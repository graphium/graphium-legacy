export interface ScoreCardMetricSample {
    isoWeekdayIndex: number,
    isWeekday: boolean,

    organizationId:number,
    facilityId:number,
    dateOfService:any,
    caseCount:number,
    anesthesiaMinutes:string,
    surgeonTurnoverTimeSurgeonMinutes:string,
    surgeonTurnoverTimeSurgeonCount:number,
    surgeonTurnoverTimeLocationMinutes:string,
    surgeonTurnoverTimeLocationCount:number,
    wheelsOutWheelsInMinutes:string,
    wheelsOutWheelsInCount:number,
    anesthesiaTurnoverTimeMinutes:string,
    anesthesiaTurnoverTimeCount:number,
    anesthesiaReadyMinutes:number,
    surgicalPrepMinutes:number,
    firstCaseCount:number,
    firstCaseDelayCount:number,
    firstCaseDelayMinutes:number,
    icuAdmissionCount:number,
    pacuAdmissionCount:number,
    generalAnesthesiaCount:number,
    macAnesthesiaCount:number,
    regionalAnesthesiaCount:number,
    spinalAnesthesiaCount:number,
    epiduraAnesthesiaCount:number,
    laborEpiduralAnesthesiaCount:number,
    localAnesthesiaCount:number,
    topicalAnesthesiaCount:number,
    safetyChecklistUsedCount:number,
    handoffProtocolUsedCount:number,
    inpatientPatientCount:number,
    ambulatoryPatientCount:number,
    hypothermicPatientCount:number,
    observationCount:number,
    majorComplicationCount:number,
    sameDayAddOnCount:number,
    sameDayCancelledCaseCount:number,
    delayedCaseCount:number,
    preopPriorCount:number,
    lungVentilationCount:number,
    currentMedsDocumentCount:number,
    ponvHighRiskCount:number,
    combinationTherapyCount:number,
    asaFrequencyDistribution:string,
    ageFrequencyDistribution:string,
    genderFrequencyDistribution:string,
    painScoreFrequencyDistribution:string,
    locationUtilization:string,
    hourlyORUtilization:string,
    complicationsList:Array<object>,
    delayReasonsList:any,
    cancelReasonsList:any,
    insertTimestamp:any,
    lastUpdateTimestamp:any,
    auditVersion:number
}

export default ScoreCardMetricSample;