var moment = require('moment');
import * as _ from 'lodash';

import { QcdrMeasure2024 } from './QcdrMeasure2024';
import { QcdrResult2024 } from './QcdrResult2024';
import { QcdrFormEvalResult2024 } from './QcdrFormEvalResult2024';
import { EncounterFormFacts2024 } from './EncounterFormFacts2024';

/**
 * Author: M.Oldham
 * Update History:
 *   Date       Name     Version      Changes
 *   ---------- -------- ------------ --------------------------------------------------------------------------
 *   01/08/2024 M.Oldham ABG.2024.1.0 Implemented preliminary 2024 rules engine. Straight copy of 2023.
 *   02/08/2024 M.Oldham ABG.2024.1.1 Correct where ABG44 measure response codes are stored.
 *   07/17/2024 M.Oldham ABG.2024.1.2 Implement new 2024 measures and remove retired 2023 measures.
 *   07/29/2024 M.Oldham ABG.2024.1.3 Add alternate QCDR eval ruleset to process QCDR passthru cases. Reactivate
 *                                    retired 2023 measures for quality reporting.
 *   10/04/2024 M.Oldham ABG.2024.1.4 Fix ABG41 CPT eligibility logic
 */
export class EncounterFormFactsEval2024 {
    static qcdrRulesEngineVersion: string = 'ABG.2024.1.4';

    isValidNpi(npiNumber: string): boolean {
        'use strict';
        if (!npiNumber) {
            //console.log('ERROR: no NPI specified');
            return false;
        }

        // tslint:disable-next-line:one-variable-per-declaration
        let npi: string = npiNumber.toString(),
            npiLength: number = npi.length,
            isNan: boolean = !/^\d+$/.test(npi),
            isZeroes: boolean = ('0000000000' + npi).slice(-10) === '0000000000',
            npiDigits = npi.split(''),
            lastDigit = npi.slice(-1),
            digit,
            oddTotal = 0,
            evenTotal = 0,
            checkTotal = 0;

        if (npiLength !== 10) {
            //console.log('ERROR: invalid length');
            return false;
        }

        if (isNan) {
            //console.log('ERROR: NaN');
            return false;
        }

        if (isZeroes) {
            //console.log('ERROR: all zeroes');
            return false;
        }
        for (var i = npiLength - 1; i > 0; i--) {
            digit = parseInt(npi.charAt(i - 1));
            if (i % 2 !== 0) {
                oddTotal += digit < 5 ? digit * 2 : digit * 2 - 9;
            } else {
                evenTotal += digit;
            }
        }
        checkTotal = 24 + evenTotal + oddTotal;
        const ceiling = checkTotal % 10 === 0 ? checkTotal : Math.ceil((checkTotal + 1) / 10) * 10;
        return ceiling - checkTotal === parseInt(lastDigit);
    }

    private isFieldMissing(fieldValue: any): boolean {
        if (_.isArray(fieldValue)) {
            return fieldValue.length < 1;
        } else {
            return fieldValue === null || fieldValue === '' || fieldValue === undefined;
        }
    }

    private arrayContainsAny(arrayField: any, value: any): boolean {
        if (arrayField === null || arrayField === undefined) {
            return false;
        } else if (!_.isArray(arrayField) || (_.isArray(arrayField) && arrayField.length == 0)) {
            return false;
        } else {
            if (_.isArray(value)) {
                //check for array overlap
                return _.intersection(arrayField, value).length > 0;
            } else {
                //check for existence of single array element
                return arrayField.indexOf(value) > -1;
            }
        }
    }

    private dedupArray(array: any[]): any[] {
        return array.filter((elem, pos) => {
            return array.indexOf(elem) == pos;
        });
    }

    private concatWithoutDuplicates<T>(arr1: T[], arr2: T[]): T[] {
        const mergedSet = new Set([...arr1, ...arr2]);
        return Array.from(mergedSet);
    }

    private evalMeasures(facts: any, isInadmissible: boolean, skipCPTEval: boolean = false): QcdrMeasure2024[] {
        let measures: QcdrMeasure2024[] = [];

        //ABG40 - NOTE: This is a retired measure as of 2024
        let abg40: QcdrMeasure2024 = new QcdrMeasure2024('ABG40');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            abg40.eligible = 1;
            if (this.isFieldMissing(facts.primaryAnesthetic)) {
                abg40.eligible = 0;
                abg40.missingFields.push('Primary Anesthetic');
            } else {
                if (facts.primaryAnesthetic !== 'SPINAL') {
                    abg40.eligible = 0;
                }
            }

            if (!this.isFieldMissing(facts.asaEmergInd) && facts.asaEmergInd === true) {
                abg40.eligible = 0;
            }

            if (skipCPTEval) {
                if (this.isFieldMissing(facts.electiveCsectionInd)) {
                    abg40.eligible = 0;
                    abg40.missingFields.push('C-Section Performed');
                } else {
                    if (facts.electiveCsectionInd !== true) {
                        abg40.eligible = 0;
                    }
                }
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    abg40.eligible = 0;
                }
                abg40.missingFields.push('CPT Code');
            } else {
                const cptList1: string[] = ['59510', '59514', '59515'];
                const cptList2: string[] = ['01961', '01968'];
                if (
                    !this.arrayContainsAny(facts.allCptCodes, cptList1) &&
                    !this.arrayContainsAny(facts.allCptCodes, cptList2)
                ) {
                    if (!skipCPTEval) {
                        abg40.eligible = 0;
                    }
                }
            }

