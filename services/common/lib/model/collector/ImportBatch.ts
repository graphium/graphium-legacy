import { ImportBatchRecord } from "./ImportBatchRecord";

export enum ImportBatchStatus {
    PendingGeneration = 'pending_generation',
    Generating = 'generating',
    GenerationError = 'generation_error',
    Triage = 'triage',
    Processing = 'processing',
    PendingReview = 'pending_review',
    Complete = 'complete',
    Discarded = 'discarded'
}

export enum ImportBatchSource {
    Fax = 'fax',
    FTP = 'ftp',
    Manual = 'manual',
    ExternalWebForm = 'external_web_form'
}

export enum ImportBatchDataType {
    PDF = 'pdf',
    DSV = 'dsv',
    HAGY = 'hagy',
    HCAADVANTX = 'hcaAdvantx',
    MEDAXION = 'medaxion',
    None = 'none'
}

export interface BatchSourceFaxIds {
    importFaxLineGuid: string;
    importFaxGuid: string;
}

export interface BatchSourceFtpIds {
    ftpSiteGuid: string;
    ftpFileGuid: string;
}

export interface BatchSourceManualIds {
    userName: string;
}

export interface BatchSourceExternalWebFormIds {
    externalWebFormGuid: string;
}

export interface DsvBatchDataTypeOptions {
    delimiter: 'tab' | 'comma' | 'pipe' | 'colon';
    hasHeader: boolean;
    columnNames: string[] | null;
    columnTitles: string[] | null;
    linesToSkip: number | null;
    skipEmptyLines: boolean;
    skipLinesWithEmptyValues: boolean;
    relaxColumnCount: boolean;
}

export interface ImportBatch {
    batchName: string;
    searchKey?: string;
    orgInternalName: string;
    facilityId: number;
    batchSource: ImportBatchSource;
    batchSourceIds: BatchSourceFaxIds | BatchSourceFtpIds | BatchSourceManualIds | BatchSourceExternalWebFormIds;
    batchDataType: ImportBatchDataType;
    requiresDataEntry: boolean;
    assignedTo: string | null;
    processingType: 'flow';
    flowGuid: string;
    batchTemplateGuid: string | null;
    batchDataTypeOptions: DsvBatchDataTypeOptions | null;
    batchData: Buffer | string | null;
    importBatchGuid: string;
    createdAt: number;
    lastUpdatedAt: number;
    receivedAt: number;
    batchStatus: ImportBatchStatus;
    dataEntryFormDefinitionName: string | null;
    discardReason?: string;
    completedAt?: number;
    records?: ImportBatchRecord[];
}

export default ImportBatch;