export interface EncounterFormFacts2023 {
    _testId?: string;
    facilityId: number;
    encounterFormId: string;
    enctrNo: string;
    enctrPatMrn: string;
    formCmpltPct: string;
    formValidInd: boolean;
    enctrFormUpdDtUtc: Date;
    enctrFormUpdTmUtc: string;
    enctrFormAudVer: number;
    qcdrEvalEnctrFormVer: number;
    dateOfService: Date;
    patAgeYears: number;
    painScoreCd: string;
    xferLocnCd: string;
    caseCancelledInd: boolean;
    asaClsfnCd: string;
    asaEmergInd: boolean;
    difficultAirwayInd: boolean;
    plannedAirwayEquipUsedInd: boolean;
    compOrInd: boolean;
    anesStartTime: string;
    caseCancelledStgCd: string;
    multiModalPainMgmtCd: string;
    priorOsaDiagInd: boolean;
    patIncapacitatedInd: boolean;
    preopEvalOsaPosInd: boolean;
    osaEducationInd: boolean;
    osaMitigationUsedInd: boolean;
    patSmokeInd: boolean;
    patSmokeCessInd: boolean;
    patSmokeDosInd: boolean;
    maintInhAgentUsedInd: boolean;
    ponvHighRiskInd: boolean;
    combTherCd: string;
    importResult: any;
    hasDateOfService: boolean;
    hasAnesthesiaProvider: boolean;
    surgeonNpi: string;
    anesProvidersList: any;
    allCptCodes: any;
    allCptCnt: number;
    compList: any;
    compCnt: number;
    postDischStatusAssessedCd: string;
    primaryAnesthetic: string;
    anesthesiaStartDateTime: Date;
    anesthesiaEndDateTime: Date;
    patientBodyTemp: number;
    nerveBlockInd: boolean;
    secondProviderDiffAirwayInd: boolean;
    sendSurveyCd: string;
    surveyEmailAddress: string;
    surveyMobilPhoneNumber: string;
    nonOrSettingCaseInd: boolean;
    etco2MonitoredInd: boolean;
    phenylephrineAdminCd: string;
    laborEpiduralFailureInd: boolean;
    primaryTkaInd: boolean;
    nerveBlockUsedCd: string;
    shoulderArthroInd: boolean;
    upperExtremityBlockCd: string;
    centralLinePlacedInd: boolean;
    centralLineTypCd: string;
    osaScreenCd: string;
    osaMitigationUsedCd: string;
    hipArthroplastyInd: boolean;
    shoulderArthroplastyInd: boolean;
    shoulderArthroscopyInd: boolean;
    anemiaScreenCd: string;
    anemiaScreenPosInd: boolean;
    dtuAnemiaManagementCd: string;
    lowFlowMaintenanceUsedCd: string;
    arterialLineTypCd: string;
    dtuArterialLinePlcmtCd: string;
    bypassPerformedInd: boolean;
    hypothermiaDuringBypassCd: string;
    caseCancelledTimeSpentMins: number;
    sameDayDistinctProcedureInd: boolean;
    amaCptLicenseInd: boolean;
    qcdrEvalSurveyId: number;
    qcdrEvalSurveyAudVer: number;
}
