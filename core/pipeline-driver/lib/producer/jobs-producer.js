const EventEmitter = require('events');
const { Producer } = require('@hkube/producer-consumer');
const { tracer } = require('@hkube/metrics');
const { nodeKind } = require('@hkube/consts');
const logger = require('@hkube/logger');
const { uid } = require('@hkube/uid');
const stateManager = require('../state/state-manager');
const log = logger.GetLogFromContainer();
const component = require('../consts/componentNames').JOBS_PRODUCER;

class JobProducer extends EventEmitter {
    constructor() {
        super();
        this._producer = null;
    }

    async init(option) {
        const options = option || {};
        this._options = options.jobs;
        this._producer = new Producer({
            setting: {
                tracer,
                redis: options.redis,
                ...this._options.producer
            }
        });
        this._queueLogging = options.logging;
    }

    async createJob({ jobId, pipeline, options, batch }) {
        // TODO: Need to migrate tasks from ETCD to DB
        if (options.node.kind === nodeKind.DataSource) {
            const jobOptions = {
                prefix: this._options.producerDataSources.prefix,
                type: this._options.producerDataSources.type,
                data: {
                    jobId,
                    taskId: options.node.taskId,
                    nodeName: options.node.nodeName,
                    dataSource: options.node.spec
                }
            };
            await this._createJob(jobOptions);
        }
        else {
            let tasks = [];
            if (batch) {
                tasks = batch.map(b => ({ taskId: b.taskId, status: b.status, input: b.input, batchIndex: b.batchIndex, storage: b.storage }));
            }
            else {
                tasks.push({ taskId: options.node.taskId, status: options.node.status, input: options.node.input, storage: options.storage });
            }
            const id = uid({ length: 8 });
            const job = {
                nodeName: options.node.nodeName,
                algorithmName: options.node.algorithmName,
                metrics: options.node.metrics,
                ttl: options.node.ttl,
                retry: options.node.retry,
                pipelineName: pipeline.name,
                stateType: options.node.stateType,
                priority: pipeline.priority,
                kind: pipeline.kind,
                parents: options.parents,
                childs: options.childs,
                parsedFlow: pipeline.streaming?.parsedFlow,
                defaultFlow: pipeline.streaming?.defaultFlow,
                spec: options.node.spec,
                info: {
                    extraData: options.node.extraData,
                    savePaths: options.paths,
                    lastRunResult: pipeline.lastRunResult,
                    rootJobId: pipeline.rootJobId
                }
            };
            const jobOptions = {
                type: options.node.algorithmName,
                data: {
                    id,
                    jobId
                }
            };
            if (this._queueLogging.tasks) {
                tasks.forEach(t => log.info(`task ${t.taskId} created`, { component, jobId, taskId: t.taskId, algorithmName: options.node.algorithmName }));
            }
            await this._createTasks({ id, jobId, tasks, job });
            await this._createJob(jobOptions);
        }
    }

    async _createTasks({ id, jobId, tasks, job }) {
        const tasksList = tasks.map(task => {
            return {
                id,
                jobId,
                ...task,
                ...job
            };
        });
        await stateManager.createTasks(tasksList);
    }

    async _createJob(options) {
        const opt = {
            job: {
                type: options.type,
                prefix: options.prefix,
                data: options.data
            }
        };
        if (options.data && options.data.jobId) {
            const topSpan = tracer.topSpan(options.data.jobId);
            if (topSpan) {
                opt.tracing = {
                    parent: topSpan.context(),
                    tags: {
                        jobId: options.data.jobId
                    }
                };
            }
        }
        await this._producer.createJob(opt);
    }
}

module.exports = new JobProducer();
