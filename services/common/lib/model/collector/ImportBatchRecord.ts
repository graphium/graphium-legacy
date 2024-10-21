import * as Joi from 'joi';
import { ImportBatch } from './ImportBatch';

export enum ImportBatchRecordStatus {
    PendingDataEntry = 'pending_data_entry',
    Discarded = 'discarded',
    PendingProcessing = 'pending_processing',
    Processing = 'processing',
    ProcessingComplete = 'processing_complete',
    Ignored = 'ignored',
    PendingReview = 'pending_review'
}

export enum ImportBatchRecordDataType {
    DsvRow = 'dsv_row',
    PdfBitmapPages = 'pdf_bitmap_pages',
    ExternalWebForm = 'external_web_form',
    HagyRecord = 'hagy_record',
    HcaAdvantxRecord = 'hca_advantx_record',
    MedaxionRecord = 'medaxtion_record'
}

export type RecordDataTypes = DsvRowData | PdfBitmapPageData[] | ExternalWebFormData | HagyRecordData | HcaAdvantxRecordData | MedaxionRecordData;

export interface ImportBatchRecord {
    importBatchRecordGuid: string;
    importBatch?:ImportBatch;
    searchKey?: string;
    importBatchGuid: string;
    orgInternalName: string;
    facilityId: number;
    recordDataType: ImportBatchRecordDataType;
    recordData: RecordDataTypes;
    recordIndex: number;
    recordOrder: number;
    recordStatus: ImportBatchRecordStatus;
    notes?: string[];
    dataEntryBy?: string[],
    dataEntryData?: { [name: string]: any };
    createdAt: number;
    lastUpdatedAt: number;
    completedAt?: number;
    dataEntryErrorFields: string[],
    dataEntryInvalidFields: string[],
    dataEntryDataIndicated: boolean,
    responsibleProviderIds?: number[],
    primaryResponsibleProviderId?: number,
    discardReason?: string,
    pageUpdateResults?: {[pageName:string]: {
        lastUpdated: number,
        reporterName: string
    }}
}

export interface DsvRowData {
    headers: string[];
    data: any[];
}

export interface PdfBitmapPageData {
    bitmapBase64: string;
    encoding: 'png';
}

export interface ExternalWebFormData {
    sourceData: any;
    formDefinitionName: string;
    recordId: string;
    caseId: string;
}

export interface HagyRecordData {
    sourceData: string[];
    parsedData: any;
}

export interface HcaAdvantxRecordData {
    sourceData: string[];
    parsedData: any;
}

export interface MedaxionRecordData {
    sourceData: string[];
    parsedData: any;
}

export function validateNewImportBatchRecord(importBatchRecord:ImportBatchRecord):boolean {
    var schema = {
        importBatchRecordGuid: Joi.string().guid().required(),
        importBatchGuid: Joi.string().guid().required(),
        orgInternalName: Joi.string().required(),
        searchKey: Joi.string().optional(),
        secondarySearchKey: Joi.string().optional(),
        facilityId: Joi.number().integer(),
        recordDataType: Joi.string().valid(['dsv_row', 'pdf_bitmap_pages','external_web_form']),
        dataEntryErrorFields: Joi.array().length(0),
        dataEntryInvalidFields: Joi.array().length(0),
        responsibleProviderIds: Joi.array().length(0),
        primaryResponsibleProviderId: Joi.number().allow(null).optional(),
        dataEntryDataIndicated: Joi.boolean().required(),
        dataEntryData: Joi.forbidden(),
        formServiceDate: Joi.string().regex(/^((0?[1-9]|1[012])[- /.](0?[1-9]|[12][0-9]|3[01])[- /.](19|20)?[0-9]{2})*$/,'date').allow(null).optional(),
        recordData: Joi.when('recordDataType', {
                is: 'dsv_row',
                then: Joi.object({
                    headers: Joi.array(),
                    data: Joi.array()
                }).required()
            })
            .when('recordDataType', {
                is: 'pdf_bitmap_pages',
                then: Joi.array().items(Joi.object({
                    bitmapBase64: Joi.string().required(),
                    encoding: Joi.string().valid(['png'])
                })).required()
            })
            .when('recordDataType', {
                is: 'external_web_form',
                then: Joi.object({
                    sourceData: Joi.object().required(),
                    formDefinitionName: Joi.string().required(),
                    recordId: Joi.string().required(),
                    caseId: Joi.string().optional()
                }).required()
            })
            .when('recordDataType', {
                is: 'hagy_record',
                then: Joi.object({
                    recordSet: Joi.object().required()
                }).required()
            })
            .when('recordDataType', {
                is: 'hca_advantx_record',
                then: Joi.object({
                    recordSet: Joi.object().required()
                }).required()
            })
            .when('recordDataType', {
                is: 'medaxion_record',
                then: Joi.object({
                    recordSet: Joi.object().required()
                }).required()
            }),
        recordIndex: Joi.number().integer().required(),
        recordOrder: Joi.number().integer().required(),
        recordStatus: Joi.string().valid(['pending_data_entry', 'pending_processing']),
        discardReason: Joi.string().forbidden(),
        notes: Joi.array().length(0),
        dataEntryBy: Joi.array().length(0),
        createdAt: Joi.number().required(),
        lastUpdatedAt: Joi.number().required(),
        completedAt: Joi.number().forbidden()
    }

    var validationResult = Joi.validate(importBatchRecord, schema, {
        abortEarly: false,
        convert: false
    });

    if (validationResult.error) {
        throw validationResult.error;
    }
    else {
        return true;
    }
}

export default ImportBatchRecord;