require('source-map-support').install();

import { EncounterFormFactsEval2024 } from './EncounterFormFactsEval2024';
import { EncounterFormFacts2024 } from './EncounterFormFacts2024';

let facts: EncounterFormFacts2024[] = [];

let abg42 = <EncounterFormFacts2024>{
    _testId: 'ABG42',
    enctrFormAudVer: 1,
    hasAnesthesiaProvider: true,
    hasDateOfService: true,
    //hasSurgeonProvider: true,
    difficultAirwayInd: true,
    secondProviderDiffAirwayInd: false,
    anesProvidersList: '3000001016',
    surgeonNpi: '3000001024',
    caseCancelledInd: false,
    allCptCodes: ['00872'],
    asaClsfnCd: '3',
    asaEmergInd: false,
    patAgeYears: 18,
    compOrInd: true,
    compList: ['misc_visual_loss'],
};

let aqi62 = <EncounterFormFacts2024>{
    _testId: 'AQI62',
    enctrFormAudVer: 1,
    hasAnesthesiaProvider: true,
    hasDateOfService: true,
    //hasSurgeonProvider: true,
    anesProvidersList: '3000001016',
    surgeonNpi: '3000001024',
    caseCancelledInd: false,
    allCptCodes: ['00872'],
    patAgeYears: 18,
    asaClsfnCd: '3',
    asaEmergInd: false,
    priorOsaDiagInd: false,
    patIncapacitatedInd: false,
    preopEvalOsaPosInd: true,
    osaEducationInd: true,
};

let aqi68 = <EncounterFormFacts2024>{
    _testId: 'AQI66',
    enctrFormAudVer: 1,
    hasAnesthesiaProvider: true,
    hasDateOfService: true,
    //hasSurgeonProvider: true,
    anesProvidersList: '3000001016',
    surgeonNpi: '3000001024',
    caseCancelledInd: false,
    allCptCodes: ['00600'],
    patAgeYears: 18,
    asaClsfnCd: '3',
    asaEmergInd: false,
    preopEvalOsaPosInd: true,
    priorOsaDiagInd: true,
    patIncapacitatedInd: false,
    osaMitigationUsedInd: true,
};

let qid404 = <EncounterFormFacts2024>{
    _testId: 'QID404',
    enctrFormAudVer: 1,
    hasAnesthesiaProvider: true,
    hasDateOfService: true,
    //hasSurgeonProvider: true,
    anesProvidersList: '3000001016',
    surgeonNpi: '3000001024',
    caseCancelledInd: false,
    allCptCodes: ['00103'],
    patAgeYears: 18,
    asaEmergInd: false,
    patSmokeInd: true,
    patSmokeCessInd: true,
    patSmokeDosInd: true,
};
/*
let qid424 = <EncounterFormFacts2024>{
    _testId: 'QID424',
    enctrFormAudVer: 1,
    hasAnesthesiaProvider: true,
    hasDateOfService: true,
    anesProvidersList: '3000001016',
    surgeonNpi: '3000001024',
    caseCancelledInd: false,
    primaryAnesthetic: 'GENERAL',
    nerveBlockInd: false,
    allCptCodes: ['01850'],
    anesthesiaStartDateTime: '2024-01-01 12:14:00',
    anesthesiaEndDateTime: '2024-01-01 13:22:00',
    patientBodyTemp: 35.4,
    compOrInd: false,
    compList: ['a']
}
*/

let qid430 = <EncounterFormFacts2024>{
    _testId: 'QID430',
    enctrFormAudVer: 1,
    hasAnesthesiaProvider: true,
    hasDateOfService: true,
    //hasSurgeonProvider: true,
    anesProvidersList: '3000001016',
    surgeonNpi: '3000001024',
    caseCancelledInd: false,
    allCptCodes: ['ABC', '00934'],
    patAgeYears: 18,
    maintInhAgentUsedInd: true,
    ponvHighRiskInd: true,
    combTherCd: 'Y',
};

let qid477 = <EncounterFormFacts2024>{
    _testId: 'QID477',
    enctrFormAudVer: 1,
    hasAnesthesiaProvider: true,
    hasDateOfService: true,
    //hasSurgeonProvider: true,
    anesProvidersList: '3000001016',
    surgeonNpi: '3000001024',
    caseCancelledInd: false,
    allCptCodes: ['00872'],
    asaClsfnCd: '3',
    asaEmergInd: true,
    multiModalPainMgmtCd: 'Y',
};

facts.push(qid430);
//console.log(JSON.stringify(facts[0]));

//let x = facts.map(fact => ({
//    //qcdrRulesEngine(fact:any);
//    console.log('_testId: '+fact.anesStartTime);
//}));
let factsEval = new EncounterFormFactsEval2024();

for (let fact of facts) {
    //console.log(JSON.stringify(fact,null,4));
    let result = factsEval.evalFacts(fact);
    console.log(JSON.stringify(result, null, 4));
}