            //Process performance criteria and missing fields
            if (abg40.eligible == 1) {
                if (this.isFieldMissing(facts.phenylephrineAdminCd)) {
                    abg40.missingFields.push('Phenylephrine Given');
                } else {
                    if (facts.phenylephrineAdminCd === 'Y') {
                        abg40.perfMet = 1;
                        abg40.measRespCds.push('1081');
                    }

                    if (facts.phenylephrineAdminCd === 'N-RU') {
                        abg40.perfNotMet = 1;
                        abg40.measRespCds.push('1082');
                    }

                    if (facts.phenylephrineAdminCd === 'N-RS') {
                        abg40.exception = 1;
                        abg40.measRespCds.push('1083');
                    }
                }
            }
        }
        measures.push(abg40);
        //END ABG40

        //ABG41 - NOTE: This is a retired measure as of 2024
        let abg41: QcdrMeasure2024 = new QcdrMeasure2024('ABG41');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            abg41.eligible = 1;
            if (this.isFieldMissing(facts.patAgeYears)) {
                abg41.eligible = 0;
                abg41.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears < 18) {
                    abg41.eligible = 0;
                }
            }

            if (!this.isFieldMissing(facts.asaEmergInd) && facts.asaEmergInd === true) {
                abg41.eligible = 0;
            }
            if (skipCPTEval) {
                if (
                    this.isFieldMissing(facts.shoulderArthroplastyInd) &&
                    this.isFieldMissing(facts.shoulderArthroscopyInd)
                ) {
                    abg41.eligible = 0;
                    abg41.missingFields.push('Shoulder Arthroscopy/plasty');
                } else {
                    if (facts.shoulderArthroscopyInd !== true || facts.shoulderArthroplastyInd !== true) {
                        abg41.eligible = 0;
                    }
                }
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    abg41.eligible = 0;
                }
                abg41.missingFields.push('CPT Code');
            } else {
                const cptList1: string[] = [
                    '23470',
                    '23472',
                    '23473',
                    '23474',
                    '29805',
                    '29806',
                    '29807',
                    '29819',
                    '29820',
                    '29821',
                    '29822',
                    '29823',
                    '29824',
                    '29825',
                    '29826',
                    '29827',
                    '29828',
                ];
                const cptList2: string[] = ['01630', '01634', '01636', '01638'];
                if (
                    !(
                        this.arrayContainsAny(facts.allCptCodes, cptList1) &&
                        this.arrayContainsAny(facts.allCptCodes, cptList2)
                    )
                ) {
                    if (!skipCPTEval) {
                        abg41.eligible = 0;
                    }
                }
            }

            //Process performance criteria and missing fields
            if (abg41.eligible == 1) {
                if (this.isFieldMissing(facts.upperExtremityBlockCd)) {
                    abg41.missingFields.push('Upper Extremity Block');
                } else {
                    if (facts.upperExtremityBlockCd === 'Y') {
                        abg41.perfMet = 1;
                        abg41.measRespCds.push('1084');
                    }

                    if (facts.upperExtremityBlockCd === 'N-RU') {
                        abg41.perfNotMet = 1;
                        abg41.measRespCds.push('1085');
                    }

                    if (facts.upperExtremityBlockCd === 'N-RS') {
                        abg41.exception = 1;
                        abg41.measRespCds.push('1086');
                    }
                }
            }
        }
        measures.push(abg41);
        //END ABG41

        //ABG42
        let abg42: QcdrMeasure2024 = new QcdrMeasure2024('ABG42');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            abg42.eligible = 1;
            if (this.isFieldMissing(facts.patAgeYears)) {
                abg42.eligible = 0;
                abg42.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears < 18) {
                    abg42.eligible = 0;
                }
            }

            if (!this.isFieldMissing(facts.asaEmergInd) && facts.asaEmergInd === true) {
                abg42.eligible = 0;
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    abg42.eligible = 0;
                }
                abg42.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = [
                    '00100',
                    '00102',
                    '00103',
                    '00104',
                    '00120',
                    '00124',
                    '00126',
                    '00140',
                    '00142',
                    '00144',
                    '00145',
                    '00147',
                    '00148',
                    '00160',
                    '00162',
                    '00164',
                    '00170',
                    '00172',
                    '00174',
                    '00176',
                    '00190',
                    '00192',
                    '00210',
                    '00211',
                    '00212',
                    '00214',
                    '00215',
                    '00216',
                    '00218',
                    '00220',
                    '00222',
                    '00300',
                    '00320',
                    '00322',
                    '00326',
                    '00350',
                    '00352',
                    '00400',
                    '00402',
                    '00404',
                    '00406',
                    '00410',
                    '00450',
                    '00454',
                    '00470',
                    '00472',
                    '00474',
                    '00500',
                    '00520',
                    '00522',
                    '00524',
                    '00528',
                    '00529',
                    '00530',
                    '00532',
                    '00534',
                    '00537',
                    '00539',
                    '00540',
                    '00541',
                    '00542',
                    '00546',
                    '00548',
                    '00550',
                    '00560',
                    '00600',
                    '00604',
                    '00620',
                    '00625',
                    '00626',
                    '00630',
                    '00632',
                    '00635',
                    '00640',
                    '00670',
                    '00700',
                    '00702',
                    '00730',
                    '00740',
                    '00750',
                    '00752',
                    '00754',
                    '00756',
                    '00770',
                    '00790',
                    '00792',
                    '00794',
                    '00796',
                    '00797',
                    '00800',
                    '00802',
                    '00810',
                    '00820',
                    '00830',
                    '00832',
                    '00834',
                    '00836',
                    '00840',
                    '00842',
                    '00844',
                    '00846',
                    '00848',
                    '00851',
                    '00860',
                    '00862',
                    '00864',
                    '00865',
                    '00866',
                    '00868',
                    '00870',
                    '00872',
                    '00873',
                    '00880',
                    '00882',
                    '00902',
                    '00904',
                    '00906',
                    '00908',
                    '00910',
                    '00912',
                    '00914',
                    '00916',
                    '00918',
                    '00920',
                    '00921',
                    '00922',
                    '00924',
                    '00926',
                    '00928',
                    '00930',
                    '00932',
                    '00934',
                    '00936',
                    '00938',
                    '00940',
                    '00942',
                    '00944',
                    '00948',
                    '00950',
                    '00952',
                    '01112',
                    '01120',
                    '01130',
                    '01140',
                    '01150',
                    '01160',
                    '01170',
                    '01173',
                    '01180',
                    '01190',
                    '01200',
                    '01202',
                    '01210',
                    '01212',
                    '01214',
                    '01215',
                    '01220',
                    '01230',
                    '01232',
                    '01234',
                    '01250',
                    '01260',
                    '01270',
                    '01272',
                    '01274',
                    '01320',
                    '01340',
                    '01360',
                    '01380',
                    '01382',
                    '01390',
                    '01392',
                    '01400',
                    '01402',
                    '01404',
                    '01420',
                    '01430',
                    '01432',
                    '01440',
                    '01442',
                    '01444',
                    '01462',
                    '01464',
                    '01470',
                    '01472',
                    '01474',
                    '01480',
                    '01482',
                    '01484',
                    '01486',
                    '01490',
                    '01500',
                    '01502',
                    '01520',
                    '01522',
                    '01610',
                    '01620',
                    '01622',
                    '01630',
                    '01634',
                    '01636',
                    '01638',
                    '01650',
                    '01652',
                    '01654',
                    '01656',
                    '01670',
                    '01680',
                    '01682',
                    '01710',
                    '01712',
                    '01714',
                    '01716',
                    '01730',
                    '01732',
                    '01740',
                    '01742',
                    '01744',
                    '01756',
                    '01758',
                    '01760',
                    '01770',
                    '01772',
                    '01780',
                    '01782',
                    '01810',
                    '01820',
                    '01829',
                    '01830',
                    '01832',
                    '01840',
                    '01842',
                    '01844',
                    '01850',
                    '01852',
                    '01860',
                    '01924',
                    '01925',
                    '01926',
                    '01930',
                    '01931',
                    '01932',
                    '01933',
                    '01935',
                    '01936',
                    '01951',
                    '01952',
                    '01961',
                    '01962',
                    '01963',
                    '01965',
                    '01966',
                    '01992',
                ];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        abg42.eligible = 0;
                    }
                }
            }

            if (this.isFieldMissing(facts.primaryAnesthetic)) {
                abg42.eligible = 0;
                abg42.missingFields.push('Primary Anesthetic');
            } else {
                if (facts.primaryAnesthetic !== 'GENERAL') {
                    abg42.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.difficultAirwayInd)) {
                abg42.eligible = 0;
                abg42.missingFields.push('Difficult Airway Ind');
            } else {
                if (facts.difficultAirwayInd === false) {
                    abg42.eligible = 0;
                }
            }

            //Process performance criteria and missing fields
            if (abg42.eligible == 1) {
                abg42.measRespCds.push('1019');
                abg42.measRespCds.push('1073');

                if (
                    this.isFieldMissing(facts.secondProviderDiffAirwayInd) ||
                    this.isFieldMissing(facts.plannedAirwayEquipUsedInd)
                ) {
                    if (this.isFieldMissing(facts.secondProviderDiffAirwayInd)) {
                        abg42.missingFields.push('2nd Provider Present for DA');
                    }
                    if (this.isFieldMissing(facts.plannedAirwayEquipUsedInd)) {
                        abg42.missingFields.push('Planned Airway Equip Used');
                    }
                } else {
                    if (facts.secondProviderDiffAirwayInd === true && facts.plannedAirwayEquipUsedInd === true) {
                        abg42.perfMet = 1;
                        abg42.measRespCds.push('1074');
                        abg42.measRespCds.push('036');
                    }

                    if (facts.secondProviderDiffAirwayInd === true && facts.plannedAirwayEquipUsedInd === false) {
                        abg42.perfNotMet = 1;
                        abg42.measRespCds.push('037');
                    }

                    if (facts.secondProviderDiffAirwayInd === false && facts.plannedAirwayEquipUsedInd === true) {
                        abg42.perfNotMet = 1;
                        abg42.measRespCds.push('1075');
                    }

                    if (facts.secondProviderDiffAirwayInd === false && facts.plannedAirwayEquipUsedInd === false) {
                        abg42.perfNotMet = 1;
                        abg42.measRespCds.push('1075');
                        abg42.measRespCds.push('037');
                    }
                }
            }
        }
        measures.push(abg42);
        //END ABG42

        //ABG44
        let abg44: QcdrMeasure2024 = new QcdrMeasure2024('ABG44');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            abg44.eligible = 1;
            if (this.isFieldMissing(facts.patAgeYears)) {
                abg44.eligible = 0;
                abg44.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears < 18) {
                    abg44.eligible = 0;
                }
            }
            if (!this.isFieldMissing(facts.asaEmergInd) && facts.asaEmergInd === true) {
                abg44.eligible = 0;
            } else {
                abg44.qualDataCds.push('G9643');
            }
            if (
                this.isFieldMissing(facts.anesthesiaStartDateTime) ||
                this.isFieldMissing(facts.anesthesiaEndDateTime)
            ) {
                abg44.eligible = 0;
                abg44.missingFields.push('Anesthesia Start/End Times');
            } else {
                let startTime = moment(facts.anesthesiaStartDateTime);
                let endTime = moment(facts.anesthesiaEndDateTime);
                let anesthesiaDurationMins = endTime.diff(startTime, 'minutes');
                if (anesthesiaDurationMins < 30) {
                    abg44.eligible = 0;
                }
            }
            if (this.isFieldMissing(facts.maintInhAgentUsedInd)) {
                abg44.eligible = 0;
                abg44.missingFields.push('Inhalational Anesthetic Agent');
            } else {
                if (facts.maintInhAgentUsedInd === true) {
                    abg44.measRespCds.push('1095');
                } else {
                    abg44.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    abg44.eligible = 0;
                }
                abg44.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = [
                    '00100',
                    '00102',
                    '00103',
                    '00104',
                    '00120',
                    '00124',
                    '00126',
                    '00140',
                    '00142',
                    '00144',
                    '00145',
                    '00147',
                    '00148',
                    '00160',
                    '00162',
                    '00164',
                    '00170',
                    '00172',
                    '00174',
                    '00176',
                    '00190',
                    '00192',
                    '00210',
                    '00211',
                    '00212',
                    '00214',
                    '00215',
                    '00216',
                    '00218',
                    '00220',
                    '00222',
                    '00300',
                    '00320',
                    '00322',
                    '00350',
                    '00352',
                    '00400',
                    '00402',
                    '00404',
                    '00406',
                    '00410',
                    '00450',
                    '00454',
                    '00470',
                    '00472',
                    '00474',
                    '00500',
                    '00520',
                    '00522',
                    '00524',
                    '00528',
                    '00529',
                    '00530',
                    '00532',
                    '00534',
                    '00537',
                    '00539',
                    '00540',
                    '00541',
                    '00542',
                    '00546',
                    '00548',
                    '00550',
                    '00560',
                    '00566',
                    '00580',
                    '00600',
                    '00604',
                    '00620',
                    '00625',
                    '00626',
                    '00630',
                    '00632',
                    '00635',
                    '00640',
                    '00670',
                    '00700',
                    '00702',
                    '00730',
                    '00731',
                    '00732',
                    '00750',
                    '00752',
                    '00754',
                    '00756',
                    '00770',
                    '00790',
                    '00792',
                    '00794',
                    '00796',
                    '00797',
                    '00800',
                    '00802',
                    '00811',
                    '00812',
                    '00813',
                    '00820',
                    '00830',
                    '00832',
                    '00840',
                    '00842',
                    '00844',
                    '00846',
                    '00848',
                    '00851',
                    '00860',
                    '00862',
                    '00864',
                    '00865',
                    '00866',
                    '00868',
                    '00870',
                    '00872',
                    '00873',
                    '00880',
                    '00882',
                    '00902',
                    '00904',
                    '00906',
                    '00908',
                    '00910',
                    '00912',
                    '00914',
                    '00916',
                    '00918',
                    '00920',
                    '00921',
                    '00922',
                    '00924',
                    '00926',
                    '00928',
                    '00930',
                    '00932',
                    '00934',
                    '00936',
                    '00938',
                    '00940',
                    '00942',
                    '00944',
                    '00948',
                    '00950',
                    '00952',
                    '01112',
                    '01120',
                    '01130',
                    '01140',
                    '01150',
                    '01160',
                    '01170',
                    '01173',
                    '01200',
                    '01202',
                    '01210',
                    '01212',
                    '01214',
                    '01215',
                    '01220',
                    '01230',
                    '01232',
                    '01234',
                    '01250',
                    '01260',
                    '01270',
                    '01272',
                    '01274',
                    '01320',
                    '01340',
                    '01360',
                    '01380',
                    '01382',
                    '01390',
                    '01392',
                    '01400',
                    '01402',
                    '01404',
                    '01420',
                    '01430',
                    '01432',
                    '01440',
                    '01442',
                    '01444',
                    '01462',
                    '01464',
                    '01470',
                    '01472',
                    '01474',
                    '01480',
                    '01482',
                    '01484',
                    '01486',
                    '01490',
                    '01500',
                    '01502',
                    '01520',
                    '01522',
                    '01610',
                    '01620',
                    '01622',
                    '01630',
                    '01634',
                    '01636',
                    '01638',
                    '01650',
                    '01652',
                    '01654',
                    '01656',
                    '01670',
                    '01680',
                    '01710',
                    '01712',
                    '01714',
                    '01716',
                    '01730',
                    '01732',
                    '01740',
                    '01742',
                    '01744',
                    '01756',
                    '01758',
                    '01760',
                    '01770',
                    '01772',
                    '01780',
                    '01782',
                    '01810',
                    '01820',
                    '01829',
                    '01830',
                    '01832',
                    '01840',
                    '01842',
                    '01844',
                    '01850',
                    '01852',
                    '01860',
                    '01924',
                    '01925',
                    '01926',
                    '01930',
                    '01931',
                    '01932',
                    '01933',
                    '01935',
                    '01936',
                    '01951',
                    '01952',
                    '01961',
                    '01962',
                    '01963',
                    '01965',
                    '01966',
                ];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        abg44.eligible = 0;
                    }
                }
            }

            if (abg44.eligible == 1) {
                if (this.isFieldMissing(facts.lowFlowMaintenanceUsedCd)) {
                    abg44.missingFields.push('Low Flow Anesthesia');
                } else {
                    if (facts.lowFlowMaintenanceUsedCd == 'Y') {
                        abg44.perfMet = 1;
                        abg44.measRespCds.push('1097');
                    } else {
                        abg44.perfNotMet = 1;
                        abg44.measRespCds.push('1098');
                    }
                }
            }
        }
        measures.push(abg44);
        //END ABG44

        //AQI18
        let aqi18: QcdrMeasure2024 = new QcdrMeasure2024('AQI18');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi18.eligible = 1;
            if (this.isFieldMissing(facts.patAgeYears)) {
                aqi18.eligible = 0;
                aqi18.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears < 18) {
                    aqi18.eligible = 0;
                }
            }

            if (!this.isFieldMissing(facts.isolatedCabgInd) && facts.isolatedCabgInd == false) {
                aqi18.eligible = 0;
            }

            if (!this.isFieldMissing(facts.asaClsfnCd) && facts.asaClsfnCd == '6') {
                aqi18.eligible = 0;
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    aqi18.eligible = 0;
                }
                aqi18.missingFields.push('CPT Code');
            } else {
                const cptList1: string[] = [
                    '33510',
                    '33511',
                    '33512',
                    '33513',
                    '33514',
                    '33516',
                    '33517',
                    '33518',
                    '33519',
                    '33521',
                    '33522',
                    '33523',
                    '33533',
                    '33534',
                    '33535',
                    '33536',
                ];
                const cptList2: string[] = ['00566', '00567'];
                const cptList3: string[] = [
                    '33510',
                    '33511',
                    '33512',
                    '33513',
                    '33514',
                    '33516',
                    '33517',
                    '33518',
                    '33519',
                    '33521',
                    '33522',
                    '33523',
                    '33533',
                    '33534',
                    '33535',
                    '33536',
                ];
                const cptList4: string[] = ['33530'];
                const cptList5: string[] = ['00562'];
                if (
                    !(
                        this.arrayContainsAny(facts.allCptCodes, cptList1) &&
                        this.arrayContainsAny(facts.allCptCodes, cptList2)
                    ) ||
                    !(
                        this.arrayContainsAny(facts.allCptCodes, cptList3) &&
                        this.arrayContainsAny(facts.allCptCodes, cptList4) &&
                        this.arrayContainsAny(facts.allCptCodes, cptList5)
                    )
                ) {
                    if (!skipCPTEval) {
                        aqi18.eligible = 0;
                    }
                }
            }

            //Process performance criteria and missing fields
            if (aqi18.eligible == 1) {
                if (this.isFieldMissing(facts.postopIntubGt24hrsReqdInd)) {
                    aqi18.missingFields.push('Intubated >24 hours');
                } else {
                    if (facts.postopIntubGt24hrsReqdInd === true) {
                        aqi18.perfMet = 1;
                        aqi18.qualDataCds.push('G8569');
                    }

                    if (facts.postopIntubGt24hrsReqdInd === false) {
                        aqi18.perfNotMet = 1;
                        aqi18.qualDataCds.push('G8570');
                    }
                }
            }
        }
        measures.push(aqi18);
        //END AQI18

        //AQI48A
        let aqi48a: QcdrMeasure2024 = new QcdrMeasure2024('AQI48A');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi48a.eligible = 1;

            if (this.isFieldMissing(facts.patAgeYears)) {
                aqi48a.eligible = 0;
                aqi48a.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears < 18) {
                    aqi48a.eligible = 0;
                }
            }

            if (!this.isFieldMissing(facts.asaClsfnCd) && facts.asaClsfnCd == '6') {
                aqi48a.eligible = 0;
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    aqi48a.eligible = 0;
                }
                aqi48a.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = [
                    '00100',
                    '00102',
                    '00103',
                    '00104',
                    '00120',
                    '00124',
                    '00126',
                    '00140',
                    '00142',
                    '00144',
                    '00145',
                    '00147',
                    '00148',
                    '00160',
                    '00162',
                    '00164',
                    '00170',
                    '00172',
                    '00174',
                    '00176',
                    '00190',
                    '00192',
                    '00210',
                    '00211',
                    '00212',
                    '00214',
                    '00215',
                    '00216',
                    '00218',
                    '00220',
                    '00222',
                    '00300',
                    '00320',
                    '00322',
                    '00350',
                    '00352',
                    '00400',
                    '00402',
                    '00404',
                    '00406',
                    '00410',
                    '00450',
                    '00454',
                    '00470',
                    '00472',
                    '00474',
                    '00500',
                    '00520',
                    '00522',
                    '00524',
                    '00528',
                    '00529',
                    '00530',
                    '00532',
                    '00534',
                    '00537',
                    '00539',
                    '00540',
                    '00541',
                    '00542',
                    '00546',
                    '00548',
                    '00550',
                    '00560',
                    '00562',
                    '00563',
                    '00566',
                    '00567',
                    '00580',
                    '00600',
                    '00604',
                    '00620',
                    '00625',
                    '00626',
                    '00630',
                    '00632',
                    '00635',
                    '00640',
                    '00670',
                    '00700',
                    '00702',
                    '00730',
                    '00731',
                    '00732',
                    '00750',
                    '00752',
                    '00754',
                    '00756',
                    '00770',
                    '00790',
                    '00792',
                    '00794',
                    '00796',
                    '00797',
                    '00800',
                    '00802',
                    '00811',
                    '00812',
                    '00813',
                    '00820',
                    '00830',
                    '00832',
                    '00840',
                    '00842',
                    '00844',
                    '00846',
                    '00848',
                    '00851',
                    '00860',
                    '00862',
                    '00864',
                    '00865',
                    '00866',
                    '00868',
                    '00870',
                    '00872',
                    '00873',
                    '00880',
                    '00882',
                    '00902',
                    '00904',
                    '00906',
                    '00908',
                    '00910',
                    '00912',
                    '00914',
                    '00916',
                    '00918',
                    '00920',
                    '00921',
                    '00922',
                    '00924',
                    '00926',
                    '00928',
                    '00930',
                    '00932',
                    '00934',
                    '00936',
                    '00938',
                    '00940',
                    '00942',
                    '00944',
                    '00948',
                    '00950',
                    '00952',
                    '01112',
                    '01120',
                    '01130',
                    '01140',
                    '01150',
                    '01160',
                    '01170',
                    '01173',
                    '01200',
                    '01202',
                    '01210',
                    '01212',
                    '01214',
                    '01215',
                    '01220',
                    '01230',
                    '01232',
                    '01234',
                    '01250',
                    '01260',
                    '01270',
                    '01272',
                    '01274',
                    '01320',
                    '01340',
                    '01360',
                    '01380',
                    '01382',
                    '01390',
                    '01392',
                    '01400',
                    '01402',
                    '01404',
                    '01420',
                    '01430',
                    '01432',
                    '01440',
                    '01442',
                    '01444',
                    '01462',
                    '01464',
                    '01470',
                    '01472',
                    '01474',
                    '01480',
                    '01482',
                    '01484',
                    '01486',
                    '01490',
                    '01500',
                    '01502',
                    '01520',
                    '01522',
                    '01610',
                    '01620',
                    '01622',
                    '01630',
                    '01634',
                    '01636',
                    '01638',
                    '01650',
                    '01652',
                    '01654',
                    '01656',
                    '01670',
                    '01680',
                    '01710',
                    '01712',
                    '01714',
                    '01716',
                    '01730',
                    '01732',
                    '01740',
                    '01742',
                    '01744',
                    '01756',
                    '01758',
                    '01760',
                    '01770',
                    '01772',
                    '01780',
                    '01782',
                    '01810',
                    '01820',
                    '01829',
                    '01830',
                    '01832',
                    '01840',
                    '01842',
                    '01844',
                    '01850',
                    '01852',
                    '01860',
                    '01916',
                    '01920',
                    '01922',
                    '01924',
                    '01925',
                    '01926',
                    '01930',
                    '01931',
                    '01932',
                    '01933',
                    '01935',
                    '01936',
                    '01951',
                    '01952',
                    '01958',
                    '01960',
                    '01961',
                    '01962',
                    '01963',
                    '01965',
                    '01966',
                    '01967',
                    '01991',
                    '01992',
                    '20526',
                    '20550',
                    '20551',
                    '20552',
                    '20553',
                    '20600',
                    '20604',
                    '20605',
                    '20606',
                    '20610',
                    '20611',
                    '27096',
                    '36555',
                    '36556',
                    '36570',
                    '36571',
                    '36578',
                    '36580',
                    '36581',
                    '36582',
                    '36583',
                    '36584',
                    '36585',
                    '62263',
                    '62264',
                    '62270',
                    '62272',
                    '62273',
                    '62280',
                    '62281',
                    '62282',
                    '62320',
                    '62321',
                    '62322',
                    '62323',
                    '62324',
                    '62325',
                    '62326',
                    '62327',
                    '62328',
                    '62329',
                    '62350',
                    '62355',
                    '62360',
                    '62361',
                    '62362',
                    '62365',
                    '62370',
                    '63650',
                    '63661',
                    '63662',
                    '63663',
                    '63664',
                    '63685',
                    '63688',
                    '64400',
                    '64405',
                    '64408',
                    '64415',
                    '64416',
                    '64417',
                    '64418',
                    '64420',
                    '64425',
                    '64430',
                    '64435',
                    '64445',
                    '64446',
                    '64447',
                    '64448',
                    '64449',
                    '64450',
                    '64451',
                    '64454',
                    '64461',
                    '64463',
                    '64479',
                    '64483',
                    '64486',
                    '64487',
                    '64488',
                    '64489',
                    '64490',
                    '64493',
                    '64505',
                    '64510',
                    '64517',
                    '64520',
                    '64530',
                    '64600',
                    '64605',
                    '64610',
                    '64620',
                    '64624',
                    '64625',
                    '64630',
                    '64633',
                    '64635',
                    '64640',
                    '64680',
                    '64681',
                    '72275',
                    '93503',
                    '95990',
                    '95991',
                ];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        aqi48a.eligible = 0;
                    }
                }
            }

            //Process performance criteria and missing fields
            if (aqi48a.eligible == 1) {
                if (!this.isFieldMissing(facts.sendSurveyCd)) {
                    if (facts.sendSurveyCd === 'Y') {
                        var surveySent = false;
                        var daysDiff = 0;
                        if (
                            !this.isFieldMissing(facts.surveySentTimestamp) &&
                            !this.isFieldMissing(facts.dateOfService)
                        ) {
                            var dateOfServiceDate = moment(facts.dateOfService);
                            var surveyReceivedDate = moment(new Date(facts.surveySentTimestamp));
                            daysDiff = surveyReceivedDate.diff(dateOfServiceDate, 'days');
                            surveySent = true;
                        } else {
                            aqi48a.missingFields.push('Patient Sent Survey');
                        }

                        if (
                            this.isFieldMissing(facts.surveyEmailAddress) &&
                            this.isFieldMissing(facts.surveyMobilPhoneNumber)
                        ) {
                            aqi48a.missingFields.push('Patient Email Address or Mobile Phone Number');
                            aqi48a.exception = 1;
                            aqi48a.qualDataCds.push('10A13');
                        } else {
                            if (!surveySent || daysDiff > 30) {
                                aqi48a.perfNotMet = 1;
                                aqi48a.qualDataCds.push('10A14');
                            } else {
                                aqi48a.perfMet = 1;
                                aqi48a.qualDataCds.push('10A12');
                            }
                        }
                    } else {
                        if (facts.sendSurveyCd === 'N-RS') {
                            aqi48a.exception = 1;
                            aqi48a.qualDataCds.push('10A13');
                        } else if (facts.sendSurveyCd === 'N-RU') {
                            aqi48a.perfNotMet = 1;
                            aqi48a.qualDataCds.push('10A14');
                        }
                    }
                } else {
                    aqi48a.missingFields.push('Send Graphium Survey');
                    aqi48a.perfNotMet = 1;
                    aqi48a.qualDataCds.push('10A14');
                }
            }
        }
        measures.push(aqi48a);
        //END AQI48A

        //AQI48B
        let aqi48b: QcdrMeasure2024 = new QcdrMeasure2024('AQI48B');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi48b.eligible = 1;
            var patientCompletedMandatoryQuestion = false;
            var surveyResultObject = {};
            var satisfactionResponse = 0;

            //NOTE1: AQI48B denominator is the same as AQI48A denominator, so no need to re-evaluate

            //NOTE2: AQI48A performance met is a denominator criteria for AQI48B
            if (this.isFieldMissing(aqi48a.perfMet) || (!this.isFieldMissing(aqi48a.perfMet) && aqi48a.perfMet !== 1)) {
                aqi48b.eligible = 0;
            }

            //NOTE3: Patient must have completed the mandatory survey question to be included in AQI48B denominator
            if (!this.isFieldMissing(facts.surveyResponseData)) {
                try {
                    surveyResultObject = facts.surveyResponseData;

                    if (surveyResultObject.hasOwnProperty('overallPatientSatisfaction')) {
                        if (surveyResultObject['overallPatientSatisfaction']) {
                            satisfactionResponse = parseInt(surveyResultObject['overallPatientSatisfaction']);
                            patientCompletedMandatoryQuestion = true;
                        } else {
                            aqi48b.eligible = 0;
                            aqi48b.qualDataCds.push('10A69');
                            aqi48b.missingFields.push('Mandatory Anesthesia Satisfaction Survey Response');
                        }
                    } else {
                        aqi48b.eligible = 0;
                        aqi48b.qualDataCds.push('10A69');
                        aqi48b.missingFields.push('Mandatory Anesthesia Satisfaction Survey Response');
                    }
                } catch (e) {
                    console.log('Error processing survey response data', e.message);
                    aqi48b.eligible = 0;
                    aqi48b.missingFields.push('Mandatory Anesthesia Satisfaction Survey Response');
                }
            } else {
                aqi48b.eligible = 0;
                aqi48b.qualDataCds.push('10A69');
                aqi48b.missingFields.push('Mandatory Anesthesia Satisfaction Survey Response');
            }

            //Process performance criteria and missing fields
            if (aqi48b.eligible == 1) {
                if (satisfactionResponse >= 4) {
                    aqi48b.perfMet = 1;
                    aqi48b.qualDataCds.push('10A72');
                    aqi48b.qualDataCds.push('10A70');
                } else {
                    aqi48b.perfNotMet = 1;
                    aqi48b.qualDataCds.push('10A72');
                    aqi48b.qualDataCds.push('10A71');
                }
            }
        }
        measures.push(aqi48b);
        //END AQI48B

        //AQI56 - NOTE: This is a retired measure as of 2024
        let aqi56: QcdrMeasure2024 = new QcdrMeasure2024('AQI56');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi56.eligible = 1;
            if (skipCPTEval) {
                if (this.isFieldMissing(facts.primaryTkaInd)) {
                    aqi56.eligible = 0;
                    aqi56.missingFields.push('Primary Total Knee Arthroplasty');
                } else {
                    if (facts.primaryTkaInd !== true) {
                        aqi56.eligible = 0;
                    }
                }
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    aqi56.eligible = 0;
                }
                aqi56.missingFields.push('CPT Code');
            } else {
                const cptList1: string[] = ['01402'];
                const cptList2: string[] = ['27486', '27487', '11A09', '27488', '11A10'];
                if (
                    !this.arrayContainsAny(facts.allCptCodes, cptList1) ||
                    this.arrayContainsAny(facts.allCptCodes, cptList2)
                ) {
                    if (!skipCPTEval) {
                        aqi56.eligible = 0;
                    }
                }
            }

            //Process performance criteria and missing fields
            if (aqi56.eligible == 1) {
                if (this.isFieldMissing(facts.nerveBlockUsedCd)) {
                    aqi56.missingFields.push('Neuraxial or Regional Block');
                } else {
                    if (facts.nerveBlockUsedCd === 'Y') {
                        aqi56.perfMet = 1;
                        aqi56.qualDataCds.push('10A78');
                    }

                    if (facts.nerveBlockUsedCd === 'N-RU') {
                        aqi56.perfNotMet = 1;
                        aqi56.qualDataCds.push('10A79');
                    }

                    if (facts.nerveBlockUsedCd === 'N-RS') {
                        aqi56.exception = 1;
                        aqi56.qualDataCds.push('11A01');
                    }
                }
            }
        }
        measures.push(aqi56);
        //END AQI56

        //AQI65
        let aqi65: QcdrMeasure2024 = new QcdrMeasure2024('AQI65');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi65.eligible = 1;

            if (this.isFieldMissing(facts.patAgeYears)) {
                aqi65.eligible = 0;
                aqi65.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears < 18) {
                    aqi65.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.bypassPerformedInd)) {
                aqi65.eligible = 0;
                aqi65.missingFields.push('Cardiopulmonary Bypass Performed');
            } else {
                if (facts.bypassPerformedInd === false) {
                    aqi65.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    aqi65.eligible = 0;
                }
                aqi65.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = ['00562', '00563', '00567', '00580'];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        aqi65.eligible = 0;
                    }
                }
            }

            //Process performance criteria and missing fields
            if (aqi65.eligible == 1) {
                if (!this.isFieldMissing(facts.hypothermiaDuringBypassCd) && facts.hypothermiaDuringBypassCd === 'Y') {
                    aqi65.perfMet = 1;
                    aqi65.qualDataCds.push('11A11');
                } else {
                    if (this.isFieldMissing(facts.hypothermiaDuringBypassCd)) {
                        aqi65.perfNotMet = 1;
                        aqi65.missingFields.push('Hypothermia During Bypass');
                        aqi65.qualDataCds.push('11A12');
                    } else {
                        if (this.isFieldMissing(facts.osaEducationInd)) {
                            aqi65.missingFields.push('OSA Education Doc');
                        } else {
                            if (
                                !this.isFieldMissing(facts.hypothermiaDuringBypassCd) &&
                                facts.hypothermiaDuringBypassCd === 'N'
                            ) {
                                aqi65.perfNotMet = 1;
                                aqi65.qualDataCds.push('11A12');
                            } else if (
                                !this.isFieldMissing(facts.hypothermiaDuringBypassCd) &&
                                facts.hypothermiaDuringBypassCd === 'NONE'
                            ) {
                                aqi65.perfNotMet = 1;
                                aqi65.qualDataCds.push('11A13');
                            }
                        }
                    }
                }
            }
        }
        measures.push(aqi65);
        //END AQI65

        //AQI67
        let aqi67: QcdrMeasure2024 = new QcdrMeasure2024('AQI67');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi67.eligible = 1;

            if (this.isFieldMissing(facts.patAgeYears)) {
                aqi67.eligible = 0;
                aqi67.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears < 70) {
                    aqi67.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.patTypCd)) {
                aqi67.eligible = 0;
                aqi67.missingFields.push('Patient Type');
            } else {
                if (facts.patTypCd !== 'IP') {
                    aqi67.eligible = 0;
                }
            }

            if (!this.isFieldMissing(facts.asaEmergInd) && facts.asaEmergInd === true) {
                aqi67.eligible = 0;
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    aqi67.eligible = 0;
                }
                aqi67.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = [
                    '00100',
                    '00102',
                    '00103',
                    '00104',
                    '00120',
                    '00124',
                    '00126',
                    '00140',
                    '00142',
                    '00144',
                    '00145',
                    '00147',
                    '00148',
                    '00160',
                    '00162',
                    '00164',
                    '00170',
                    '00172',
                    '00174',
                    '00176',
                    '00190',
                    '00192',
                    '00210',
                    '00211',
                    '00212',
                    '00214',
                    '00215',
                    '00216',
                    '00218',
                    '00220',
                    '00222',
                    '00300',
                    '00320',
                    '00322',
                    '00350',
                    '00352',
                    '00400',
                    '00402',
                    '00404',
                    '00406',
                    '00410',
                    '00450',
                    '00454',
                    '00470',
                    '00472',
                    '00474',
                    '00500',
                    '00520',
                    '00522',
                    '00524',
                    '00528',
                    '00529',
                    '00530',
                    '00532',
                    '00534',
                    '00537',
                    '00539',
                    '00540',
                    '00541',
                    '00542',
                    '00546',
                    '00548',
                    '00550',
                    '00560',
                    '00562',
                    '00563',
                    '00566',
                    '00567',
                    '00580',
                    '00600',
                    '00604',
                    '00620',
                    '00625',
                    '00626',
                    '00630',
                    '00632',
                    '00635',
                    '00640',
                    '00670',
                    '00700',
                    '00702',
                    '00730',
                    '00731',
                    '00732',
                    '00750',
                    '00752',
                    '00754',
                    '00756',
                    '00770',
                    '00790',
                    '00792',
                    '00794,',
                    '00796',
                    '00797',
                    '00800',
                    '00802',
                    '00811',
                    '00812',
                    '00813',
                    '00820',
                    '00830',
                    '00832',
                    '00840',
                    '00842',
                    '00844',
                    '00846',
                    '00848',
                    '00851',
                    '00860',
                    '00862',
                    '00864',
                    '00865',
                    '00866',
                    '00868',
                    '00870',
                    '00872',
                    '00873',
                    '00880',
                    '00882',
                    '00902',
                    '00904',
                    '00906',
                    '00908',
                    '00910',
                    '00912',
                    '00914',
                    '00916',
                    '00918',
                    '00920',
                    '00921',
                    '00922',
                    '00924',
                    '00926',
                    '00928',
                    '00930',
                    '00932',
                    '00934',
                    '00936',
                    '00938',
                    '00940',
                    '00942',
                    '00944',
                    '00948',
                    '00950',
                    '00952',
                    '01112',
                    '01120',
                    '01130',
                    '01140',
                    '01150',
                    '01160',
                    '01170',
                    '01173',
                    '01200',
                    '01202',
                    '01210',
                    '01212',
                    '01214',
                    '01215',
                    '01220',
                    '01230',
                    '01232',
                    '01234',
                    '01250',
                    '01260',
                    '01270',
                    '01272',
                    '01274',
                    '01320',
                    '01340',
                    '01360',
                    '01380',
                    '01382',
                    '01390',
                    '01392',
                    '01400',
                    '01402',
                    '01404',
                    '01420',
                    '01430',
                    '01432',
                    '01440',
                    '01442',
                    '01444',
                    '01462',
                    '01464',
                    '01470',
                    '01472',
                    '01474',
                    '01480',
                    '01482',
                    '01484',
                    '01486',
                    '01490',
                    '01500',
                    '01502',
                    '01520',
                    '01522',
                    '01610',
                    '01620',
                    '01622',
                    '01630',
                    '01634',
                    '01636',
                    '01638',
                    '01650',
                    '01652',
                    '01654',
                    '01656',
                    '01670',
                    '01680',
                    '01710',
                    '01712',
                    '01714',
                    '01716',
                    '01730',
                    '01732',
                    '01740',
                    '01742',
                    '01744',
                    '01756',
                    '01758',
                    '01760',
                    '01770',
                    '01772',
                    '01780',
                    '01782',
                    '01810',
                    '01820',
                    '01829',
                    '01830',
                    '01832',
                    '01840',
                    '01842',
                    '01844',
                    '01850',
                    '01852',
                    '01860',
                    '01916',
                    '01920',
                    '01922',
                    '01924',
                    '01925',
                    '01926',
                    '01930',
                    '01931',
                    '01932',
                    '01933',
                    '01937',
                    '01938',
                    '01939',
                    '01940',
                    '01941',
                    '01942',
                    '01951',
                    '01952',
                    '01991',
                    '01992',
                    '20526',
                    '20550',
                    '20551',
                    '20552',
                    '20553',
                    '20600',
                    '20604',
                    '20605',
                    '20606',
                    '20610',
                    '20611',
                    '27096',
                    '36555',
                    '36556',
                    '36570',
                    '36571',
                    '36578',
                    '36580',
                    '36581',
                    '36582',
                    '36583',
                    '36584',
                    '36585',
                    '62263',
                    '62264',
                    '62270',
                    '62272',
                    '62273',
                    '62280',
                    '62281',
                    '62282',
                    '62320',
                    '62321',
                    '62322',
                    '62323',
                    '62324',
                    '62325',
                    '62326',
                    '62327',
                    '62328',
                    '62329',
                    '62350',
                    '62355',
                    '62360',
                    '62361',
                    '62362',
                    '62365',
                    '62370',
                    '63650',
                    '63661',
                    '63662',
                    '63663',
                    '63664',
                    '63685',
                    '63688',
                    '64400',
                    '64405',
                    '64408',
                    '64415',
                    '64416',
                    '64417',
                    '64418',
                    '64420',
                    '64425',
                    '64430',
                    '64435',
                    '64445',
                    '64446',
                    '64447',
                    '64448',
                    '64449',
                    '64450',
                    '64451',
                    '64454',
                    '64461',
                    '64463',
                    '64479',
                    '64483',
                    '64486',
                    '64487',
                    '64488',
                    '64489',
                    '64490',
                    '64493',
                    '64505',
                    '64510',
                    '64517',
                    '64520',
                    '64530',
                    '64600',
                    '64605',
                    '64610',
                    '64620',
                    '64624',
                    '64625',
                    '64630',
                    '64633',
                    '64635',
                    '64640',
                    '64680',
                    '64681',
                    '93503',
                    '95990',
                    '95991',
                ];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        aqi67.eligible = 0;
                    }
                }
            }

            if (this.isFieldMissing(facts.frailtyScreenPosInd) || facts.frailtyScreenPosInd === false) {
                aqi67.eligible = 0;
            } else {
                aqi67.qualDataCds.push('11A14');
            }

            //Process performance criteria and missing fields
            if (aqi67.eligible == 1) {
                if (
                    this.isFieldMissing(facts.recvdMultidisciplinaryConsultInd) ||
                    facts.recvdMultidisciplinaryConsultInd === false
                ) {
                    aqi67.qualDataCds.push('11A16');
                    aqi67.perfNotMet = 1;
                } else {
                    aqi67.qualDataCds.push('11A15');
                    aqi67.perfMet = 1;
                }
            }
        }
        measures.push(aqi67);
        //END AQI67

        //AQI68 - NOTE: This is a retired measure as of 2024
        let aqi68: QcdrMeasure2024 = new QcdrMeasure2024('AQI68');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi68.eligible = 1;

            if (this.isFieldMissing(facts.patAgeYears)) {
                aqi68.eligible = 0;
                aqi68.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears < 18) {
                    aqi68.eligible = 0;
                }
            }

            if (!this.isFieldMissing(facts.asaEmergInd) && facts.asaEmergInd === true) {
                aqi68.eligible = 0;
            } else {
                aqi68.qualDataCds.push('G9643');
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    aqi68.eligible = 0;
                }
                aqi68.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = [
                    '00100',
                    '00102',
                    '00103',
                    '00104',
                    '00120',
                    '00124',
                    '00126',
                    '00140',
                    '00142',
                    '00144',
                    '00145',
                    '00147',
                    '00148',
                    '00160',
                    '00162',
                    '00164',
                    '00170',
                    '00172',
                    '00174',
                    '00176',
                    '00190',
                    '00192',
                    '00210',
                    '00211',
                    '00212',
                    '00214',
                    '00215',
                    '00216',
                    '00218',
                    '00220',
                    '00222',
                    '00300',
                    '00320',
                    '00322',
                    '00350',
                    '00352',
                    '00400',
                    '00402',
                    '00404',
                    '00406',
                    '00410',
                    '00450',
                    '00454',
                    '00470',
                    '00472',
                    '00474',
                    '00500',
                    '00520',
                    '00522',
                    '00524',
                    '00528',
                    '00529',
                    '00530',
                    '00532',
                    '00534',
                    '00537',
                    '00539',
                    '00540',
                    '00541',
                    '00542',
                    '00546',
                    '00548',
                    '00550',
                    '00560',
                    '00562',
                    '00563',
                    '00566',
                    '00567',
                    '00580',
                    '00600',
                    '00604',
                    '00620',
                    '00625',
                    '00626',
                    '00630',
                    '00632',
                    '00635',
                    '00640',
                    '00670',
                    '00700',
                    '00702',
                    '00730',
                    '00731',
                    '00732',
                    '00750',
                    '00752',
                    '00754',
                    '00756',
                    '00770',
                    '00790',
                    '00792',
                    '00794',
                    '00796',
                    '00797',
                    '00800',
                    '00802',
                    '00811',
                    '00812',
                    '00813',
                    '00820',
                    '00830',
                    '00832',
                    '00840',
                    '00842',
                    '00844',
                    '00846',
                    '00848',
                    '00851',
                    '00860',
                    '00862',
                    '00864',
                    '00865',
                    '00866',
                    '00868',
                    '00870',
                    '00872',
                    '00873',
                    '00880',
                    '00882',
                    '00902',
                    '00904',
                    '00906',
                    '00908',
                    '00910',
                    '00912',
                    '00914',
                    '00916',
                    '00918',
                    '00920',
                    '00921',
                    '00922',
                    '00924',
                    '00926',
                    '00928',
                    '00930',
                    '00932',
                    '00934',
                    '00936',
                    '00938',
                    '00940',
                    '00942',
                    '00944',
                    '00948',
                    '00950',
                    '00952',
                    '01112',
                    '01120',
                    '01130',
                    '01140',
                    '01150',
                    '01160',
                    '01170',
                    '01173',
                    '01200',
                    '01202',
                    '01210',
                    '01212',
                    '01214',
                    '01215',
                    '01220',
                    '01230',
                    '01232',
                    '01234',
                    '01250',
                    '01260',
                    '01270',
                    '01272',
                    '01274',
                    '01320',
                    '01340',
                    '01360',
                    '01380',
                    '01382',
                    '01390',
                    '01392',
                    '01400',
                    '01402',
                    '01404',
                    '01420',
                    '01430',
                    '01432',
                    '01440',
                    '01442',
                    '01444',
                    '01462',
                    '01464',
                    '01470',
                    '01472',
                    '01474',
                    '01480',
                    '01482',
                    '01484',
                    '01486',
                    '01490',
                    '01500',
                    '01502',
                    '01520',
                    '01522',
                    '01610',
                    '01620',
                    '01622',
                    '01630',
                    '01634',
                    '01636',
                    '01638',
                    '01650',
                    '01652',
                    '01654',
                    '01656',
                    '01670',
                    '01680',
                    '01710',
                    '01712',
                    '01714',
                    '01716',
                    '01730',
                    '01732',
                    '01740',
                    '01742',
                    '01744',
                    '01756',
                    '01758',
                    '01760',
                    '01770',
                    '01772',
                    '01780',
                    '01782',
                    '01810',
                    '01820',
                    '01829',
                    '01830',
                    '01832',
                    '01840',
                    '01842',
                    '01844',
                    '01850',
                    '01852',
                    '01860',
                    '01916',
                    '01920',
                    '01922',
                    '01924',
                    '01925',
                    '01926',
                    '01930',
                    '01931',
                    '01932',
                    '01933',
                    '01935',
                    '01936',
                    '01951',
                    '01952',
                    '01958',
                    '01960',
                    '01961',
                    '01962',
                    '01963',
                    '01965',
                    '01966',
                    '01967',
                    '01991',
                    '01992',
                ];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        aqi68.eligible = 0;
                    }
                }
            }
            //Process performance criteria and missing fields
            if (aqi68.eligible == 1) {
                if (!this.isFieldMissing(facts.preopEvalOsaPosInd) && facts.preopEvalOsaPosInd === false) {
                    aqi68.perfMet = 1;
                    aqi68.qualDataCds.push('11A27');
                } else if (
                    //old logic prior to 2024 - keeping for customers who have outdated forms
                    (((!this.isFieldMissing(facts.preopEvalOsaPosInd) && facts.preopEvalOsaPosInd === true) ||
                        (!this.isFieldMissing(facts.priorOsaDiagInd) && facts.priorOsaDiagInd === true)) &&
                        !this.isFieldMissing(facts.osaMitigationUsedInd) &&
                        facts.osaMitigationUsedInd === true) ||
                    //new logic in 2024
                    (((!this.isFieldMissing(facts.preopEvalOsaPosInd) && facts.preopEvalOsaPosInd === true) ||
                        (!this.isFieldMissing(facts.priorOsaDiagInd) && facts.priorOsaDiagInd === true)) &&
                        !this.isFieldMissing(facts.osaMitigationUsedCd) &&
                        facts.osaMitigationUsedCd === 'Y')
                ) {
                    aqi68.perfMet = 1;
                    aqi68.qualDataCds.push('11A26');
                } else if (
                    //old logic prior to 2024 - keeping for customers who have outdated forms
                    (!this.isFieldMissing(facts.patIncapacitatedInd) && facts.patIncapacitatedInd === true) ||
                    //new logic in 2024
                    (!this.isFieldMissing(facts.osaMitigationUsedCd) && facts.osaMitigationUsedCd === 'N-RS') ||
                    (!this.isFieldMissing(facts.osaScreenCd) && facts.osaScreenCd === 'N-RS')
                ) {
                    aqi68.exception = 1;
                    aqi68.qualDataCds.push('11A38');
                } else if (
                    //old logic prior to 2024 - keeping for customers who have outdated forms
                    this.isFieldMissing(facts.preopEvalOsaPosInd) ||
                    (!this.isFieldMissing(facts.preopEvalOsaPosInd) &&
                        facts.preopEvalOsaPosInd === true &&
                        !this.isFieldMissing(facts.osaMitigationUsedInd) &&
                        facts.osaMitigationUsedInd === false) ||
                    //new logic in 2024
                    this.isFieldMissing(facts.preopEvalOsaPosInd) ||
                    (!this.isFieldMissing(facts.preopEvalOsaPosInd) &&
                        facts.preopEvalOsaPosInd === true &&
                        !this.isFieldMissing(facts.osaMitigationUsedCd) &&
                        facts.osaMitigationUsedCd === 'N-RU')
                ) {
                    aqi68.perfNotMet = 1;
                    aqi68.qualDataCds.push('11A28');
                } else {
                    //Process missing fields
                    if (this.isFieldMissing(facts.priorOsaDiagInd)) {
                        aqi68.missingFields.push('Prior OSA Diagnosis');
                    } else {
                        if (
                            !this.isFieldMissing(facts.priorOsaDiagInd) &&
                            facts.priorOsaDiagInd == false &&
                            //new logic in 2024
                            this.isFieldMissing(facts.osaMitigationUsedCd)
                        ) {
                            aqi68.missingFields.push('OSA Mitigation Used Code');
                        }
                        if (
                            !this.isFieldMissing(facts.osaMitigationUsedCd) &&
                            facts.osaMitigationUsedCd == 'N-RU' &&
                            this.isFieldMissing(facts.preopEvalOsaPosInd)
                        ) {
                            aqi68.missingFields.push('OSA Screen Positive');
                        }
                        if (
                            !this.isFieldMissing(facts.preopEvalOsaPosInd) &&
                            facts.preopEvalOsaPosInd == true &&
                            this.isFieldMissing(facts.osaMitigationUsedCd)
                        ) {
                            aqi68.missingFields.push('OSA Mitigation Used Code');
                        }
                    }
                }
            }
        }
        measures.push(aqi68);
        //END AQI68

        //AQI71A
        let aqi71a: QcdrMeasure2024 = new QcdrMeasure2024('AQI71A');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi71a.eligible = 1;

            if (this.isFieldMissing(facts.patAgeYears)) {
                aqi71a.eligible = 0;
                aqi71a.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears >= 18) {
                    aqi71a.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.patTypCd)) {
                aqi71a.eligible = 0;
                aqi71a.missingFields.push('Patient Type');
            } else {
                if (facts.patTypCd !== 'AMB') {
                    aqi71a.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    aqi71a.eligible = 0;
                }
                aqi71a.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = [
                    '00100',
                    '00102',
                    '00103',
                    '00104',
                    '00120',
                    '00124',
                    '00126',
                    '00140',
                    '00142',
                    '00144',
                    '00145',
                    '00147',
                    '00148',
                    '00160',
                    '00164',
                    '00170',
                    '00172',
                    '00174',
                    '00176',
                    '00300',
                    '00320',
                    '00322',
                    '00400',
                    '00402',
                    '00404',
                    '00410',
                    '00450',
                    '00454',
                    '00520',
                    '00522',
                    '00524',
                    '00530',
                    '00532',
                    '00534',
                    '00537',
                    '00700',
                    '00702',
                    '00730',
                    '00731',
                    '00732',
                    '00750',
                    '00752',
                    '00790',
                    '00797',
                    '00800',
                    '00802',
                    '00811',
                    '00812',
                    '00813',
                    '00820',
                    '00830',
                    '00832',
                    '00851',
                    '00870',
                    '00872',
                    '00873',
                    '00902',
                    '00906',
                    '00910',
                    '00912',
                    '00914',
                    '00918',
                    '00920',
                    '00921',
                    '00922',
                    '00924',
                    '00926',
                    '00928',
                    '00930',
                    '00938',
                    '00940',
                    '00942',
                    '00944',
                    '00948',
                    '00950',
                    '00952',
                    '01112',
                    '01120',
                    '01202',
                    '01250',
                    '01260',
                    '01320',
                    '01380',
                    '01382',
                    '01390',
                    '01392',
                    '01400',
                    '01402',
                    '01404',
                    '01464',
                    '01470',
                    '01472',
                    '01474',
                    '01480',
                    '01520',
                    '01610',
                    '01620',
                    '01622',
                    '01630',
                    '01634',
                    '01638',
                    '01670',
                    '01710',
                    '01712',
                    '01714',
                    '01716',
                    '01730',
                    '01732',
                    '01740',
                    '01742',
                    '01744',
                    '01758',
                    '01760',
                    '01810',
                    '01820',
                    '01829',
                    '01830',
                    '01832',
                    '01840',
                    '01842',
                    '01844',
                    '01850',
                    '01852',
                    '01860',
                    '01916',
                    '01920',
                    '01930',
                    '01937',
                    '01938',
                    '01939',
                    '01940',
                    '01941',
                    '01942',
                    '01965',
                    '01966',
                    '01991',
                    '01992',
                ];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        aqi71a.eligible = 0;
                    }
                }
            }

            let diabetesDiagnosis: boolean = false;
            if (!this.isFieldMissing(facts.allIcdCmCodes)) {
                const icdCmList: string[] = [
                    'E10.10',
                    'E10.3291',
                    'E10.3399',
                    'E10.3513',
                    'E10.3542',
                    'E10.36',
                    'E10.49',
                    'E10.638',
                    'E11.21',
                    'E11.3293',
                    'E11.3412',
                    'E11.3521',
                    'E11.3549',
                    'E11.37X2',
                    'E11.52',
                    'E11.649',
                    'E13.29',
                    'E13.3311',
                    'E13.3419',
                    'E13.3523',
                    'E13.3552',
                    'E13.37X9',
                    'E13.610',
                    'E13.69',
                    'E10.11',
                    'E10.3292',
                    'E10.3411',
                    'E10.3519',
                    'E10.3543',
                    'E10.37X1',
                    'E10.51',
                    'E10.641',
                    'E11.22',
                    'E11.3299',
                    'E11.3413',
                    'E11.3522',
                    'E11.3551',
                    'E11.37X3',
                    'E11.59',
                    'E11.65',
                    'E13.311',
                    'E13.3312',
                    'E13.3491',
                    'E13.3529',
                    'E13.3553',
                    'E13.39',
                    'E13.618',
                    'E13.8',
                    'E10.21',
                    'E10.3293',
                    'E10.3412',
                    'E10.3521',
                    'E10.3549',
                    'E10.37X2',
                    'E10.52',
                    'E10.649',
                    'E11.29',
                    'E11.3311',
                    'E11.3419',
                    'E11.3523',
                    'E11.3552',
                    'E11.37X9',
                    'E11.610',
                    'E11.69',
                    'E13.319',
                    'E13.3313',
                    'E13.3492',
                    'E13.3531',
                    'E13.3559',
                    'E13.40',
                    'E13.620',
                    'E13.9',
                    'E10.22',
                    'E10.3299',
                    'E10.3413',
                    'E10.3522',
                    'E10.3551',
                    'E10.37X3',
                    'E10.59',
                    'E10.65',
                    'E11.311',
                    'E11.3312',
                    'E11.3491',
                    'E11.3529',
                    'E11.3553',
                    'E11.39',
                    'E11.618',
                    'E11.8',
                    'E13.3211',
                    'E13.3319',
                    'E13.3493',
                    'E13.3532',
                    'E13.3591',
                    'E13.41',
                    'E13.621',
                    'E10.29',
                    'E10.3311',
                    'E10.3419',
                    'E10.3523',
                    'E10.3552',
                    'E10.37X9',
                    'E10.610',
                    'E10.69',
                    'E11.319',
                    'E11.3313',
                    'E11.3492',
                    'E11.3531',
                    'E11.3559',
                    'E11.40',
                    'E11.620',
                    'E11.9',
                    'E13.3212',
                    'E13.3391',
                    'E13.3499',
                    'E13.3533',
                    'E13.3592',
                    'E13.42',
                    'E13.622',
                    'E10.311',
                    'E10.3312',
                    'E10.3491',
                    'E10.3529',
                    'E10.3553',
                    'E10.39',
                    'E10.618',
                    'E10.8',
                    'E11.3211',
                    'E11.3319',
                    'E11.3493',
                    'E11.3532',
                    'E11.3591',
                    'E11.41',
                    'E11.621',
                    'E13.00',
                    'E13.3213',
                    'E13.3392',
                    'E13.3511',
                    'E13.3539',
                    'E13.3593',
                    'E13.43',
                    'E13.628',
                    'E10.319',
                    'E10.3313',
                    'E10.3492',
                    'E10.3531',
                    'E10.3559',
                    'E10.40',
                    'E10.620',
                    'E10.9',
                    'E11.3212',
                    'E11.3391',
                    'E11.3499',
                    'E11.3533',
                    'E11.3592',
                    'E11.42',
                    'E11.622',
                    'E13.01',
                    'E13.3219',
                    'E13.3393',
                    'E13.3512',
                    'E13.3541',
                    'E13.3599',
                    'E13.44',
                    'E13.630',
                    'E10.3211',
                    'E10.3319',
                    'E10.3493',
                    'E10.3532',
                    'E10.3591',
                    'E10.41',
                    'E10.621',
                    'E11.00',
                    'E11.3213',
                    'E11.3392',
                    'E11.3511',
                    'E11.3539',
                    'E11.3593',
                    'E11.43',
                    'E11.628',
                    'E13.10',
                    'E13.3291',
                    'E13.3399',
                    'E13.3513',
                    'E13.3542',
                    'E13.36',
                    'E13.49',
                    'E13.638',
                    'E10.3212',
                    'E10.3391',
                    'E10.3499',
                    'E10.3533',
                    'E10.3592',
                    'E10.42',
                    'E10.622',
                    'E11.01',
                    'E11.3219',
                    'E11.3393',
                    'E11.3512',
                    'E11.3541',
                    'E11.3599',
                    'E11.44',
                    'E11.630',
                    'E13.11',
                    'E13.3292',
                    'E13.3411',
                    'E13.3519',
                    'E13.3543',
                    'E13.37X1',
                    'E13.51',
                    'E13.641',
                    'E10.3213',
                    'E10.3392',
                    'E10.3511',
                    'E10.3539',
                    'E10.3593',
                    'E10.43',
                    'E10.628',
                    'E11.10',
                    'E11.3291',
                    'E11.3399',
                    'E11.3513',
                    'E11.3542',
                    'E11.36',
                    'E11.49',
                    'E11.638',
                    'E13.21',
                    'E13.3293',
                    'E13.3412',
                    'E13.3521',
                    'E13.3549',
                    'E13.37X2',
                    'E13.52',
                    'E13.649',
                    'E10.3219',
                    'E10.3393',
                    'E10.3512',
                    'E10.3541',
                    'E10.3599',
                    'E10.44',
                    'E10.630',
                    'E11.11',
                    'E11.3292',
                    'E11.3411',
                    'E11.3519',
                    'E11.3543',
                    'E11.37X1',
                    'E11.51',
                    'E11.641',
                    'E13.22',
                    'E13.3299',
                    'E13.3413',
                    'E13.3522',
                    'E13.3551',
                    'E13.37X3',
                    'E13.59',
                    'E13.65',
                ];
                if (this.arrayContainsAny(facts.allIcdCmCodes, icdCmList)) {
                    diabetesDiagnosis = true;
                }
            }

            if (
                diabetesDiagnosis ||
                (!this.isFieldMissing(facts.diabetesDiagnosisInd) && facts.diabetesDiagnosisInd === true)
            ) {
                aqi71a.qualDataCds.push('11A41');
            } else {
                aqi71a.eligible = 0;
            }

            let startTime = moment(facts.anesthesiaStartDateTime);
            let endTime = moment(facts.anesthesiaEndDateTime);
            let anesthesiaDurationMins = endTime.diff(startTime, 'minutes');
            if (anesthesiaDurationMins < 30) {
                aqi71a.eligible = 0;
                aqi71a.qualDataCds.push('11A45');
            }

            //Process performance criteria and missing fields
            if (aqi71a.eligible == 1) {
                if (
                    this.isFieldMissing(facts.bgTestPriorToAnesthesiaInd) ||
                    facts.bgTestPriorToAnesthesiaInd === false
                ) {
                    aqi71a.qualDataCds.push('11A52');
                    aqi71a.perfNotMet = 1;
                } else {
                    aqi71a.qualDataCds.push('11A51');
                    aqi71a.perfMet = 1;
                }
            }
        }
        measures.push(aqi71a);
        //END AQI71A

        //AQI71B
        let aqi71b: QcdrMeasure2024 = new QcdrMeasure2024('AQI71B');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi71b.eligible = 1;

            if (this.isFieldMissing(facts.patAgeYears)) {
                aqi71b.eligible = 0;
                aqi71b.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears >= 18) {
                    aqi71b.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.patTypCd)) {
                aqi71b.eligible = 0;
                aqi71b.missingFields.push('Patient Type');
            } else {
                if (facts.patTypCd !== 'AMB') {
                    aqi71b.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    aqi71b.eligible = 0;
                }
                aqi71b.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = [
                    '00100',
                    '00102',
                    '00103',
                    '00104',
                    '00120',
                    '00124',
                    '00126',
                    '00140',
                    '00142',
                    '00144',
                    '00145',
                    '00147',
                    '00148',
                    '00160',
                    '00164',
                    '00170',
                    '00172',
                    '00174',
                    '00176',
                    '00300',
                    '00320',
                    '00322',
                    '00400',
                    '00402',
                    '00404',
                    '00410',
                    '00450',
                    '00454',
                    '00520',
                    '00522',
                    '00524',
                    '00530',
                    '00532',
                    '00534',
                    '00537',
                    '00700',
                    '00702',
                    '00730',
                    '00731',
                    '00732',
                    '00750',
                    '00752',
                    '00790',
                    '00797',
                    '00800',
                    '00802',
                    '00811',
                    '00812',
                    '00813',
                    '00820',
                    '00830',
                    '00832',
                    '00851',
                    '00870',
                    '00872',
                    '00873',
                    '00902',
                    '00906',
                    '00910',
                    '00912',
                    '00914',
                    '00918',
                    '00920',
                    '00921',
                    '00922',
                    '00924',
                    '00926',
                    '00928',
                    '00930',
                    '00938',
                    '00940',
                    '00942',
                    '00944',
                    '00948',
                    '00950',
                    '00952',
                    '01112',
                    '01120',
                    '01202',
                    '01250',
                    '01260',
                    '01320',
                    '01380',
                    '01382',
                    '01390',
                    '01392',
                    '01400',
                    '01402',
                    '01404',
                    '01464',
                    '01470',
                    '01472',
                    '01474',
                    '01480',
                    '01520',
                    '01610',
                    '01620',
                    '01622',
                    '01630',
                    '01634',
                    '01638',
                    '01670',
                    '01710',
                    '01712',
                    '01714',
                    '01716',
                    '01730',
                    '01732',
                    '01740',
                    '01742',
                    '01744',
                    '01758',
                    '01760',
                    '01810',
                    '01820',
                    '01829',
                    '01830',
                    '01832',
                    '01840',
                    '01842',
                    '01844',
                    '01850',
                    '01852',
                    '01860',
                    '01916',
                    '01920',
                    '01930',
                    '01937',
                    '01938',
                    '01939',
                    '01940',
                    '01941',
                    '01942',
                    '01965',
                    '01966',
                    '01991',
                    '01992',
                ];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        aqi71b.eligible = 0;
                    }
                }
            }

            let diabetesDiagnosis: boolean = false;
            if (!this.isFieldMissing(facts.allIcdCmCodes)) {
                const icdCmList: string[] = [
                    'E10.10',
                    'E10.3291',
                    'E10.3399',
                    'E10.3513',
                    'E10.3542',
                    'E10.36',
                    'E10.49',
                    'E10.638',
                    'E11.21',
                    'E11.3293',
                    'E11.3412',
                    'E11.3521',
                    'E11.3549',
                    'E11.37X2',
                    'E11.52',
                    'E11.649',
                    'E13.29',
                    'E13.3311',
                    'E13.3419',
                    'E13.3523',
                    'E13.3552',
                    'E13.37X9',
                    'E13.610',
                    'E13.69',
                    'E10.11',
                    'E10.3292',
                    'E10.3411',
                    'E10.3519',
                    'E10.3543',
                    'E10.37X1',
                    'E10.51',
                    'E10.641',
                    'E11.22',
                    'E11.3299',
                    'E11.3413',
                    'E11.3522',
                    'E11.3551',
                    'E11.37X3',
                    'E11.59',
                    'E11.65',
                    'E13.311',
                    'E13.3312',
                    'E13.3491',
                    'E13.3529',
                    'E13.3553',
                    'E13.39',
                    'E13.618',
                    'E13.8',
                    'E10.21',
                    'E10.3293',
                    'E10.3412',
                    'E10.3521',
                    'E10.3549',
                    'E10.37X2',
                    'E10.52',
                    'E10.649',
                    'E11.29',
                    'E11.3311',
                    'E11.3419',
                    'E11.3523',
                    'E11.3552',
                    'E11.37X9',
                    'E11.610',
                    'E11.69',
                    'E13.319',
                    'E13.3313',
                    'E13.3492',
                    'E13.3531',
                    'E13.3559',
                    'E13.40',
                    'E13.620',
                    'E13.9',
                    'E10.22',
                    'E10.3299',
                    'E10.3413',
                    'E10.3522',
                    'E10.3551',
                    'E10.37X3',
                    'E10.59',
                    'E10.65',
                    'E11.311',
                    'E11.3312',
                    'E11.3491',
                    'E11.3529',
                    'E11.3553',
                    'E11.39',
                    'E11.618',
                    'E11.8',
                    'E13.3211',
                    'E13.3319',
                    'E13.3493',
                    'E13.3532',
                    'E13.3591',
                    'E13.41',
                    'E13.621',
                    'E10.29',
                    'E10.3311',
                    'E10.3419',
                    'E10.3523',
                    'E10.3552',
                    'E10.37X9',
                    'E10.610',
                    'E10.69',
                    'E11.319',
                    'E11.3313',
                    'E11.3492',
                    'E11.3531',
                    'E11.3559',
                    'E11.40',
                    'E11.620',
                    'E11.9',
                    'E13.3212',
                    'E13.3391',
                    'E13.3499',
                    'E13.3533',
                    'E13.3592',
                    'E13.42',
                    'E13.622',
                    'E10.311',
                    'E10.3312',
                    'E10.3491',
                    'E10.3529',
                    'E10.3553',
                    'E10.39',
                    'E10.618',
                    'E10.8',
                    'E11.3211',
                    'E11.3319',
                    'E11.3493',
                    'E11.3532',
                    'E11.3591',
                    'E11.41',
                    'E11.621',
                    'E13.00',
                    'E13.3213',
                    'E13.3392',
                    'E13.3511',
                    'E13.3539',
                    'E13.3593',
                    'E13.43',
                    'E13.628',
                    'E10.319',
                    'E10.3313',
                    'E10.3492',
                    'E10.3531',
                    'E10.3559',
                    'E10.40',
                    'E10.620',
                    'E10.9',
                    'E11.3212',
                    'E11.3391',
                    'E11.3499',
                    'E11.3533',
                    'E11.3592',
                    'E11.42',
                    'E11.622',
                    'E13.01',
                    'E13.3219',
                    'E13.3393',
                    'E13.3512',
                    'E13.3541',
                    'E13.3599',
                    'E13.44',
                    'E13.630',
                    'E10.3211',
                    'E10.3319',
                    'E10.3493',
                    'E10.3532',
                    'E10.3591',
                    'E10.41',
                    'E10.621',
                    'E11.00',
                    'E11.3213',
                    'E11.3392',
                    'E11.3511',
                    'E11.3539',
                    'E11.3593',
                    'E11.43',
                    'E11.628',
                    'E13.10',
                    'E13.3291',
                    'E13.3399',
                    'E13.3513',
                    'E13.3542',
                    'E13.36',
                    'E13.49',
                    'E13.638',
                    'E10.3212',
                    'E10.3391',
                    'E10.3499',
                    'E10.3533',
                    'E10.3592',
                    'E10.42',
                    'E10.622',
                    'E11.01',
                    'E11.3219',
                    'E11.3393',
                    'E11.3512',
                    'E11.3541',
                    'E11.3599',
                    'E11.44',
                    'E11.630',
                    'E13.11',
                    'E13.3292',
                    'E13.3411',
                    'E13.3519',
                    'E13.3543',
                    'E13.37X1',
                    'E13.51',
                    'E13.641',
                    'E10.3213',
                    'E10.3392',
                    'E10.3511',
                    'E10.3539',
                    'E10.3593',
                    'E10.43',
                    'E10.628',
                    'E11.10',
                    'E11.3291',
                    'E11.3399',
                    'E11.3513',
                    'E11.3542',
                    'E11.36',
                    'E11.49',
                    'E11.638',
                    'E13.21',
                    'E13.3293',
                    'E13.3412',
                    'E13.3521',
                    'E13.3549',
                    'E13.37X2',
                    'E13.52',
                    'E13.649',
                    'E10.3219',
                    'E10.3393',
                    'E10.3512',
                    'E10.3541',
                    'E10.3599',
                    'E10.44',
                    'E10.630',
                    'E11.11',
                    'E11.3292',
                    'E11.3411',
                    'E11.3519',
                    'E11.3543',
                    'E11.37X1',
                    'E11.51',
                    'E11.641',
                    'E13.22',
                    'E13.3299',
                    'E13.3413',
                    'E13.3522',
                    'E13.3551',
                    'E13.37X3',
                    'E13.59',
                    'E13.65',
                ];
                if (this.arrayContainsAny(facts.allIcdCmCodes, icdCmList)) {
                    diabetesDiagnosis = true;
                }
            }

            if (
                diabetesDiagnosis ||
                (!this.isFieldMissing(facts.diabetesDiagnosisInd) && facts.diabetesDiagnosisInd === true)
            ) {
                aqi71b.qualDataCds.push('11A41');
            } else {
                aqi71b.eligible = 0;
            }

            if (this.isFieldMissing(facts.bgGt180Ind) || facts.bgGt180Ind === false) {
                aqi71b.missingFields.push('Resulting Blood Glucose > 180 mg/dL');
                aqi71b.eligible = 0;
            } else {
                aqi71b.qualDataCds.push('11A44');
            }

            let startTime = moment(facts.anesthesiaStartDateTime);
            let endTime = moment(facts.anesthesiaEndDateTime);
            let anesthesiaDurationMins = endTime.diff(startTime, 'minutes');
            if (anesthesiaDurationMins < 30) {
                aqi71b.eligible = 0;
                aqi71b.qualDataCds.push('11A45');
            }

            //Process performance criteria and missing fields
            if (aqi71b.eligible == 1) {
                if (this.isFieldMissing(facts.recvdInsulinPriorToAnesEndCd)) {
                    aqi71b.missingFields.push('Received Insulin Prior to Anesthesia End');
                } else {
                    if (facts.recvdInsulinPriorToAnesEndCd === 'Y') {
                        aqi71b.perfMet = 1;
                        aqi71b.qualDataCds.push('11A53');
                    } else if (facts.recvdInsulinPriorToAnesEndCd === 'N-RS') {
                        aqi71b.exception = 1;
                        aqi71b.qualDataCds.push('11A82');
                    } else if (facts.recvdInsulinPriorToAnesEndCd === 'N-RU') {
                        aqi71b.perfNotMet = 1;
                        aqi71b.qualDataCds.push('11A54');
                    }
                }
            }
        }
        measures.push(aqi71b);
        //END AQI71B

        //AQI71C
        let aqi71c: QcdrMeasure2024 = new QcdrMeasure2024('AQI71C');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi71c.eligible = 1;

            if (this.isFieldMissing(facts.patAgeYears)) {
                aqi71c.eligible = 0;
                aqi71c.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears >= 18) {
                    aqi71c.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.patTypCd)) {
                aqi71c.eligible = 0;
                aqi71c.missingFields.push('Patient Type');
            } else {
                if (facts.patTypCd !== 'AMB') {
                    aqi71c.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    aqi71c.eligible = 0;
                }
                aqi71c.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = [
                    '00100',
                    '00102',
                    '00103',
                    '00104',
                    '00120',
                    '00124',
                    '00126',
                    '00140',
                    '00142',
                    '00144',
                    '00145',
                    '00147',
                    '00148',
                    '00160',
                    '00164',
                    '00170',
                    '00172',
                    '00174',
                    '00176',
                    '00300',
                    '00320',
                    '00322',
                    '00400',
                    '00402',
                    '00404',
                    '00410',
                    '00450',
                    '00454',
                    '00520',
                    '00522',
                    '00524',
                    '00530',
                    '00532',
                    '00534',
                    '00537',
                    '00700',
                    '00702',
                    '00730',
                    '00731',
                    '00732',
                    '00750',
                    '00752',
                    '00790',
                    '00797',
                    '00800',
                    '00802',
                    '00811',
                    '00812',
                    '00813',
                    '00820',
                    '00830',
                    '00832',
                    '00851',
                    '00870',
                    '00872',
                    '00873',
                    '00902',
                    '00906',
                    '00910',
                    '00912',
                    '00914',
                    '00918',
                    '00920',
                    '00921',
                    '00922',
                    '00924',
                    '00926',
                    '00928',
                    '00930',
                    '00938',
                    '00940',
                    '00942',
                    '00944',
                    '00948',
                    '00950',
                    '00952',
                    '01112',
                    '01120',
                    '01202',
                    '01250',
                    '01260',
                    '01320',
                    '01380',
                    '01382',
                    '01390',
                    '01392',
                    '01400',
                    '01402',
                    '01404',
                    '01464',
                    '01470',
                    '01472',
                    '01474',
                    '01480',
                    '01520',
                    '01610',
                    '01620',
                    '01622',
                    '01630',
                    '01634',
                    '01638',
                    '01670',
                    '01710',
                    '01712',
                    '01714',
                    '01716',
                    '01730',
                    '01732',
                    '01740',
                    '01742',
                    '01744',
                    '01758',
                    '01760',
                    '01810',
                    '01820',
                    '01829',
                    '01830',
                    '01832',
                    '01840',
                    '01842',
                    '01844',
                    '01850',
                    '01852',
                    '01860',
                    '01916',
                    '01920',
                    '01930',
                    '01937',
                    '01938',
                    '01939',
                    '01940',
                    '01941',
                    '01942',
                    '01965',
                    '01966',
                    '01991',
                    '01992',
                ];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        aqi71c.eligible = 0;
                    }
                }
            }

            let diabetesDiagnosis: boolean = false;
            if (!this.isFieldMissing(facts.allIcdCmCodes)) {
                const icdCmList: string[] = [
                    'E10.10',
                    'E10.3291',
                    'E10.3399',
                    'E10.3513',
                    'E10.3542',
                    'E10.36',
                    'E10.49',
                    'E10.638',
                    'E11.21',
                    'E11.3293',
                    'E11.3412',
                    'E11.3521',
                    'E11.3549',
                    'E11.37X2',
                    'E11.52',
                    'E11.649',
                    'E13.29',
                    'E13.3311',
                    'E13.3419',
                    'E13.3523',
                    'E13.3552',
                    'E13.37X9',
                    'E13.610',
                    'E13.69',
                    'E10.11',
                    'E10.3292',
                    'E10.3411',
                    'E10.3519',
                    'E10.3543',
                    'E10.37X1',
                    'E10.51',
                    'E10.641',
                    'E11.22',
                    'E11.3299',
                    'E11.3413',
                    'E11.3522',
                    'E11.3551',
                    'E11.37X3',
                    'E11.59',
                    'E11.65',
                    'E13.311',
                    'E13.3312',
                    'E13.3491',
                    'E13.3529',
                    'E13.3553',
                    'E13.39',
                    'E13.618',
                    'E13.8',
                    'E10.21',
                    'E10.3293',
                    'E10.3412',
                    'E10.3521',
                    'E10.3549',
                    'E10.37X2',
                    'E10.52',
                    'E10.649',
                    'E11.29',
                    'E11.3311',
                    'E11.3419',
                    'E11.3523',
                    'E11.3552',
                    'E11.37X9',
                    'E11.610',
                    'E11.69',
                    'E13.319',
                    'E13.3313',
                    'E13.3492',
                    'E13.3531',
                    'E13.3559',
                    'E13.40',
                    'E13.620',
                    'E13.9',
                    'E10.22',
                    'E10.3299',
                    'E10.3413',
                    'E10.3522',
                    'E10.3551',
                    'E10.37X3',
                    'E10.59',
                    'E10.65',
                    'E11.311',
                    'E11.3312',
                    'E11.3491',
                    'E11.3529',
                    'E11.3553',
                    'E11.39',
                    'E11.618',
                    'E11.8',
                    'E13.3211',
                    'E13.3319',
                    'E13.3493',
                    'E13.3532',
                    'E13.3591',
                    'E13.41',
                    'E13.621',
                    'E10.29',
                    'E10.3311',
                    'E10.3419',
                    'E10.3523',
                    'E10.3552',
                    'E10.37X9',
                    'E10.610',
                    'E10.69',
                    'E11.319',
                    'E11.3313',
                    'E11.3492',
                    'E11.3531',
                    'E11.3559',
                    'E11.40',
                    'E11.620',
                    'E11.9',
                    'E13.3212',
                    'E13.3391',
                    'E13.3499',
                    'E13.3533',
                    'E13.3592',
                    'E13.42',
                    'E13.622',
                    'E10.311',
                    'E10.3312',
                    'E10.3491',
                    'E10.3529',
                    'E10.3553',
                    'E10.39',
                    'E10.618',
                    'E10.8',
                    'E11.3211',
                    'E11.3319',
                    'E11.3493',
                    'E11.3532',
                    'E11.3591',
                    'E11.41',
                    'E11.621',
                    'E13.00',
                    'E13.3213',
                    'E13.3392',
                    'E13.3511',
                    'E13.3539',
                    'E13.3593',
                    'E13.43',
                    'E13.628',
                    'E10.319',
                    'E10.3313',
                    'E10.3492',
                    'E10.3531',
                    'E10.3559',
                    'E10.40',
                    'E10.620',
                    'E10.9',
                    'E11.3212',
                    'E11.3391',
                    'E11.3499',
                    'E11.3533',
                    'E11.3592',
                    'E11.42',
                    'E11.622',
                    'E13.01',
                    'E13.3219',
                    'E13.3393',
                    'E13.3512',
                    'E13.3541',
                    'E13.3599',
                    'E13.44',
                    'E13.630',
                    'E10.3211',
                    'E10.3319',
                    'E10.3493',
                    'E10.3532',
                    'E10.3591',
                    'E10.41',
                    'E10.621',
                    'E11.00',
                    'E11.3213',
                    'E11.3392',
                    'E11.3511',
                    'E11.3539',
                    'E11.3593',
                    'E11.43',
                    'E11.628',
                    'E13.10',
                    'E13.3291',
                    'E13.3399',
                    'E13.3513',
                    'E13.3542',
                    'E13.36',
                    'E13.49',
                    'E13.638',
                    'E10.3212',
                    'E10.3391',
                    'E10.3499',
                    'E10.3533',
                    'E10.3592',
                    'E10.42',
                    'E10.622',
                    'E11.01',
                    'E11.3219',
                    'E11.3393',
                    'E11.3512',
                    'E11.3541',
                    'E11.3599',
                    'E11.44',
                    'E11.630',
                    'E13.11',
                    'E13.3292',
                    'E13.3411',
                    'E13.3519',
                    'E13.3543',
                    'E13.37X1',
                    'E13.51',
                    'E13.641',
                    'E10.3213',
                    'E10.3392',
                    'E10.3511',
                    'E10.3539',
                    'E10.3593',
                    'E10.43',
                    'E10.628',
                    'E11.10',
                    'E11.3291',
                    'E11.3399',
                    'E11.3513',
                    'E11.3542',
                    'E11.36',
                    'E11.49',
                    'E11.638',
                    'E13.21',
                    'E13.3293',
                    'E13.3412',
                    'E13.3521',
                    'E13.3549',
                    'E13.37X2',
                    'E13.52',
                    'E13.649',
                    'E10.3219',
                    'E10.3393',
                    'E10.3512',
                    'E10.3541',
                    'E10.3599',
                    'E10.44',
                    'E10.630',
                    'E11.11',
                    'E11.3292',
                    'E11.3411',
                    'E11.3519',
                    'E11.3543',
                    'E11.37X1',
                    'E11.51',
                    'E11.641',
                    'E13.22',
                    'E13.3299',
                    'E13.3413',
                    'E13.3522',
                    'E13.3551',
                    'E13.37X3',
                    'E13.59',
                    'E13.65',
                ];
                if (this.arrayContainsAny(facts.allIcdCmCodes, icdCmList)) {
                    diabetesDiagnosis = true;
                }
            }

            if (
                diabetesDiagnosis ||
                (!this.isFieldMissing(facts.diabetesDiagnosisInd) && facts.diabetesDiagnosisInd === true)
            ) {
                aqi71c.qualDataCds.push('11A41');
            } else {
                aqi71c.eligible = 0;
            }

            if (
                !this.isFieldMissing(facts.recvdInsulinPriorToAnesEndCd) &&
                facts.recvdInsulinPriorToAnesEndCd === 'Y'
            ) {
                aqi71c.qualDataCds.push('11A55');
            } else {
                aqi71c.eligible = 0;
            }

            let startTime = moment(facts.anesthesiaStartDateTime);
            let endTime = moment(facts.anesthesiaEndDateTime);
            let anesthesiaDurationMins = endTime.diff(startTime, 'minutes');
            if (anesthesiaDurationMins < 30) {
                aqi71c.eligible = 0;
                aqi71c.qualDataCds.push('11A45');
            }

            //Process performance criteria and missing fields
            if (aqi71c.eligible == 1) {
                if (this.isFieldMissing(facts.glucCheckAfterInsulinPriorToDischargeInd)) {
                    aqi71c.missingFields.push('Blood Glucose Checked Prior to Discharge');
                } else {
                    if (facts.glucCheckAfterInsulinPriorToDischargeInd === true) {
                        aqi71c.perfMet = 1;
                        aqi71c.qualDataCds.push('11A56');
                    } else {
                        aqi71c.perfNotMet = 1;
                        aqi71c.qualDataCds.push('11A57');
                    }
                }
            }
        }
        measures.push(aqi71c);
        //END AQI71C

        //AQI71D
        let aqi71d: QcdrMeasure2024 = new QcdrMeasure2024('AQI71D');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi71d.eligible = 1;

            if (this.isFieldMissing(facts.patAgeYears)) {
                aqi71d.eligible = 0;
                aqi71d.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears >= 18) {
                    aqi71d.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.patTypCd)) {
                aqi71d.eligible = 0;
                aqi71d.missingFields.push('Patient Type');
            } else {
                if (facts.patTypCd !== 'AMB') {
                    aqi71d.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    aqi71d.eligible = 0;
                }
                aqi71d.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = [
                    '00100',
                    '00102',
                    '00103',
                    '00104',
                    '00120',
                    '00124',
                    '00126',
                    '00140',
                    '00142',
                    '00144',
                    '00145',
                    '00147',
                    '00148',
                    '00160',
                    '00164',
                    '00170',
                    '00172',
                    '00174',
                    '00176',
                    '00300',
                    '00320',
                    '00322',
                    '00400',
                    '00402',
                    '00404',
                    '00410',
                    '00450',
                    '00454',
                    '00520',
                    '00522',
                    '00524',
                    '00530',
                    '00532',
                    '00534',
                    '00537',
                    '00700',
                    '00702',
                    '00730',
                    '00731',
                    '00732',
                    '00750',
                    '00752',
                    '00790',
                    '00797',
                    '00800',
                    '00802',
                    '00811',
                    '00812',
                    '00813',
                    '00820',
                    '00830',
                    '00832',
                    '00851',
                    '00870',
                    '00872',
                    '00873',
                    '00902',
                    '00906',
                    '00910',
                    '00912',
                    '00914',
                    '00918',
                    '00920',
                    '00921',
                    '00922',
                    '00924',
                    '00926',
                    '00928',
                    '00930',
                    '00938',
                    '00940',
                    '00942',
                    '00944',
                    '00948',
                    '00950',
                    '00952',
                    '01112',
                    '01120',
                    '01202',
                    '01250',
                    '01260',
                    '01320',
                    '01380',
                    '01382',
                    '01390',
                    '01392',
                    '01400',
                    '01402',
                    '01404',
                    '01464',
                    '01470',
                    '01472',
                    '01474',
                    '01480',
                    '01520',
                    '01610',
                    '01620',
                    '01622',
                    '01630',
                    '01634',
                    '01638',
                    '01670',
                    '01710',
                    '01712',
                    '01714',
                    '01716',
                    '01730',
                    '01732',
                    '01740',
                    '01742',
                    '01744',
                    '01758',
                    '01760',
                    '01810',
                    '01820',
                    '01829',
                    '01830',
                    '01832',
                    '01840',
                    '01842',
                    '01844',
                    '01850',
                    '01852',
                    '01860',
                    '01916',
                    '01920',
                    '01930',
                    '01937',
                    '01938',
                    '01939',
                    '01940',
                    '01941',
                    '01942',
                    '01965',
                    '01966',
                    '01991',
                    '01992',
                ];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        aqi71d.eligible = 0;
                    }
                }
            }

            let diabetesDiagnosis: boolean = false;
            if (!this.isFieldMissing(facts.allIcdCmCodes)) {
                const icdCmList: string[] = [
                    'E10.10',
                    'E10.3291',
                    'E10.3399',
                    'E10.3513',
                    'E10.3542',
                    'E10.36',
                    'E10.49',
                    'E10.638',
                    'E11.21',
                    'E11.3293',
                    'E11.3412',
                    'E11.3521',
                    'E11.3549',
                    'E11.37X2',
                    'E11.52',
                    'E11.649',
                    'E13.29',
                    'E13.3311',
                    'E13.3419',
                    'E13.3523',
                    'E13.3552',
                    'E13.37X9',
                    'E13.610',
                    'E13.69',
                    'E10.11',
                    'E10.3292',
                    'E10.3411',
                    'E10.3519',
                    'E10.3543',
                    'E10.37X1',
                    'E10.51',
                    'E10.641',
                    'E11.22',
                    'E11.3299',
                    'E11.3413',
                    'E11.3522',
                    'E11.3551',
                    'E11.37X3',
                    'E11.59',
                    'E11.65',
                    'E13.311',
                    'E13.3312',
                    'E13.3491',
                    'E13.3529',
                    'E13.3553',
                    'E13.39',
                    'E13.618',
                    'E13.8',
                    'E10.21',
                    'E10.3293',
                    'E10.3412',
                    'E10.3521',
                    'E10.3549',
                    'E10.37X2',
                    'E10.52',
                    'E10.649',
                    'E11.29',
                    'E11.3311',
                    'E11.3419',
                    'E11.3523',
                    'E11.3552',
                    'E11.37X9',
                    'E11.610',
                    'E11.69',
                    'E13.319',
                    'E13.3313',
                    'E13.3492',
                    'E13.3531',
                    'E13.3559',
                    'E13.40',
                    'E13.620',
                    'E13.9',
                    'E10.22',
                    'E10.3299',
                    'E10.3413',
                    'E10.3522',
                    'E10.3551',
                    'E10.37X3',
                    'E10.59',
                    'E10.65',
                    'E11.311',
                    'E11.3312',
                    'E11.3491',
                    'E11.3529',
                    'E11.3553',
                    'E11.39',
                    'E11.618',
                    'E11.8',
                    'E13.3211',
                    'E13.3319',
                    'E13.3493',
                    'E13.3532',
                    'E13.3591',
                    'E13.41',
                    'E13.621',
                    'E10.29',
                    'E10.3311',
                    'E10.3419',
                    'E10.3523',
                    'E10.3552',
                    'E10.37X9',
                    'E10.610',
                    'E10.69',
                    'E11.319',
                    'E11.3313',
                    'E11.3492',
                    'E11.3531',
                    'E11.3559',
                    'E11.40',
                    'E11.620',
                    'E11.9',
                    'E13.3212',
                    'E13.3391',
                    'E13.3499',
                    'E13.3533',
                    'E13.3592',
                    'E13.42',
                    'E13.622',
                    'E10.311',
                    'E10.3312',
                    'E10.3491',
                    'E10.3529',
                    'E10.3553',
                    'E10.39',
                    'E10.618',
                    'E10.8',
                    'E11.3211',
                    'E11.3319',
                    'E11.3493',
                    'E11.3532',
                    'E11.3591',
                    'E11.41',
                    'E11.621',
                    'E13.00',
                    'E13.3213',
                    'E13.3392',
                    'E13.3511',
                    'E13.3539',
                    'E13.3593',
                    'E13.43',
                    'E13.628',
                    'E10.319',
                    'E10.3313',
                    'E10.3492',
                    'E10.3531',
                    'E10.3559',
                    'E10.40',
                    'E10.620',
                    'E10.9',
                    'E11.3212',
                    'E11.3391',
                    'E11.3499',
                    'E11.3533',
                    'E11.3592',
                    'E11.42',
                    'E11.622',
                    'E13.01',
                    'E13.3219',
                    'E13.3393',
                    'E13.3512',
                    'E13.3541',
                    'E13.3599',
                    'E13.44',
                    'E13.630',
                    'E10.3211',
                    'E10.3319',
                    'E10.3493',
                    'E10.3532',
                    'E10.3591',
                    'E10.41',
                    'E10.621',
                    'E11.00',
                    'E11.3213',
                    'E11.3392',
                    'E11.3511',
                    'E11.3539',
                    'E11.3593',
                    'E11.43',
                    'E11.628',
                    'E13.10',
                    'E13.3291',
                    'E13.3399',
                    'E13.3513',
                    'E13.3542',
                    'E13.36',
                    'E13.49',
                    'E13.638',
                    'E10.3212',
                    'E10.3391',
                    'E10.3499',
                    'E10.3533',
                    'E10.3592',
                    'E10.42',
                    'E10.622',
                    'E11.01',
                    'E11.3219',
                    'E11.3393',
                    'E11.3512',
                    'E11.3541',
                    'E11.3599',
                    'E11.44',
                    'E11.630',
                    'E13.11',
                    'E13.3292',
                    'E13.3411',
                    'E13.3519',
                    'E13.3543',
                    'E13.37X1',
                    'E13.51',
                    'E13.641',
                    'E10.3213',
                    'E10.3392',
                    'E10.3511',
                    'E10.3539',
                    'E10.3593',
                    'E10.43',
                    'E10.628',
                    'E11.10',
                    'E11.3291',
                    'E11.3399',
                    'E11.3513',
                    'E11.3542',
                    'E11.36',
                    'E11.49',
                    'E11.638',
                    'E13.21',
                    'E13.3293',
                    'E13.3412',
                    'E13.3521',
                    'E13.3549',
                    'E13.37X2',
                    'E13.52',
                    'E13.649',
                    'E10.3219',
                    'E10.3393',
                    'E10.3512',
                    'E10.3541',
                    'E10.3599',
                    'E10.44',
                    'E10.630',
                    'E11.11',
                    'E11.3292',
                    'E11.3411',
                    'E11.3519',
                    'E11.3543',
                    'E11.37X1',
                    'E11.51',
                    'E11.641',
                    'E13.22',
                    'E13.3299',
                    'E13.3413',
                    'E13.3522',
                    'E13.3551',
                    'E13.37X3',
                    'E13.59',
                    'E13.65',
                ];
                if (this.arrayContainsAny(facts.allIcdCmCodes, icdCmList)) {
                    diabetesDiagnosis = true;
                }
            }

            if (
                diabetesDiagnosis ||
                (!this.isFieldMissing(facts.diabetesDiagnosisInd) && facts.diabetesDiagnosisInd === true)
            ) {
                aqi71d.qualDataCds.push('11A41');
            } else {
                aqi71d.eligible = 0;
            }

            if (this.isFieldMissing(facts.bgGt180Ind) || facts.bgGt180Ind === false) {
                aqi71d.eligible = 0;
            } else {
                aqi71d.qualDataCds.push('11A44');
            }

            let startTime = moment(facts.anesthesiaStartDateTime);
            let endTime = moment(facts.anesthesiaEndDateTime);
            let anesthesiaDurationMins = endTime.diff(startTime, 'minutes');
            if (anesthesiaDurationMins < 30) {
                aqi71d.eligible = 0;
                aqi71d.qualDataCds.push('11A45');
            }

            //Process performance criteria and missing fields
            if (aqi71d.eligible == 1) {
                if (this.isFieldMissing(facts.recvdGlucMgmtEducationInd)) {
                    aqi71d.missingFields.push('Received Education on Blood Glucose Management');
                } else {
                    if (facts.recvdGlucMgmtEducationInd === true) {
                        aqi71d.perfMet = 1;
                        aqi71d.qualDataCds.push('11A58');
                    } else {
                        aqi71d.perfNotMet = 1;
                        aqi71d.qualDataCds.push('11A59');
                    }
                }
            }
        }
        measures.push(aqi71d);
        //END AQI71D

        //AQI72
        let aqi72: QcdrMeasure2024 = new QcdrMeasure2024('AQI72');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi72.eligible = 1;

            if (this.isFieldMissing(facts.patAgeYears)) {
                aqi72.eligible = 0;
                aqi72.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears < 18) {
                    aqi72.eligible = 0;
                }
            }

            if (!this.isFieldMissing(facts.asaEmergInd) && facts.asaEmergInd === true) {
                aqi72.eligible = 0;
            } else {
                aqi72.qualDataCds.push('G9643');
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    aqi72.eligible = 0;
                }
                aqi72.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = ['01214', '01215', '01402', '01638'];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        aqi72.eligible = 0;
                    }
                }
            }

            if (
                (this.isFieldMissing(facts.hipArthroplastyInd) || facts.hipArthroplastyInd === false) &&
                (this.isFieldMissing(facts.shoulderArthroplastyInd) || facts.shoulderArthroplastyInd === false) &&
                (this.isFieldMissing(facts.primaryTkaInd) || facts.primaryTkaInd === false)
            ) {
                aqi72.eligible = 0;
            }

            //Process performance criteria and missing fields
            if (aqi72.eligible == 1) {
                if (this.isFieldMissing(facts.anemiaScreenCd)) {
                    aqi72.missingFields.push('Anemia Screen Performed');
                } else {
                    if (
                        facts.anemiaScreenCd === 'Y' &&
                        !this.isFieldMissing(facts.anemiaScreenPosInd) &&
                        facts.anemiaScreenPosInd === true &&
                        !this.isFieldMissing(facts.dtuAnemiaManagementCd) &&
                        facts.dtuAnemiaManagementCd === 'Y'
                    ) {
                        aqi72.perfMet = 1;
                        aqi72.qualDataCds.push('11A67');
                    } else if (
                        facts.anemiaScreenCd === 'Y' &&
                        !this.isFieldMissing(facts.anemiaScreenPosInd) &&
                        facts.anemiaScreenPosInd === false
                    ) {
                        aqi72.exception = 1;
                        aqi72.qualDataCds.push('11A68');
                    } else if (facts.anemiaScreenCd === 'N-RS') {
                        aqi72.exception = 1;
                        aqi72.qualDataCds.push('11A69');
                    } else if (
                        facts.anemiaScreenCd === 'N-RU' ||
                        (!this.isFieldMissing(facts.anemiaScreenPosInd) &&
                            facts.anemiaScreenPosInd === true &&
                            (this.isFieldMissing(facts.dtuAnemiaManagementCd) ||
                                (!this.isFieldMissing(facts.dtuAnemiaManagementCd) &&
                                    facts.dtuAnemiaManagementCd === 'N-RS') ||
                                facts.dtuAnemiaManagementCd === 'N-RU'))
                    ) {
                        aqi72.perfNotMet = 1;
                        aqi72.qualDataCds.push('11A70');
                    }
                }
            }
        }
        measures.push(aqi72);
        //END AQI72

        //AQI73A - NOTE: This is a retired measure as of 2024
        let aqi73a: QcdrMeasure2024 = new QcdrMeasure2024('AQI73A');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi73a.eligible = 1;

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    aqi73a.eligible = 0;
                }
                aqi73a.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = ['36620'];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        aqi73a.eligible = 0;
                    }
                }
            }

            if (this.isFieldMissing(facts.arterialLineTypCd)) {
                aqi73a.eligible = 0;
                aqi73a.missingFields.push('Arterial Line Type');
            } else {
                const eligibleLineTypes: string[] = [
                    'BRACHIAL',
                    'BRACHIAL_US',
                    'RADIAL',
                    'RADIAL_US',
                    'PT',
                    'PT_US',
                    'DP',
                    'DP_US',
                ];
                if (!(eligibleLineTypes.indexOf(facts.arterialLineTypCd) > -1)) {
                    aqi73a.eligible = 0;
                } else {
                    aqi73a.qualDataCds.push('11A71');
                }
            }

            //Process performance criteria and missing fields
            if (aqi73a.eligible == 1) {
                if (this.isFieldMissing(facts.dtuArterialLinePlcmtCd)) {
                    aqi73a.missingFields.push('Defined Sterile Technique Used for A-Line Placement');
                } else {
                    if (facts.dtuArterialLinePlcmtCd === 'Y') {
                        aqi73a.perfMet = 1;
                        aqi73a.qualDataCds.push('11A74');
                    }
                    if (facts.dtuArterialLinePlcmtCd === 'N-RS') {
                        aqi73a.exception = 1;
                        aqi73a.qualDataCds.push('11A75');
                    }

                    if (facts.dtuArterialLinePlcmtCd === 'N-RU') {
                        aqi73a.perfNotMet = 1;
                        aqi73a.qualDataCds.push('11A76');
                    }
                }
            }
        }
        measures.push(aqi73a);
        //END AQI73A

        //AQI73B - NOTE: This is a retired measure as of 2024
        let aqi73b: QcdrMeasure2024 = new QcdrMeasure2024('AQI73B');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi73b.eligible = 1;

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    aqi73b.eligible = 0;
                }
                aqi73b.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = ['36620'];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        aqi73b.eligible = 0;
                    }
                }
            }

            if (this.isFieldMissing(facts.arterialLineTypCd)) {
                aqi73b.eligible = 0;
                aqi73b.missingFields.push('Arterial Line Type');
            } else {
                const eligibleLineTypes: string[] = ['FEMORAL', 'FEMORAL_US', 'AXILLARY', 'AXILLARY_US'];
                if (!(eligibleLineTypes.indexOf(facts.arterialLineTypCd) > -1)) {
                    aqi73b.eligible = 0;
                } else {
                    aqi73b.qualDataCds.push('11A72');
                }
            }

            //Process performance criteria and missing fields
            if (aqi73b.eligible == 1) {
                if (this.isFieldMissing(facts.dtuArterialLinePlcmtCd)) {
                    aqi73b.missingFields.push('Defined Sterile Technique Used for A-Line Placement');
                } else {
                    if (facts.dtuArterialLinePlcmtCd === 'Y') {
                        aqi73b.perfMet = 1;
                        aqi73b.qualDataCds.push('11A77');
                    }
                    if (facts.dtuArterialLinePlcmtCd === 'N-RS') {
                        aqi73b.exception = 1;
                        aqi73b.qualDataCds.push('11A78');
                    }

                    if (facts.dtuArterialLinePlcmtCd === 'N-RU') {
                        aqi73b.perfNotMet = 1;
                        aqi73b.qualDataCds.push('11A79');
                    }
                }
            }
        }
        measures.push(aqi73b);
        //END AQI73B

        //MD54 - NOTE: This is a retired measure as of 2024
        let md54: QcdrMeasure2024 = new QcdrMeasure2024('MD54');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            md54.eligible = 1;
            if (this.isFieldMissing(facts.laborEpiduralConvertedCsectionInd)) {
                md54.eligible = 0;
                md54.missingFields.push('Labor Epidural Converted to C/S');
            } else {
                if (facts.laborEpiduralConvertedCsectionInd !== true) {
                    md54.eligible = 0;
                }
            }

            if (!this.isFieldMissing(facts.asaEmergInd) && facts.asaEmergInd === true) {
                md54.eligible = 0;
                md54.measRespCds.push('1091');
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    md54.eligible = 0;
                }
                md54.missingFields.push('CPT Code');
            } else {
                const cptList1: string[] = ['01967'];
                const cptList2: string[] = ['01968'];
                if (
                    !this.arrayContainsAny(facts.allCptCodes, cptList1) ||
                    !this.arrayContainsAny(facts.allCptCodes, cptList2)
                ) {
                    if (!skipCPTEval) {
                        md54.eligible = 0;
                    }
                }
            }

            //Process performance criteria and missing fields
            if (md54.eligible == 1) {
                if (this.isFieldMissing(facts.laborEpiduralFailureInd)) {
                    md54.missingFields.push('Labor Epidural Failed');
                } else {
                    if (facts.laborEpiduralFailureInd === true) {
                        md54.perfMet = 1;
                        md54.measRespCds.push('54A');
                    }

                    if (facts.laborEpiduralFailureInd === false) {
                        md54.perfNotMet = 1;
                        md54.measRespCds.push('54B');
                    }
                }
            }
        }
        measures.push(md54);
        //END MD54

        //QID404
        let qid404: QcdrMeasure2024 = new QcdrMeasure2024('QID404');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            qid404.eligible = 1;

            if (this.isFieldMissing(facts.patAgeYears)) {
                qid404.eligible = 0;
                qid404.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears < 18) {
                    qid404.eligible = 0;
                }
            }

            if (!this.isFieldMissing(facts.asaEmergInd) && facts.asaEmergInd === true) {
                qid404.eligible = 0;
            } else {
                qid404.qualDataCds.push('G9643');
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    qid404.eligible = 0;
                }
                qid404.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = [
                    '00100',
                    '00102',
                    '00103',
                    '00104',
                    '00120',
                    '00124',
                    '00126',
                    '00140',
                    '00142',
                    '00144',
                    '00145',
                    '00147',
                    '00148',
                    '00160',
                    '00162',
                    '00164',
                    '00170',
                    '00172',
                    '00174',
                    '00176',
                    '00190',
                    '00192',
                    '00210',
                    '00211',
                    '00212',
                    '00214',
                    '00215',
                    '00216',
                    '00218',
                    '00220',
                    '00222',
                    '00300',
                    '00320',
                    '00322',
                    '00350',
                    '00352',
                    '00400',
                    '00402',
                    '00404',
                    '00406',
                    '00410',
                    '00450',
                    '00454',
                    '00470',
                    '00472',
                    '00474',
                    '00500',
                    '00520',
                    '00522',
                    '00524',
                    '00528',
                    '00529',
                    '00530',
                    '00532',
                    '00534',
                    '00537',
                    '00539',
                    '00540',
                    '00541',
                    '00542',
                    '00546',
                    '00548',
                    '00550',
                    '00560',
                    '00563',
                    '00566',
                    '00567',
                    '00580',
                    '00600',
                    '00604',
                    '00620',
                    '00625',
                    '00626',
                    '00630',
                    '00632',
                    '00635',
                    '00640',
                    '00670',
                    '00700',
                    '00702',
                    '00730',
                    '00731',
                    '00732',
                    '00750',
                    '00752',
                    '00756',
                    '00770',
                    '00790',
                    '00792',
                    '00794',
                    '00796',
                    '00797',
                    '00800',
                    '00802',
                    '00811',
                    '00812',
                    '00813',
                    '00820',
                    '00830',
                    '00832',
                    '00840',
                    '00842',
                    '00844',
                    '00846',
                    '00848',
                    '00851',
                    '00860',
                    '00862',
                    '00864',
                    '00865',
                    '00866',
                    '00868',
                    '00870',
                    '00872',
                    '00873',
                    '00880',
                    '00882',
                    '00902',
                    '00904',
                    '00906',
                    '00908',
                    '00910',
                    '00912',
                    '00914',
                    '00916',
                    '00918',
                    '00920',
                    '00921',
                    '00922',
                    '00924',
                    '00926',
                    '00928',
                    '00930',
                    '00932',
                    '00934',
                    '00936',
                    '00938',
                    '00940',
                    '00942',
                    '00944',
                    '00948',
                    '00950',
                    '00952',
                    '01112',
                    '01120',
                    '01130',
                    '01140',
                    '01150',
                    '01160',
                    '01170',
                    '01173',
                    '01200',
                    '01202',
                    '01210',
                    '01212',
                    '01214',
                    '01215',
                    '01220',
                    '01230',
                    '01232',
                    '01234',
                    '01250',
                    '01260',
                    '01270',
                    '01272',
                    '01402',
                    '01404',
                    '01420',
                    '01430',
                    '01432',
                    '01482',
                    '01484',
                    '01486',
                    '01490',
                    '01500',
                    '01638',
                    '01650',
                    '01652',
                    '01654',
                    '01656',
                    '01742',
                    '01744',
                    '01756',
                    '01758',
                    '01760',
                    '01840',
                    '01842',
                    '01844',
                    '01850',
                    '01852',
                    '01932',
                    '01933',
                    '01935',
                    '01936',
                    '01951',
                    '62320',
                    '62321',
                    '62322',
                    '62323',
                    '62324',
                    '64415',
                    '64416',
                    '64417',
                    '64418',
                    '64420',
                    '64450',
                    '64455',
                    '64461',
                    '64463',
                    '64479',
                    '64517',
                    '64520',
                    '64530',
                    '0228T',
                    '0230T',
                    '01274',
                    '01320',
                    '01340',
                    '01360',
                    '01380',
                    '01382',
                    '01390',
                    '01392',
                    '01400',
                    '01440',
                    '01442',
                    '01444',
                    '01462',
                    '01464',
                    '01470',
                    '01472',
                    '01474',
                    '01480',
                    '01502',
                    '01520',
                    '01522',
                    '01610',
                    '01620',
                    '01622',
                    '01630',
                    '01634',
                    '01636',
                    '01670',
                    '01680',
                    '01710',
                    '01712',
                    '01714',
                    '01716',
                    '01730',
                    '01732',
                    '01740',
                    '01770',
                    '01772',
                    '01780',
                    '01782',
                    '01810',
                    '01820',
                    '01829',
                    '01830',
                    '01832',
                    '01860',
                    '01916',
                    '01920',
                    '01922',
                    '01924',
                    '01925',
                    '01926',
                    '01930',
                    '01931',
                    '01952',
                    '01958',
                    '01960',
                    '01961',
                    '01966',
                    '01991',
                    '01992',
                    '27095',
                    '27096',
                    '62325',
                    '62326',
                    '62327',
                    '64400',
                    '64405',
                    '64408',
                    '64421',
                    '64425',
                    '64430',
                    '64435',
                    '64445',
                    '64446',
                    '64447',
                    '64448',
                    '64449',
                    '64483',
                    '64486',
                    '64487',
                    '64488',
                    '64489',
                    '64490',
                    '64493',
                    '64505',
                    '64510',
                ];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        qid404.eligible = 0;
                    }
                }
            }

            if (this.isFieldMissing(facts.patSmokeInd)) {
                qid404.eligible = 0;
                qid404.missingFields.push('Patient is Current Smoker');
            } else {
                if (facts.patSmokeInd === true) {
                    qid404.qualDataCds.push('G9642');
                } else {
                    qid404.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.patSmokeCessInd)) {
                qid404.eligible = 0;
                qid404.missingFields.push('Smoking Abstinence Instructions');
            } else {
                if (facts.patSmokeCessInd === true) {
                    qid404.qualDataCds.push('G9497');
                } else {
                    qid404.eligible = 0;
                }
            }

            //Process performance criteria and missing fields
            if (qid404.eligible == 1) {
                if (this.isFieldMissing(facts.patSmokeDosInd)) {
                    qid404.missingFields.push('Patient Smoked on DOS');
                } else {
                    if (facts.patSmokeDosInd === false) {
                        qid404.perfMet = 1;
                        qid404.qualDataCds.push('G9644');
                    } else if (facts.patSmokeDosInd === true) {
                        qid404.perfNotMet = 1;
                        qid404.qualDataCds.push('G9645');
                    }
                }
            }
        }
        measures.push(qid404);
        //END QID404

        //QID424
        let qid424: QcdrMeasure2024 = new QcdrMeasure2024('QID424');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            qid424.eligible = 1;

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    qid424.eligible = 0;
                }
                qid424.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = [
                    '00100',
                    '00102',
                    '00103',
                    '00104',
                    '00120',
                    '00124',
                    '00126',
                    '00140',
                    '00142',
                    '00144',
                    '00145',
                    '00147',
                    '00148',
                    '00160',
                    '00162',
                    '00164',
                    '00170',
                    '00172',
                    '00174',
                    '00176',
                    '00190',
                    '00192',
                    '00210',
                    '00211',
                    '00212',
                    '00214',
                    '00215',
                    '00216',
                    '00218',
                    '00220',
                    '00222',
                    '00300',
                    '00320',
                    '00322',
                    '00326',
                    '00350',
                    '00352',
                    '00400',
                    '00402',
                    '00404',
                    '00406',
                    '00410',
                    '00450',
                    '00454',
                    '00470',
                    '00472',
                    '00474',
                    '00500',
                    '00520',
                    '00522',
                    '00524',
                    '00528',
                    '00529',
                    '00530',
                    '00532',
                    '00534',
                    '00537',
                    '00539',
                    '00540',
                    '00541',
                    '00542',
                    '00546',
                    '00548',
                    '00550',
                    '00560',
                    '00600',
                    '00604',
                    '00620',
                    '00625',
                    '00626',
                    '00630',
                    '00632',
                    '00635',
                    '00640',
                    '00670',
                    '00700',
                    '00702',
                    '00730',
                    '00731',
                    '00732',
                    '00750',
                    '00752',
                    '00754',
                    '00756',
                    '00770',
                    '00790',
                    '00792',
                    '00794',
                    '00796',
                    '00797',
                    '00800',
                    '00802',
                    '00811',
                    '00812',
                    '00813',
                    '00820',
                    '00830',
                    '00832',
                    '00834',
                    '00836',
                    '00840',
                    '00842',
                    '00844',
                    '00846',
                    '00848',
                    '00851',
                    '00860',
                    '00862',
                    '00864',
                    '00865',
                    '00866',
                    '00868',
                    '00870',
                    '00872',
                    '00873',
                    '00880',
                    '00882',
                    '00902',
                    '00904',
                    '00906',
                    '00908',
                    '00910',
                    '00912',
                    '00914',
                    '00916',
                    '00918',
                    '00920',
                    '00921',
                    '00922',
                    '00924',
                    '00926',
                    '00928',
                    '00930',
                    '00932',
                    '00934',
                    '00936',
                    '00938',
                    '00940',
                    '00942',
                    '00944',
                    '00948',
                    '00950',
                    '00952',
                    '01112',
                    '01120',
                    '01130',
                    '01140',
                    '01150',
                    '01160',
                    '01170',
                    '01173',
                    '01200',
                    '01202',
                    '01210',
                    '01212',
                    '01214',
                    '01215',
                    '01220',
                    '01230',
                    '01232',
                    '01234',
                    '01250',
                    '01260',
                    '01270',
                    '01272',
                    '01274',
                    '01320',
                    '01340',
                    '01360',
                    '01380',
                    '01382',
                    '01390',
                    '01392',
                    '01400',
                    '01402',
                    '01404',
                    '01420',
                    '01430',
                    '01432',
                    '01440',
                    '01442',
                    '01444',
                    '01462',
                    '01464',
                    '01470',
                    '01472',
                    '01474',
                    '01480',
                    '01482',
                    '01484',
                    '01486',
                    '01490',
                    '01500',
                    '01502',
                    '01520',
                    '01522',
                    '01610',
                    '01620',
                    '01622',
                    '01630',
                    '01634',
                    '01636',
                    '01638',
                    '01650',
                    '01652',
                    '01654',
                    '01656',
                    '01670',
                    '01680',
                    '01710',
                    '01712',
                    '01714',
                    '01716',
                    '01730',
                    '01732',
                    '01740',
                    '01742',
                    '01744',
                    '01756',
                    '01758',
                    '01760',
                    '01770',
                    '01772',
                    '01780',
                    '01782',
                    '01810',
                    '01820',
                    '01829',
                    '01830',
                    '01832',
                    '01840',
                    '01842',
                    '01844',
                    '01850',
                    '01852',
                    '01860',
                    '01924',
                    '01925',
                    '01926',
                    '01930',
                    '01931',
                    '01932',
                    '01933',
                    '01935',
                    '01936',
                    '01951',
                    '01952',
                    '01961',
                    '01962',
                    '01963',
                    '01965',
                    '01966',
                ];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        qid424.eligible = 0;
                    }
                }
            }

            if (this.isFieldMissing(facts.primaryAnesthetic)) {
                qid424.eligible = 0;
                qid424.missingFields.push('Primary Anesthetic');
            } else {
                let eligibleAnesthetics: string[] = ['GENERAL', 'SPINAL', 'EPIDURAL', 'LABOR_EPIDURAL'];
                if (facts.primaryAnesthetic === 'MAC') {
                    qid424.eligible = 0;
                    qid424.qualDataCds.push('G9654');
                } else if (facts.primaryAnesthetic === 'REGIONAL') {
                    qid424.eligible = 0;
                    qid424.qualDataCds.push('G9770');
                } else if (!(eligibleAnesthetics.indexOf(facts.primaryAnesthetic) > -1)) {
                    qid424.eligible = 0;
                }
            }

            if (
                this.isFieldMissing(facts.anesthesiaStartDateTime) ||
                this.isFieldMissing(facts.anesthesiaEndDateTime)
            ) {
                qid424.eligible = 0;
                qid424.missingFields.push('Anesthesia Start/End Times');
            } else {
                let startTime = moment(facts.anesthesiaStartDateTime);
                let endTime = moment(facts.anesthesiaEndDateTime);
                let anesthesiaDurationMins = endTime.diff(startTime, 'minutes');
                if (anesthesiaDurationMins >= 60) {
                    qid424.qualDataCds.push('4255F');
                } else {
                    qid424.eligible = 0;
                }
            }

            //Process performance criteria and missing fields
            if (qid424.eligible == 1) {
                const compList: string[] = ['pacu_hypotherm'];
                if (
                    (!this.isFieldMissing(facts.patientBodyTemp) && facts.patientBodyTemp < 35.5) ||
                    this.arrayContainsAny(facts.compList, compList)
                ) {
                    qid424.perfNotMet = 1;
                    qid424.qualDataCds.push('G9773');
                } else {
                    qid424.perfMet = 1;
                    qid424.qualDataCds.push('G9771');
                }
            }
        }
        measures.push(qid424);
        //END QID424

        //QID430
        let qid430: QcdrMeasure2024 = new QcdrMeasure2024('QID430');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            qid430.eligible = 1;

            if (this.isFieldMissing(facts.patAgeYears)) {
                qid430.eligible = 0;
                qid430.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears < 18) {
                    qid430.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    qid430.eligible = 0;
                }
                qid430.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = [
                    '00100',
                    '00102',
                    '00103',
                    '00104',
                    '00120',
                    '00124',
                    '00126',
                    '00140',
                    '00142',
                    '00144',
                    '00145',
                    '00147',
                    '00148',
                    '00160',
                    '00162',
                    '00164',
                    '00170',
                    '00172',
                    '00174',
                    '00176',
                    '00190',
                    '00192',
                    '00210',
                    '00211',
                    '00212',
                    '00214',
                    '00215',
                    '00216',
                    '00218',
                    '00220',
                    '00222',
                    '00300',
                    '00320',
                    '00322',
                    '00350',
                    '00352',
                    '00400',
                    '00402',
                    '00404',
                    '00406',
                    '00410',
                    '00450',
                    '00454',
                    '00470',
                    '00472',
                    '00474',
                    '00500',
                    '00520',
                    '00522',
                    '00524',
                    '00528',
                    '00529',
                    '00530',
                    '00532',
                    '00534',
                    '00537',
                    '00539',
                    '00540',
                    '00541',
                    '00542',
                    '00546',
                    '00548',
                    '00550',
                    '00560',
                    '00566',
                    '00580',
                    '00600',
                    '00604',
                    '00620',
                    '00625',
                    '00626',
                    '00630',
                    '00632',
                    '00635',
                    '00640',
                    '00670',
                    '00700',
                    '00702',
                    '00730',
                    '00731',
                    '00732',
                    '00750',
                    '00752',
                    '00754',
                    '00756',
                    '00770',
                    '00790',
                    '00792',
                    '00794',
                    '00796',
                    '00797',
                    '00800',
                    '00802',
                    '00811',
                    '00812',
                    '00813',
                    '00820',
                    '00830',
                    '00832',
                    '00840',
                    '00842',
                    '00844',
                    '00846',
                    '00848',
                    '00851',
                    '00860',
                    '00862',
                    '00864',
                    '00865',
                    '00866',
                    '00868',
                    '00870',
                    '00872',
                    '00873',
                    '00880',
                    '00882',
                    '00902',
                    '00904',
                    '00906',
                    '00908',
                    '00910',
                    '00912',
                    '00914',
                    '00916',
                    '00918',
                    '00920',
                    '00921',
                    '00922',
                    '00924',
                    '00926',
                    '00928',
                    '00930',
                    '00932',
                    '00934',
                    '00936',
                    '00938',
                    '00940',
                    '00942',
                    '00944',
                    '00948',
                    '00950',
                    '00952',
                    '01112',
                    '01120',
                    '01130',
                    '01140',
                    '01150',
                    '01160',
                    '01170',
                    '01173',
                    '01200',
                    '01202',
                    '01210',
                    '01212',
                    '01214',
                    '01215',
                    '01220',
                    '01230',
                    '01232',
                    '01234',
                    '01250',
                    '01260',
                    '01270',
                    '01272',
                    '01274',
                    '01320',
                    '01340',
                    '01360',
                    '01380',
                    '01382',
                    '01390',
                    '01392',
                    '01400',
                    '01402',
                    '01404',
                    '01420',
                    '01430',
                    '01432',
                    '01440',
                    '01442',
                    '01444',
                    '01462',
                    '01464',
                    '01470',
                    '01472',
                    '01474',
                    '01480',
                    '01482',
                    '01484',
                    '01486',
                    '01490',
                    '01500',
                    '01502',
                    '01520',
                    '01522',
                    '01610',
                    '01620',
                    '01622',
                    '01630',
                    '01634',
                    '01636',
                    '01638',
                    '01650',
                    '01652',
                    '01654',
                    '01656',
                    '01670',
                    '01680',
                    '01710',
                    '01712',
                    '01714',
                    '01716',
                    '01730',
                    '01732',
                    '01740',
                    '01742',
                    '01744',
                    '01756',
                    '01758',
                    '01760',
                    '01770',
                    '01772',
                    '01780',
                    '01782',
                    '01810',
                    '01820',
                    '01829',
                    '01830',
                    '01832',
                    '01840',
                    '01842',
                    '01844',
                    '01850',
                    '01852',
                    '01860',
                    '01924',
                    '01925',
                    '01926',
                    '01930',
                    '01931',
                    '01932',
                    '01933',
                    '01937',
                    '01938',
                    '01939',
                    '01940',
                    '01941',
                    '01942',
                    '01951',
                    '01952',
                    '01961',
                    '01962',
                    '01963',
                    '01965',
                    '01966',
                ];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        qid430.eligible = 0;
                    }
                }
            }

            if (this.isFieldMissing(facts.maintInhAgentUsedInd)) {
                qid430.eligible = 0;
                qid430.missingFields.push('Inhalational Anesthetic Agent');
            } else {
                if (facts.maintInhAgentUsedInd === true) {
                    qid430.qualDataCds.push('4554F');
                } else {
                    qid430.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.ponvHighRiskInd)) {
                qid430.eligible = 0;
                qid430.missingFields.push('PONV Risk');
            } else {
                if (facts.ponvHighRiskInd === true) {
                    qid430.qualDataCds.push('4556F');
                } else {
                    qid430.eligible = 0;
                }
            }

            //Process performance criteria and missing fields
            if (qid430.eligible == 1) {
                if (this.isFieldMissing(facts.combTherCd)) {
                    qid430.missingFields.push('Combination Therapy');
                } else {
                    if (facts.combTherCd === 'Y') {
                        qid430.perfMet = 1;
                        qid430.qualDataCds.push('G9775');
                    } else if (facts.combTherCd === 'N-RS') {
                        qid430.exception = 1;
                        qid430.qualDataCds.push('G9776');
                    } else if (facts.combTherCd === 'N-RU') {
                        qid430.perfNotMet = 1;
                        qid430.qualDataCds.push('G9777');
                    }
                }
            }
        }
        measures.push(qid430);
        //END QID430

        //QID463
        let qid463: QcdrMeasure2024 = new QcdrMeasure2024('QID463');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            qid463.eligible = 1;

            if (this.isFieldMissing(facts.patAgeYears)) {
                qid463.eligible = 0;
                qid463.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears < 3 || facts.patAgeYears > 17) {
                    qid463.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    qid463.eligible = 0;
                }
                qid463.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = [
                    '00100',
                    '00102',
                    '00103',
                    '00104',
                    '00120',
                    '00124',
                    '00126',
                    '00140',
                    '00142',
                    '00144',
                    '00145',
                    '00147',
                    '00148',
                    '00160',
                    '00162',
                    '00164',
                    '00170',
                    '00172',
                    '00174',
                    '00176',
                    '00190',
                    '00192',
                    '00210',
                    '00211',
                    '00212',
                    '00214',
                    '00215',
                    '00216',
                    '00218',
                    '00220',
                    '00222',
                    '00300',
                    '00320',
                    '00322',
                    '00350',
                    '00352',
                    '00400',
                    '00402',
                    '00404',
                    '00406',
                    '00410',
                    '00450',
                    '00454',
                    '00470',
                    '00472',
                    '00474',
                    '00500',
                    '00520',
                    '00522',
                    '00524',
                    '00528',
                    '00529',
                    '00530',
                    '00532',
                    '00534',
                    '00537',
                    '00539',
                    '00540',
                    '00541',
                    '00542',
                    '00546',
                    '00548',
                    '00550',
                    '00560',
                    '00562',
                    '00563',
                    '00566',
                    '00567',
                    '00580',
                    '00600',
                    '00604',
                    '00620',
                    '00625',
                    '00626',
                    '00630',
                    '00632',
                    '00635',
                    '00640',
                    '00670',
                    '00700',
                    '00702',
                    '00730',
                    '00731',
                    '00732',
                    '00750',
                    '00752',
                    '00754',
                    '00756',
                    '00770',
                    '00790',
                    '00792',
                    '00794',
                    '00796',
                    '00797',
                    '00800',
                    '00802',
                    '00811',
                    '00812',
                    '00813',
                    '00820',
                    '00830',
                    '00832',
                    '00840',
                    '00842',
                    '00844',
                    '00846',
                    '00848',
                    '00851',
                    '00860',
                    '00862',
                    '00864',
                    '00865',
                    '00866',
                    '00868',
                    '00870',
                    '00872',
                    '00873',
                    '00880',
                    '00882',
                    '00902',
                    '00904',
                    '00906',
                    '00908',
                    '00910',
                    '00912',
                    '00914',
                    '00916',
                    '00918',
                    '00920',
                    '00921',
                    '00922',
                    '00924',
                    '00926',
                    '00928',
                    '00930',
                    '00932',
                    '00934',
                    '00936',
                    '00938',
                    '00940',
                    '00942',
                    '00944',
                    '00948',
                    '00950',
                    '00952',
                    '01112',
                    '01120',
                    '01130',
                    '01140',
                    '01150',
                    '01160',
                    '01170',
                    '01173',
                    '01200',
                    '01202',
                    '01210',
                    '01212',
                    '01214',
                    '01215',
                    '01220',
                    '01230',
                    '01232',
                    '01234',
                    '01250',
                    '01260',
                    '01270',
                    '01272',
                    '01274',
                    '01320',
                    '01340',
                    '01360',
                    '01380',
                    '01382',
                    '01390',
                    '01392',
                    '01400',
                    '01402',
                    '01404',
                    '01420',
                    '01430',
                    '01432',
                    '01440',
                    '01442',
                    '01444',
                    '01462',
                    '01464',
                    '01470',
                    '01472',
                    '01474',
                    '01480',
                    '01482',
                    '01484',
                    '01486',
                    '01490',
                    '01500',
                    '01502',
                    '01520',
                    '01522',
                    '01610',
                    '01620',
                    '01622',
                    '01630',
                    '01634',
                    '01636',
                    '01638',
                    '01650',
                    '01652',
                    '01654',
                    '01656',
                    '01670',
                    '01680',
                    '01710',
                    '01712',
                    '01714',
                    '01716',
                    '01730',
                    '01732',
                    '01740',
                    '01742',
                    '01744',
                    '01756',
                    '01758',
                    '01760',
                    '01770',
                    '01772',
                    '01780',
                    '01782',
                    '01810',
                    '01820',
                    '01829',
                    '01830',
                    '01832',
                    '01840',
                    '01842',
                    '01844',
                    '01850',
                    '01852',
                    '01860',
                    '01916',
                    '01920',
                    '01922',
                    '01924',
                    '01925',
                    '01926',
                    '01930',
                    '01931',
                    '01932',
                    '01933',
                    '01937',
                    '01938',
                    '01939',
                    '01940',
                    '01941',
                    '01942',
                    '01951',
                    '01952',
                    '01958',
                    '01960',
                    '01961',
                    '01962',
                    '01963',
                    '01965',
                    '01966',
                    '01991',
                    '01992',
                ];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        qid463.eligible = 0;
                    }
                }
            }

            if (this.isFieldMissing(facts.maintInhAgentUsedInd)) {
                qid463.eligible = 0;
                qid463.missingFields.push('Inhalational Anesthetic Agent');
            } else {
                if (facts.maintInhAgentUsedInd === true) {
                    qid463.qualDataCds.push('4554F');
                } else {
                    qid463.eligible = 0;
                }
            }

            if (this.isFieldMissing(facts.ponvHighRiskInd)) {
                qid463.eligible = 0;
                qid463.missingFields.push('PONV Risk');
            } else {
                if (facts.ponvHighRiskInd === true) {
                    qid463.qualDataCds.push('G9954');
                } else {
                    qid463.eligible = 0;
                }
            }

            //Process performance criteria and missing fields
            if (qid463.eligible == 1) {
                if (this.isFieldMissing(facts.combTherCd)) {
                    qid463.missingFields.push('Combination Therapy');
                } else {
                    if (facts.combTherCd === 'Y') {
                        qid463.perfMet = 1;
                        qid463.qualDataCds.push('G9956');
                    } else if (facts.combTherCd === 'N-RS') {
                        qid463.exception = 1;
                        qid463.qualDataCds.push('G9957');
                    } else if (facts.combTherCd === 'N-RU') {
                        qid463.perfNotMet = 1;
                        qid463.qualDataCds.push('G9958');
                    }
                }
            }
        }
        measures.push(qid463);
        //END QID463

        //QID477
        let qid477: QcdrMeasure2024 = new QcdrMeasure2024('QID477');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            qid477.eligible = 1;

            if (this.isFieldMissing(facts.patAgeYears)) {
                qid477.eligible = 0;
                qid477.missingFields.push('Patient Age');
            } else {
                if (facts.patAgeYears < 18) {
                    qid477.eligible = 0;
                }
            }
            if (!this.isFieldMissing(facts.asaEmergInd) && facts.asaEmergInd === true) {
                qid477.eligible = 0;
                qid477.qualDataCds.push('M1142');
            }
            if (this.isFieldMissing(facts.allCptCodes)) {
                if (!skipCPTEval) {
                    qid477.eligible = 0;
                }
                qid477.missingFields.push('CPT Code');
            } else {
                const cptList: string[] = [
                    '00102',
                    '00120',
                    '00160',
                    '00162',
                    '00172',
                    '00174',
                    '00190',
                    '00222',
                    '00300',
                    '00320',
                    '00402',
                    '00404',
                    '00406',
                    '00450',
                    '00470',
                    '00472',
                    '00500',
                    '00528',
                    '00529',
                    '00539',
                    '00540',
                    '00541',
                    '00542',
                    '00546',
                    '00548',
                    '00600',
                    '00620',
                    '00625',
                    '00626',
                    '00630',
                    '00670',
                    '00700',
                    '00730',
                    '00750',
                    '00752',
                    '00754',
                    '00756',
                    '00770',
                    '00790',
                    '00792',
                    '00794',
                    '00797',
                    '00800',
                    '00820',
                    '00830',
                    '00832',
                    '00840',
                    '00844',
                    '00846',
                    '00848',
                    '00860',
                    '00862',
                    '00864',
                    '00865',
                    '00866',
                    '00870',
                    '00872',
                    '00873',
                    '00880',
                    '00902',
                    '00906',
                    '00910',
                    '00912',
                    '00914',
                    '00916',
                    '00918',
                    '00920',
                    '00940',
                    '00942',
                    '00948',
                    '01120',
                    '01160',
                    '01170',
                    '01173',
                    '01210',
                    '01214',
                    '01215',
                    '01220',
                    '01230',
                    '01360',
                    '01392',
                    '01400',
                    '01402',
                    '01480',
                    '01482',
                    '01484',
                    '01486',
                    '01630',
                    '01634',
                    '01636',
                    '01638',
                    '01740',
                    '01742',
                    '01744',
                    '01760',
                    '01830',
                    '01832',
                    '01961',
                ];
                if (!this.arrayContainsAny(facts.allCptCodes, cptList)) {
                    if (!skipCPTEval) {
                        qid477.eligible = 0;
                    }
                }
            }

            //Process performance criteria and missing fields
            if (qid477.eligible == 1) {
                if (this.isFieldMissing(facts.multiModalPainMgmtCd)) {
                    qid477.missingFields.push('Multimodal Pain Mgmt');
                } else {
                    if (facts.multiModalPainMgmtCd == 'Y') {
                        qid477.perfMet = 1;
                        qid477.qualDataCds.push('G2148');
                    } else if (facts.multiModalPainMgmtCd == 'N-RU') {
                        qid477.perfNotMet = 1;
                        qid477.qualDataCds.push('G2150');
                    } else if (facts.multiModalPainMgmtCd == 'N-RS') {
                        qid477.exception = 1;
                        qid477.qualDataCds.push('G2149');
                    }
                }
            }
        }
        measures.push(qid477);
        //END QID477

        return measures;
    }

    private evalMeasuresPassthrough(facts: any, isInadmissible: boolean, skipCPTEval: boolean): QcdrMeasure2024[] {
        let measures: QcdrMeasure2024[] = [];

        //        qcdrPassthroughData: {
        //            groupId: string;
        //            locationId: string;
        //            cptCodes: string[];
        //            icdCodes: string[];
        //            patientSourceType: string;
        //            pqrsModifiers: string[];
        //            measureEvents: string[];
        //        }

        const sourceQualityCodes = this.concatWithoutDuplicates(
            facts.qcdrPassthroughData.pqrsModifiers,
            facts.qcdrPassthroughData.measureEvents,
        );

        //ABG42
        let abg42: QcdrMeasure2024 = new QcdrMeasure2024('ABG42');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            abg42.eligible = 0;

            const cptList: string[] = [
                '00100',
                '00102',
                '00103',
                '00104',
                '00120',
                '00124',
                '00126',
                '00140',
                '00142',
                '00144',
                '00145',
                '00147',
                '00148',
                '00160',
                '00162',
                '00164',
                '00170',
                '00172',
                '00174',
                '00176',
                '00190',
                '00192',
                '00210',
                '00211',
                '00212',
                '00214',
                '00215',
                '00216',
                '00218',
                '00220',
                '00222',
                '00300',
                '00320',
                '00322',
                '00326',
                '00350',
                '00352',
                '00400',
                '00402',
                '00404',
                '00406',
                '00410',
                '00450',
                '00454',
                '00470',
                '00472',
                '00474',
                '00500',
                '00520',
                '00522',
                '00524',
                '00528',
                '00529',
                '00530',
                '00532',
                '00534',
                '00537',
                '00539',
                '00540',
                '00541',
                '00542',
                '00546',
                '00548',
                '00550',
                '00560',
                '00600',
                '00604',
                '00620',
                '00625',
                '00626',
                '00630',
                '00632',
                '00635',
                '00640',
                '00670',
                '00700',
                '00702',
                '00730',
                '00740',
                '00750',
                '00752',
                '00754',
                '00756',
                '00770',
                '00790',
                '00792',
                '00794',
                '00796',
                '00797',
                '00800',
                '00802',
                '00810',
                '00820',
                '00830',
                '00832',
                '00834',
                '00836',
                '00840',
                '00842',
                '00844',
                '00846',
                '00848',
                '00851',
                '00860',
                '00862',
                '00864',
                '00865',
                '00866',
                '00868',
                '00870',
                '00872',
                '00873',
                '00880',
                '00882',
                '00902',
                '00904',
                '00906',
                '00908',
                '00910',
                '00912',
                '00914',
                '00916',
                '00918',
                '00920',
                '00921',
                '00922',
                '00924',
                '00926',
                '00928',
                '00930',
                '00932',
                '00934',
                '00936',
                '00938',
                '00940',
                '00942',
                '00944',
                '00948',
                '00950',
                '00952',
                '01112',
                '01120',
                '01130',
                '01140',
                '01150',
                '01160',
                '01170',
                '01173',
                '01180',
                '01190',
                '01200',
                '01202',
                '01210',
                '01212',
                '01214',
                '01215',
                '01220',
                '01230',
                '01232',
                '01234',
                '01250',
                '01260',
                '01270',
                '01272',
                '01274',
                '01320',
                '01340',
                '01360',
                '01380',
                '01382',
                '01390',
                '01392',
                '01400',
                '01402',
                '01404',
                '01420',
                '01430',
                '01432',
                '01440',
                '01442',
                '01444',
                '01462',
                '01464',
                '01470',
                '01472',
                '01474',
                '01480',
                '01482',
                '01484',
                '01486',
                '01490',
                '01500',
                '01502',
                '01520',
                '01522',
                '01610',
                '01620',
                '01622',
                '01630',
                '01634',
                '01636',
                '01638',
                '01650',
                '01652',
                '01654',
                '01656',
                '01670',
                '01680',
                '01682',
                '01710',
                '01712',
                '01714',
                '01716',
                '01730',
                '01732',
                '01740',
                '01742',
                '01744',
                '01756',
                '01758',
                '01760',
                '01770',
                '01772',
                '01780',
                '01782',
                '01810',
                '01820',
                '01829',
                '01830',
                '01832',
                '01840',
                '01842',
                '01844',
                '01850',
                '01852',
                '01860',
                '01924',
                '01925',
                '01926',
                '01930',
                '01931',
                '01932',
                '01933',
                '01935',
                '01936',
                '01951',
                '01952',
                '01961',
                '01962',
                '01963',
                '01965',
                '01966',
                '01992',
            ];

            if (
                !this.isFieldMissing(facts.patAgeYears) &&
                !this.isFieldMissing(facts.allCptCodes) &&
                facts.patAgeYears >= 18 &&
                this.arrayContainsAny(facts.allCptCodes, cptList) &&
                this.arrayContainsAny(sourceQualityCodes, ['1019']) &&
                this.arrayContainsAny(sourceQualityCodes, ['1073']) &&
                !(!this.isFieldMissing(facts.asaEmergInd) && facts.asaEmergInd === true)
            ) {
                abg42.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (abg42.eligible == 1) {
                abg42.measRespCds.push('1019');
                abg42.measRespCds.push('1073');

                if (
                    this.arrayContainsAny(sourceQualityCodes, ['1074']) &&
                    this.arrayContainsAny(sourceQualityCodes, ['036'])
                ) {
                    abg42.measRespCds.push('1074');
                    abg42.measRespCds.push('036');
                    abg42.perfMet = 1;
                } else if (
                    this.arrayContainsAny(sourceQualityCodes, ['037']) ||
                    this.arrayContainsAny(sourceQualityCodes, ['1075'])
                ) {
                    if (this.arrayContainsAny(sourceQualityCodes, ['037'])) abg42.measRespCds.push('037');
                    if (this.arrayContainsAny(sourceQualityCodes, ['1075'])) abg42.measRespCds.push('1075');
                    abg42.perfNotMet = 1;
                }
            }
        }
        measures.push(abg42);
        //END ABG42

        //ABG44
        let abg44: QcdrMeasure2024 = new QcdrMeasure2024('ABG44');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            abg44.eligible = 0;

            const cptList: string[] = [
                '00100',
                '00102',
                '00103',
                '00104',
                '00120',
                '00124',
                '00126',
                '00140',
                '00142',
                '00144',
                '00145',
                '00147',
                '00148',
                '00160',
                '00162',
                '00164',
                '00170',
                '00172',
                '00174',
                '00176',
                '00190',
                '00192',
                '00210',
                '00211',
                '00212',
                '00214',
                '00215',
                '00216',
                '00218',
                '00220',
                '00222',
                '00300',
                '00320',
                '00322',
                '00350',
                '00352',
                '00400',
                '00402',
                '00404',
                '00406',
                '00410',
                '00450',
                '00454',
                '00470',
                '00472',
                '00474',
                '00500',
                '00520',
                '00522',
                '00524',
                '00528',
                '00529',
                '00530',
                '00532',
                '00534',
                '00537',
                '00539',
                '00540',
                '00541',
                '00542',
                '00546',
                '00548',
                '00550',
                '00560',
                '00566',
                '00580',
                '00600',
                '00604',
                '00620',
                '00625',
                '00626',
                '00630',
                '00632',
                '00635',
                '00640',
                '00670',
                '00700',
                '00702',
                '00730',
                '00731',
                '00732',
                '00750',
                '00752',
                '00754',
                '00756',
                '00770',
                '00790',
                '00792',
                '00794',
                '00796',
                '00797',
                '00800',
                '00802',
                '00811',
                '00812',
                '00813',
                '00820',
                '00830',
                '00832',
                '00840',
                '00842',
                '00844',
                '00846',
                '00848',
                '00851',
                '00860',
                '00862',
                '00864',
                '00865',
                '00866',
                '00868',
                '00870',
                '00872',
                '00873',
                '00880',
                '00882',
                '00902',
                '00904',
                '00906',
                '00908',
                '00910',
                '00912',
                '00914',
                '00916',
                '00918',
                '00920',
                '00921',
                '00922',
                '00924',
                '00926',
                '00928',
                '00930',
                '00932',
                '00934',
                '00936',
                '00938',
                '00940',
                '00942',
                '00944',
                '00948',
                '00950',
                '00952',
                '01112',
                '01120',
                '01130',
                '01140',
                '01150',
                '01160',
                '01170',
                '01173',
                '01200',
                '01202',
                '01210',
                '01212',
                '01214',
                '01215',
                '01220',
                '01230',
                '01232',
                '01234',
                '01250',
                '01260',
                '01270',
                '01272',
                '01274',
                '01320',
                '01340',
                '01360',
                '01380',
                '01382',
                '01390',
                '01392',
                '01400',
                '01402',
                '01404',
                '01420',
                '01430',
                '01432',
                '01440',
                '01442',
                '01444',
                '01462',
                '01464',
                '01470',
                '01472',
                '01474',
                '01480',
                '01482',
                '01484',
                '01486',
                '01490',
                '01500',
                '01502',
                '01520',
                '01522',
                '01610',
                '01620',
                '01622',
                '01630',
                '01634',
                '01636',
                '01638',
                '01650',
                '01652',
                '01654',
                '01656',
                '01670',
                '01680',
                '01710',
                '01712',
                '01714',
                '01716',
                '01730',
                '01732',
                '01740',
                '01742',
                '01744',
                '01756',
                '01758',
                '01760',
                '01770',
                '01772',
                '01780',
                '01782',
                '01810',
                '01820',
                '01829',
                '01830',
                '01832',
                '01840',
                '01842',
                '01844',
                '01850',
                '01852',
                '01860',
                '01924',
                '01925',
                '01926',
                '01930',
                '01931',
                '01932',
                '01933',
                '01935',
                '01936',
                '01951',
                '01952',
                '01961',
                '01962',
                '01963',
                '01965',
                '01966',
            ];

            if (
                !this.isFieldMissing(facts.patAgeYears) &&
                !this.isFieldMissing(facts.allCptCodes) &&
                facts.patAgeYears >= 18 &&
                this.arrayContainsAny(facts.allCptCodes, cptList) &&
                this.arrayContainsAny(sourceQualityCodes, ['G9643']) &&
                this.arrayContainsAny(sourceQualityCodes, ['1095'])
            ) {
                abg44.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (abg44.eligible == 1) {
                abg44.qualDataCds.push('G9643');
                abg44.measRespCds.push('1095');

                if (this.arrayContainsAny(sourceQualityCodes, ['1097'])) {
                    abg44.measRespCds.push('1097');
                    abg44.perfMet = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['1098'])) {
                    abg44.measRespCds.push('1098');
                    abg44.perfNotMet = 1;
                }
            }
        }
        measures.push(abg44);
        //END ABG44

        //AQI18
        let aqi18: QcdrMeasure2024 = new QcdrMeasure2024('AQI18');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi18.eligible = 0;

            const cptList1: string[] = [
                '33510',
                '33511',
                '33512',
                '33513',
                '33514',
                '33516',
                '33517',
                '33518',
                '33519',
                '33521',
                '33522',
                '33523',
                '33533',
                '33534',
                '33535',
                '33536',
            ];
            const cptList2: string[] = ['00566', '00567'];
            const cptList3: string[] = [
                '33510',
                '33511',
                '33512',
                '33513',
                '33514',
                '33516',
                '33517',
                '33518',
                '33519',
                '33521',
                '33522',
                '33523',
                '33533',
                '33534',
                '33535',
                '33536',
            ];
            const cptList4: string[] = ['33530'];
            const cptList5: string[] = ['00562'];

            if (
                !this.isFieldMissing(facts.patAgeYears) &&
                !this.isFieldMissing(facts.allCptCodes) &&
                facts.patAgeYears >= 18 &&
                ((this.arrayContainsAny(facts.allCptCodes, cptList1) &&
                    this.arrayContainsAny(facts.allCptCodes, cptList2)) ||
                    (this.arrayContainsAny(facts.allCptCodes, cptList3) &&
                        this.arrayContainsAny(facts.allCptCodes, cptList4) &&
                        this.arrayContainsAny(facts.allCptCodes, cptList5))) &&
                !(this.isFieldMissing(facts.asaClsfnCd) && facts.asaClsfnCd == '6')
            ) {
                aqi18.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (aqi18.eligible == 1) {
                if (this.arrayContainsAny(sourceQualityCodes, ['G8569'])) {
                    aqi18.qualDataCds.push('G8569');
                    aqi18.perfMet = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['G8570'])) {
                    aqi18.qualDataCds.push('G8570');
                    aqi18.perfNotMet = 1;
                }
            }
        }
        measures.push(aqi18);
        //END AQI18

        //AQI48A
        let aqi48a: QcdrMeasure2024 = new QcdrMeasure2024('AQI48A');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi48a.eligible = 0;

            const cptList: string[] = [
                '00100',
                '00102',
                '00103',
                '00104',
                '00120',
                '00124',
                '00126',
                '00140',
                '00142',
                '00144',
                '00145',
                '00147',
                '00148',
                '00160',
                '00162',
                '00164',
                '00170',
                '00172',
                '00174',
                '00176',
                '00190',
                '00192',
                '00210',
                '00211',
                '00212',
                '00214',
                '00215',
                '00216',
                '00218',
                '00220',
                '00222',
                '00300',
                '00320',
                '00322',
                '00350',
                '00352',
                '00400',
                '00402',
                '00404',
                '00406',
                '00410',
                '00450',
                '00454',
                '00470',
                '00472',
                '00474',
                '00500',
                '00520',
                '00522',
                '00524',
                '00528',
                '00529',
                '00530',
                '00532',
                '00534',
                '00537',
                '00539',
                '00540',
                '00541',
                '00542',
                '00546',
                '00548',
                '00550',
                '00560',
                '00562',
                '00563',
                '00566',
                '00567',
                '00580',
                '00600',
                '00604',
                '00620',
                '00625',
                '00626',
                '00630',
                '00632',
                '00635',
                '00640',
                '00670',
                '00700',
                '00702',
                '00730',
                '00731',
                '00732',
                '00750',
                '00752',
                '00754',
                '00756',
                '00770',
                '00790',
                '00792',
                '00794',
                '00796',
                '00797',
                '00800',
                '00802',
                '00811',
                '00812',
                '00813',
                '00820',
                '00830',
                '00832',
                '00840',
                '00842',
                '00844',
                '00846',
                '00848',
                '00851',
                '00860',
                '00862',
                '00864',
                '00865',
                '00866',
                '00868',
                '00870',
                '00872',
                '00873',
                '00880',
                '00882',
                '00902',
                '00904',
                '00906',
                '00908',
                '00910',
                '00912',
                '00914',
                '00916',
                '00918',
                '00920',
                '00921',
                '00922',
                '00924',
                '00926',
                '00928',
                '00930',
                '00932',
                '00934',
                '00936',
                '00938',
                '00940',
                '00942',
                '00944',
                '00948',
                '00950',
                '00952',
                '01112',
                '01120',
                '01130',
                '01140',
                '01150',
                '01160',
                '01170',
                '01173',
                '01200',
                '01202',
                '01210',
                '01212',
                '01214',
                '01215',
                '01220',
                '01230',
                '01232',
                '01234',
                '01250',
                '01260',
                '01270',
                '01272',
                '01274',
                '01320',
                '01340',
                '01360',
                '01380',
                '01382',
                '01390',
                '01392',
                '01400',
                '01402',
                '01404',
                '01420',
                '01430',
                '01432',
                '01440',
                '01442',
                '01444',
                '01462',
                '01464',
                '01470',
                '01472',
                '01474',
                '01480',
                '01482',
                '01484',
                '01486',
                '01490',
                '01500',
                '01502',
                '01520',
                '01522',
                '01610',
                '01620',
                '01622',
                '01630',
                '01634',
                '01636',
                '01638',
                '01650',
                '01652',
                '01654',
                '01656',
                '01670',
                '01680',
                '01710',
                '01712',
                '01714',
                '01716',
                '01730',
                '01732',
                '01740',
                '01742',
                '01744',
                '01756',
                '01758',
                '01760',
                '01770',
                '01772',
                '01780',
                '01782',
                '01810',
                '01820',
                '01829',
                '01830',
                '01832',
                '01840',
                '01842',
                '01844',
                '01850',
                '01852',
                '01860',
                '01916',
                '01920',
                '01922',
                '01924',
                '01925',
                '01926',
                '01930',
                '01931',
                '01932',
                '01933',
                '01935',
                '01936',
                '01951',
                '01952',
                '01958',
                '01960',
                '01961',
                '01962',
                '01963',
                '01965',
                '01966',
                '01967',
                '01991',
                '01992',
                '20526',
                '20550',
                '20551',
                '20552',
                '20553',
                '20600',
                '20604',
                '20605',
                '20606',
                '20610',
                '20611',
                '27096',
                '36555',
                '36556',
                '36570',
                '36571',
                '36578',
                '36580',
                '36581',
                '36582',
                '36583',
                '36584',
                '36585',
                '62263',
                '62264',
                '62270',
                '62272',
                '62273',
                '62280',
                '62281',
                '62282',
                '62320',
                '62321',
                '62322',
                '62323',
                '62324',
                '62325',
                '62326',
                '62327',
                '62328',
                '62329',
                '62350',
                '62355',
                '62360',
                '62361',
                '62362',
                '62365',
                '62370',
                '63650',
                '63661',
                '63662',
                '63663',
                '63664',
                '63685',
                '63688',
                '64400',
                '64405',
                '64408',
                '64415',
                '64416',
                '64417',
                '64418',
                '64420',
                '64425',
                '64430',
                '64435',
                '64445',
                '64446',
                '64447',
                '64448',
                '64449',
                '64450',
                '64451',
                '64454',
                '64461',
                '64463',
                '64479',
                '64483',
                '64486',
                '64487',
                '64488',
                '64489',
                '64490',
                '64493',
                '64505',
                '64510',
                '64517',
                '64520',
                '64530',
                '64600',
                '64605',
                '64610',
                '64620',
                '64624',
                '64625',
                '64630',
                '64633',
                '64635',
                '64640',
                '64680',
                '64681',
                '72275',
                '93503',
                '95990',
                '95991',
            ];

            if (
                !this.isFieldMissing(facts.patAgeYears) &&
                !this.isFieldMissing(facts.allCptCodes) &&
                facts.patAgeYears >= 18 &&
                this.arrayContainsAny(facts.allCptCodes, cptList) &&
                !(this.isFieldMissing(facts.asaClsfnCd) && facts.asaClsfnCd == '6')
            ) {
                aqi48a.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (aqi48a.eligible == 1) {
                if (this.arrayContainsAny(sourceQualityCodes, ['10A12'])) {
                    aqi48a.qualDataCds.push('10A12');
                    aqi48a.perfMet = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['10A13'])) {
                    aqi48a.qualDataCds.push('10A13');
                    aqi48a.exception = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['10A14'])) {
                    aqi48a.qualDataCds.push('10A14');
                    aqi48a.perfNotMet = 1;
                }
            }
        }
        measures.push(aqi48a);
        //END AQI48A

        //AQI48B
        let aqi48b: QcdrMeasure2024 = new QcdrMeasure2024('AQI48B');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi48b.eligible = 0;

            if (!this.isFieldMissing(aqi48a.perfMet) && aqi48a.perfMet == 1) {
                aqi48b.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (aqi48b.eligible == 1) {
                if (this.arrayContainsAny(sourceQualityCodes, ['10A72'])) aqi48b.qualDataCds.push('10A72');

                if (this.arrayContainsAny(sourceQualityCodes, ['10A69'])) {
                    aqi48b.qualDataCds.push('10A69');
                    aqi48b.eligible = 0;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['10A70'])) {
                    aqi48b.qualDataCds.push('10A70');
                    aqi48b.perfMet = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['10A71'])) {
                    aqi48b.qualDataCds.push('10A71');
                    aqi48b.perfNotMet = 1;
                }
            }
        }
        measures.push(aqi48b);
        //END AQI48B

        //AQI65
        let aqi65: QcdrMeasure2024 = new QcdrMeasure2024('AQI65');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi65.eligible = 0;

            const cptList: string[] = ['00562', '00563', '00567', '00580'];

            if (
                !this.isFieldMissing(facts.patAgeYears) &&
                !this.isFieldMissing(facts.allCptCodes) &&
                facts.patAgeYears >= 18 &&
                this.arrayContainsAny(facts.allCptCodes, cptList)
            ) {
                aqi65.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (aqi65.eligible == 1) {
                if (this.arrayContainsAny(sourceQualityCodes, ['11A11'])) {
                    aqi65.qualDataCds.push('11A11');
                    aqi65.perfMet = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['11A12', '11A13'])) {
                    if (this.arrayContainsAny(sourceQualityCodes, ['11A12'])) aqi65.qualDataCds.push('11A12');
                    if (this.arrayContainsAny(sourceQualityCodes, ['11A12'])) aqi65.qualDataCds.push('11A13');
                    aqi65.perfNotMet = 1;
                }
            }
        }
        measures.push(aqi65);
        //END AQI65

        //AQI67
        let aqi67: QcdrMeasure2024 = new QcdrMeasure2024('AQI67');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi67.eligible = 0;

            const cptList: string[] = [
                '00100',
                '00102',
                '00103',
                '00104',
                '00120',
                '00124',
                '00126',
                '00140',
                '00142',
                '00144',
                '00145',
                '00147',
                '00148',
                '00160',
                '00162',
                '00164',
                '00170',
                '00172',
                '00174',
                '00176',
                '00190',
                '00192',
                '00210',
                '00211',
                '00212',
                '00214',
                '00215',
                '00216',
                '00218',
                '00220',
                '00222',
                '00300',
                '00320',
                '00322',
                '00350',
                '00352',
                '00400',
                '00402',
                '00404',
                '00406',
                '00410',
                '00450',
                '00454',
                '00470',
                '00472',
                '00474',
                '00500',
                '00520',
                '00522',
                '00524',
                '00528',
                '00529',
                '00530',
                '00532',
                '00534',
                '00537',
                '00539',
                '00540',
                '00541',
                '00542',
                '00546',
                '00548',
                '00550',
                '00560',
                '00562',
                '00563',
                '00566',
                '00567',
                '00580',
                '00600',
                '00604',
                '00620',
                '00625',
                '00626',
                '00630',
                '00632',
                '00635',
                '00640',
                '00670',
                '00700',
                '00702',
                '00730',
                '00731',
                '00732',
                '00750',
                '00752',
                '00754',
                '00756',
                '00770',
                '00790',
                '00792',
                '00794,',
                '00796',
                '00797',
                '00800',
                '00802',
                '00811',
                '00812',
                '00813',
                '00820',
                '00830',
                '00832',
                '00840',
                '00842',
                '00844',
                '00846',
                '00848',
                '00851',
                '00860',
                '00862',
                '00864',
                '00865',
                '00866',
                '00868',
                '00870',
                '00872',
                '00873',
                '00880',
                '00882',
                '00902',
                '00904',
                '00906',
                '00908',
                '00910',
                '00912',
                '00914',
                '00916',
                '00918',
                '00920',
                '00921',
                '00922',
                '00924',
                '00926',
                '00928',
                '00930',
                '00932',
                '00934',
                '00936',
                '00938',
                '00940',
                '00942',
                '00944',
                '00948',
                '00950',
                '00952',
                '01112',
                '01120',
                '01130',
                '01140',
                '01150',
                '01160',
                '01170',
                '01173',
                '01200',
                '01202',
                '01210',
                '01212',
                '01214',
                '01215',
                '01220',
                '01230',
                '01232',
                '01234',
                '01250',
                '01260',
                '01270',
                '01272',
                '01274',
                '01320',
                '01340',
                '01360',
                '01380',
                '01382',
                '01390',
                '01392',
                '01400',
                '01402',
                '01404',
                '01420',
                '01430',
                '01432',
                '01440',
                '01442',
                '01444',
                '01462',
                '01464',
                '01470',
                '01472',
                '01474',
                '01480',
                '01482',
                '01484',
                '01486',
                '01490',
                '01500',
                '01502',
                '01520',
                '01522',
                '01610',
                '01620',
                '01622',
                '01630',
                '01634',
                '01636',
                '01638',
                '01650',
                '01652',
                '01654',
                '01656',
                '01670',
                '01680',
                '01710',
                '01712',
                '01714',
                '01716',
                '01730',
                '01732',
                '01740',
                '01742',
                '01744',
                '01756',
                '01758',
                '01760',
                '01770',
                '01772',
                '01780',
                '01782',
                '01810',
                '01820',
                '01829',
                '01830',
                '01832',
                '01840',
                '01842',
                '01844',
                '01850',
                '01852',
                '01860',
                '01916',
                '01920',
                '01922',
                '01924',
                '01925',
                '01926',
                '01930',
                '01931',
                '01932',
                '01933',
                '01937',
                '01938',
                '01939',
                '01940',
                '01941',
                '01942',
                '01951',
                '01952',
                '01991',
                '01992',
                '20526',
                '20550',
                '20551',
                '20552',
                '20553',
                '20600',
                '20604',
                '20605',
                '20606',
                '20610',
                '20611',
                '27096',
                '36555',
                '36556',
                '36570',
                '36571',
                '36578',
                '36580',
                '36581',
                '36582',
                '36583',
                '36584',
                '36585',
                '62263',
                '62264',
                '62270',
                '62272',
                '62273',
                '62280',
                '62281',
                '62282',
                '62320',
                '62321',
                '62322',
                '62323',
                '62324',
                '62325',
                '62326',
                '62327',
                '62328',
                '62329',
                '62350',
                '62355',
                '62360',
                '62361',
                '62362',
                '62365',
                '62370',
                '63650',
                '63661',
                '63662',
                '63663',
                '63664',
                '63685',
                '63688',
                '64400',
                '64405',
                '64408',
                '64415',
                '64416',
                '64417',
                '64418',
                '64420',
                '64425',
                '64430',
                '64435',
                '64445',
                '64446',
                '64447',
                '64448',
                '64449',
                '64450',
                '64451',
                '64454',
                '64461',
                '64463',
                '64479',
                '64483',
                '64486',
                '64487',
                '64488',
                '64489',
                '64490',
                '64493',
                '64505',
                '64510',
                '64517',
                '64520',
                '64530',
                '64600',
                '64605',
                '64610',
                '64620',
                '64624',
                '64625',
                '64630',
                '64633',
                '64635',
                '64640',
                '64680',
                '64681',
                '93503',
                '95990',
                '95991',
            ];

            if (
                !this.isFieldMissing(facts.patAgeYears) &&
                !this.isFieldMissing(facts.allCptCodes) &&
                !this.isFieldMissing(facts.qcdrPassthroughData.patientSourceType) &&
                facts.patAgeYears >= 70 &&
                this.arrayContainsAny(facts.allCptCodes, cptList) &&
                facts.qcdrPassthroughData.patientSourceType == '21' &&
                this.arrayContainsAny(sourceQualityCodes, ['11A14'])
            ) {
                aqi67.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (aqi67.eligible == 1) {
                aqi67.qualDataCds.push('11A14');
                if (this.arrayContainsAny(sourceQualityCodes, ['11A15'])) {
                    aqi67.qualDataCds.push('11A15');
                    aqi67.perfMet = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['11A16'])) {
                    aqi67.qualDataCds.push('11A16');
                    aqi67.perfNotMet = 1;
                }
            }
        }
        measures.push(aqi67);
        //END AQI67

        //AQI71A
        let aqi71a: QcdrMeasure2024 = new QcdrMeasure2024('AQI71A');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi71a.eligible = 0;

            const cptList: string[] = [
                '00100',
                '00102',
                '00103',
                '00104',
                '00120',
                '00124',
                '00126',
                '00140',
                '00142',
                '00144',
                '00145',
                '00147',
                '00148',
                '00160',
                '00164',
                '00170',
                '00172',
                '00174',
                '00176',
                '00300',
                '00320',
                '00322',
                '00400',
                '00402',
                '00404',
                '00410',
                '00450',
                '00454',
                '00520',
                '00522',
                '00524',
                '00530',
                '00532',
                '00534',
                '00537',
                '00700',
                '00702',
                '00730',
                '00731',
                '00732',
                '00750',
                '00752',
                '00790',
                '00797',
                '00800',
                '00802',
                '00811',
                '00812',
                '00813',
                '00820',
                '00830',
                '00832',
                '00851',
                '00870',
                '00872',
                '00873',
                '00902',
                '00906',
                '00910',
                '00912',
                '00914',
                '00918',
                '00920',
                '00921',
                '00922',
                '00924',
                '00926',
                '00928',
                '00930',
                '00938',
                '00940',
                '00942',
                '00944',
                '00948',
                '00950',
                '00952',
                '01112',
                '01120',
                '01202',
                '01250',
                '01260',
                '01320',
                '01380',
                '01382',
                '01390',
                '01392',
                '01400',
                '01402',
                '01404',
                '01464',
                '01470',
                '01472',
                '01474',
                '01480',
                '01520',
                '01610',
                '01620',
                '01622',
                '01630',
                '01634',
                '01638',
                '01670',
                '01710',
                '01712',
                '01714',
                '01716',
                '01730',
                '01732',
                '01740',
                '01742',
                '01744',
                '01758',
                '01760',
                '01810',
                '01820',
                '01829',
                '01830',
                '01832',
                '01840',
                '01842',
                '01844',
                '01850',
                '01852',
                '01860',
                '01916',
                '01920',
                '01930',
                '01937',
                '01938',
                '01939',
                '01940',
                '01941',
                '01942',
                '01965',
                '01966',
                '01991',
                '01992',
            ];
            const icdCmList: string[] = [
                'E10.10',
                'E10.3291',
                'E10.3399',
                'E10.3513',
                'E10.3542',
                'E10.36',
                'E10.49',
                'E10.638',
                'E11.21',
                'E11.3293',
                'E11.3412',
                'E11.3521',
                'E11.3549',
                'E11.37X2',
                'E11.52',
                'E11.649',
                'E13.29',
                'E13.3311',
                'E13.3419',
                'E13.3523',
                'E13.3552',
                'E13.37X9',
                'E13.610',
                'E13.69',
                'E10.11',
                'E10.3292',
                'E10.3411',
                'E10.3519',
                'E10.3543',
                'E10.37X1',
                'E10.51',
                'E10.641',
                'E11.22',
                'E11.3299',
                'E11.3413',
                'E11.3522',
                'E11.3551',
                'E11.37X3',
                'E11.59',
                'E11.65',
                'E13.311',
                'E13.3312',
                'E13.3491',
                'E13.3529',
                'E13.3553',
                'E13.39',
                'E13.618',
                'E13.8',
                'E10.21',
                'E10.3293',
                'E10.3412',
                'E10.3521',
                'E10.3549',
                'E10.37X2',
                'E10.52',
                'E10.649',
                'E11.29',
                'E11.3311',
                'E11.3419',
                'E11.3523',
                'E11.3552',
                'E11.37X9',
                'E11.610',
                'E11.69',
                'E13.319',
                'E13.3313',
                'E13.3492',
                'E13.3531',
                'E13.3559',
                'E13.40',
                'E13.620',
                'E13.9',
                'E10.22',
                'E10.3299',
                'E10.3413',
                'E10.3522',
                'E10.3551',
                'E10.37X3',
                'E10.59',
                'E10.65',
                'E11.311',
                'E11.3312',
                'E11.3491',
                'E11.3529',
                'E11.3553',
                'E11.39',
                'E11.618',
                'E11.8',
                'E13.3211',
                'E13.3319',
                'E13.3493',
                'E13.3532',
                'E13.3591',
                'E13.41',
                'E13.621',
                'E10.29',
                'E10.3311',
                'E10.3419',
                'E10.3523',
                'E10.3552',
                'E10.37X9',
                'E10.610',
                'E10.69',
                'E11.319',
                'E11.3313',
                'E11.3492',
                'E11.3531',
                'E11.3559',
                'E11.40',
                'E11.620',
                'E11.9',
                'E13.3212',
                'E13.3391',
                'E13.3499',
                'E13.3533',
                'E13.3592',
                'E13.42',
                'E13.622',
                'E10.311',
                'E10.3312',
                'E10.3491',
                'E10.3529',
                'E10.3553',
                'E10.39',
                'E10.618',
                'E10.8',
                'E11.3211',
                'E11.3319',
                'E11.3493',
                'E11.3532',
                'E11.3591',
                'E11.41',
                'E11.621',
                'E13.00',
                'E13.3213',
                'E13.3392',
                'E13.3511',
                'E13.3539',
                'E13.3593',
                'E13.43',
                'E13.628',
                'E10.319',
                'E10.3313',
                'E10.3492',
                'E10.3531',
                'E10.3559',
                'E10.40',
                'E10.620',
                'E10.9',
                'E11.3212',
                'E11.3391',
                'E11.3499',
                'E11.3533',
                'E11.3592',
                'E11.42',
                'E11.622',
                'E13.01',
                'E13.3219',
                'E13.3393',
                'E13.3512',
                'E13.3541',
                'E13.3599',
                'E13.44',
                'E13.630',
                'E10.3211',
                'E10.3319',
                'E10.3493',
                'E10.3532',
                'E10.3591',
                'E10.41',
                'E10.621',
                'E11.00',
                'E11.3213',
                'E11.3392',
                'E11.3511',
                'E11.3539',
                'E11.3593',
                'E11.43',
                'E11.628',
                'E13.10',
                'E13.3291',
                'E13.3399',
                'E13.3513',
                'E13.3542',
                'E13.36',
                'E13.49',
                'E13.638',
                'E10.3212',
                'E10.3391',
                'E10.3499',
                'E10.3533',
                'E10.3592',
                'E10.42',
                'E10.622',
                'E11.01',
                'E11.3219',
                'E11.3393',
                'E11.3512',
                'E11.3541',
                'E11.3599',
                'E11.44',
                'E11.630',
                'E13.11',
                'E13.3292',
                'E13.3411',
                'E13.3519',
                'E13.3543',
                'E13.37X1',
                'E13.51',
                'E13.641',
                'E10.3213',
                'E10.3392',
                'E10.3511',
                'E10.3539',
                'E10.3593',
                'E10.43',
                'E10.628',
                'E11.10',
                'E11.3291',
                'E11.3399',
                'E11.3513',
                'E11.3542',
                'E11.36',
                'E11.49',
                'E11.638',
                'E13.21',
                'E13.3293',
                'E13.3412',
                'E13.3521',
                'E13.3549',
                'E13.37X2',
                'E13.52',
                'E13.649',
                'E10.3219',
                'E10.3393',
                'E10.3512',
                'E10.3541',
                'E10.3599',
                'E10.44',
                'E10.630',
                'E11.11',
                'E11.3292',
                'E11.3411',
                'E11.3519',
                'E11.3543',
                'E11.37X1',
                'E11.51',
                'E11.641',
                'E13.22',
                'E13.3299',
                'E13.3413',
                'E13.3522',
                'E13.3551',
                'E13.37X3',
                'E13.59',
                'E13.65',
            ];

            if (
                !this.isFieldMissing(facts.patAgeYears) &&
                !this.isFieldMissing(facts.allCptCodes) &&
                !this.isFieldMissing(facts.allIcdCmCodes) &&
                !this.isFieldMissing(facts.qcdrPassthroughData.patientSourceType) &&
                facts.patAgeYears >= 18 &&
                this.arrayContainsAny(facts.allCptCodes, cptList) &&
                this.arrayContainsAny(['11', '19', '22', '24'], [facts.qcdrPassthroughData.patientSourceType]) &&
                (this.arrayContainsAny(sourceQualityCodes, ['11A41']) ||
                    this.arrayContainsAny(facts.allIcdCmCodes, icdCmList))
            ) {
                aqi71a.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (aqi71a.eligible == 1) {
                aqi71a.qualDataCds.push('11A41');
                if (this.arrayContainsAny(sourceQualityCodes, ['11A45'])) {
                    aqi71a.qualDataCds.push('11A45');
                    aqi71a.eligible = 0;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['11A51'])) {
                    aqi71a.qualDataCds.push('11A51');
                    aqi71a.perfMet = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['11A52'])) {
                    aqi71a.qualDataCds.push('11A52');
                    aqi71a.perfNotMet = 1;
                }
            }
        }
        measures.push(aqi71a);
        //END AQI71A

        //AQI71B
        let aqi71b: QcdrMeasure2024 = new QcdrMeasure2024('AQI71B');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi71b.eligible = 0;

            const cptList: string[] = [
                '00100',
                '00102',
                '00103',
                '00104',
                '00120',
                '00124',
                '00126',
                '00140',
                '00142',
                '00144',
                '00145',
                '00147',
                '00148',
                '00160',
                '00164',
                '00170',
                '00172',
                '00174',
                '00176',
                '00300',
                '00320',
                '00322',
                '00400',
                '00402',
                '00404',
                '00410',
                '00450',
                '00454',
                '00520',
                '00522',
                '00524',
                '00530',
                '00532',
                '00534',
                '00537',
                '00700',
                '00702',
                '00730',
                '00731',
                '00732',
                '00750',
                '00752',
                '00790',
                '00797',
                '00800',
                '00802',
                '00811',
                '00812',
                '00813',
                '00820',
                '00830',
                '00832',
                '00851',
                '00870',
                '00872',
                '00873',
                '00902',
                '00906',
                '00910',
                '00912',
                '00914',
                '00918',
                '00920',
                '00921',
                '00922',
                '00924',
                '00926',
                '00928',
                '00930',
                '00938',
                '00940',
                '00942',
                '00944',
                '00948',
                '00950',
                '00952',
                '01112',
                '01120',
                '01202',
                '01250',
                '01260',
                '01320',
                '01380',
                '01382',
                '01390',
                '01392',
                '01400',
                '01402',
                '01404',
                '01464',
                '01470',
                '01472',
                '01474',
                '01480',
                '01520',
                '01610',
                '01620',
                '01622',
                '01630',
                '01634',
                '01638',
                '01670',
                '01710',
                '01712',
                '01714',
                '01716',
                '01730',
                '01732',
                '01740',
                '01742',
                '01744',
                '01758',
                '01760',
                '01810',
                '01820',
                '01829',
                '01830',
                '01832',
                '01840',
                '01842',
                '01844',
                '01850',
                '01852',
                '01860',
                '01916',
                '01920',
                '01930',
                '01937',
                '01938',
                '01939',
                '01940',
                '01941',
                '01942',
                '01965',
                '01966',
                '01991',
                '01992',
            ];

            const icdCmList: string[] = [
                'E10.10',
                'E10.3291',
                'E10.3399',
                'E10.3513',
                'E10.3542',
                'E10.36',
                'E10.49',
                'E10.638',
                'E11.21',
                'E11.3293',
                'E11.3412',
                'E11.3521',
                'E11.3549',
                'E11.37X2',
                'E11.52',
                'E11.649',
                'E13.29',
                'E13.3311',
                'E13.3419',
                'E13.3523',
                'E13.3552',
                'E13.37X9',
                'E13.610',
                'E13.69',
                'E10.11',
                'E10.3292',
                'E10.3411',
                'E10.3519',
                'E10.3543',
                'E10.37X1',
                'E10.51',
                'E10.641',
                'E11.22',
                'E11.3299',
                'E11.3413',
                'E11.3522',
                'E11.3551',
                'E11.37X3',
                'E11.59',
                'E11.65',
                'E13.311',
                'E13.3312',
                'E13.3491',
                'E13.3529',
                'E13.3553',
                'E13.39',
                'E13.618',
                'E13.8',
                'E10.21',
                'E10.3293',
                'E10.3412',
                'E10.3521',
                'E10.3549',
                'E10.37X2',
                'E10.52',
                'E10.649',
                'E11.29',
                'E11.3311',
                'E11.3419',
                'E11.3523',
                'E11.3552',
                'E11.37X9',
                'E11.610',
                'E11.69',
                'E13.319',
                'E13.3313',
                'E13.3492',
                'E13.3531',
                'E13.3559',
                'E13.40',
                'E13.620',
                'E13.9',
                'E10.22',
                'E10.3299',
                'E10.3413',
                'E10.3522',
                'E10.3551',
                'E10.37X3',
                'E10.59',
                'E10.65',
                'E11.311',
                'E11.3312',
                'E11.3491',
                'E11.3529',
                'E11.3553',
                'E11.39',
                'E11.618',
                'E11.8',
                'E13.3211',
                'E13.3319',
                'E13.3493',
                'E13.3532',
                'E13.3591',
                'E13.41',
                'E13.621',
                'E10.29',
                'E10.3311',
                'E10.3419',
                'E10.3523',
                'E10.3552',
                'E10.37X9',
                'E10.610',
                'E10.69',
                'E11.319',
                'E11.3313',
                'E11.3492',
                'E11.3531',
                'E11.3559',
                'E11.40',
                'E11.620',
                'E11.9',
                'E13.3212',
                'E13.3391',
                'E13.3499',
                'E13.3533',
                'E13.3592',
                'E13.42',
                'E13.622',
                'E10.311',
                'E10.3312',
                'E10.3491',
                'E10.3529',
                'E10.3553',
                'E10.39',
                'E10.618',
                'E10.8',
                'E11.3211',
                'E11.3319',
                'E11.3493',
                'E11.3532',
                'E11.3591',
                'E11.41',
                'E11.621',
                'E13.00',
                'E13.3213',
                'E13.3392',
                'E13.3511',
                'E13.3539',
                'E13.3593',
                'E13.43',
                'E13.628',
                'E10.319',
                'E10.3313',
                'E10.3492',
                'E10.3531',
                'E10.3559',
                'E10.40',
                'E10.620',
                'E10.9',
                'E11.3212',
                'E11.3391',
                'E11.3499',
                'E11.3533',
                'E11.3592',
                'E11.42',
                'E11.622',
                'E13.01',
                'E13.3219',
                'E13.3393',
                'E13.3512',
                'E13.3541',
                'E13.3599',
                'E13.44',
                'E13.630',
                'E10.3211',
                'E10.3319',
                'E10.3493',
                'E10.3532',
                'E10.3591',
                'E10.41',
                'E10.621',
                'E11.00',
                'E11.3213',
                'E11.3392',
                'E11.3511',
                'E11.3539',
                'E11.3593',
                'E11.43',
                'E11.628',
                'E13.10',
                'E13.3291',
                'E13.3399',
                'E13.3513',
                'E13.3542',
                'E13.36',
                'E13.49',
                'E13.638',
                'E10.3212',
                'E10.3391',
                'E10.3499',
                'E10.3533',
                'E10.3592',
                'E10.42',
                'E10.622',
                'E11.01',
                'E11.3219',
                'E11.3393',
                'E11.3512',
                'E11.3541',
                'E11.3599',
                'E11.44',
                'E11.630',
                'E13.11',
                'E13.3292',
                'E13.3411',
                'E13.3519',
                'E13.3543',
                'E13.37X1',
                'E13.51',
                'E13.641',
                'E10.3213',
                'E10.3392',
                'E10.3511',
                'E10.3539',
                'E10.3593',
                'E10.43',
                'E10.628',
                'E11.10',
                'E11.3291',
                'E11.3399',
                'E11.3513',
                'E11.3542',
                'E11.36',
                'E11.49',
                'E11.638',
                'E13.21',
                'E13.3293',
                'E13.3412',
                'E13.3521',
                'E13.3549',
                'E13.37X2',
                'E13.52',
                'E13.649',
                'E10.3219',
                'E10.3393',
                'E10.3512',
                'E10.3541',
                'E10.3599',
                'E10.44',
                'E10.630',
                'E11.11',
                'E11.3292',
                'E11.3411',
                'E11.3519',
                'E11.3543',
                'E11.37X1',
                'E11.51',
                'E11.641',
                'E13.22',
                'E13.3299',
                'E13.3413',
                'E13.3522',
                'E13.3551',
                'E13.37X3',
                'E13.59',
                'E13.65',
            ];

            if (
                !this.isFieldMissing(facts.patAgeYears) &&
                !this.isFieldMissing(facts.allCptCodes) &&
                !this.isFieldMissing(facts.allIcdCmCodes) &&
                !this.isFieldMissing(facts.qcdrPassthroughData.patientSourceType) &&
                facts.patAgeYears >= 18 &&
                this.arrayContainsAny(facts.allCptCodes, cptList) &&
                this.arrayContainsAny(['11', '19', '22', '24'], [facts.qcdrPassthroughData.patientSourceType]) &&
                this.arrayContainsAny(sourceQualityCodes, ['11A44']) &&
                (this.arrayContainsAny(sourceQualityCodes, ['11A41']) ||
                    this.arrayContainsAny(facts.allIcdCmCodes, icdCmList))
            ) {
                aqi71b.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (aqi71b.eligible == 1) {
                aqi71b.qualDataCds.push('11A44');
                if (this.arrayContainsAny(sourceQualityCodes, ['11A53'])) {
                    aqi71b.qualDataCds.push('11A53');
                    aqi71b.perfMet = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['11A54'])) {
                    aqi71b.qualDataCds.push('11A54');
                    aqi71b.perfNotMet = 1;
                }
            }
        }
        measures.push(aqi71b);
        //END AQI71B

        //AQI71C
        let aqi71c: QcdrMeasure2024 = new QcdrMeasure2024('AQI71C');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi71c.eligible = 0;

            const cptList: string[] = [
                '00100',
                '00102',
                '00103',
                '00104',
                '00120',
                '00124',
                '00126',
                '00140',
                '00142',
                '00144',
                '00145',
                '00147',
                '00148',
                '00160',
                '00164',
                '00170',
                '00172',
                '00174',
                '00176',
                '00300',
                '00320',
                '00322',
                '00400',
                '00402',
                '00404',
                '00410',
                '00450',
                '00454',
                '00520',
                '00522',
                '00524',
                '00530',
                '00532',
                '00534',
                '00537',
                '00700',
                '00702',
                '00730',
                '00731',
                '00732',
                '00750',
                '00752',
                '00790',
                '00797',
                '00800',
                '00802',
                '00811',
                '00812',
                '00813',
                '00820',
                '00830',
                '00832',
                '00851',
                '00870',
                '00872',
                '00873',
                '00902',
                '00906',
                '00910',
                '00912',
                '00914',
                '00918',
                '00920',
                '00921',
                '00922',
                '00924',
                '00926',
                '00928',
                '00930',
                '00938',
                '00940',
                '00942',
                '00944',
                '00948',
                '00950',
                '00952',
                '01112',
                '01120',
                '01202',
                '01250',
                '01260',
                '01320',
                '01380',
                '01382',
                '01390',
                '01392',
                '01400',
                '01402',
                '01404',
                '01464',
                '01470',
                '01472',
                '01474',
                '01480',
                '01520',
                '01610',
                '01620',
                '01622',
                '01630',
                '01634',
                '01638',
                '01670',
                '01710',
                '01712',
                '01714',
                '01716',
                '01730',
                '01732',
                '01740',
                '01742',
                '01744',
                '01758',
                '01760',
                '01810',
                '01820',
                '01829',
                '01830',
                '01832',
                '01840',
                '01842',
                '01844',
                '01850',
                '01852',
                '01860',
                '01916',
                '01920',
                '01930',
                '01937',
                '01938',
                '01939',
                '01940',
                '01941',
                '01942',
                '01965',
                '01966',
                '01991',
                '01992',
            ];

            const icdCmList: string[] = [
                'E10.10',
                'E10.3291',
                'E10.3399',
                'E10.3513',
                'E10.3542',
                'E10.36',
                'E10.49',
                'E10.638',
                'E11.21',
                'E11.3293',
                'E11.3412',
                'E11.3521',
                'E11.3549',
                'E11.37X2',
                'E11.52',
                'E11.649',
                'E13.29',
                'E13.3311',
                'E13.3419',
                'E13.3523',
                'E13.3552',
                'E13.37X9',
                'E13.610',
                'E13.69',
                'E10.11',
                'E10.3292',
                'E10.3411',
                'E10.3519',
                'E10.3543',
                'E10.37X1',
                'E10.51',
                'E10.641',
                'E11.22',
                'E11.3299',
                'E11.3413',
                'E11.3522',
                'E11.3551',
                'E11.37X3',
                'E11.59',
                'E11.65',
                'E13.311',
                'E13.3312',
                'E13.3491',
                'E13.3529',
                'E13.3553',
                'E13.39',
                'E13.618',
                'E13.8',
                'E10.21',
                'E10.3293',
                'E10.3412',
                'E10.3521',
                'E10.3549',
                'E10.37X2',
                'E10.52',
                'E10.649',
                'E11.29',
                'E11.3311',
                'E11.3419',
                'E11.3523',
                'E11.3552',
                'E11.37X9',
                'E11.610',
                'E11.69',
                'E13.319',
                'E13.3313',
                'E13.3492',
                'E13.3531',
                'E13.3559',
                'E13.40',
                'E13.620',
                'E13.9',
                'E10.22',
                'E10.3299',
                'E10.3413',
                'E10.3522',
                'E10.3551',
                'E10.37X3',
                'E10.59',
                'E10.65',
                'E11.311',
                'E11.3312',
                'E11.3491',
                'E11.3529',
                'E11.3553',
                'E11.39',
                'E11.618',
                'E11.8',
                'E13.3211',
                'E13.3319',
                'E13.3493',
                'E13.3532',
                'E13.3591',
                'E13.41',
                'E13.621',
                'E10.29',
                'E10.3311',
                'E10.3419',
                'E10.3523',
                'E10.3552',
                'E10.37X9',
                'E10.610',
                'E10.69',
                'E11.319',
                'E11.3313',
                'E11.3492',
                'E11.3531',
                'E11.3559',
                'E11.40',
                'E11.620',
                'E11.9',
                'E13.3212',
                'E13.3391',
                'E13.3499',
                'E13.3533',
                'E13.3592',
                'E13.42',
                'E13.622',
                'E10.311',
                'E10.3312',
                'E10.3491',
                'E10.3529',
                'E10.3553',
                'E10.39',
                'E10.618',
                'E10.8',
                'E11.3211',
                'E11.3319',
                'E11.3493',
                'E11.3532',
                'E11.3591',
                'E11.41',
                'E11.621',
                'E13.00',
                'E13.3213',
                'E13.3392',
                'E13.3511',
                'E13.3539',
                'E13.3593',
                'E13.43',
                'E13.628',
                'E10.319',
                'E10.3313',
                'E10.3492',
                'E10.3531',
                'E10.3559',
                'E10.40',
                'E10.620',
                'E10.9',
                'E11.3212',
                'E11.3391',
                'E11.3499',
                'E11.3533',
                'E11.3592',
                'E11.42',
                'E11.622',
                'E13.01',
                'E13.3219',
                'E13.3393',
                'E13.3512',
                'E13.3541',
                'E13.3599',
                'E13.44',
                'E13.630',
                'E10.3211',
                'E10.3319',
                'E10.3493',
                'E10.3532',
                'E10.3591',
                'E10.41',
                'E10.621',
                'E11.00',
                'E11.3213',
                'E11.3392',
                'E11.3511',
                'E11.3539',
                'E11.3593',
                'E11.43',
                'E11.628',
                'E13.10',
                'E13.3291',
                'E13.3399',
                'E13.3513',
                'E13.3542',
                'E13.36',
                'E13.49',
                'E13.638',
                'E10.3212',
                'E10.3391',
                'E10.3499',
                'E10.3533',
                'E10.3592',
                'E10.42',
                'E10.622',
                'E11.01',
                'E11.3219',
                'E11.3393',
                'E11.3512',
                'E11.3541',
                'E11.3599',
                'E11.44',
                'E11.630',
                'E13.11',
                'E13.3292',
                'E13.3411',
                'E13.3519',
                'E13.3543',
                'E13.37X1',
                'E13.51',
                'E13.641',
                'E10.3213',
                'E10.3392',
                'E10.3511',
                'E10.3539',
                'E10.3593',
                'E10.43',
                'E10.628',
                'E11.10',
                'E11.3291',
                'E11.3399',
                'E11.3513',
                'E11.3542',
                'E11.36',
                'E11.49',
                'E11.638',
                'E13.21',
                'E13.3293',
                'E13.3412',
                'E13.3521',
                'E13.3549',
                'E13.37X2',
                'E13.52',
                'E13.649',
                'E10.3219',
                'E10.3393',
                'E10.3512',
                'E10.3541',
                'E10.3599',
                'E10.44',
                'E10.630',
                'E11.11',
                'E11.3292',
                'E11.3411',
                'E11.3519',
                'E11.3543',
                'E11.37X1',
                'E11.51',
                'E11.641',
                'E13.22',
                'E13.3299',
                'E13.3413',
                'E13.3522',
                'E13.3551',
                'E13.37X3',
                'E13.59',
                'E13.65',
            ];

            if (
                !this.isFieldMissing(facts.patAgeYears) &&
                !this.isFieldMissing(facts.allCptCodes) &&
                !this.isFieldMissing(facts.allIcdCmCodes) &&
                !this.isFieldMissing(facts.qcdrPassthroughData.patientSourceType) &&
                facts.patAgeYears >= 18 &&
                this.arrayContainsAny(facts.allCptCodes, cptList) &&
                this.arrayContainsAny(['11', '19', '22', '24'], [facts.qcdrPassthroughData.patientSourceType]) &&
                this.arrayContainsAny(sourceQualityCodes, ['11A55']) &&
                (this.arrayContainsAny(sourceQualityCodes, ['11A41']) ||
                    this.arrayContainsAny(facts.allIcdCmCodes, icdCmList))
            ) {
                aqi71c.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (aqi71c.eligible == 1) {
                aqi71c.qualDataCds.push('11A55');
                if (this.arrayContainsAny(sourceQualityCodes, ['11A45'])) {
                    aqi71c.qualDataCds.push('11A45');
                    aqi71c.eligible = 0;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['11A56'])) {
                    aqi71c.qualDataCds.push('11A56');
                    aqi71c.perfMet = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['11A57'])) {
                    aqi71c.qualDataCds.push('11A57');
                    aqi71c.perfNotMet = 1;
                }
            }
        }
        measures.push(aqi71c);
        //END AQI71C

        //AQI71D
        let aqi71d: QcdrMeasure2024 = new QcdrMeasure2024('AQI71D');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi71d.eligible = 0;

            const cptList: string[] = [
                '00100',
                '00102',
                '00103',
                '00104',
                '00120',
                '00124',
                '00126',
                '00140',
                '00142',
                '00144',
                '00145',
                '00147',
                '00148',
                '00160',
                '00164',
                '00170',
                '00172',
                '00174',
                '00176',
                '00300',
                '00320',
                '00322',
                '00400',
                '00402',
                '00404',
                '00410',
                '00450',
                '00454',
                '00520',
                '00522',
                '00524',
                '00530',
                '00532',
                '00534',
                '00537',
                '00700',
                '00702',
                '00730',
                '00731',
                '00732',
                '00750',
                '00752',
                '00790',
                '00797',
                '00800',
                '00802',
                '00811',
                '00812',
                '00813',
                '00820',
                '00830',
                '00832',
                '00851',
                '00870',
                '00872',
                '00873',
                '00902',
                '00906',
                '00910',
                '00912',
                '00914',
                '00918',
                '00920',
                '00921',
                '00922',
                '00924',
                '00926',
                '00928',
                '00930',
                '00938',
                '00940',
                '00942',
                '00944',
                '00948',
                '00950',
                '00952',
                '01112',
                '01120',
                '01202',
                '01250',
                '01260',
                '01320',
                '01380',
                '01382',
                '01390',
                '01392',
                '01400',
                '01402',
                '01404',
                '01464',
                '01470',
                '01472',
                '01474',
                '01480',
                '01520',
                '01610',
                '01620',
                '01622',
                '01630',
                '01634',
                '01638',
                '01670',
                '01710',
                '01712',
                '01714',
                '01716',
                '01730',
                '01732',
                '01740',
                '01742',
                '01744',
                '01758',
                '01760',
                '01810',
                '01820',
                '01829',
                '01830',
                '01832',
                '01840',
                '01842',
                '01844',
                '01850',
                '01852',
                '01860',
                '01916',
                '01920',
                '01930',
                '01937',
                '01938',
                '01939',
                '01940',
                '01941',
                '01942',
                '01965',
                '01966',
                '01991',
                '01992',
            ];

            const icdCmList: string[] = [
                'E10.10',
                'E10.3291',
                'E10.3399',
                'E10.3513',
                'E10.3542',
                'E10.36',
                'E10.49',
                'E10.638',
                'E11.21',
                'E11.3293',
                'E11.3412',
                'E11.3521',
                'E11.3549',
                'E11.37X2',
                'E11.52',
                'E11.649',
                'E13.29',
                'E13.3311',
                'E13.3419',
                'E13.3523',
                'E13.3552',
                'E13.37X9',
                'E13.610',
                'E13.69',
                'E10.11',
                'E10.3292',
                'E10.3411',
                'E10.3519',
                'E10.3543',
                'E10.37X1',
                'E10.51',
                'E10.641',
                'E11.22',
                'E11.3299',
                'E11.3413',
                'E11.3522',
                'E11.3551',
                'E11.37X3',
                'E11.59',
                'E11.65',
                'E13.311',
                'E13.3312',
                'E13.3491',
                'E13.3529',
                'E13.3553',
                'E13.39',
                'E13.618',
                'E13.8',
                'E10.21',
                'E10.3293',
                'E10.3412',
                'E10.3521',
                'E10.3549',
                'E10.37X2',
                'E10.52',
                'E10.649',
                'E11.29',
                'E11.3311',
                'E11.3419',
                'E11.3523',
                'E11.3552',
                'E11.37X9',
                'E11.610',
                'E11.69',
                'E13.319',
                'E13.3313',
                'E13.3492',
                'E13.3531',
                'E13.3559',
                'E13.40',
                'E13.620',
                'E13.9',
                'E10.22',
                'E10.3299',
                'E10.3413',
                'E10.3522',
                'E10.3551',
                'E10.37X3',
                'E10.59',
                'E10.65',
                'E11.311',
                'E11.3312',
                'E11.3491',
                'E11.3529',
                'E11.3553',
                'E11.39',
                'E11.618',
                'E11.8',
                'E13.3211',
                'E13.3319',
                'E13.3493',
                'E13.3532',
                'E13.3591',
                'E13.41',
                'E13.621',
                'E10.29',
                'E10.3311',
                'E10.3419',
                'E10.3523',
                'E10.3552',
                'E10.37X9',
                'E10.610',
                'E10.69',
                'E11.319',
                'E11.3313',
                'E11.3492',
                'E11.3531',
                'E11.3559',
                'E11.40',
                'E11.620',
                'E11.9',
                'E13.3212',
                'E13.3391',
                'E13.3499',
                'E13.3533',
                'E13.3592',
                'E13.42',
                'E13.622',
                'E10.311',
                'E10.3312',
                'E10.3491',
                'E10.3529',
                'E10.3553',
                'E10.39',
                'E10.618',
                'E10.8',
                'E11.3211',
                'E11.3319',
                'E11.3493',
                'E11.3532',
                'E11.3591',
                'E11.41',
                'E11.621',
                'E13.00',
                'E13.3213',
                'E13.3392',
                'E13.3511',
                'E13.3539',
                'E13.3593',
                'E13.43',
                'E13.628',
                'E10.319',
                'E10.3313',
                'E10.3492',
                'E10.3531',
                'E10.3559',
                'E10.40',
                'E10.620',
                'E10.9',
                'E11.3212',
                'E11.3391',
                'E11.3499',
                'E11.3533',
                'E11.3592',
                'E11.42',
                'E11.622',
                'E13.01',
                'E13.3219',
                'E13.3393',
                'E13.3512',
                'E13.3541',
                'E13.3599',
                'E13.44',
                'E13.630',
                'E10.3211',
                'E10.3319',
                'E10.3493',
                'E10.3532',
                'E10.3591',
                'E10.41',
                'E10.621',
                'E11.00',
                'E11.3213',
                'E11.3392',
                'E11.3511',
                'E11.3539',
                'E11.3593',
                'E11.43',
                'E11.628',
                'E13.10',
                'E13.3291',
                'E13.3399',
                'E13.3513',
                'E13.3542',
                'E13.36',
                'E13.49',
                'E13.638',
                'E10.3212',
                'E10.3391',
                'E10.3499',
                'E10.3533',
                'E10.3592',
                'E10.42',
                'E10.622',
                'E11.01',
                'E11.3219',
                'E11.3393',
                'E11.3512',
                'E11.3541',
                'E11.3599',
                'E11.44',
                'E11.630',
                'E13.11',
                'E13.3292',
                'E13.3411',
                'E13.3519',
                'E13.3543',
                'E13.37X1',
                'E13.51',
                'E13.641',
                'E10.3213',
                'E10.3392',
                'E10.3511',
                'E10.3539',
                'E10.3593',
                'E10.43',
                'E10.628',
                'E11.10',
                'E11.3291',
                'E11.3399',
                'E11.3513',
                'E11.3542',
                'E11.36',
                'E11.49',
                'E11.638',
                'E13.21',
                'E13.3293',
                'E13.3412',
                'E13.3521',
                'E13.3549',
                'E13.37X2',
                'E13.52',
                'E13.649',
                'E10.3219',
                'E10.3393',
                'E10.3512',
                'E10.3541',
                'E10.3599',
                'E10.44',
                'E10.630',
                'E11.11',
                'E11.3292',
                'E11.3411',
                'E11.3519',
                'E11.3543',
                'E11.37X1',
                'E11.51',
                'E11.641',
                'E13.22',
                'E13.3299',
                'E13.3413',
                'E13.3522',
                'E13.3551',
                'E13.37X3',
                'E13.59',
                'E13.65',
            ];

            if (
                !this.isFieldMissing(facts.patAgeYears) &&
                !this.isFieldMissing(facts.allCptCodes) &&
                !this.isFieldMissing(facts.allIcdCmCodes) &&
                !this.isFieldMissing(facts.qcdrPassthroughData.patientSourceType) &&
                facts.patAgeYears >= 18 &&
                this.arrayContainsAny(facts.allCptCodes, cptList) &&
                this.arrayContainsAny(['11', '19', '22', '24'], [facts.qcdrPassthroughData.patientSourceType]) &&
                this.arrayContainsAny(sourceQualityCodes, ['11A44']) &&
                (this.arrayContainsAny(sourceQualityCodes, ['11A41']) ||
                    this.arrayContainsAny(facts.allIcdCmCodes, icdCmList))
            ) {
                aqi71d.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (aqi71d.eligible == 1) {
                aqi71d.qualDataCds.push('11A44');
                if (this.arrayContainsAny(sourceQualityCodes, ['11A45'])) {
                    aqi71d.qualDataCds.push('11A45');
                    aqi71d.eligible = 0;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['11A58'])) {
                    aqi71d.qualDataCds.push('11A58');
                    aqi71d.perfMet = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['11A59'])) {
                    aqi71d.qualDataCds.push('11A59');
                    aqi71d.perfNotMet = 1;
                }
            }
        }
        measures.push(aqi71d);
        //END AQI71D

        //AQI72
        let aqi72: QcdrMeasure2024 = new QcdrMeasure2024('AQI72');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            aqi72.eligible = 0;

            const cptList: string[] = ['01214', '01215', '01402', '01638'];

            if (
                !this.isFieldMissing(facts.patAgeYears) &&
                !this.isFieldMissing(facts.allCptCodes) &&
                facts.patAgeYears >= 18 &&
                this.arrayContainsAny(facts.allCptCodes, cptList) &&
                this.arrayContainsAny(sourceQualityCodes, ['G9643'])
            ) {
                aqi72.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (aqi72.eligible == 1) {
                aqi72.qualDataCds.push('G9643');

                if (this.arrayContainsAny(sourceQualityCodes, ['11A67'])) {
                    aqi72.qualDataCds.push('11A67');
                    aqi72.perfMet = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['11A68', '11A69'])) {
                    aqi72.exception = 1;
                    if (this.arrayContainsAny(sourceQualityCodes, ['11A68'])) aqi72.qualDataCds.push('11A68');
                    if (this.arrayContainsAny(sourceQualityCodes, ['11A69'])) aqi72.qualDataCds.push('11A69');
                } else if (this.arrayContainsAny(sourceQualityCodes, ['11A70'])) {
                    aqi72.qualDataCds.push('11A70');
                    aqi72.perfNotMet = 1;
                }
            }
        }
        measures.push(aqi72);
        //END AQI72

        //QID404
        let qid404: QcdrMeasure2024 = new QcdrMeasure2024('QID404');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            qid404.eligible = 0;

            const cptList: string[] = [
                '00100',
                '00102',
                '00103',
                '00104',
                '00120',
                '00124',
                '00126',
                '00140',
                '00142',
                '00144',
                '00145',
                '00147',
                '00148',
                '00160',
                '00162',
                '00164',
                '00170',
                '00172',
                '00174',
                '00176',
                '00190',
                '00192',
                '00210',
                '00211',
                '00212',
                '00214',
                '00215',
                '00216',
                '00218',
                '00220',
                '00222',
                '00300',
                '00320',
                '00322',
                '00350',
                '00352',
                '00400',
                '00402',
                '00404',
                '00406',
                '00410',
                '00450',
                '00454',
                '00470',
                '00472',
                '00474',
                '00500',
                '00520',
                '00522',
                '00524',
                '00528',
                '00529',
                '00530',
                '00532',
                '00534',
                '00537',
                '00539',
                '00540',
                '00541',
                '00542',
                '00546',
                '00548',
                '00550',
                '00560',
                '00563',
                '00566',
                '00567',
                '00580',
                '00600',
                '00604',
                '00620',
                '00625',
                '00626',
                '00630',
                '00632',
                '00635',
                '00640',
                '00670',
                '00700',
                '00702',
                '00730',
                '00731',
                '00732',
                '00750',
                '00752',
                '00756',
                '00770',
                '00790',
                '00792',
                '00794',
                '00796',
                '00797',
                '00800',
                '00802',
                '00811',
                '00812',
                '00813',
                '00820',
                '00830',
                '00832',
                '00840',
                '00842',
                '00844',
                '00846',
                '00848',
                '00851',
                '00860',
                '00862',
                '00864',
                '00865',
                '00866',
                '00868',
                '00870',
                '00872',
                '00873',
                '00880',
                '00882',
                '00902',
                '00904',
                '00906',
                '00908',
                '00910',
                '00912',
                '00914',
                '00916',
                '00918',
                '00920',
                '00921',
                '00922',
                '00924',
                '00926',
                '00928',
                '00930',
                '00932',
                '00934',
                '00936',
                '00938',
                '00940',
                '00942',
                '00944',
                '00948',
                '00950',
                '00952',
                '01112',
                '01120',
                '01130',
                '01140',
                '01150',
                '01160',
                '01170',
                '01173',
                '01200',
                '01202',
                '01210',
                '01212',
                '01214',
                '01215',
                '01220',
                '01230',
                '01232',
                '01234',
                '01250',
                '01260',
                '01270',
                '01272',
                '01402',
                '01404',
                '01420',
                '01430',
                '01432',
                '01482',
                '01484',
                '01486',
                '01490',
                '01500',
                '01638',
                '01650',
                '01652',
                '01654',
                '01656',
                '01742',
                '01744',
                '01756',
                '01758',
                '01760',
                '01840',
                '01842',
                '01844',
                '01850',
                '01852',
                '01932',
                '01933',
                '01935',
                '01936',
                '01951',
                '62320',
                '62321',
                '62322',
                '62323',
                '62324',
                '64415',
                '64416',
                '64417',
                '64418',
                '64420',
                '64450',
                '64455',
                '64461',
                '64463',
                '64479',
                '64517',
                '64520',
                '64530',
                '0228T',
                '0230T',
                '01274',
                '01320',
                '01340',
                '01360',
                '01380',
                '01382',
                '01390',
                '01392',
                '01400',
                '01440',
                '01442',
                '01444',
                '01462',
                '01464',
                '01470',
                '01472',
                '01474',
                '01480',
                '01502',
                '01520',
                '01522',
                '01610',
                '01620',
                '01622',
                '01630',
                '01634',
                '01636',
                '01670',
                '01680',
                '01710',
                '01712',
                '01714',
                '01716',
                '01730',
                '01732',
                '01740',
                '01770',
                '01772',
                '01780',
                '01782',
                '01810',
                '01820',
                '01829',
                '01830',
                '01832',
                '01860',
                '01916',
                '01920',
                '01922',
                '01924',
                '01925',
                '01926',
                '01930',
                '01931',
                '01952',
                '01958',
                '01960',
                '01961',
                '01966',
                '01991',
                '01992',
                '27095',
                '27096',
                '62325',
                '62326',
                '62327',
                '64400',
                '64405',
                '64408',
                '64421',
                '64425',
                '64430',
                '64435',
                '64445',
                '64446',
                '64447',
                '64448',
                '64449',
                '64483',
                '64486',
                '64487',
                '64488',
                '64489',
                '64490',
                '64493',
                '64505',
                '64510',
            ];

            if (
                !this.isFieldMissing(facts.patAgeYears) &&
                !this.isFieldMissing(facts.allCptCodes) &&
                facts.patAgeYears >= 18 &&
                this.arrayContainsAny(facts.allCptCodes, cptList) &&
                this.arrayContainsAny(sourceQualityCodes, ['G9642']) &&
                this.arrayContainsAny(sourceQualityCodes, ['G9643']) &&
                this.arrayContainsAny(sourceQualityCodes, ['G9497'])
            ) {
                qid404.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (qid404.eligible == 1) {
                qid404.qualDataCds.push('G9642');
                qid404.qualDataCds.push('G9643');
                qid404.qualDataCds.push('G9497');

                if (this.arrayContainsAny(sourceQualityCodes, ['G9644'])) {
                    qid404.qualDataCds.push('G9644');
                    qid404.perfMet = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['G9645'])) {
                    qid404.qualDataCds.push('G9645');
                    qid404.perfNotMet = 1;
                }
            }
        }
        measures.push(qid404);
        //END QID404

        //QID424
        let qid424: QcdrMeasure2024 = new QcdrMeasure2024('QID424');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            qid424.eligible = 0;

            const cptList: string[] = [
                '00100',
                '00102',
                '00103',
                '00104',
                '00120',
                '00124',
                '00126',
                '00140',
                '00142',
                '00144',
                '00145',
                '00147',
                '00148',
                '00160',
                '00162',
                '00164',
                '00170',
                '00172',
                '00174',
                '00176',
                '00190',
                '00192',
                '00210',
                '00211',
                '00212',
                '00214',
                '00215',
                '00216',
                '00218',
                '00220',
                '00222',
                '00300',
                '00320',
                '00322',
                '00326',
                '00350',
                '00352',
                '00400',
                '00402',
                '00404',
                '00406',
                '00410',
                '00450',
                '00454',
                '00470',
                '00472',
                '00474',
                '00500',
                '00520',
                '00522',
                '00524',
                '00528',
                '00529',
                '00530',
                '00532',
                '00534',
                '00537',
                '00539',
                '00540',
                '00541',
                '00542',
                '00546',
                '00548',
                '00550',
                '00560',
                '00600',
                '00604',
                '00620',
                '00625',
                '00626',
                '00630',
                '00632',
                '00635',
                '00640',
                '00670',
                '00700',
                '00702',
                '00730',
                '00731',
                '00732',
                '00750',
                '00752',
                '00754',
                '00756',
                '00770',
                '00790',
                '00792',
                '00794',
                '00796',
                '00797',
                '00800',
                '00802',
                '00811',
                '00812',
                '00813',
                '00820',
                '00830',
                '00832',
                '00834',
                '00836',
                '00840',
                '00842',
                '00844',
                '00846',
                '00848',
                '00851',
                '00860',
                '00862',
                '00864',
                '00865',
                '00866',
                '00868',
                '00870',
                '00872',
                '00873',
                '00880',
                '00882',
                '00902',
                '00904',
                '00906',
                '00908',
                '00910',
                '00912',
                '00914',
                '00916',
                '00918',
                '00920',
                '00921',
                '00922',
                '00924',
                '00926',
                '00928',
                '00930',
                '00932',
                '00934',
                '00936',
                '00938',
                '00940',
                '00942',
                '00944',
                '00948',
                '00950',
                '00952',
                '01112',
                '01120',
                '01130',
                '01140',
                '01150',
                '01160',
                '01170',
                '01173',
                '01200',
                '01202',
                '01210',
                '01212',
                '01214',
                '01215',
                '01220',
                '01230',
                '01232',
                '01234',
                '01250',
                '01260',
                '01270',
                '01272',
                '01274',
                '01320',
                '01340',
                '01360',
                '01380',
                '01382',
                '01390',
                '01392',
                '01400',
                '01402',
                '01404',
                '01420',
                '01430',
                '01432',
                '01440',
                '01442',
                '01444',
                '01462',
                '01464',
                '01470',
                '01472',
                '01474',
                '01480',
                '01482',
                '01484',
                '01486',
                '01490',
                '01500',
                '01502',
                '01520',
                '01522',
                '01610',
                '01620',
                '01622',
                '01630',
                '01634',
                '01636',
                '01638',
                '01650',
                '01652',
                '01654',
                '01656',
                '01670',
                '01680',
                '01710',
                '01712',
                '01714',
                '01716',
                '01730',
                '01732',
                '01740',
                '01742',
                '01744',
                '01756',
                '01758',
                '01760',
                '01770',
                '01772',
                '01780',
                '01782',
                '01810',
                '01820',
                '01829',
                '01830',
                '01832',
                '01840',
                '01842',
                '01844',
                '01850',
                '01852',
                '01860',
                '01924',
                '01925',
                '01926',
                '01930',
                '01931',
                '01932',
                '01933',
                '01935',
                '01936',
                '01951',
                '01952',
                '01961',
                '01962',
                '01963',
                '01965',
                '01966',
            ];

            if (
                !this.isFieldMissing(facts.allCptCodes) &&
                this.arrayContainsAny(facts.allCptCodes, cptList) &&
                this.arrayContainsAny(sourceQualityCodes, ['4255F'])
            ) {
                qid424.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (qid424.eligible == 1) {
                qid424.qualDataCds.push('4255F');

                if (this.arrayContainsAny(sourceQualityCodes, ['G9654', 'G9770'])) {
                    qid424.eligible = 0;
                    if (this.arrayContainsAny(sourceQualityCodes, ['G9654'])) qid424.qualDataCds.push('G9654');
                    if (this.arrayContainsAny(sourceQualityCodes, ['G9770'])) qid424.qualDataCds.push('G9770');
                } else if (this.arrayContainsAny(sourceQualityCodes, ['G9771'])) {
                    qid424.qualDataCds.push('G9771');
                    qid424.perfMet = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['G9772'])) {
                    qid424.qualDataCds.push('G9772');
                    qid424.exception = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['G9773'])) {
                    qid424.qualDataCds.push('G9773');
                    qid424.perfNotMet = 1;
                }
            }
        }
        measures.push(qid424);
        //END QID424

        //QID430
        let qid430: QcdrMeasure2024 = new QcdrMeasure2024('QID430');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            qid430.eligible = 0;

            const cptList: string[] = [
                '00100',
                '00102',
                '00103',
                '00104',
                '00120',
                '00124',
                '00126',
                '00140',
                '00142',
                '00144',
                '00145',
                '00147',
                '00148',
                '00160',
                '00162',
                '00164',
                '00170',
                '00172',
                '00174',
                '00176',
                '00190',
                '00192',
                '00210',
                '00211',
                '00212',
                '00214',
                '00215',
                '00216',
                '00218',
                '00220',
                '00222',
                '00300',
                '00320',
                '00322',
                '00350',
                '00352',
                '00400',
                '00402',
                '00404',
                '00406',
                '00410',
                '00450',
                '00454',
                '00470',
                '00472',
                '00474',
                '00500',
                '00520',
                '00522',
                '00524',
                '00528',
                '00529',
                '00530',
                '00532',
                '00534',
                '00537',
                '00539',
                '00540',
                '00541',
                '00542',
                '00546',
                '00548',
                '00550',
                '00560',
                '00566',
                '00580',
                '00600',
                '00604',
                '00620',
                '00625',
                '00626',
                '00630',
                '00632',
                '00635',
                '00640',
                '00670',
                '00700',
                '00702',
                '00730',
                '00731',
                '00732',
                '00750',
                '00752',
                '00754',
                '00756',
                '00770',
                '00790',
                '00792',
                '00794',
                '00796',
                '00797',
                '00800',
                '00802',
                '00811',
                '00812',
                '00813',
                '00820',
                '00830',
                '00832',
                '00840',
                '00842',
                '00844',
                '00846',
                '00848',
                '00851',
                '00860',
                '00862',
                '00864',
                '00865',
                '00866',
                '00868',
                '00870',
                '00872',
                '00873',
                '00880',
                '00882',
                '00902',
                '00904',
                '00906',
                '00908',
                '00910',
                '00912',
                '00914',
                '00916',
                '00918',
                '00920',
                '00921',
                '00922',
                '00924',
                '00926',
                '00928',
                '00930',
                '00932',
                '00934',
                '00936',
                '00938',
                '00940',
                '00942',
                '00944',
                '00948',
                '00950',
                '00952',
                '01112',
                '01120',
                '01130',
                '01140',
                '01150',
                '01160',
                '01170',
                '01173',
                '01200',
                '01202',
                '01210',
                '01212',
                '01214',
                '01215',
                '01220',
                '01230',
                '01232',
                '01234',
                '01250',
                '01260',
                '01270',
                '01272',
                '01274',
                '01320',
                '01340',
                '01360',
                '01380',
                '01382',
                '01390',
                '01392',
                '01400',
                '01402',
                '01404',
                '01420',
                '01430',
                '01432',
                '01440',
                '01442',
                '01444',
                '01462',
                '01464',
                '01470',
                '01472',
                '01474',
                '01480',
                '01482',
                '01484',
                '01486',
                '01490',
                '01500',
                '01502',
                '01520',
                '01522',
                '01610',
                '01620',
                '01622',
                '01630',
                '01634',
                '01636',
                '01638',
                '01650',
                '01652',
                '01654',
                '01656',
                '01670',
                '01680',
                '01710',
                '01712',
                '01714',
                '01716',
                '01730',
                '01732',
                '01740',
                '01742',
                '01744',
                '01756',
                '01758',
                '01760',
                '01770',
                '01772',
                '01780',
                '01782',
                '01810',
                '01820',
                '01829',
                '01830',
                '01832',
                '01840',
                '01842',
                '01844',
                '01850',
                '01852',
                '01860',
                '01924',
                '01925',
                '01926',
                '01930',
                '01931',
                '01932',
                '01933',
                '01937',
                '01938',
                '01939',
                '01940',
                '01941',
                '01942',
                '01951',
                '01952',
                '01961',
                '01962',
                '01963',
                '01965',
                '01966',
            ];

            if (
                !this.isFieldMissing(facts.patAgeYears) &&
                !this.isFieldMissing(facts.allCptCodes) &&
                facts.patAgeYears >= 18 &&
                this.arrayContainsAny(facts.allCptCodes, cptList) &&
                this.arrayContainsAny(sourceQualityCodes, ['4554F']) &&
                this.arrayContainsAny(sourceQualityCodes, ['4556F'])
            ) {
                qid430.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (qid430.eligible == 1) {
                qid430.qualDataCds.push('4554F');
                qid430.qualDataCds.push('4556F');

                if (this.arrayContainsAny(sourceQualityCodes, ['G9775'])) {
                    qid430.qualDataCds.push('G9775');
                    qid430.perfMet = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['G9776'])) {
                    qid430.qualDataCds.push('G9776');
                    qid430.exception = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['G9777'])) {
                    qid430.qualDataCds.push('G9777');
                    qid430.perfNotMet = 1;
                }
            }
        }
        measures.push(qid430);
        //END QID430

        //QID463
        let qid463: QcdrMeasure2024 = new QcdrMeasure2024('QID463');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            qid463.eligible = 0;

            const cptList: string[] = [
                '00100',
                '00102',
                '00103',
                '00104',
                '00120',
                '00124',
                '00126',
                '00140',
                '00142',
                '00144',
                '00145',
                '00147',
                '00148',
                '00160',
                '00162',
                '00164',
                '00170',
                '00172',
                '00174',
                '00176',
                '00190',
                '00192',
                '00210',
                '00211',
                '00212',
                '00214',
                '00215',
                '00216',
                '00218',
                '00220',
                '00222',
                '00300',
                '00320',
                '00322',
                '00350',
                '00352',
                '00400',
                '00402',
                '00404',
                '00406',
                '00410',
                '00450',
                '00454',
                '00470',
                '00472',
                '00474',
                '00500',
                '00520',
                '00522',
                '00524',
                '00528',
                '00529',
                '00530',
                '00532',
                '00534',
                '00537',
                '00539',
                '00540',
                '00541',
                '00542',
                '00546',
                '00548',
                '00550',
                '00560',
                '00562',
                '00563',
                '00566',
                '00567',
                '00580',
                '00600',
                '00604',
                '00620',
                '00625',
                '00626',
                '00630',
                '00632',
                '00635',
                '00640',
                '00670',
                '00700',
                '00702',
                '00730',
                '00731',
                '00732',
                '00750',
                '00752',
                '00754',
                '00756',
                '00770',
                '00790',
                '00792',
                '00794',
                '00796',
                '00797',
                '00800',
                '00802',
                '00811',
                '00812',
                '00813',
                '00820',
                '00830',
                '00832',
                '00840',
                '00842',
                '00844',
                '00846',
                '00848',
                '00851',
                '00860',
                '00862',
                '00864',
                '00865',
                '00866',
                '00868',
                '00870',
                '00872',
                '00873',
                '00880',
                '00882',
                '00902',
                '00904',
                '00906',
                '00908',
                '00910',
                '00912',
                '00914',
                '00916',
                '00918',
                '00920',
                '00921',
                '00922',
                '00924',
                '00926',
                '00928',
                '00930',
                '00932',
                '00934',
                '00936',
                '00938',
                '00940',
                '00942',
                '00944',
                '00948',
                '00950',
                '00952',
                '01112',
                '01120',
                '01130',
                '01140',
                '01150',
                '01160',
                '01170',
                '01173',
                '01200',
                '01202',
                '01210',
                '01212',
                '01214',
                '01215',
                '01220',
                '01230',
                '01232',
                '01234',
                '01250',
                '01260',
                '01270',
                '01272',
                '01274',
                '01320',
                '01340',
                '01360',
                '01380',
                '01382',
                '01390',
                '01392',
                '01400',
                '01402',
                '01404',
                '01420',
                '01430',
                '01432',
                '01440',
                '01442',
                '01444',
                '01462',
                '01464',
                '01470',
                '01472',
                '01474',
                '01480',
                '01482',
                '01484',
                '01486',
                '01490',
                '01500',
                '01502',
                '01520',
                '01522',
                '01610',
                '01620',
                '01622',
                '01630',
                '01634',
                '01636',
                '01638',
                '01650',
                '01652',
                '01654',
                '01656',
                '01670',
                '01680',
                '01710',
                '01712',
                '01714',
                '01716',
                '01730',
                '01732',
                '01740',
                '01742',
                '01744',
                '01756',
                '01758',
                '01760',
                '01770',
                '01772',
                '01780',
                '01782',
                '01810',
                '01820',
                '01829',
                '01830',
                '01832',
                '01840',
                '01842',
                '01844',
                '01850',
                '01852',
                '01860',
                '01916',
                '01920',
                '01922',
                '01924',
                '01925',
                '01926',
                '01930',
                '01931',
                '01932',
                '01933',
                '01937',
                '01938',
                '01939',
                '01940',
                '01941',
                '01942',
                '01951',
                '01952',
                '01958',
                '01960',
                '01961',
                '01962',
                '01963',
                '01965',
                '01966',
                '01991',
                '01992',
            ];

            if (
                !this.isFieldMissing(facts.patAgeYears) &&
                !this.isFieldMissing(facts.allCptCodes) &&
                facts.patAgeYears >= 3 &&
                facts.patAgeYears < 18 &&
                this.arrayContainsAny(facts.allCptCodes, cptList) &&
                this.arrayContainsAny(sourceQualityCodes, ['4554F']) &&
                this.arrayContainsAny(sourceQualityCodes, ['G9954'])
            ) {
                qid463.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (qid463.eligible == 1) {
                qid463.qualDataCds.push('4554F');
                qid463.qualDataCds.push('G9954');

                if (this.arrayContainsAny(sourceQualityCodes, ['G9955'])) {
                    //exclusion
                    qid463.qualDataCds.push('G9955');
                    qid463.eligible = 0;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['G9956'])) {
                    qid463.qualDataCds.push('G9956');
                    qid463.perfMet = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['G9957'])) {
                    qid463.qualDataCds.push('G9957');
                    qid463.exception = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['G9958'])) {
                    qid463.qualDataCds.push('G9958');
                    qid463.perfNotMet = 1;
                }
            }
        }
        measures.push(qid463);
        //END QID463

        //QID477
        let qid477: QcdrMeasure2024 = new QcdrMeasure2024('QID477');
        if (!isInadmissible) {
            //only evaluate if admissible
            //Process eligibility criteria and missing fields
            qid477.eligible = 0;

            const cptList: string[] = [
                '00102',
                '00120',
                '00160',
                '00162',
                '00172',
                '00174',
                '00190',
                '00222',
                '00300',
                '00320',
                '00402',
                '00404',
                '00406',
                '00450',
                '00470',
                '00472',
                '00500',
                '00528',
                '00529',
                '00539',
                '00540',
                '00541',
                '00542',
                '00546',
                '00548',
                '00600',
                '00620',
                '00625',
                '00626',
                '00630',
                '00670',
                '00700',
                '00730',
                '00750',
                '00752',
                '00754',
                '00756',
                '00770',
                '00790',
                '00792',
                '00794',
                '00797',
                '00800',
                '00820',
                '00830',
                '00832',
                '00840',
                '00844',
                '00846',
                '00848',
                '00860',
                '00862',
                '00864',
                '00865',
                '00866',
                '00870',
                '00872',
                '00873',
                '00880',
                '00902',
                '00906',
                '00910',
                '00912',
                '00914',
                '00916',
                '00918',
                '00920',
                '00940',
                '00942',
                '00948',
                '01120',
                '01160',
                '01170',
                '01173',
                '01210',
                '01214',
                '01215',
                '01220',
                '01230',
                '01360',
                '01392',
                '01400',
                '01402',
                '01480',
                '01482',
                '01484',
                '01486',
                '01630',
                '01634',
                '01636',
                '01638',
                '01740',
                '01742',
                '01744',
                '01760',
                '01830',
                '01832',
                '01961',
            ];

            if (
                !this.isFieldMissing(facts.patAgeYears) &&
                !this.isFieldMissing(facts.allCptCodes) &&
                facts.patAgeYears >= 18 &&
                this.arrayContainsAny(facts.allCptCodes, cptList)
            ) {
                qid477.eligible = 1;
            }

            //Process performance criteria and missing fields
            if (qid477.eligible == 1) {
                if (this.arrayContainsAny(sourceQualityCodes, ['M1142'])) {
                    //exclusion
                    qid477.qualDataCds.push('M1142');
                    qid477.eligible = 0;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['G2148'])) {
                    qid477.qualDataCds.push('G2148');
                    qid477.perfMet = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['G2148'])) {
                    qid477.qualDataCds.push('G2149');
                    qid477.exception = 1;
                } else if (this.arrayContainsAny(sourceQualityCodes, ['G2150'])) {
                    qid477.qualDataCds.push('G2150');
                    qid477.perfNotMet = 1;
                }
            }
        }
        measures.push(qid477);
        //END QID477

        return measures;
    }

    public evalFacts(facts: EncounterFormFacts2024): QcdrFormEvalResult2024 {
        const qcdrRulesEngineEvalTimestamp: string = moment().toISOString();
        const actualResult: QcdrResult2024 = new QcdrResult2024(
            EncounterFormFactsEval2024.qcdrRulesEngineVersion,
            qcdrRulesEngineEvalTimestamp,
            facts.enctrFormAudVer,
        );
        const projectedResult: QcdrResult2024 = new QcdrResult2024(
            EncounterFormFactsEval2024.qcdrRulesEngineVersion,
            qcdrRulesEngineEvalTimestamp,
            facts.enctrFormAudVer,
        );

        //=====================================================
        // Step 1: Check for missing data elements required for ABG submission (a.k.a. "Admissibility")
        //=====================================================
        if (!(facts.hasDateOfService !== null && facts.hasDateOfService === true)) {
            actualResult.admissible = false;
            actualResult.errors.push('Date of Service not entered');
            projectedResult.admissible = false;
            projectedResult.errors.push('Date of Service not entered');
        }
        if (!(facts.hasAnesthesiaProvider !== null && facts.hasAnesthesiaProvider === true)) {
            actualResult.admissible = false;
            projectedResult.admissible = false;
            actualResult.errors.push('Anesthesia Provider not entered');
            projectedResult.errors.push('Anesthesia Provider not entered');
        }
        if (facts.surgeonNpi && facts.surgeonNpi !== 'UNKNOWN' && !this.isValidNpi(facts.surgeonNpi)) {
            actualResult.admissible = false;
            projectedResult.admissible = false;
            actualResult.errors.push('Invalid Surgeon NPI');
            projectedResult.errors.push('Invalid Surgeon NPI');
        }

        //console.log(facts.anesProvidersList);
        if (facts.anesProvidersList && facts.anesProvidersList !== null && facts.hasAnesthesiaProvider === true) {
            //validate all Anesthesia Provider NPIs, break on first invalid NPI
            let anesProviders = facts.anesProvidersList.split('|');
            anesProviders.some((npi) => {
                if (!this.isValidNpi(npi)) {
                    actualResult.admissible = false;
                    projectedResult.admissible = false;
                    actualResult.errors.push('Invalid Anesthesia NPI(s)');
                    projectedResult.errors.push('Invalid Anesthesia NPI(s)');
                    return true;
                }
            });
        }

        if (
            !this.isFieldMissing(facts.caseCancelledInd) &&
            facts.caseCancelledInd === true &&
            (this.isFieldMissing(facts.anesStartTime) ||
                !this.isFieldMissing(facts.caseCancelledStgCd && facts.caseCancelledStgCd !== 'AI'))
        ) {
            actualResult.admissible = false;
            projectedResult.admissible = false;
            actualResult.errors.push('Case Cancelled Before Induction');
            projectedResult.errors.push('Case Cancelled Before Induction');
        }

        //invert admissible flag for rule evaulation
        const isInadmissible: boolean = !actualResult.admissible;

        //=====================================================
        // Step 2: Evaluate QCDR measures
        //=====================================================
        const qcdrPassthroughCaseInd: boolean = this.isFieldMissing(facts.qcdrPassthroughCaseInd)
            ? false
            : facts.qcdrPassthroughCaseInd;
        if (!qcdrPassthroughCaseInd) {
            //process case using normal QCDR rules
            actualResult.measures = this.evalMeasures(facts, isInadmissible, false);
            projectedResult.measures = this.evalMeasures(facts, isInadmissible, true);
        } else {
            //process case using QCDR passthrough rules
            actualResult.measures = this.evalMeasuresPassthrough(facts, isInadmissible, false);
            //note that the projected result is the same as the actual result for passthrough cases
            projectedResult.measures = actualResult.measures;
        }

        //=====================================================
        // Step 3: Populate and return final QCDR evaluation results
        //=====================================================
        //populate remaining result properties
        actualResult.qcdrVersion = EncounterFormFactsEval2024.qcdrRulesEngineVersion;
        actualResult.cptCodes = facts.allCptCodes;

        //Generate unique arrays of actualResult eval codes (across all meaasures)
        let missingFieldList: string[] = [];
        for (let measure of actualResult.measures) {
            missingFieldList = _.union(missingFieldList, measure.missingFields);
            actualResult.qualDataCds = _.union(actualResult.qualDataCds, measure.qualDataCds);
            actualResult.measRespCds = _.union(actualResult.measRespCds, measure.measRespCds);
            actualResult.orObsCodes = _.union(actualResult.orObsCodes, measure.orObsCodes);
            actualResult.unspObsCodes = _.union(actualResult.unspObsCodes, measure.unspObsCodes);
        }

        projectedResult.qcdrVersion = EncounterFormFactsEval2024.qcdrRulesEngineVersion;
        projectedResult.cptCodes = facts.allCptCodes;
        //Generate unique arrays of projectedResult eval codes (across all meaasures)
        for (let measure of projectedResult.measures) {
            projectedResult.qualDataCds = _.union(projectedResult.qualDataCds, measure.qualDataCds);
            projectedResult.measRespCds = _.union(projectedResult.measRespCds, measure.measRespCds);
            projectedResult.orObsCodes = _.union(projectedResult.orObsCodes, measure.orObsCodes);
            projectedResult.unspObsCodes = _.union(projectedResult.unspObsCodes, measure.unspObsCodes);
        }

        let evalResult: QcdrFormEvalResult2024 = {
            facts: facts,
            actualResult: actualResult,
            projectedResult: projectedResult,
            missingFieldList: missingFieldList,
            missingFieldCount: missingFieldList.length,
            modelUpdates: [],
        };

        evalResult.modelUpdates = this.generateModelPropertyUpdatesFromResults(evalResult);
        return evalResult;

        /*
            //testing
            console.log('Actual:\n-----------------\n'+JSON.stringify(actualResult,null,4));
            console.log('\nProjected:\n-----------------\n'+JSON.stringify(projectedResult,null,4));
        */
    }

    private generateModelPropertyUpdatesFromResults(evalResult: QcdrFormEvalResult2024): any[] {
        var modelPropertyUpdates = [];
        var formValid = evalResult.facts.formValidInd;
        var percentComplete = evalResult.facts.formCmpltPct;

        modelPropertyUpdates.push({
            propertyName: 'qcdr_eval_result',
            fieldValue: JSON.stringify(evalResult.actualResult),
            formValid: formValid,
            percentComplete: percentComplete,
        });

        modelPropertyUpdates.push({
            propertyName: 'qcdr_eval_result_projected',
            fieldValue: JSON.stringify(evalResult.projectedResult),
            formValid: formValid,
            percentComplete: percentComplete,
        });

        modelPropertyUpdates.push({
            propertyName: 'qcdr_missing_data_count',
            fieldValue: evalResult.missingFieldCount,
            formValid: formValid,
            percentComplete: percentComplete,
        });
        modelPropertyUpdates.push({
            propertyName: 'qcdr_eval_dttm',
            fieldValue: evalResult.actualResult.evalTimestamp,
            formValid: formValid,
            percentComplete: percentComplete,
        });
        modelPropertyUpdates.push({
            propertyName: 'qcdr_eval_enctr_form_ver',
            fieldValue: evalResult.facts.enctrFormAudVer,
            formValid: formValid,
            percentComplete: percentComplete,
        });

        return modelPropertyUpdates;
    }
}
