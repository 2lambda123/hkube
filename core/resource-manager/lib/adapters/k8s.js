
const Api = require('kubernetes-client');
const Adapter = require('./Adapter');
const parse = require('parseunit');

class K8sAdapter extends Adapter {

    constructor(settings, options) {
        super(settings);
        if (options.k8s.local) {
            this._client = new Api.Core(Api.config.fromKubeconfig());
        }
        else {
            this._client = new Api.Core(Api.config.getInCluster());
        }
    }

    async getData() {
        let nodes = await this._client.nodes.get();
        let pods = await this._client.pods.get();
        let nodeSpec = new Map();
        pods.items.forEach(pod => {
            if (nodeSpec.has(pod.spec.nodeName)) {
                let containers = nodeSpec.get(pod.spec.nodeName);
                pod.spec.containers.forEach((container) => {
                    containers.push(container);
                });
            }
            else {
                nodeSpec.set(pod.spec.nodeName, pod.spec.containers);
            }
        });
        let nodeResourcesInUse = new Map();
        nodeSpec.forEach((containers, node) => {
            let cpuRequests = 0;
            let memoryRequests = 0;
            containers.forEach((container) => {
                if (container.resources.requests != undefined) {
                    let cpu = container.resources.requests.cpu;
                    let memory = container.resources.requests.memory;
                    if (cpu)
                        cpuRequests += parse.parseUnitObj(cpu).val;
                    if (memory)
                        memoryRequests += parse.parseUnitObj(memory).val;
                }
            });
            nodeResourcesInUse.set(node, { cpuRequests, memoryRequests });
        });

        let resourcesStatus = new Map();
        nodes.items.forEach((node) => {
            let nodeName = node.metadata.name;
            let freeCpu = parse.parseUnitObj(node.status.allocatable.cpu).val - nodeResourcesInUse.get(nodeName).cpuRequests;
            let freeMemory = parse.parseUnitObj(node.status.allocatable.memory).val - nodeResourcesInUse.get(nodeName).memoryRequests;
            resourcesStatus.set(nodeName, { freeCpu, freeMemory })
        });
        return resourcesStatus;
    }
}

module.exports = K8sAdapter;