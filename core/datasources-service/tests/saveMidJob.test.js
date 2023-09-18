const { expect } = require('chai');
const { uid: uuid } = require('@hkube/uid');
const fse = require('fs-extra');
const waitFor = require('./waitFor');
const pathLib = require('path');
const { getDatasourcesInUseFolder } = require('../lib/utils/pathUtils');
const { mockRemove, nonExistingId } = require('./utils');
const {
    createDataSource,
    createSnapshot,
    createJob,
} = require('./api');
let jobConsumer;
let storageManager;
let rootDir = null;

const waitForStatus = async ({ jobId, taskId }, status) => {
    let state = null;
    await waitFor(async () => {
        state = await jobConsumer.state.get({ jobId, taskId });
        return state.status === status;
    });
    return state;
};

describe('Save Mid Pipeline', () => {
    before(() => {
        jobConsumer = require('../lib/service/jobs-consumer');
        storageManager = require('@hkube/storage-manager');
        rootDir = getDatasourcesInUseFolder(global.testParams.config);
    
    });
    after(() => {
        fse.remove(rootDir);
    });

    it('should add new file to the dvc track', async () => {
        
    })
})