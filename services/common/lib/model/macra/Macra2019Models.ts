import EncounterFormImportResult from "../flow/EncounterFormImportResult";

export interface Macra2019CaseData {
    encounterId:number;
    encounterNumber:string;
    encounterFormId:number;
    formCompletePct:number;
    facilityId:number;
    dos:string;
    anesStartDate:string;
    anesStartTime:string;
    anesEndDate:string;
    anesEndTime:string;
    qcdrEvalResult?:Macra2019EvaluationResult;
    qcdrEvalResultProjected?:Macra2019EvaluationResult;
    qcdrMissingDataCount:number;
    qcdrEvalDateTime:string;
    importResult:EncounterFormImportResult;
    surgeonProvider:Macra2019CaseDataSurgeonProvider;
    anesProviders:Macra2019CaseDataAnesthesiaProvider[];
}

export interface Macra2019CaseDataSurgeonProvider {
    providerId: number;
    providerName: string;
}

export interface Macra2019CaseDataAnesthesiaProvider {
    providerId: number;
    providerType: string;
    providerName: string;
}

export interface Macra2019Measure {
    name: string;
    eligible: number;
    exception: number;
    perfMet: number;
    perfNotMet: number;
    qualDataCds: string[];
    measRespCds: string[];
    orObsCodes: string[];
    unspObsCodes: string[];
    missingFields: string[];
}

export interface Macra2019EvaluationResult {
    qualDataCds: string[];
    measRespCds: string[];
    orObsCodes: string[];
    unspObsCodes: string[];
    cptCodes: string[];
    measures:Macra2019Measure[];
    admissible: boolean;
    errors: string[];
    qcdrVersion: "ABG.2019.1.0";
    evalTimestamp: string;
    evalEnctrFormVer: number;
}

export interface AbgQcdrMeasure2019 {
    name: string;
    label: string;
    measureNumber: number;
    displayOrder: number;
    inverted: boolean;
}

export interface AbgMeasureCalculatedMean2019 {
    measureDefinition:AbgQcdrMeasure2019;
    mean:number;
    numerator:number;
    denominator:number;
}