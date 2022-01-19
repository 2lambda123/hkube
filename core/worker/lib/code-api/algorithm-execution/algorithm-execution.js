const Validator = require('ajv');
const Logger = require('@hkube/logger');
const { tracer } = require('@hkube/metrics');
const { uid } = require('@hkube/uid');
const { taskStatuses, retryPolicy } = require('@hkube/consts');
const algoRunnerCommunication = require('../../algorithm-communication/workerCommunication');
const stateAdapter = require('../../states/stateAdapter');
const messages = require('../../algorithm-communication/messages');
const { taskEvents, Components } = require('../../consts');
const jobConsumer = require('../../consumer/JobConsumer');
const producer = require('../../producer/producer');
const { startAlgorithmSchema, stopAlgorithmSchema } = require('./schema');
const validator = new Validator({ useDefaults: true, coerceTypes: false });
const component = Components.ALGORITHM_EXECUTION;
const NO_RETRY = { policy: retryPolicy.Never };

let log;

class AlgorithmExecution {
    init() {
        log = Logger.GetLogFromContainer();
        this._watching = false;
        this._executions = new Map();
        this._startAlgorithmSchema = validator.compile(startAlgorithmSchema);
        this._stopAlgorithmSchema = validator.compile(stopAlgorithmSchema);
        this._registerToEtcdEvents();
        this._registerToAlgorithmEvents();
    }

    setStorageType(type) {
        const execAlgorithms = require(`./algorithm-execution-${type}`); // eslint-disable-line
        this._getStorage = (...args) => execAlgorithms.getResultFromStorage(...args);
        this._setStorage = (...args) => execAlgorithms.setInputToStorage(...args);
    }

    _registerToEtcdEvents() {
        stateAdapter.on(taskEvents.FAILED, (task) => {
            this._sendErrorToAlgorithm(task);
            this._finishAlgoExecSpan(task.taskId);
            this._deleteExecution(task.taskId);
        });
        stateAdapter.on(taskEvents.STALLED, (task) => {
            this._sendErrorToAlgorithm(task);
            this._finishAlgoExecSpan(task.taskId);
            this._deleteExecution(task.taskId);
        });
        stateAdapter.on(taskEvents.CRASHED, (task) => {
            this._sendErrorToAlgorithm(task);
            this._finishAlgoExecSpan(task.taskId);
            this._deleteExecution(task.taskId);
        });
        stateAdapter.on(taskEvents.SUCCEED, (task) => {
            this._sendDoneToAlgorithm(task);
            this._finishAlgoExecSpan(task.taskId);
            this._deleteExecution(task.taskId);
        });
        stateAdapter.on(taskEvents.STORING, (task) => {
            this._onStoring(task);
        });
    }

    _registerToAlgorithmEvents() {
        algoRunnerCommunication.on(messages.incomming.startAlgorithmExecution, (message) => {
            this._startAlgorithmExecution(message);
        });
        algoRunnerCommunication.on(messages.incomming.stopAlgorithmExecution, (message) => {
            this._stopAlgorithmExecution(message);
        });
    }

    _deleteExecution(taskId) {
        this._executions.delete(taskId);
    }

    _onStoring(task) {
        const execution = this._executions.get(task.taskId);
        if (!execution) {
            return;
        }
        this._executions.set(task.taskId, { ...execution, result: task.result });
    }

    async _sendDoneToAlgorithm(task) {
        const execution = this._executions.get(task.taskId);
        if (!execution) {
            return;
        }
        const { includeResult, result, execId } = execution;
        const response = await this._getStorage({ includeResult, result });
        log.debug(`sending done from ${task.taskId} to algorithm`, { component });
        this._sendCompleteToAlgorithm({ execId, response, command: messages.outgoing.execAlgorithmDone });
    }

    _sendErrorToAlgorithm(task) {
        const execution = this._executions.get(task.taskId);
        if (task.taskId && !execution) {
            return;
        }
        const { error, execId, taskId } = task;
        log.info(`sending error from ${taskId} to algorithm, error: ${error}`, { component });
        this._sendCompleteToAlgorithm({ execId, error, command: messages.outgoing.execAlgorithmError });
    }

    _sendCompleteToAlgorithm({ command, execId, error, response }) {
        algoRunnerCommunication.send({
            command,
            data: {
                execId,
                response,
                error
            }
        });
    }

    async _unWatchTasks({ jobId }) {
        if (this._watching) {
            this._watching = false;
            await stateAdapter.unWatchTasks({ jobId });
        }
    }

    async _watchTasks({ jobId }) {
        if (!this._watching) {
            this._watching = true;
            await stateAdapter.watchTasks({ jobId });
        }
    }

    _findTaskByExecId(execId) {
        return [...this._executions.values()].find(t => t.execId === execId);
    }

