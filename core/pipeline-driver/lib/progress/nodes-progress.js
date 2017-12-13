const stateManager = require('lib/state/state-manager');

const levels = {
    silly: 'silly',
    debug: 'debug',
    info: 'info',
    warning: 'warning',
    error: 'error',
    critical: 'critical'
};

class ProgressManager {

    calcMethod(method) {
        this._calc = method;
    }

    silly(data) {
        this._progress(levels.silly, data);
    }

    debug(data) {
        this._progress(levels.debug, data);
    }

    info(data) {
        this._progress(levels.info, data);
    }

    warning(data) {
        this._progress(levels.warning, data);
    }

    error(data) {
        this._progress(levels.error, data);
    }

    critical(data) {
        this._progress(levels.critical, data);
    }

    _progress(level, { jobId, status, error }) {
        let progress = 0;
        let details = '';
        if (this._calc) {
            const data = this._calc();
            progress = data.progress;
            details = data.details;
        }
        stateManager.setJobStatus({ jobId, data: { level, status, error, progress, details } });
    }
}

module.exports = new ProgressManager();