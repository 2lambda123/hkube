const rp = require('request-promise');
const log = require('@hkube/logger').GetLogFromContainer();
const { boardStatuses } = require('@hkube/consts');
const db = require('../helpers/db');
const { createKindsSpec } = require('../deployments/optunaboard');
const kubernetes = require('../helpers/kubernetes');
const { normalizeOptunaboardDeployments } = require('./normalize');
const deploymentType = require('../consts/DeploymentTypes').OPTUNABOARD;
const _createBoardDeployment = async (deploymentDetails) => {
    const { versions, registry, clusterOptions, options, board } = deploymentDetails;
    const { boardReference, logDir, id } = board;
    const { deploymentSpec, serviceSpec, ingressSpec } = createKindsSpec({ id, boardReference, logDir, versions, registry, clusterOptions, options });
    await kubernetes.deployExposedPod({ deploymentSpec, ingressSpec, serviceSpec, name: boardReference }, deploymentType);
    board.status = boardStatuses.CREATING;
    board.timestamp = Date.now();
    await db.updateOptunaboard(board);
};

const reconcile = async ({ boards, deployments, versions, registry, clusterOptions, boardTimeOut, options }) => {
    const normDeployments = normalizeOptunaboardDeployments(deployments);
    const pending = boards.filter(b => b.status === boardStatuses.PENDING);
    const added = pending.filter(a => !normDeployments.find(d => d.boardReference === a.boardReference));
    const now = Date.now();
    const timedOut = boards.filter(b => ((b.startTime + boardTimeOut) < now));
    await Promise.all(timedOut.map(board => (db.deleteOptunaboard(board))));
    const boardsLeft = boards.filter(board => (timedOut.indexOf(board) === -1));
    const removed = normDeployments.filter(a => !boardsLeft.find(d => d.boardReference === a.boardReference));
    await Promise.all(added.map(a => _createBoardDeployment({ board: a, versions, registry, clusterOptions, options })));
    await Promise.all(removed.map(a => kubernetes.deleteExposedDeployment(a.boardReference, deploymentType)));
};

const updateOptunaboards = async () => {
    const boards = await db.getOptunaboards();
    const creating = boards.filter(b => b.status === boardStatuses.CREATING);
    await Promise.all(creating.map(async (board) => {
        const url = `http://board-service-${board.boardReference}.${kubernetes.namespace}.svc`;
        try {
            const result = await rp({ uri: url, resolveWithFullResponse: true });
            await db.updateOptunaboard({ ...board, status: boardStatuses.RUNNING, timestamp: Date.now() });
            return { code: result.statusCode };
        }
        catch (error) {
            log.debug(`${url} ${error.message}`);
            return error.statusCode;
        }
    }));
};
module.exports = {
    reconcile, updateOptunaboards
};
