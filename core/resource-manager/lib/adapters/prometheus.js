
const Adapter = require('./Adapter');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').AlgorithmDb;
const client = require('@hkube/prometheus-client');
var median = require('median')

class PrometheusAdapter extends Adapter {

    constructor(settings, options) {
        super(settings, options);
        client.init(options.connection);
    }

    async getData() {
        let data = this.cache.get();
        if (data) {
            return data;
        }
        else {
            let currentDate = Date.now();
            let sixHoursBefore = new Date(currentDate - (6 * 60 * 60 * 1000));

            let res = await client.range({
                query: 'algorithm_runtime_summary{quantile="0.5", algorithmName!~""}',
                start: sixHoursBefore / 1000,
                end: currentDate / 1000,
                step: 60
            });
            let arr = [];
            let algoRunTime = new Map();
            res.data.result.forEach(algorithm => {
                algorithm.values.forEach(slice => {
                    if (algoRunTime.has(algorithm.metric.algorithmName)) {
                        let a = algoRunTime.get(algorithm.metric.algorithmName);
                        a.push(parseFloat(slice[1]));
                    }
                    else {
                        algoRunTime.set(algorithm.metric.algorithmName, [parseFloat(slice[1])]);
                    }
                })
            });
            algoRunTime.forEach((val, key) => arr.push({ algorithmName: key, runTime: median(val) }));
            this.cache.set(arr);
            return arr;
        }
    }
}

module.exports = PrometheusAdapter;