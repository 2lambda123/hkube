const fse = require('fs-extra');
const { Consumer } = require('@hkube/producer-consumer');
const { taskStatuses } = require('@hkube/consts');
const storageManager = require('@hkube/storage-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../consts/componentNames').JOBS_CONSUMER;
const Etcd = require('../Etcd');
const dbConnection = require('../db');
const Repository = require('../utils/Repository');
const { ResourceNotFoundError } = require('./../errors');
const { getDatasourcesInUseFolder } = require('../utils/pathUtils');
/**
 * @typedef {import('./../utils/types').config} config
 * @typedef {import('./types').onJobHandler} onJobHandler
 * @typedef {import('./types').PipelineDatasourceDescriptor} PipelineDatasourceDescriptor
 * @typedef {import('@hkube/db/lib/DataSource').FileMeta} FileMeta
 * @typedef {import('./types').Job} Job
 */

class JobConsumer {
    constructor() {
        this._inactiveTimer = null;
    }

    /**
     * Init the consumer and register for jobs, initialize connection to the state manager
     *
     * @param {config} config
     */
    async init(config) {
        this.config = config;
        this.rootDir = getDatasourcesInUseFolder(config);
        await fse.ensureDir(this.rootDir);
        const { type, prefix } = config.jobs.consumer;
        const consumerSettings = {
            job: { type, prefix },
            setting: {
                redis: config.redis,
                prefix,
            },
        };
        this.state = new Etcd(config);
        this.consumer = new Consumer(consumerSettings);
        this.consumer.register(consumerSettings);
        /** @type {import('@hkube/db/lib/MongoDB').ProviderInterface} */
        this.db = dbConnection.connection;
        await this.state.startWatch();
        this.consumer.on(
            'job',
            /** @type {onJobHandler} */
            async job => {
                await this.fetchDataSource(job.data);
                job.done(); // send job done to redis
            }
        );

        this.state.onDone(job => {
            this.unmountDataSource(job.jobId);
        });
    }

    handleFail({ jobId, taskId, error }) {
        log.error(error, { component, taskId });
        return this.state.update({
            jobId,
            taskId,
            endTime: Date.now(),
            status: taskStatuses.FAILED,
            error,
        });
    }

    setActive(job) {
        return this.state.set({
            ...job,
            podName: this.config.podName,
            startTime: Date.now(),
            status: taskStatuses.ACTIVE,
        });
    }

    /** @param {Job} props */
    async fetchDataSource({ dataSource: dataSourceDescriptor, ...job }) {
        const { taskId } = job;
        log.info(`got job, starting to fetch dataSource`, {
            component,
            taskId,
        });
        await this.setActive(job);

        let dataSource;
        const { snapshot } = dataSourceDescriptor;

        let resolvedSnapshot;
        try {
            if (snapshot) {
                resolvedSnapshot = await this.db.snapshots.fetchDataSource({
                    snapshotName: snapshot.name,
                    dataSourceName: dataSourceDescriptor.name,
                });
                if (!resolvedSnapshot)
                    throw new ResourceNotFoundError(
                        'snapshot',
                        `${dataSourceDescriptor.name}:${snapshot.name}`
                    );
                dataSource = resolvedSnapshot.dataSource;
            } else {
                const shouldGetLatest = !dataSourceDescriptor.version;
                dataSource = await this.db.dataSources.fetch(
                    shouldGetLatest
                        ? { name: dataSourceDescriptor.name }
                        : { id: dataSourceDescriptor.version }
                );
            }
        } catch (e) {
            return this.handleFail({ ...job, error: e.message });
        }

        const repository = new Repository(
            dataSource.name,
            this.config,
            `${this.rootDir}/${dataSource.name}/${dataSource.id}`
        );

        try {
            log.info(`starting to clone dataSource ${dataSource.name}`, {
                component,
                taskId,
            });
            await repository.ensureClone(dataSource.commitHash);
            await repository.pullFiles();
        } catch (e) {
            return this.handleFail({
                ...job,
                error: `could not clone the datasource ${dataSource.name}. ${e.message}`,
            });
        }

        if (resolvedSnapshot) {
            await repository.filterFilesFromClone(
                resolvedSnapshot.droppedFiles
            );
            await repository.filterMetaFilesFromClone();
            await this.storeResult({
                payload: { snapshotId: resolvedSnapshot.id },
                ...job,
            });
        } else {
            await this.storeResult({
                payload: { dataSourceId: dataSource.id },
                dataSource,
                ...job,
            });
        }

        log.info(
            `successfully cloned and stored dataSource ${dataSource.name}`,
            { component, taskId }
        );
        return null;
    }

    /** @param {{ payload: { dataSourceId?: string; snapshotId?: string } } & Job} props */
    async storeResult({ payload, dataSource, ...job }) {
        const { jobId, taskId } = job;
        try {
            /** @type {{ path: string }} */
            const storageInfo = await storageManager.hkube.put({
                jobId,
                taskId,
                data: payload,
            });

            await this.state.update({
                ...job,
                status: taskStatuses.STORING,
                result: { storageInfo },
            });

            await this.state.update({
                ...job,
                endTime: Date.now(),
                status: taskStatuses.SUCCEED,
            });
        } catch (e) {
            return this.handleFail({
                ...job,
                error: `failed storing datasource ${dataSource.name}. ${e.message}`,
            });
        }
        return null;
    }

    unmountDataSource(jobId) {
        return fse.remove(`${this.rootDir}/${jobId}`);
    }
}

module.exports = new JobConsumer();