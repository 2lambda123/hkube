const config = {};

config.serviceName = 'algorithm-operator';

config.kubernetes = {
    isLocal: !!process.env.KUBERNETES_SERVICE_HOST,
    namespace: process.env.NAMESPACE || 'default'
};
config.etcd = {
    etcd: {
        protocol: 'http',
        host: process.env.ETCD_CLIENT_SERVICE_HOST || '127.0.0.1',
        port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001
    },
    serviceName: config.serviceName
};

config.intervalMs = 10000;

config.metrics = {
    collectDefault: true,
    server: {
        port: process.env.METRICS_PORT
    }
};

config.tracer = {
    tracerConfig: {
        serviceName: config.serviceName,
        reporter: {
            agentHost: process.env.JAEGER_AGENT_SERVICE_HOST || 'localhost',
            agentPort: process.env.JAEGER_AGENT_SERVICE_PORT_AGENT_BINARY || 6832
        }
    }
};

module.exports = config;
