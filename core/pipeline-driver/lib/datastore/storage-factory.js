const log = require('@hkube/logger').GetLogFromContainer();

class DatastoreFactory {
    async getAdapter(config) {
        const storage = config.storageAdapters[config.defaultStorage];
        const adapter = require(storage.moduleName);  // eslint-disable-line
        await adapter.init(storage.connection, log);
        return adapter;
    }
}
module.exports = new DatastoreFactory();
