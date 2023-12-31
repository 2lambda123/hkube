class Downloads {
    constructor(validator) {
        this._validator = validator;
    }

    validatePrepareForDownload({ dataSourceId, fileIds }) {
        this._validator.validate(
            this._validator.definitions.CreateDownloadLinkRequest,
            { dataSourceId: dataSourceId.trim(), fileIds }
        );
    }

    validateDownloadId(downloadId) {
        this._validator.validate(
            this._validator.definitions.DownloadId,
            downloadId
        );
    }
}

module.exports = Downloads;
