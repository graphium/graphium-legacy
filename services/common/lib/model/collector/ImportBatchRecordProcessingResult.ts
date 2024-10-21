export interface ImportBatchRecordProcessingResult {
    flowGuid?: string,
    flowVersion?: number,
    systemFlowScriptGuid?: string,
    systemFlowScriptVersion?: number,
    result?: any,
    recordImportResult?: any,
    hasError?: boolean,
    errorMessage?: string,
    errorStack?: string
};

export default ImportBatchRecordProcessingResult;