import EncounterFormImportResult from '../flow/EncounterFormImportResult';

export interface Macra2017CaseData {
    encounterId:number;
    encounterNumber:string;
    encounterFormId:number;
    facilityId:number;
    dos:string;
    anesStartDate:string;
    anesStartTime:string;
    anesEndDate:string;
    anesEndTime:string;
    qcdrEvalResult?:Macra2017EvaluationResult;
    qcdrMissingDataCount:number;
    qcdrEvalDateTime:string;
    importResult:EncounterFormImportResult;
    surgeonProvider:Macra2017CaseDataSurgeonProvider;
    anesProviders:Macra2017CaseDataAnesthesiaProvider[];
}


export interface Macra2017CaseDataSurgeonProvider {
    providerId: number;
    providerName: string;
}


export interface Macra2017CaseDataAnesthesiaProvider {
    providerId: number;
    providerType: string;
    providerName: string;
}

export interface Macra2017EvaluationResult {
    orEventCodes: string[];
    measureEventCodes: number[];
    measures:Array<{
        name: string;
        d: number;
        n: number;
        missing?: string[];
    }>;
    admissible: boolean;
    missing: string[];
    errors: string[];
    qcdrVersion: "ABG.2017.1.0";
}

export interface AbgQcdrMeasure2017 {
    name: string;
    label:string;
    measureNumber: number;
    displayOrder: number;
    inverted: boolean;
}

export interface AbgMeasureCalculatedMean2017 {
    measureDefinition:AbgQcdrMeasure2017;
    mean:number;
    numerator:number;
    denominator:number;
}