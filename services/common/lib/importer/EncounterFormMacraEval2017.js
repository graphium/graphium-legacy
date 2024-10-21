var GraphiumServiceUtils = require('./GraphiumServiceUtils').default;
var PqrsAnalyticsDAO = require('../dao/PQRSAnalyticsDAO');  // may need to comment out this line for local utility script execution
var moment = require('moment');
var _ = require('lodash');
var Promise = require('bluebird');

module.exports = (function () {

    function EncounterFormMacraEval2017(serviceConfig, facilityId, encounterFormId) {
        this.serviceConfig = serviceConfig;
        this.facilityId = facilityId;
        this.encounterFormId = encounterFormId;
        this.serviceUtils = new GraphiumServiceUtils(this.serviceConfig);
    };

    EncounterFormMacraEval2017.prototype.getFormFacts = function () {
        var searchParameters = [];
        searchParameters.push({
            parameterName: 'fac_id',
            parameterValue: parseInt(this.facilityId)
        });
        searchParameters.push({
            parameterName: 'enctr_form_id',
            parameterValue: this.encounterFormId
        });

        return this.serviceUtils.getSearchResultsBySearchName('system.abgEncounterFormList2017', searchParameters);
    }

    EncounterFormMacraEval2017.prototype.getFormFactsForPendingFormsFromDb = function(onlyPendingForms) {
        return PqrsAnalyticsDAO.get2017QcdrFormFacts(this.serviceConfig.orgInternalName, this.facilityId, onlyPendingForms);
    }

    EncounterFormMacraEval2017.prototype.evaluateAllPendingForms = function(includeFactsInResults) {
        var _this = this;
        return this.getFormFactsForPendingFormsFromDb(true)
        .then(function (formFactsResults) {
            return Promise.mapSeries(formFactsResults, function(formFacts) {
                var ruleResults = executeRules(formFacts);
                var modelPropertyUpdates = generateModelPropertyUpdatesFromResults(formFacts, ruleResults);

                var results = {
                    hasError: false,
                    qcdrResults: ruleResults,
                    modelUpdates: modelPropertyUpdates
                };

                if(includeFactsInResults)
                    results.facts = formFacts;

                return Promise.resolve(results);
            });
        })
        .then(function (qcdrResults) {
            return Promise.resolve(qcdrResults);
        })
    }

    EncounterFormMacraEval2017.prototype.evaluateAllFormsForDateRange = function(includeFactsInResults) {
        var _this = this;
        return this.getFormFactsForPendingFormsFromDb(false)
        .then(function (formFactsResults) {
            return Promise.mapSeries(formFactsResults, function(formFacts) {
                var ruleResults = executeRules(formFacts);
                var modelPropertyUpdates = generateModelPropertyUpdatesFromResults(formFacts, ruleResults);

                var results = {
                    hasError: false,
                    qcdrResults: ruleResults,
                    modelUpdates: modelPropertyUpdates
                };

                if(includeFactsInResults)
                    results.facts = formFacts;

                return Promise.resolve(results);
            });
        })
        .then(function (qcdrResults) {
            return Promise.resolve(qcdrResults);
        })
    }

    EncounterFormMacraEval2017.prototype.evaluateAllOrgFormsForYear = function(includeFactsInResults, onlyPreviouslyCalculated) {
        var _this = this;
        var skippedFormsCount = 0;
        return this.getOrgFormFactsForDateRange("2017-01-01","2017-12-31")
        .then(function (formFactsResults) {
            //console.log(JSON.stringify(formFactsResults,null,4));
            return Promise.mapSeries(formFactsResults, function(formFacts) {

                if(onlyPreviouslyCalculated && formFacts.qcdr_eval_enctr_form_ver == null) {
                    skippedFormsCount++;
                    return Promise.resolve(null);
                }

                var ruleResults = executeRules(formFacts);
                var modelPropertyUpdates = generateModelPropertyUpdatesFromResults(formFacts, ruleResults);

                var results = {
                    hasError: false,
                    qcdrResults: ruleResults,
                    modelUpdates: modelPropertyUpdates
                };

                if(includeFactsInResults)
                    results.facts = formFacts;

                return Promise.resolve(results);
            });
        })
        .then(function (qcdrResults) {
            console.log(' - Skipping ' + skippedFormsCount + ' forms that have not previously been evaluated.');
            return Promise.resolve(_.compact(qcdrResults));
        })
    }

    EncounterFormMacraEval2017.prototype.getOrgFormFactsForDateRange = function(startDate, endDate) {
        var searchParameters = [];
        searchParameters.push({
            parameterName: 'proc_dt',
            parameterValue: {
                lowerBounds: startDate,
                upperBounds: endDate
            }
        });

        return this.serviceUtils.getSearchResultsBySearchName('system.abgEncounterFormList2017', searchParameters);
    }

    EncounterFormMacraEval2017.prototype.getFormFactsForDateRange = function(startDate, endDate) {
        var searchParameters = [];
        searchParameters.push({
            parameterName: 'fac_id',
            parameterValue: parseInt(this.facilityId)
        });
        searchParameters.push({
            parameterName: 'proc_dt',
            parameterValue: {
                lowerBounds: startDate,
                upperBounds: endDate
            }
        });

        return this.serviceUtils.getSearchResultsBySearchName('system.abgEncounterFormList2017', searchParameters);
    }

    EncounterFormMacraEval2017.prototype.evaluateDateRange = function(startDate, endDate, includeFactsInResults) {
        var _this = this;
        return this.getFormFactsForDateRange(startDate, endDate)
        .then(function (formFactsResults) {
            return Promise.mapSeries(formFactsResults, function(formFacts) {
                var ruleResults = executeRules(formFacts);
                var modelPropertyUpdates = generateModelPropertyUpdatesFromResults(formFacts, ruleResults);

                var results = {
                    hasError: false,
                    qcdrResults: ruleResults,
                    modelUpdates: modelPropertyUpdates
                };

                if(includeFactsInResults)
                    results.facts = formFacts;

                return Promise.resolve(results);
            });
        })
        .then(function (qcdrResults) {
            return Promise.resolve(qcdrResults);
        })
    }

    EncounterFormMacraEval2017.prototype.evaluateForm = function (includeFactsInResults) {
        var _this = this;
        return this.getFormFacts()
            .then(function (formFactsResults) {
                var formFacts = _.find(formFactsResults, { enctr_form_id: _this.encounterFormId });

                if (!formFacts) {
                    return Promise.resolve({
                        hasError: true,
                        errorText: 'Unable to find form facts for form, unable to evaluate PQRS rules.'
                    })
                }
                else {
                    var ruleResults = executeRules(formFacts);
                    var modelPropertyUpdates = generateModelPropertyUpdatesFromResults(formFacts, ruleResults);

                    var results = {
                        hasError: false,
                        qcdrResults: ruleResults,
                        modelUpdates: modelPropertyUpdates
                    };
                    
                    if(includeFactsInResults)
                        results.facts = formFacts;

                    return Promise.resolve(results);
                }
            })
    };

    function generateModelPropertyUpdatesFromResults(formData, ruleResults) {
        var modelPropertyUpdates = [];
        var formValid = formData.form_valid_ind;
        var percentComplete = formData.form_cmplt_pct;

        //console.log('--- FORM DATA');
        //console.log(JSON.stringify(formData,null,4));
        //console.log('--- RULE RESULTS');
        //console.log(JSON.stringify(ruleResults,null,4));
        //console.log('---');

        modelPropertyUpdates.push({
            propertyName: "qcdr_eval_result",
            fieldValue: JSON.stringify(ruleResults),
            formValid: formValid,
            percentComplete: percentComplete
        });
/*
        modelPropertyUpdates.push({
            propertyName: "qcdr_measure_count",
            fieldValue: ruleResults.measureCount,
            formValid: formValid,
            percentComplete: percentComplete
        });
        modelPropertyUpdates.push({
            propertyName: "qcdr_domain_count",
            fieldValue: ruleResults.domainCount,
            formValid: formValid,
            percentComplete: percentComplete
        });
*/

        //Generate unique list of missing data fields (across all API-required and measure-required fields)
        var missingFieldList = ruleResults.missing || [];
        for (var measure in ruleResults.measures) {
            if(ruleResults.measures[measure].missing)
                missingFieldList.push.apply(missingFieldList, ruleResults.measures[measure].missing);
        }
        missingFieldList = dedupArray(missingFieldList);

        modelPropertyUpdates.push({
            propertyName: "qcdr_missing_data_count",
            fieldValue: missingFieldList.length,
            formValid: formValid,
            percentComplete: percentComplete
        });
        modelPropertyUpdates.push({
            propertyName: "qcdr_eval_dttm",
            fieldValue: ruleResults.evalTimestamp,
            formValid: formValid,
            percentComplete: percentComplete
        });
        modelPropertyUpdates.push({
            propertyName: "qcdr_eval_enctr_form_ver",
            fieldValue: formData.enctr_form_aud_ver,
            formValid: formValid,
            percentComplete: percentComplete
        });

        return modelPropertyUpdates;
    }

    function arraysOverlap(array1, array2) {
        // determine if arrays have any elements in common
        var arrays = [array1, array2];
        var result = arrays.shift().reduce(function (res, v) {
            if (res.indexOf(v) === -1 && arrays.every(function (a) {
                return a.indexOf(v) !== -1;
            })) res.push(v)
            return res;
        }, []);
        return (result.length > 0);
    }

    function dedupArray(array) {
        return array.filter(function (elem, pos) {
            return array.indexOf(elem) == pos;
        });
    }

    function validateNpi(number) {
        'use strict';
        if(!number) {
            //console.log('ERROR: no NPI specified');
            return false;
        }
    
        var npi = number.toString()
        , npiLength = npi.length
        , isNan = !/^\d+$/.test(npi)
        , isZeroes = ('0000000000'+npi).slice(-10) === '0000000000'
        , npiDigits = npi.split('')
        , lastDigit = npi.slice(-1)
        , digit
        , oddTotal = 0
        , evenTotal = 0
        , checkTotal = 0;
  
        if(npiLength !== 10) {
            //console.log('ERROR: invalid length');
            return false;
        }
  
        if(isNan) {
            //console.log('ERROR: NaN');
            return false;
        }
  
        if(isZeroes) {
            //console.log('ERROR: all zeroes');
            return false;
        }
        for(var i = npiLength-1; i > 0; i--) {
            digit = parseInt(npi.charAt(i-1));
            if((i % 2) !== 0) {
                oddTotal += ((digit<5) ? digit*2 : (digit*2)-9);
            } else {
                evenTotal += digit;
            }
        }
        checkTotal = (24 + evenTotal + oddTotal);
        var ceiling = checkTotal % 10 === 0 ? checkTotal : (Math.ceil((checkTotal+1) / 10) * 10);
        return ((ceiling-checkTotal) === parseInt(lastDigit));
    }

    function evalOrPhaseMeasures(facts, isInadmissible) {
        var result = {
            "eventCodes": [],
            "measures": []
        };

        //ABG5
        var abg5 = {};
        abg5.name = 'ABG5';
        //check for required fields for this measure
        [{ name:'Complications Observed', value:facts.comp_or_ind },
         { name:'Primary Anesthetic', value:facts.prim_anes_typ_cd }].
         forEach(function(field) {
             if(field.value === null || field.value === '') {
                if(!_.isArray(abg5.missing)) abg5.missing = [];
                abg5.missing.push(field.name);
             }
        });

        if(isInadmissible) {
            //Case is inadmissible
            abg5.n = 0;
            abg5.d = 0;
        } else if(abg5.missing && abg5.missing.length > 0) {
            //Case is admissible, but required fields for measure are missing
            abg5.n = 0;
            abg5.d = 0;
        } else if(facts.prim_anes_typ_cd == 'LABOR_EPIDURAL') {
            //Per ABG: "Labor Epidurals are excluded from the definition of cases in operating rooms/procedure rooms"
            abg5.n = 0;
            abg5.d = 0;
        } else {
            if((facts.comp_or_ind === true) &&
               (facts.all_comp_cnt > 0) &&
               (facts.all_comp_list.indexOf('cv_vasc_access_comp') > -1) &&
               (facts.all_comp_list.indexOf('resp_pneumothorax') > -1)) {
                // A new onset of a pneumothorax in the periopertive period following anesthetically performed perithoracic vascular procedures.
                result.eventCodes.push('73');
                abg5.n = 1;
                abg5.d = 1;
            } else if((facts.comp_or_ind === true) &&
                      (facts.all_comp_cnt > 0) &&
                      (facts.all_comp_list.indexOf('cv_vasc_access_comp') > -1) &&
                      !(facts.all_comp_list.indexOf('resp_pneumothorax') > -1)) {
                // An event arising from an attempt at securing vascular access (arterial, central venous, or peripheral venous) requiring intervention (not including pneumothorax- For pneumothorax, please use "Pneumothorax after perithoracic vascular procedure").
                result.eventCodes.push('19');
                abg5.n = 1;
                abg5.d = 1;
            } else {
                //Either no complications occurred or some other complication occurred not relevant to this measure
                abg5.n = 0;
                abg5.d = 1;
            }
        }
        result.measures.push(abg5);
        //END ABG5

        //ABG14
        var abg14 = {};
        abg14.name = 'ABG14';
        //check for required fields for this measure
        [{ name:'Complications Observed', value:facts.comp_or_ind },
         { name:'Primary Anesthetic', value:facts.prim_anes_typ_cd }].
         forEach(function(field) {
             if(field.value === null || field.value === '') {
                if(!_.isArray(abg14.missing)) abg14.missing = [];
                abg14.missing.push(field.name);
             }
        });

        if(isInadmissible) {
            //Case is inadmissible
            abg14.n = 0;
            abg14.d = 0;
        } else if(abg14.missing && abg14.missing.length > 0) {
            //Case is admissible, but required fields for measure are missing
            abg14.n = 0;
            abg14.d = 0;
        } else if(facts.prim_anes_typ_cd == 'LABOR_EPIDURAL') {
            //Per ABG: "Labor Epidurals are excluded from the definition of cases in operating rooms/procedure rooms"
            abg14.n = 0;
            abg14.d = 0;
        } else {
            if((facts.comp_or_ind === true) &&
               (facts.all_comp_cnt > 0) &&
               (facts.all_comp_list.indexOf('misc_eye_inj') > -1)) {
                //Any ocular surface injury requiring evaluation, follow up, or treatment.
                result.eventCodes.push('80');
                abg14.n = 1;
                abg14.d = 1;
            } else {
                //Either no complications occurred or some other complication occurred not relevant to this measure
                abg14.n = 0;
                abg14.d = 1;
            }
        }
        result.measures.push(abg14);
        //END ABG14

        return result;
    }

    function evalQcdrMeasures(facts, isInadmissible) {
        var result = {
            "eventCodes": [],
            "measures": []
        };

        //ABG7
        var abg7 = {};
        abg7.name = 'ABG7';
        //check for required fields for this measure
        [{ name:'Pain Score', value:facts.painScoreCode },
         { name:'Patient Age', value:facts.pat_age_years },
         { name:'Transfer Location', value:facts.xfer_locn_cd }].
         forEach(function(field) {
             if(field.value === null || field.value === '') {
                if(!_.isArray(abg7.missing)) abg7.missing = [];
                abg7.missing.push(field.name);
             }
        });

        if(isInadmissible) {
            //Case is inadmissible
            abg7.n = 0;
            abg7.d = 0;
        } else if(abg7.missing && abg7.missing.length > 0) {
            //Case is admissible, but required fields for measure are missing
            abg7.n = 0;
            abg7.d = 1;
        } else {
            var painScoreCode = facts.pacu_pain_score_cd ? /(\S+)/.exec(facts.pacu_pain_score_cd)[1].toUpperCase() : null;
            if((facts.pat_age_years >= 18) &&
               (facts.xfer_locn_cd == 'PACU') &&
               (['0', '1', '2', '3', '4', '5', '6'].indexOf(painScoreCode) > -1 ||
                ['0 of 10', '1 of 10', '2 of 10', '3 of 10', '4 of 10', '5 of 10', '6 of 10'].indexOf(painScoreCode) > -1)) {
                //Pain score 0-6 on arrival to PACU
                result.eventCodes.push('1001');
                abg7.n = 1;
                abg7.d = 1;
            } else if((facts.pat_age_years >= 18) &&
                      (facts.xfer_locn_cd == 'PACU') &&
                      (['7', '8', '9', '10'].indexOf(painScoreCode) > -1 ||
                       ['7 of 10', '8 of 10', '9 of 10', '10 of 10'].indexOf(painScoreCode) > -1)) {
                //Pain score 7-10 on arrival to PACU
                result.eventCodes.push('1002');
                abg7.n = 0;
                abg7.d = 1;
            } else if((facts.pat_age_years >= 18) &&
                      (facts.xfer_locn_cd == 'PACU') &&
                      (painScoreCode == 'UNKNOWN' ||
                       painScoreCode == 'U')) {
                //Patient unable to report pain score on arrival to PACU
                result.eventCodes.push('1003');
                abg7.n = 1;
                abg7.d = 1;
            } else if((facts.pat_age_years >= 18) &&
                      (facts.xfer_locn_cd !== 'PACU')) {
                //Patient NOT transferred to PACU
                result.eventCodes.push('1017');
                abg7.n = 0;
                abg7.d = 0;
            } else {
                //Either patient age < 18 or something unexpected happened in the logic
                abg7.n = 0;
                abg7.d = 0;
            }
        }
        result.measures.push(abg7);
        //END ABG7

        //ABG21
        var abg21 = {};
        abg21.name = 'ABG21';
        //check for required fields for this measure
        [{ name:'Preop OSA Eval', value:facts.preop_eval_osa_cd }].
         forEach(function(field) {
             if(field.value === null || field.value === '') {
                if(!_.isArray(abg21.missing)) abg21.missing = [];
                abg21.missing.push(field.name);
             }
        });

        if(isInadmissible) {
            //Case is inadmissible
            abg21.n = 0;
            abg21.d = 0;
        } else if(abg21.missing && abg21.missing.length > 0) {
            //Case is admissible, but required fields for measure are missing
            abg21.n = 0;
            abg21.d = 1;
        } else {
            if (facts.preop_eval_osa_cd.toUpperCase() == 'Y') {
                //Preoperative OSA assesment done
                result.eventCodes.push('1014');
                abg21.n = 1;
                abg21.d = 1;
            } else if (facts.preop_eval_osa_cd.toUpperCase() == 'N-RU') {
                //Preoperative OSA assesment NOT done
                result.eventCodes.push('1015');
                abg21.n = 0;
                abg21.d = 1;
            } else if (facts.preop_eval_osa_cd.toUpperCase() == 'N-RS') {
                //Medical reason for no preoperative OSA assesment
                result.eventCodes.push('1016');
                abg21.n = 1;
                abg21.d = 1;
            } else {
                //Something unexpected happened in the logic
                abg21.n = 0;
                abg21.d = 0;
            }
        }
        result.measures.push(abg21);
        //END ABG21

        //ABG28
        var abg28 = {};
        abg28.name = 'ABG28';
        //check for required fields for this measure
        [{ name:'ASA Phys Status', value:facts.asa_clsfn_cd },
         //{ name:'ASA Emergency', value:facts.asa_emerg_ind },
         { name:'Preop GERD Eval', value:facts.preop_eval_gerd_cd }].
         forEach(function(field) {
             if(field.value === null || field.value === '') {
                if(!_.isArray(abg28.missing)) abg28.missing = [];
                abg28.missing.push(field.name);
             }
        });

        if(isInadmissible) {
            //Case is inadmissible
            abg28.n = 0;
            abg28.d = 0;
        } else if(abg28.missing && abg28.missing.length > 0) {
            //Case is admissible, but required fields for measure are missing
            abg28.n = 0;
            abg28.d = 1;
        } else {
            if (['5','6'].indexOf(facts.asa_clsfn_cd) > -1) {
                //ASA > 4, denominator exclusion
                abg28.n = 0;
                abg28.d = 0;
            } else if ((facts.asa_emerg_ind !== null) && 
                       (facts.asa_emerg_ind === true)) {
                //ASA Emergency, denominator exception
                abg28.n = 1;
                abg28.d = 1;
            } else if (facts.preop_eval_gerd_cd.toUpperCase() == 'Y') {
                //Screened for GERD
                result.eventCodes.push('1022');
                abg28.n = 1;
                abg28.d = 1;
            } else if (facts.preop_eval_gerd_cd.toUpperCase() == 'N-RU') {
                //Not Screened for GERD
                result.eventCodes.push('1023');
                abg28.n = 0;
                abg28.d = 1;
            } else if (facts.preop_eval_gerd_cd.toUpperCase() == 'N-RS') {
                //Patient, System or Medical Reason not screened
                result.eventCodes.push('1024');
                abg28.n = 1;
                abg28.d = 1;
            } else {
                //something unexpected happened in the logic
                abg28.n = 0;
                abg28.d = 0;
            }
        }
        result.measures.push(abg28);
        //END ABG28

        //ABG29
        var abg29 = {};
        abg29.name = 'ABG29';
        //check for required fields for this measure
        [{ name:'ASA Phys Status', value:facts.asa_clsfn_cd },
         //{ name:'ASA Emergency', value:facts.asa_emerg_ind },
         { name:'Preop Glaucoma Eval', value:facts.preop_eval_glauc_cd }].
         forEach(function(field) {
             if(field.value === null || field.value === '') {
                if(!_.isArray(abg29.missing)) abg29.missing = [];
                abg29.missing.push(field.name);
             }
        });

        if(isInadmissible) {
            //Case is inadmissible
            abg29.n = 0;
            abg29.d = 0;
        } else if(abg29.missing && abg29.missing.length > 0) {
            //Case is admissible, but required fields for measure are missing
            abg29.n = 0;
            abg29.d = 1;
        } else {
            if (['5','6'].indexOf(facts.asa_clsfn_cd) > -1) {
                //ASA > 4, denominator exclusion
                abg29.n = 0;
                abg29.d = 0;
            } else if ((facts.asa_emerg_ind !== null) && 
                       (facts.asa_emerg_ind === true)) {
                //ASA Emergency, denominator exception
                abg29.n = 1;
                abg29.d = 1;
            } else if (facts.preop_eval_glauc_cd.toUpperCase() == 'Y') {
                //Screened for Glaucoma
                result.eventCodes.push('1025');
                abg29.n = 1;
                abg29.d = 1;
            } else if (facts.preop_eval_glauc_cd.toUpperCase() == 'N-RU') {
                //Not Screened for Glaucoma
                result.eventCodes.push('1026');
                abg29.n = 0;
                abg29.d = 1;
            } else if (facts.preop_eval_glauc_cd.toUpperCase() == 'N-RS') {
                //Patient, System or Medical Reason not screened
                result.eventCodes.push('1027');
                abg29.n = 1;
                abg29.d = 1;
            } else {
                //Either ASA PS > 4, ASA Emerg = TRUE, or something unexpected happened in the logic
                abg29.n = 0;
                abg29.d = 0;
            }
        }
        result.measures.push(abg29);
        //END ABG29

        //ABG30
        var abg30 = {};
        abg30.name = 'ABG30';
        //check for required fields for this measure
        [{ name:'ASA Phys Status', value:facts.asa_clsfn_cd },
         //{ name:'ASA Emergency', value:facts.asa_emerg_ind },
         { name:'Preop PONV Eval', value:facts.preop_eval_ponv_cd }].
         forEach(function(field) {
             if(field.value === null || field.value === '') {
                if(!_.isArray(abg30.missing)) abg30.missing = [];
                abg30.missing.push(field.name);
             }
        });

        if(isInadmissible) {
            //Case is inadmissible
            abg30.n = 0;
            abg30.d = 0;
        } else if(abg30.missing && abg30.missing.length > 0) {
            //Case is admissible, but required fields for measure are missing
            abg30.n = 0;
            abg30.d = 1;
        } else {
            if (['5','6'].indexOf(facts.asa_clsfn_cd) > -1) {
                //ASA > 4, denominator exclusion
                abg30.n = 0;
                abg30.d = 0;
            } else if ((facts.asa_emerg_ind !== null) && 
                       (facts.asa_emerg_ind === true)) {
                //ASA Emergency, denominator exception
                abg30.n = 1;
                abg30.d = 1;
            } else if (facts.preop_eval_ponv_cd.toUpperCase() == 'Y') {
                //Screened for PONV Risk Factors
                result.eventCodes.push('1028');
                abg30.n = 1;
                abg30.d = 1;
            } else if (facts.preop_eval_ponv_cd.toUpperCase() == 'N-RU') {
                //Not Screened for PONV Risk Factors
                result.eventCodes.push('1029');
                abg30.n = 0;
                abg30.d = 1;
            } else if (facts.preop_eval_ponv_cd.toUpperCase() == 'N-RS') {
                //Patient, System or Medical Reason not screened
                result.eventCodes.push('1030');
                abg30.n = 1;
                abg30.d = 1;
            } else {
                //Either ASA PS > 4, ASA Emerg = TRUE, or something unexpected happened in the logic
                abg30.n = 0;
                abg30.d = 0;
            }
        }
        result.measures.push(abg30);
        //END ABG30

        //ABG31
        var abg31 = {};
        abg31.name = 'ABG31';
        //check for required fields for this measure
        [{ name:'ASA Phys Status', value:facts.asa_clsfn_cd },
         //{ name:'ASA Emergency', value:facts.asa_emerg_ind },
         { name:'Preop Alc/Drug Eval', value:facts.preop_eval_alctob_cd }].
         forEach(function(field) {
             if(field.value === null || field.value === '') {
                if(!_.isArray(abg31.missing)) abg31.missing = [];
                abg31.missing.push(field.name);
             }
        });

        if(isInadmissible) {
            //Case is inadmissible
            abg31.n = 0;
            abg31.d = 0;
        } else if(abg31.missing && abg31.missing.length > 0) {
            //Case is admissible, but required fields for measure are missing
            abg31.n = 0;
            abg31.d = 1;
        } else {
            if (['5','6'].indexOf(facts.asa_clsfn_cd) > -1) {
                //ASA > 4, denominator exclusion
                abg31.n = 0;
                abg31.d = 0;
            } else if ((facts.asa_emerg_ind !== null) && 
                       (facts.asa_emerg_ind === true)) {
                //ASA Emergency, denominator exception
                abg31.n = 1;
                abg31.d = 1;
            } else if (facts.preop_eval_alctob_cd.toUpperCase() == 'Y') {
                //Screened for Alcohol and Drug Use
                result.eventCodes.push('1031');
                abg31.n = 1;
                abg31.d = 1;
            } else if (facts.preop_eval_alctob_cd.toUpperCase() == 'N-RU') {
                //Not Screened for Alcohol and Drug Use
                result.eventCodes.push('1032');
                abg31.n = 0;
                abg31.d = 1;
            } else if (facts.preop_eval_alctob_cd.toUpperCase() == 'N-RS') {
                //Patient, System or Medical Reason not screened
                result.eventCodes.push('1033');
                abg31.n = 1;
                abg31.d = 1;
            } else {
                //Either ASA PS > 4, ASA Emerg = TRUE, or something unexpected happened in the logic
                abg31.n = 0;
                abg31.d = 0;
            }
        }
        result.measures.push(abg31);
        //END ABG31

        return result;
    }

    function executeRules(facts) {
        var qcdrVersion = 'ABG.2017.1.3';
        /**
         * Author: M.Oldham
         * Update History:
         *   Date       Name     Version      Changes
         *   ---------- -------- ------------ ---------------------------------------------------------------------
         *   06/01/2017 M.Oldham ABG.2017.1.0 Add initial logic for 2017 measures and a switch for which year's
         *                                    logic to use based on Date of Service.
         *   07/18/2017 M.Oldham ABG.2017.1.0 Final updates after unit test and prior to deployment.
         *   08/15/2017 M.Oldham ABG.2017.1.1 Update ABG28-31 to remove requirement for ASA Emerg Ind (i.e. interpret
         *                                    NULL as FALSE).
         *   10/11/2017 M.Oldham ABG.2017.1.2 Add NPI checksum logic to mark any case with invalid NPIs as inadmissible
         *   01/23/2018 M.Oldham ABG.2017.1.3 Expand pain score evaluation logic in ABG7 to handle alternate pain
         *                                    score formats (e.g. "1 of 10" versus "1")
         * 
         * Measures:
         *   Name   Type  Phase Model Properties Evaluated Complications Evaluated Domain
         *   ------ ----- ----- -------------------------- ----------------------- ------------------------
         *   ABG5   Phase OR    comp_or_ind                cv_vasc_access_comp     Patient Safety
         *                      prim_anes_typ_cd           resp_pneumothorax
         *
         *   ABG7   Unsp  QCDR  pacu_pain_score_cd                                 Person and Caregiver-Centered Experience and Outcomes
         *                      pat_dob
         *                      xfer_locn_cd
         *
         *   ABG14  Phase OR    comp_or_ind                misc_eye_inj            Patient Safety
         *                      prim_anes_typ_cd
         *
         *   ABG21  Unsp  QCDR  preop_eval_osa_cd                                  Effective Clinical Care
         *
         *   ABG28  Unsp  QCDR  preop_eval_gerd_cd                                 Effective Clinical Care
         *                      asa_clsfn_cd
         *                      asa_emerg_ind (not validated)
         *
         *   ABG29  Unsp  QCDR  preop_eval_glauc_cd                                Effective Clinical Care
         *                      asa_clsfn_cd
         *                      asa_emerg_ind (not validated)
         *
         *   ABG30  Unsp  QCDR  preop_eval_ponv_cd                                 Effective Clinical Care
         *                      asa_clsfn_cd
         *                      asa_emerg_ind (not validated)
         *
         *   ABG31  Unsp  QCDR  preop_eval_alctob_cd                               Effective Clinical Care
         *                      asa_clsfn_cd
         *                      asa_emerg_ind (not validated)
         *           
         * Logic scenarios for PSO Phase Measures:
         * ---------------------------------------
         * 1. If the complications gatekeeper property is null, leave OR phase empty (no measures reported for this phase)
         * 2. If the complications gatekeeper is true, but no complications are selected, then leave OR phase result empty (no measures reported for this phase)
         * 3. If the complications gatekeeper is false, report Database ID 1 for the OR phase
         * 4. If the complications gatekeeper is true, and one or more complications other than those used by our measures were selected, then report a Database ID 1 for the OR phase
         * 5. If the complications gatekeeper is true, and one or more complications are selected that are used by our measures, then one or more Database IDs should be reported (based on each measure's logic)
         *
         * Logic scenarios for QCDR Measures:
         * ----------------------------------
         * Evaluate each measure's logic individually, and report either a single event code for each one or nothing at all, depending on the measure logic
         *
         * Properties Referenced in Search Definition Result: 
         * --------------------------------------------------
         * - comp_or_ind (bool)
         * - all_comp_cnt (int)
         * - all_comp_list  (string array)
         * - xfer_locn_cd (string)
         * - pacu_pain_score_cd (string)
         * - pat_age_years (int)
         * - prim_anes_typ_cd
         * - asa_clsfn_cd
         * - asa_emerg_ind
         * - preop_eval_osa_cd
         * - preop_eval_gerd_cd
         * - preop_eval_glauc_cd
         * - preop_eval_ponv_cd
         * - preop_eval_alctob_cd
         * - enctr_form_aud_ver (int)
         * - req_data_proc_dt
         * - req_data_surgn_prvr
         * - req_data_anes_prvr
         *
         * Properties to ensure are populated for the purposes of ABG Submission:
         * ----------------------------------------------------------------
         * - Unique Case ID (implicitly set by our platform)
         * - Group/Org ID (implicitly set by our platform)
         * - Location/Facility ID (implicitly set by our platform)
         * - Date of Service
         * - Surgeon Provider
         * - Anesthesia provider (at least 1)
         * 
         * Surgery Model Properties to Set:
         * --------------------------------
         * - qcdr_eval_result: TEXT (JSON object)
         *    {
         *        "orEventCodes": ["string","string"],
         *        "measureEventCodes": ["string","string"],
         *        "measures": [{name, d, n, missing}],
         *        "admissible": false,
         *        "missing": ["string","string"],
         *        "qcdrVersion": "string",
         *    }
         * - qcdr_missing_data_count: INT
         * - qcdr_eval_dttm: TIMESTAMP WITH TIMEZONE 'UTC'
         * - qcdr_eval_enctr_form_ver: INT
         * 
         * qcdr_eval_result (sample):
         * {
         *     "orEventCodes": [1],
         *     "measureEventCodes": [2,3,4],
         *     "measures": [
         *         {
         *             "name": "ABG5",
         *             "d": 0,
         *             "n": 0,
         *             "missing": ["field3,field4"]
         *         },
         *         {
         *             "name": "ABG7",
         *             "d": 1,
         *             "n": 1
         *         },
         *         {
         *             "name": "ABG14",
         *             "d": 1,
         *             "n": 0
         *         },
         *         {
         *             "name": "ABG21",
         *             "d": 0,
         *             "n": 0,
         *             "missing": ["field1,field3"]
         *         },
         *         {
         *             "name": "ABG28",
         *             "d": 1,
         *             "n": 1
         *         },
         *         {
         *             "name": "ABG29",
         *             "d": 1,
         *             "n": 0
         *         },
         *         {
         *             "name": "ABG30",
         *             "d": 1,
         *             "n": 0
         *         },
         *         {
         *             "name": "ABG31",
         *             "d": 1,
         *             "n": 1
         *         }
         *     ],
         *     "admissible": false,
         *     "missing": ["field5,field7,field8"],
         *     "qcdrVersion": "ABG.2017.1.0"
         * }
         * 
         * qcdr_missing_data_count: 6
         * qcdr_eval_dttm: "2017-06-15T15:05:18.064Z"
         * qcdr_eval_enctr_form_ver: 28
         *}
         * 
         */

        var qcdrEvalResult = {
            "orEventCodes": [],
            "measureEventCodes": [],
            "measures": [],
            "admissible": true,
            "missing": [],
            "errors": [],
            "qcdrVersion": qcdrVersion
        };

        var abgPhaseMeasures = ['ABG5', 'ABG14'];
        var abgQcdrMeasures = ['ABG7', 'ABG21', 'ABG28', 'ABG29', 'ABG30', 'ABG31'];
        var complicationsList = ['cv_vasc_access_comp', 'resp_pneumothorax', 'misc_eye_inj'];

        //=====================================================
        // Step 1: Check for missing data elements required for ABG submission
        //=====================================================
        if (!(facts.req_data_proc_dt !== null && facts.req_data_proc_dt === true)) {
            qcdrEvalResult.admissible = false;
            qcdrEvalResult.missing.push("Date of Service");
            qcdrEvalResult.errors.push("Date of Service not entered");
        }
        if (!(facts.req_data_surgn_prvr !== null && facts.req_data_surgn_prvr === true)) {
            qcdrEvalResult.admissible = false;
            qcdrEvalResult.missing.push("Surgeon Provider");
            qcdrEvalResult.errors.push("Surgeon Provider not entered");
        }
        if (!(facts.req_data_anes_prvr !== null && facts.req_data_anes_prvr === true)) {
            qcdrEvalResult.admissible = false;
            qcdrEvalResult.missing.push("Anesthesia Provider");
            qcdrEvalResult.errors.push("Anesthesia Provider not entered");
        }
        if (!validateNpi(facts.surgn_prvr_npi)) {
             qcdrEvalResult.admissible = false;
             qcdrEvalResult.errors.push("Invalid Surgeon NPI");
        }
        if (facts.anes_prvrs_npi_list && facts.anes_prvrs_npi_list !== null && facts.req_data_anes_prvr === true) {
            //validate all Anesthesia Provider NPIs, break on first invalid NPI
            var anesProviders = facts.anes_prvrs_npi_list.split('|');
            anesProviders.some(function(npi) {
                if(!validateNpi(npi)) {
                    qcdrEvalResult.admissible = false;
                    qcdrEvalResult.errors.push("Invalid Anesthesia NPI(s)");
                    return true;
                }
           })
        }
    
        //invert admissible flag for rule evaulation
        var isInadmissible = !qcdrEvalResult.admissible;

        //=====================================================
        // Step 2: Process Phase measures and accumulate results
        //=====================================================
        if (facts.comp_or_ind == null) {
            //Scenario: 1. Provider did not indicate whether or not complications occurred (null)
            //Action: Leave OR event code empty (no measures)
            //console.log('DEBUG: Scenario: 1');
            qcdrEvalResult.orEventCodes = [];
        } else if ((facts.comp_or_ind !== null) &&
            (facts.comp_or_ind === true) &&
            (facts.all_comp_cnt == 0)) {
            //Scenario: 2. Provider did indicate that complications did occur (true), but failed to list any complications 
            //Action: Leave OR event codes empty (no measures)
            //console.log('DEBUG: Scenario: 2');
            qcdrEvalResult.orEventCodes = [];
        } else if ((facts.comp_or_ind !== null) &&
            (facts.comp_or_ind === false)) {
            //Scenario: 3. Provider indicated that no complications occurred (false)
            //Action: Report event code 1 for OR phase
            //console.log('DEBUG: Scenario: 3');
            qcdrEvalResult.orEventCodes = ['1'];
        } else if ((facts.comp_or_ind !== null) &&
            (facts.comp_or_ind === true) &&
            (facts.all_comp_cnt > 0) &&
            (!arraysOverlap(facts.all_comp_list, complicationsList))) {
            //Scenario: 4. Provider indicated that complications did occur (true), but only complications *not* evaluated by our measures were selected
            //Action: Report event code 1 for OR phase
            //console.log('DEBUG: Scenario: 4');
            qcdrEvalResult.orEventCodes = ['1'];
        } else if ((facts.comp_or_ind !== null) &&
            (facts.comp_or_ind === true) &&
            (facts.all_comp_cnt > 0) &&
            (arraysOverlap(facts.all_comp_list, complicationsList))) {
            //Scenario: 5. Provider indicated that complications did occur (true), and one or more complications evaluated by our measures was selected
            //Action: Evaluation each phase-specific measure and report appropriate event code(s) and domain(s)
            //console.log('DEBUG: Scenario: 5');
            //process OR measures and accumulate results
            qcdrEvalResult.orEventCodes = [];
        } else {
            //Scenario: 6. Something else went wrong
            //Action: Leave OR event codes empty (no measures)
            //console.log('DEBUG: Scenario: 6' + '\n' + JSON.stringify(facts,null,4));
            qcdrEvalResult.orEventCodes = [];
        }
        var orMeasureResult = evalOrPhaseMeasures(facts, isInadmissible);
        qcdrEvalResult.orEventCodes.push.apply(qcdrEvalResult.orEventCodes, orMeasureResult.eventCodes);
        qcdrEvalResult.measures.push.apply(qcdrEvalResult.measures, orMeasureResult.measures);

        //=====================================================
        // Step 3: Process QCDR measures
        //=====================================================
        var qcdrMeasureResult = evalQcdrMeasures(facts, isInadmissible);
        qcdrEvalResult.measureEventCodes = qcdrMeasureResult.eventCodes;
        qcdrEvalResult.measures.push.apply(qcdrEvalResult.measures, qcdrMeasureResult.measures);

        //=====================================================
        // Step 4: Return final QCDR evaluation result
        //=====================================================
        qcdrEvalResult.evalTimestamp = moment().toISOString();
        return qcdrEvalResult;
    }

    return EncounterFormMacraEval2017;
})();