    async stopAllExecutions({ jobId }) {
        let response = null;
        if (this._stopping || !jobId) {
            return response;
        }
        try {
            this._stopping = true;
            await this._unWatchTasks({ jobId });

            if (this._executions.size === 0) {
                return response;
            }
            log.info(`stopping ${this._executions.size} executions`, { component });
            response = await Promise.all([...this._executions.keys()].map(taskId => stateAdapter.stopAlgorithmExecution({ jobId, taskId })));
        }
        catch (e) {
            log.warning(`failed to stop executions: ${e.message}`, { component });
        }
        finally {
            this._executions.forEach(e => this._finishAlgoExecSpan(e.taskId));
            this._executions.clear();
            this._stopping = false;
        }
        return response;
    }

    async _stopAlgorithmExecution(message) {
        let execId;
        try {
            const data = (message && message.data) || {};
            execId = data.execId;
            const valid = this._stopAlgorithmSchema(data);
            if (!valid) {
                throw new Error(validator.errorsText(this._stopAlgorithmSchema.errors));
            }
            const task = this._findTaskByExecId(execId);
            if (!task) {
                throw new Error(`unable to find execId ${execId}`);
            }
            const { jobId } = jobConsumer.jobData;
            this._finishAlgoExecSpan(task.taskId);
            await stateAdapter.stopAlgorithmExecution({ jobId, taskId: task.taskId, reason: data.reason });
        }
        catch (e) {
            this._sendErrorToAlgorithm({ execId, error: e.message });
        }
    }

    async _startAlgorithmExecution(message) {
        let execId;
        try {
            const data = (message && message.data) || {};
            execId = data.execId;
            const valid = this._startAlgorithmSchema(data);
            if (!valid) {
                throw new Error(validator.errorsText(this._startAlgorithmSchema.errors));
            }
            const taskByExec = this._findTaskByExecId(execId);
            if (taskByExec) {
                throw new Error(`execution ${execId} already running`);
            }
            const { jobData } = jobConsumer;
            if (!jobData.jobId) {
                throw new Error('execution cannot start in this state');
            }

            const { jobId, nodeName } = jobData;
            const parentAlgName = jobData.algorithmName;
            const { algorithmName, input, includeResult, storageInput, storage = {} } = data;
            const algos = await stateAdapter.getExistingAlgorithms();
            if (!algos.find(algo => algo.name === algorithmName)) {
                throw new Error(`Algorithm named '${algorithmName}' does not exist`);
            }
            const taskId = producer.createTaskID();
            log.info(`startAlgorithmExecution for ${algorithmName} with ${taskId}`, { component });
            this._executions.set(taskId, { taskId, execId, includeResult });
            const newInput = await this._setStorage({ input, storage, jobId, storageInput });

            const newNodeName = `${nodeName}:${algorithmName}`;
            this._startExecAlgoSpan(jobId, taskId, algorithmName, parentAlgName, nodeName);
            await this._watchTasks({ jobId });
            const id = uid({ length: 8 });

            await stateAdapter.updateTask({
                ...jobData,
                id,
                jobId,
                taskId,
                execId,
                input: newInput,
                storage,
                parentNodeName: nodeName,
                algorithmName,
                nodeName: newNodeName,
                status: taskStatuses.CREATING,
                retry: NO_RETRY,
                info: {
                    ...jobData.info,
                    extraData: undefined
                },
            });
            await this._createJob({ id, jobId, taskId, algorithmName });
        }
        catch (e) {
            this._sendErrorToAlgorithm({ execId, error: e.message });
        }
    }

    _createJob({ id, jobId, taskId, algorithmName }) {
        const topSpan = tracer.topSpan(taskId);
        let tracing;
        if (topSpan) {
            tracing = {
                parent: topSpan.context(),
                tags: {
                    jobId
                }
            };
        }
        return producer.createJob({ id, jobId, algorithmName, tracing });
    }

    _startExecAlgoSpan(jobId, taskId, algorithmName, parentAlgName, nodeName) {
        try {
            const name = `${nodeName}:${parentAlgName} executing ${algorithmName}`;
            const spanOptions = {
                name,
                id: taskId,
                tags: {
                    jobId,
                    taskId
                }
            };

            const topWorkerSpan = tracer.topSpan(jobId);
            if (topWorkerSpan) {
                spanOptions.parent = topWorkerSpan.context();
            }
            tracer.startSpan(spanOptions);
        }
        catch (error) {
            log.warning(`error while staring job execution span: ${error.message}`);
        }
    }

    _finishAlgoExecSpan(taskId) {
        const execution = this._executions.get(taskId);
        if (!execution) {
            return;
        }
        const topSpan = tracer.topSpan(taskId);
        if (topSpan) {
            topSpan.finish();
        }
    }
}

module.exports = new AlgorithmExecution();
