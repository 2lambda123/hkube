const log = require('@hkube/logger').GetLogFromContainer();

class StorageFactory {
    async init(config) {
        const storage = config.storageAdapters[config.defaultStorage];
        this.moduleName = storage.moduleName;
        this.adapter = require(storage.moduleName);  // eslint-disable-line
        await this.adapter.init(storage.connection, log);
    }

    async setResultsFromStorage(options) {
        if (options.data) {
            options.data = await Promise.all(options.data.map(a => this._getStorageItem(a)));
            options.storageModule = this.moduleName;
        }
    }

    async _getStorageItem(options) {
        if (options.result && options.result.storageInfo) {
            const result = await this.adapter.get(options.result.storageInfo);
            return { ...options, result };
        }
        return { ...options };
    }
}
module.exports = new StorageFactory();
