const sources = {
    k8s: 'k8s',
    es: 'es'
};

const formats = {
    json: 'json',
    raw: 'raw'
};

const sortOrder = {
    asc: 'asc',
    desc: 'desc'
};

const containers = {
    pipelineDriver: 'pipelineDriver',
    worker: 'worker',
    algorunner: 'algorunner'
};

const components = {
    Algorunner: 'Algorunner',
    Consumer: 'Jobs-Consumer',
};

const internalLogPrefix = 'wrapper::';

const LOGS_LIMIT = 1000;

module.exports = {
  TASK_STATUS: {
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCEEDED: 'succeeded',
    FAILED: 'failed',
  },
  LOG_TYPES: {
    SYSTEM: 'system',
    TASK: 'task',
  },
  LOGS_ORDER: {
    ASC: 'asc',
    DESC: 'desc',
  },
    sources,
    formats,
    sortOrder,
    containers,
    components,
    internalLogPrefix,
    LOGS_LIMIT,
};
