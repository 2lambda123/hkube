const stateManager = require('./states/stateManager');
const jobConsumer = require('./consumer/JobConsumer');
const algoRunnerCommunication = require('./algorunnerCommunication/workerCommunication');
const discovery = require('./states/discovery');
const Logger = require('@hkube/logger');
let log;
const { stateEvents } = require('../common/consts/events');
const { workerStates } = require('../common/consts/states');
const messages = require('./algorunnerCommunication/messages');
const component = require('../common/consts/componentNames').WORKER;

const DEFAULT_STOP_TIMEOUT = 5000;
class Worker {
    constructor() {
        this._stopTimeout = null;
    }

    preInit() {
        log = Logger.GetLogFromContainer();
        this._registerToConnectionEvents();
    }

    async init(options) {
        this._registerToCommunicationEvents();
        this._registerToStateEvents();
        this._registerToEtcdEvents();
        this._stopTimeoutMs = options.timeouts.stop || DEFAULT_STOP_TIMEOUT;
        this._inactiveTimeoutMs = options.timeouts.inactive || 0;
    }

    _registerToEtcdEvents() {
        discovery.on('stop', (res) => {
            log.info(`got stop for ${res}`, { component });
            stateManager.stop();
        });
    }

    _registerToConnectionEvents() {
        algoRunnerCommunication.on('connection', () => {
            log.info('starting bootstrap state', { component });
            stateManager.bootstrap();
            log.info('finished bootstrap state', { component });
        });
        algoRunnerCommunication.on('disconnect', () => {
            log.warning('algorithm runner has disconnected', { component });
            stateManager.reset();
        });
    }

    _registerToCommunicationEvents() {
        algoRunnerCommunication.on(messages.incomming.initialized, () => {
            stateManager.start();
        });
        algoRunnerCommunication.on(messages.incomming.done, (message) => {
            stateManager.done(message);
        });
        algoRunnerCommunication.on(messages.incomming.stopped, (message) => {
            if (this._stopTimeout) {
                clearTimeout(this._stopTimeout);
            }
            stateManager.done(message);
        });
        algoRunnerCommunication.on(messages.incomming.progress, (message) => {
            if (message.data) {
                log.debug(`progress: ${message.data.progress}`, { component });
            }
        });
        algoRunnerCommunication.on(messages.incomming.error, (message) => {
            log.error(`got error from algorithm. Error: ${message.error}`, { component });
            stateManager.done(message);
        });
    }

    _registerToStateEvents() {
        stateManager.on(stateEvents.stateEntered, async ({ job, state, results }) => {
            let pendingTransition = null;
            log.info(`Entering state: ${state}`);
            const result = { state, results };
            if (state === workerStates.ready) {
                if (this._inactiveTimer) {
                    clearTimeout(this._inactiveTimer);
                }
                if (this._inactiveTimeoutMs !== 0 && this._inactiveTimeoutMs !== '0') {
                    log.info('starting inactive timeout for worker');
                    this._inactiveTimer = setTimeout(() => {
                        log.info(`worker is inactive for more than ${this._inactiveTimeoutMs / 1000} seconds.`);
                        process.exit(0);
                    }, this._inactiveTimeoutMs);
                }
            }
            else if (this._inactiveTimer) {
                log.info(`worker is active (${state}). Clearing inactive timeout`);
                clearTimeout(this._inactiveTimer);
            }
            switch (state) {
                case workerStates.results:
                    await jobConsumer.finishJob(result);
                    pendingTransition = stateManager.cleanup.bind(stateManager);
                    break;
                case workerStates.ready:
                    break;
                case workerStates.init: {
                    const { error, data } = await jobConsumer.extractData(job.data);
                    if (!error) {
                        algoRunnerCommunication.send({
                            command: messages.outgoing.initialize,
                            data
                        });
                    }
                    break;
                }
                case workerStates.working:
                    algoRunnerCommunication.send({
                        command: messages.outgoing.start
                    });
                    break;
                case workerStates.shutdown:
                    break;
                case workerStates.error:
                    break;
                case workerStates.stop:
                    this._stopTimeout = setTimeout(() => {
                        log.error('Timeout exceeded trying to stop algorithm.', { component });
                        stateManager.done('Timeout exceeded trying to stop algorithm');
                    }, this._stopTimeoutMs);
                    algoRunnerCommunication.send({
                        command: messages.outgoing.stop
                    });
                    break;
                default:
            }
            jobConsumer.updateDiscovery(result);
            if (pendingTransition) {
                pendingTransition();
            }
        });
    }
}

module.exports = new Worker();
