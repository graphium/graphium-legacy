var GraphiumServiceUtils = require('./GraphiumServiceUtils').default;
var moment = require('moment');
var _ = require('lodash');
var Promise = require('bluebird');

module.exports = (function () {

    function EncounterFormPqrsEval(serviceConfig, facilityId, encounterFormId) {
        this.serviceConfig = serviceConfig;
        this.facilityId = facilityId;
        this.encounterFormId = encounterFormId;
        this.serviceUtils = new GraphiumServiceUtils(this.serviceConfig);
    };

    EncounterFormPqrsEval.prototype.getFormFacts = function () {
        var searchParameters = [];
        searchParameters.push({
            parameterName: 'fac_id',
            parameterValue: parseInt(this.facilityId)
        });
        searchParameters.push({
            parameterName: 'enctr_form_id',
            parameterValue: this.encounterFormId
        });

        return this.serviceUtils.getSearchResultsBySearchName('system.abgEncounterFormList', searchParameters);
    }

    EncounterFormPqrsEval.prototype.getFormFactsForDateRange = function(startDate, endDate) {
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

        return this.serviceUtils.getSearchResultsBySearchName('system.abgEncounterFormList', searchParameters);
    }

    EncounterFormPqrsEval.prototype.evaluateDateRange = function(startDate, endDate, includeFactsInResults) {
        var _this = this;
        return this.getFormFactsForDateRange(startDate, endDate)
        .then(function (formFactsResults) {
            return Promise.mapSeries(formFactsResults, function(formFacts) {
                var ruleResults = executeRules(formFacts);
                var modelPropertyUpdates = generateModelPropertyUpdatesFromResults(formFacts, ruleResults);

                var results = {
                    hasError: false,
                    pqrsResults: ruleResults,
                    modelUpdates: modelPropertyUpdates
                };

                if(includeFactsInResults)
                    results.facts = formFacts;

                return Promise.resolve(results);
            });
        })
        .then(function (pqrsResults) {
            return Promise.resolve(pqrsResults);
        })
    }

    EncounterFormPqrsEval.prototype.evaluateForm = function (includeFactsInResults) {
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
                        pqrsResults: ruleResults,
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

        modelPropertyUpdates.push({
            propertyName: "qcdr_eval_result",
            fieldValue: JSON.stringify(ruleResults.qcdrEvalResult),
            formValid: formValid,
            percentComplete: percentComplete
        });
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
        modelPropertyUpdates.push({
            propertyName: "qcdr_missing_data_count",
            fieldValue: ruleResults.missingDataCount,
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
            fieldValue: ruleResults.evalEnctrFormVer,
            formValid: formValid,
            percentComplete: percentComplete
        });

        return modelPropertyUpdates;
    }
    /*  ABG Processing (vABG.2016.1.0)
    
    Logic scenarios for PSO Phase Measures:
    ---------------------------------------
    1. If the complications gatekeeper property is null, leave OR and PACU phases empty (no measures reported for those phases)
    2. If the complications gatekeeper is true, but no complications are selected, then leave OR and PACU phases empty (no measures reported for those phases)
    3. If the complications gatekeeper is false, report event code 1 for both the OR and PACU phases (13 measures, 1 domain)
    4. If the complications gatekeeper is true, and one or more complications other than those used by our measures were selected, then report a 1 for both the OR and PACU phases (13 measures, 1 domain)
    5. If the complications gatekeeper is true, and one or more complications are selected that are used by our measures, then one or more event codes should be reported (based on each measure's logic), but ultimately all 14 measures qualify
    
    Logic scenarios for QCDR Measures:
    ----------------------------------
    Evaluate each measure's logic individually, and report either a single event code for each one or nothing at all, depending on the measure logic
    
    Properties Referenced in Search Definition Result: 
    --------------------------------------------------
    - comp_or_ind (bool)
    - all_comp_cnt (int)
    - all_comp_list  (string array)
    - xfer_locn_cd (string)
    - pacu_pain_score_cd (string)
    - pat_age_years (int)
    - xfer_proto_usage_cd (string)
    - prvr_attest_curr_med_cd (string)
    - enctr_form_aud_ver (int)
    - req_data_proc_dt
    - req_data_surgn_prvr
    - req_data_anes_prvr
    - req_data_anes_st_dt
    - req_data_anes_st_tm
    - req_data_anes_end_dt
    - req_data_anes_end_tm
    - req_data_prim_anes_typ_cd
    - req_data_asa_clsfn_cd
    - req_data_pat_dob
    
    Properties to ensure are populated for the purposes of ABG Submission:
    ----------------------------------------------------------------
    - Date of Service
    - Surgeon Provider
    - Anesthesia provider (at least 1)
    - Anes Start Date
    - Anes Start Time
    - Anes End Date
    - Anes End Time
    - Primary Anesthetic
    - ASA Phys Status Code
    - Patient DOB
    
    Surgery Model Properties to Set:
    --------------------------------
    - qcdr_eval_result: TEXT (JSON object)
       {
           "qcdrVersion": "string",
           "orEventCodes": ["string","string"],
           "pacuEventCodes": ["string","string"],
           "measureEventCodes": ["string","string"],
           "measureList": ["string","string"],
           "domainList": ["string","string"],
           "missingDataList": ["string","string"]
       }
    - qcdr_measure_count: INT
    - qcdr_domain_count: INT
    - qcdr_missing_data_count: INT
    - qcdr_eval_dttm: TIMESTAMP WITH TIMEZONE 'UTC'
    - qcdr_eval_enctr_form_ver: INT
    
    Object properties returned:
    -------------------------------
    {
        "qcdrEvalResult": {
            "orEventCodes": [],
            "pacuEventCodes": [],
            "measureEventCodes": [],
            "measureList": [],
            "domainList": [],
            "qcdrVersion": "ABG.2016.1.0"
        },
        "measureCount": 14,
        "domainCount": 3,
        "missingDataCount": 1
        "evalTimestamp": "2016-06-15T15:05:18.064Z",
        "evalEnctrFormVer": 28
    }
    
    */

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

    function sortMeasureArray(array) {
        // sort measure array numerically based on the digits portion of the metric code (e.g. 'ABG26' => 26)
        return array.sort(function (a, b) {
            var regex = /\d+/;
            return Number(regex.exec(a)[0]) - Number(regex.exec(b)[0]);
        });
    };

    function evalOrPhaseMeasures(facts) {
        var orResult = {
            "measures": [],
            "eventCodes": [],
            "domains": []
        };

        //ABG2
        if (facts.all_comp_list.indexOf('cv_cardiac_arrest') !== -1) {
            orResult.measures.push('ABG2');
            orResult.eventCodes.push('14');
            orResult.domains.push('Patient Safety');
        }

        //ABG3
        if (facts.all_comp_list.indexOf('cv_unexp_death') !== -1) {
            orResult.measures.push('ABG3');
            orResult.eventCodes.push('32');
            orResult.domains.push('Patient Safety');
        }

        //ABG9
        if (facts.all_comp_list.indexOf('misc_surg_fire') !== -1) {
            orResult.measures.push('ABG9');
            orResult.eventCodes.push('50');
            orResult.domains.push('Patient Safety');
        }

        //ABG11
        if (facts.all_comp_list.indexOf('med_anaphylaxis') !== -1) {
            orResult.measures.push('ABG11');
            orResult.eventCodes.push('79');
            orResult.domains.push('Patient Safety');
        }

        //ABG14
        if (facts.all_comp_list.indexOf('misc_eye_inj') !== -1) {
            orResult.measures.push('ABG14');
            orResult.eventCodes.push('80');
            orResult.domains.push('Patient Safety');
        }

        //ABG17
        if (facts.all_comp_list.indexOf('med_admin_err') !== -1) {
            orResult.measures.push('ABG17');
            orResult.eventCodes.push('47');
            orResult.domains.push('Patient Safety');
        }

        //ABG22
        if (facts.all_comp_list.indexOf('arwy_fire') !== -1) {
            orResult.measures.push('ABG22');
            orResult.eventCodes.push('52');
            orResult.domains.push('Patient Safety');
        }

        //ABG23
        if (facts.all_comp_list.indexOf('misc_pat_fall_or') !== -1) {
            orResult.measures.push('ABG23');
            orResult.eventCodes.push('49');
            orResult.domains.push('Patient Safety');
        }

        //ABG24
        if (arraysOverlap(facts.all_comp_list, ['proc_wrong_site', 'proc_wrong_pat', 'proc_wrong_proc'])) {
            orResult.measures.push('ABG24');
            orResult.eventCodes.push('55');
            orResult.domains.push('Patient Safety');
        }

        //ABG26
        if (facts.all_comp_list.indexOf('cv_myocard_ischem') !== -1) {
            orResult.measures.push('ABG26');
            orResult.eventCodes.push('12');
            orResult.domains.push('Patient Safety');
        }

        //ABG27
        if (facts.all_comp_list.indexOf('cv_arrythmia') !== -1) {
            orResult.measures.push('ABG27');
            orResult.eventCodes.push('62');
            orResult.domains.push('Patient Safety');
        }

        return orResult;
    }

    function evalPacuPhaseMeasures(facts) {
        var pacuResult = {
            "measures": [],
            "eventCodes": [],
            "domains": []
        };

        //ABG4
        if (arraysOverlap(facts.all_comp_list, ['pacu_reintub_plnd', 'pacu_reintub'])) {
            pacuResult.measures.push('ABG4');
            pacuResult.eventCodes.push('8');
            pacuResult.domains.push('Patient Safety');
        }

        //ABG19
        if (facts.all_comp_list.indexOf('pacu_unplnd_hosp_adm') !== -1) {
            pacuResult.measures.push('ABG19');
            pacuResult.eventCodes.push('11');
            pacuResult.domains.push('Efficiency and Cost Reduction');
        }

        return pacuResult;
    }

    function evalQcdrMeasures(facts) {
        var qcdrResult = {
            "measures": [],
            "eventCodes": [],
            "domains": []
        };

        //ABG7
        var painScoreCode = facts.pacu_pain_score_cd ? /(\S+)/.exec(facts.pacu_pain_score_cd)[1] : null;
        if ((facts.pat_age_years !== null && facts.pat_age_years >= 18) &&
            (painScoreCode !== null && painScoreCode !== '') &&
            (facts.xfer_locn_cd !== null && facts.xfer_locn_cd !== '')) {
            if (facts.xfer_locn_cd == 'PACU' &&
                painScoreCode == 'UNKNOWN') {
                qcdrResult.measures.push('ABG7');
                qcdrResult.eventCodes.push('1003');
                qcdrResult.domains.push('Person and Caregiver-Centered Experience and Outcomes');
            } else if (facts.xfer_locn_cd == 'PACU' &&
                ['0', '1', '2', '3', '4', '5', '6'].indexOf(painScoreCode) !== -1) {
                qcdrResult.measures.push('ABG7');
                qcdrResult.eventCodes.push('1001');
                qcdrResult.domains.push('Person and Caregiver-Centered Experience and Outcomes');
            } else if (facts.xfer_locn_cd == 'PACU' &&
                ['7', '8', '9', '10'].indexOf(painScoreCode) !== -1) {
                qcdrResult.measures.push('ABG7');
                qcdrResult.eventCodes.push('1002');
                qcdrResult.domains.push('Person and Caregiver-Centered Experience and Outcomes');
            } else if (facts.xfer_locn_cd !== 'PACU') {
                qcdrResult.measures.push('ABG7');
                qcdrResult.eventCodes.push('1017');
                qcdrResult.domains.push('Person and Caregiver-Centered Experience and Outcomes');
            }
        }

        //ABG8
        if ((facts.xfer_proto_usage_cd !== null) &&
            (facts.xfer_locn_cd !== null && ['PACU', 'ICU'].indexOf(facts.xfer_locn_cd) !== -1)) {
            if (facts.xfer_proto_usage_cd.toUpperCase().charAt(0) == 'Y') {
                qcdrResult.measures.push('ABG8');
                qcdrResult.eventCodes.push('1004');
                qcdrResult.domains.push('Communication and Care Coordination');
            } else if (facts.xfer_proto_usage_cd.toUpperCase().charAt(0) == 'N') {
                qcdrResult.measures.push('ABG8');
                qcdrResult.eventCodes.push('1005');
                qcdrResult.domains.push('Communication and Care Coordination');
            }
        }

        //ABG18
        if ((facts.prvr_attest_curr_med_cd) &&
            (facts.prvr_attest_curr_med_cd !== null) &&
            (facts.prvr_attest_curr_med_cd !== '') &&
            (facts.prvr_attest_curr_med_cd.toUpperCase().charAt(0) == 'Y')) {
            qcdrResult.measures.push('ABG18');
            qcdrResult.eventCodes.push('1009');
            qcdrResult.domains.push('Communication and Care Coordination');
        } else if ((facts.prvr_attest_curr_med_cd) &&
            (facts.prvr_attest_curr_med_cd !== null) &&
            (facts.prvr_attest_curr_med_cd !== '') &&
            (facts.prvr_attest_curr_med_cd.toUpperCase() == 'N-RS')) {
            qcdrResult.measures.push('ABG18');
            qcdrResult.eventCodes.push('1011');
            qcdrResult.domains.push('Communication and Care Coordination');
        } else if ((facts.prvr_attest_curr_med_cd) &&
            (facts.prvr_attest_curr_med_cd !== null) &&
            (facts.prvr_attest_curr_med_cd !== '') &&
            (facts.prvr_attest_curr_med_cd.toUpperCase() == 'N-RU')) {
            qcdrResult.measures.push('ABG18');
            qcdrResult.eventCodes.push('1010');
            qcdrResult.domains.push('Communication and Care Coordination');
        }

        return qcdrResult;
    }

    function executeRules(facts) {
        var qcdrVersion = 'ABG.2016.1.1';
        /**
         * Initial version: ABG.2016.1.0
         * Author: M.Oldham
         * 
         * Measures:
         *   Name   Type  Model Properties Evaluated Complications Evaluated Domain
         *   ------ ----- -------------------------- ----------------------- ------------------------
         *   ABG2   Phase comp_or_ind                cv_cardiac_arrest       Patient Safety
         *   ABG3   Phase comp_or_ind                cv_unexp_death          Patient Safety
         *   ABG4   Phase comp_or_ind                pacu_reintub_plnd       Patient Safety
         *                                           pacu_reintub
         *   ABG7   QCDR  pacu_pain_score_cd                                 Person and Caregiver-Centered Experience and Outcomes
         *                pat_dob
         *                xfer_locn_cd
         *   ABG8   QCDR  xfer_proto_usage_cd                                Communication and Care Coordination
         *                xfer_locn_cd
         *   ABG9   Phase comp_or_ind                misc_surg_fire          Patient Safety
         *   ABG11  Phase comp_or_ind                med_anaphylaxis         Patient Safety
         *   ABG14  Phase comp_or_ind                misc_eye_inj            Patient Safety
         *   ABG17  Phase comp_or_ind                med_admin_err           Patient Safety
         *   ABG18  QCDR  prvr_attest_curr_med_cd                            Communication and Care Coordination
         *   ABG19  Phase comp_or_ind                pacu_unplnd_hosp_adm    Efficiency and Cost Reduction
         *   ABG22  Phase comp_or_ind                arwy_fire               Patient Safety
         *   ABG23  Phase comp_or_ind                misc_pat_fall_or        Patient Safety
         *   ABG24  Phase comp_or_ind                proc_wrong_site         Patient Safety
         *                                           proc_wrong_pat
         *                                           proc_wrong_proc
         *   ABG26  Phase comp_or_ind                cv_myocard_ischem       Patient Safety
         *   ABG27  Phase comp_or_ind                cv_arrythmia            Patient Safety
         * 
         * Update History:
         *   Date       Name     Version      Changes
         *   ---------- -------- ------------ --------------------------------------------------------------------
         *   08/02/2016 M.Oldham ABG.2016.1.1 Add logic to check for data fields required for ABG case submission:
         *                                    Add "missingDataList"" element to qcdrEvalResult
         *                                    Add new output model property qcdr_missing_data_count
         *   09/13/2016 M.Oldham ABG.2016.1.1 Add comment header listing measures and model properties for each
         * 
        */
        var qcdrEvalResult = {
            "orEventCodes": [],
            "pacuEventCodes": [],
            "measureEventCodes": [],
            "measureList": [],
            "domainList": [],
            "missingDataList": []
        };

        var abgResult = {
            "qcdrEvalResult": {
                "orEventCodes": [],
                "pacuEventCodes": [],
                "measureEventCodes": [],
                "measureList": [],
                "domainList": [],
                "missingDataList": []
            },
            "measureCount": 0,
            "domainCount": 0,
            "missingDataCount": 0,
            "evalTimestamp": null
        }

        var abgPhaseMeasures = ['ABG2', 'ABG3', 'ABG4',
            'ABG9', 'ABG11', 'ABG14',
            'ABG17', 'ABG19', 'ABG22',
            'ABG23', 'ABG24', 'ABG26',
            'ABG27'];

        var abgQcdrMeasures = ['ABG7', 'ABG8', 'ABG18'];

        var complicationsList = ['cv_cardiac_arrest', 'cv_unexp_death', 'pacu_reintub_plnd',
            'pacu_reintub', 'misc_surg_fire', 'med_anaphylaxis',
            'misc_eye_inj', 'med_admin_err', 'pacu_unplnd_hosp_adm',
            'arwy_fire', 'misc_pat_fall_or', 'proc_wrong_site',
            'proc_wrong_pat', 'proc_wrong_proc', 'cv_myocard_ischem',
            'cv_arrythmia'];

        // Step 1: Check for missing data elements required for ABG submission
        if (!(facts.req_data_proc_dt !== null && facts.req_data_proc_dt === true)) {
            qcdrEvalResult.missingDataList.push("Date of Service");
        }
        if (!(facts.req_data_surgn_prvr !== null && facts.req_data_surgn_prvr === true)) {
            qcdrEvalResult.missingDataList.push("Surgeon Provider");
        }
        if (!(facts.req_data_anes_prvr !== null && facts.req_data_anes_prvr === true)) {
            qcdrEvalResult.missingDataList.push("Anesthesia Provider");
        }
        if (!(facts.req_data_anes_st_dt !== null && facts.req_data_anes_st_dt === true)) {
            qcdrEvalResult.missingDataList.push("Anesthesia Start Date");
        }
        if (!(facts.req_data_anes_st_tm !== null && facts.req_data_anes_st_tm === true)) {
            qcdrEvalResult.missingDataList.push("Anesthesia Start Time");
        }
        if (!(facts.req_data_anes_end_dt !== null && facts.req_data_anes_end_dt === true)) {
            qcdrEvalResult.missingDataList.push("Anesthesia End Date");
        }
        if (!(facts.req_data_anes_end_tm !== null && facts.req_data_anes_end_tm === true)) {
            qcdrEvalResult.missingDataList.push("Anesthesia End Time");
        }
        if (!(facts.req_data_prim_anes_typ_cd !== null && facts.req_data_prim_anes_typ_cd === true)) {
            qcdrEvalResult.missingDataList.push("Primary Anesthetic");
        }
        if (!(facts.req_data_asa_clsfn_cd !== null && facts.req_data_asa_clsfn_cd === true)) {
            qcdrEvalResult.missingDataList.push("ASA Physical Status");
        }
        if (!(facts.req_data_pat_dob !== null && facts.req_data_pat_dob === true)) {
            qcdrEvalResult.missingDataList.push("Patient DOB");
        }

        // Step 2: Process Phase measures and accumulate results
        if (facts.comp_or_ind == null) {
            //Scenario: 1. Provider did not indicate whether or not complications occurred (null)
            //Action: Leave OR and PACU event codes empty (no measures)
            //console.log('DEBUG: Scenario: 1');
            qcdrEvalResult.orEventCodes = [];
            qcdrEvalResult.pacuEventCodes = [];
        } else if ((facts.comp_or_ind !== null) &&
            (facts.comp_or_ind === true) &&
            (facts.all_comp_cnt == 0)) {
            //Scenario: 2. Provider did indicated that complications did occur (true), but failed to list any complications 
            //Action: Leave OR and PACU event codes empty (no measures)
            //console.log('DEBUG: Scenario: 2');
            qcdrEvalResult.orEventCodes = [];
            qcdrEvalResult.pacuEventCodes = [];
        } else if ((facts.comp_or_ind !== null) &&
            (facts.comp_or_ind === false)) {
            //Scenario: 3. Provider indicated that no complications occurred (false)
            //Action: Report event code 1 for both OR and PACU phases (13 measures, 2 NQS domains)
            //console.log('DEBUG: Scenario: 3');
            qcdrEvalResult.orEventCodes = ['1'];
            qcdrEvalResult.pacuEventCodes = ['1'];
            qcdrEvalResult.measureList.push.apply(qcdrEvalResult.measureList, abgPhaseMeasures);
            qcdrEvalResult.domainList.push.apply(qcdrEvalResult.domainList, ['Patient Safety', 'Efficiency and Cost Reduction']);
        } else if ((facts.comp_or_ind !== null) &&
            (facts.comp_or_ind === true) &&
            (facts.all_comp_cnt > 0) &&
            (!arraysOverlap(facts.all_comp_list, complicationsList))) {
            //Scenario: 4. Provider indicated that complications did occurr (true), but only complications *not* used by our measures were selected
            //Action: Report event code 1 for both OR and PACU phases (13 measures, 2 NQS domains)
            //console.log('DEBUG: Scenario: 4');
            qcdrEvalResult.orEventCodes = ['1'];
            qcdrEvalResult.pacuEventCodes = ['1'];
            qcdrEvalResult.measureList.push.apply(qcdrEvalResult.measureList, abgPhaseMeasures);
            qcdrEvalResult.domainList.push.apply(qcdrEvalResult.domainList, ['Patient Safety', 'Efficiency and Cost Reduction']);
        } else if ((facts.comp_or_ind !== null) &&
            (facts.comp_or_ind === true) &&
            (facts.all_comp_cnt > 0) &&
            (arraysOverlap(facts.all_comp_list, complicationsList))) {
            //Scenario: 5. Provider indicated that complications did occurr (true), and one or more complications used by our measures was selected
            //Action: Evaluation each phase-specific measure and report appropriate event code(s) and domain(s)
            //console.log('DEBUG: Scenario: 5');

            //process OR measures and accumulate results
            var orMeasureResult = evalOrPhaseMeasures(facts);
            qcdrEvalResult.orEventCodes = orMeasureResult.eventCodes;
            qcdrEvalResult.measureList.push.apply(qcdrEvalResult.measureList, orMeasureResult.measures);
            qcdrEvalResult.domainList.push.apply(qcdrEvalResult.domainList, orMeasureResult.domains);

            //process PACU measures and accumulate results
            var pacuMeasureResult = evalPacuPhaseMeasures(facts);
            qcdrEvalResult.pacuEventCodes = pacuMeasureResult.eventCodes;
            qcdrEvalResult.measureList.push.apply(qcdrEvalResult.measureList, pacuMeasureResult.measures);
            qcdrEvalResult.domainList.push.apply(qcdrEvalResult.domainList, pacuMeasureResult.domains);
        } else {
            //Scenario: 6. Something else went wrong
            //Action: Leave OR and PACU event codes empty (no measures)
            //console.log('DEBUG: Scenario: 6' + '\n' + JSON.stringify(facts,null,4));
            qcdrEvalResult.orEventCodes = [];
            qcdrEvalResult.pacuEventCodes = [];
        }

        // Step 3: Process QCDR measures and accumulate results
        var qcdrMeasureResult = evalQcdrMeasures(facts);
        qcdrEvalResult.measureEventCodes = qcdrMeasureResult.eventCodes;
        qcdrEvalResult.measureList.push.apply(qcdrEvalResult.measureList, qcdrMeasureResult.measures);
        qcdrEvalResult.domainList.push.apply(qcdrEvalResult.domainList, qcdrMeasureResult.domains);

        // Deduplicate measure and domain arrays
        qcdrEvalResult.measureList = dedupArray(qcdrEvalResult.measureList);
        qcdrEvalResult.domainList = dedupArray(qcdrEvalResult.domainList);

        //Sort measure array 
        qcdrEvalResult.measureList = sortMeasureArray(qcdrEvalResult.measureList);

        //Calculate measure, domain, and missing data counts
        var measureCount = qcdrEvalResult.measureList.length;
        var domainCount = qcdrEvalResult.domainList.length;
        var missingDataCount = qcdrEvalResult.missingDataList.length;

        //populate final ABG result
        abgResult.qcdrEvalResult = qcdrEvalResult;
        abgResult.qcdrEvalResult.qcdrVersion = qcdrVersion;
        abgResult.measureCount = measureCount;
        abgResult.domainCount = domainCount;
        abgResult.missingDataCount = missingDataCount;
        abgResult.evalTimestamp = new Date().toISOString();
        abgResult.evalEnctrFormVer = facts.enctr_form_aud_ver;

        return abgResult;
    }

    return EncounterFormPqrsEval;
})();


/*


function generateModelPropertyUpdatesFromResults(formData, ruleResults) {
    var modelPropertyUpdates = [];
    var formValid = formData.form_valid_ind;
    var percentComplete = formData.form_cmplt_pct;
    
    modelPropertyUpdates.push({
        propertyName: "qcdr_eval_result",
        fieldValue: JSON.stringify(ruleResults.qcdrEvalResult),
        formValid: formValid,
        percentComplete: percentComplete
    });
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
    modelPropertyUpdates.push({
        propertyName: "qcdr_eval_dttm",
        fieldValue: ruleResults.evalTimestamp,
        formValid: formValid,
        percentComplete: percentComplete
    });
    modelPropertyUpdates.push({
        propertyName: "qcdr_eval_enctr_form_ver",
        fieldValue: ruleResults.evalEnctrFormVer,
        formValid: formValid,
        percentComplete: percentComplete
    });
    
    return modelPropertyUpdates;
}

function processMessage() {
    var scriptResults = [];
    
    getUpdatedFormFacts()
    .then(function(forms) {

        return Promise.map(forms, function(formData) {
            
            // If the eval version is only one less than the current audit version, it means that the
            // current version of the form was the one that was updated by this script previously, so
            // we skip it.
            if(formData.qcdr_eval_enctr_form_ver !== null &&
               formData.qcdr_eval_enctr_form_ver == formData.enctr_form_aud_ver - 1)
               return Promise.resolve();
            
            var ruleResults = executeRules(formData);
            var modelPropertyUpdates = generateModelPropertyUpdatesFromResults(formData, ruleResults);
            scriptResults.push({formData:formData, ruleResults:ruleResults, modelPropertyUpdates:modelPropertyUpdates});
            
            return formService.updateEncounterFormModel( formData.enctr_form_id, modelPropertyUpdates ); 

        },{concurrency: 5});
    })
    .then(function(results) {
        return uploadDataToFtp(ftpUploadPath + '/results_'+getTimeframe().fileDate+'.json', JSON.stringify(scriptResults,null,4));
    })
    .then(function() {
        console.log('Completed updates.');
        context.succeed();
    })
    .catch(function(error) {
        console.log('Unable to complete udpate: ' + error);
        context.fail(error);
    })
}

processMessage();
*/

/*  ABG Processing (vABG.2016.1.0)

Logic scenarios for PSO Phase Measures:
---------------------------------------
1. If the complications gatekeeper property is null, leave OR and PACU phases empty (no measures reported for those phases)
2. If the complications gatekeeper is true, but no complications are selected, then leave OR and PACU phases empty (no measures reported for those phases)
3. If the complications gatekeeper is false, report event code 1 for both the OR and PACU phases (13 measures, 1 domain)
4. If the complications gatekeeper is true, and one or more complications other than those used by our measures were selected, then report a 1 for both the OR and PACU phases (13 measures, 1 domain)
5. If the complications gatekeeper is true, and one or more complications are selected that are used by our measures, then one or more event codes should be reported (based on each measure's logic), but ultimately all 14 measures qualify

Logic scenarios for QCDR Measures:
----------------------------------
Evaluate each measure's logic individually, and report either a single event code for each one or nothing at all, depending on the measure logic

Properties Referenced in Search Definition Result: 
--------------------------------------------------
- comp_or_ind (bool)
- all_comp_cnt (int)
- all_comp_list  (string array)
- xfer_locn_cd (string)
- pacu_pain_score_cd (string)
- pat_age_years (int)
- xfer_proto_usage_cd (string)
- prvr_attest_curr_med_cd (string)
- enctr_form_aud_ver (int)

Surgery Model Properties to Set:
--------------------------------
- qcdr_eval_result: TEXT (JSON object)
   {
       "qcdrVersion": "string",
       "orEventCodes": ["string","string"],
       "pacuEventCodes": ["string","string"],
       "measureEventCodes": ["string","string"],
       "measureList": ["string","string"],
       "domainList": ["string","string"]
   }
- qcdr_measure_count: INT
- qcdr_domain_count: INT
- qcdr_eval_dttm: TIMESTAMP WITH TIMEZONE 'UTC'
- qcdr_eval_enctr_form_ver: INT

Object properties returned:
-------------------------------
{
    "qcdrEvalResult": {
        "orEventCodes": [],
        "pacuEventCodes": [],
        "measureEventCodes": [],
        "measureList": [],
        "domainList": [],
        "qcdrVersion": "ABG.2016.1.0"
    },
    "measureCount": 14,
    "domainCount": 3,
    "evalTimestamp": "2016-06-15T15:05:18.064Z",
    "evalEnctrFormVer": 28
}

*/
/*
function arraysOverlap(array1,array2) {
    // determine if arrays have any elements in common
    var arrays = [array1,array2];
    var result = arrays.shift().reduce(function(res, v) {
        if (res.indexOf(v) === -1 && arrays.every(function(a) {
            return a.indexOf(v) !== -1;
        })) res.push(v)
        return res;
    }, []);
    return (result.length > 0);
}

function dedupArray(array) {
    return array.filter(function(elem, pos) {
        return array.indexOf(elem) == pos;
    });
}

function sortMeasureArray(array) {
    // sort measure array numerically based on the digits portion of the metric code (e.g. 'ABG26' => 26)
    return array.sort(function(a,b) {
        var regex = /\d+/;
        return Number(regex.exec(a)[0]) - Number(regex.exec(b)[0]);
    });
};

function evalOrPhaseMeasures(facts) {
    var orResult = {
        "measures": [],
        "eventCodes": [],
        "domains": []
    };

    //ABG2
    if (facts.all_comp_list.indexOf('cv_cardiac_arrest') !== -1) {
        orResult.measures.push('ABG2');
        orResult.eventCodes.push('14');
        orResult.domains.push('Patient Safety');
    }

    //ABG3
    if (facts.all_comp_list.indexOf('cv_unexp_death') !== -1) {
        orResult.measures.push('ABG3');
        orResult.eventCodes.push('32');
        orResult.domains.push('Patient Safety');
    }

    //ABG9
    if (facts.all_comp_list.indexOf('misc_surg_fire') !== -1) {
        orResult.measures.push('ABG9');
        orResult.eventCodes.push('50');
        orResult.domains.push('Patient Safety');
    }

    //ABG11
    if (facts.all_comp_list.indexOf('med_anaphylaxis') !== -1) {
        orResult.measures.push('ABG11');
        orResult.eventCodes.push('79');
        orResult.domains.push('Patient Safety');
    }

    //ABG14
    if (facts.all_comp_list.indexOf('misc_eye_inj') !== -1) {
        orResult.measures.push('ABG14');
        orResult.eventCodes.push('80');
        orResult.domains.push('Patient Safety');
    }

    //ABG17
    if (facts.all_comp_list.indexOf('med_admin_err') !== -1) {
        orResult.measures.push('ABG17');
        orResult.eventCodes.push('47');
        orResult.domains.push('Patient Safety');
    }

    //ABG22
    if (facts.all_comp_list.indexOf('arwy_fire') !== -1) {
        orResult.measures.push('ABG22');
        orResult.eventCodes.push('52');
        orResult.domains.push('Patient Safety');
    }

    //ABG23
    if (facts.all_comp_list.indexOf('misc_pat_fall_or') !== -1) {
        orResult.measures.push('ABG23');
        orResult.eventCodes.push('49');
        orResult.domains.push('Patient Safety');
    }

    //ABG24
    if (arraysOverlap(facts.all_comp_list,['proc_wrong_site', 'proc_wrong_pat', 'proc_wrong_proc'])) {
        orResult.measures.push('ABG24');
        orResult.eventCodes.push('55');
        orResult.domains.push('Patient Safety');
    }

    //ABG26
    if (facts.all_comp_list.indexOf('cv_myocard_ischem') !== -1) {
        orResult.measures.push('ABG26');
        orResult.eventCodes.push('12');
        orResult.domains.push('Patient Safety');
    }

    //ABG27
    if (facts.all_comp_list.indexOf('cv_arrythmia') !== -1) {
        orResult.measures.push('ABG27');
        orResult.eventCodes.push('62');
        orResult.domains.push('Patient Safety');
    }

    return orResult;
}

function evalPacuPhaseMeasures(facts) {
    var pacuResult = {
        "measures": [],
        "eventCodes": [],
        "domains": []
    };

    //ABG4
    if (arraysOverlap(facts.all_comp_list,['pacu_reintub_plnd', 'pacu_reintub'])) {
        pacuResult.measures.push('ABG4');
        pacuResult.eventCodes.push('8');
        pacuResult.domains.push('Patient Safety');
    }

    //ABG19
    if (facts.all_comp_list.indexOf('pacu_unplnd_hosp_adm') !== -1) {
        pacuResult.measures.push('ABG19');
        pacuResult.eventCodes.push('11');
        pacuResult.domains.push('Efficiency and Cost Reduction');
    }

    return pacuResult;    
}

function evalQcdrMeasures(facts) {
    var qcdrResult = {
        "measures": [],
        "eventCodes": [],
        "domains": []
    };

    //ABG7
    var painScoreCode = facts.pacu_pain_score_cd ? /(\S+)/.exec(facts.pacu_pain_score_cd)[1] : null;
    if ( (facts.pat_age_years !== null && facts.pat_age_years >= 18) &&
         (painScoreCode !== null && painScoreCode !== '') &&
         (facts.xfer_locn_cd !== null && facts.xfer_locn_cd !== '') ) {
        if (facts.xfer_locn_cd == 'PACU' &&
            painScoreCode == 'UNKNOWN') {
            qcdrResult.measures.push('ABG7');
            qcdrResult.eventCodes.push('1003');
            qcdrResult.domains.push('Person and Caregiver-Centered Experience and Outcomes');
        } else if(facts.xfer_locn_cd == 'PACU' &&
                  ['0','1','2','3','4','5','6'].indexOf(painScoreCode) !== -1) {
            qcdrResult.measures.push('ABG7');
            qcdrResult.eventCodes.push('1001');
            qcdrResult.domains.push('Person and Caregiver-Centered Experience and Outcomes');
        } else if (facts.xfer_locn_cd == 'PACU' &&
                  ['7','8','9','10'].indexOf(painScoreCode) !== -1) {
            qcdrResult.measures.push('ABG7');
            qcdrResult.eventCodes.push('1002');
            qcdrResult.domains.push('Person and Caregiver-Centered Experience and Outcomes');            
        } else if (facts.xfer_locn_cd !== 'PACU') {
            qcdrResult.measures.push('ABG7');
            qcdrResult.eventCodes.push('1017');
            qcdrResult.domains.push('Person and Caregiver-Centered Experience and Outcomes');
        }
    }
    
    //ABG8
    if ( (facts.xfer_proto_usage_cd !== null) &&
         (facts.xfer_locn_cd !== null && ['PACU','ICU'].indexOf(facts.xfer_locn_cd) !== -1) ) {
        if (facts.xfer_proto_usage_cd.toUpperCase().charAt(0) == 'Y') {
            qcdrResult.measures.push('ABG8');
            qcdrResult.eventCodes.push('1004');
            qcdrResult.domains.push('Communication and Care Coordination');
        } else if(facts.xfer_proto_usage_cd.toUpperCase().charAt(0) == 'N') {
            qcdrResult.measures.push('ABG8');
            qcdrResult.eventCodes.push('1005');
            qcdrResult.domains.push('Communication and Care Coordination');
        }
    }

    //ABG18
    if ( (facts.prvr_attest_curr_med_cd) &&
         (facts.prvr_attest_curr_med_cd !== null) &&
         (facts.prvr_attest_curr_med_cd !== '') &&
         (facts.prvr_attest_curr_med_cd.toUpperCase().charAt(0) == 'Y') ) {
        qcdrResult.measures.push('ABG18');
        qcdrResult.eventCodes.push('1009');
        qcdrResult.domains.push('Communication and Care Coordination');
    } else if( (facts.prvr_attest_curr_med_cd) &&
               (facts.prvr_attest_curr_med_cd !== null) &&
               (facts.prvr_attest_curr_med_cd !== '') &&
               (facts.prvr_attest_curr_med_cd.toUpperCase() == 'N-RS') ) {
        qcdrResult.measures.push('ABG18');
        qcdrResult.eventCodes.push('1011');
        qcdrResult.domains.push('Communication and Care Coordination');
    } else if( (facts.prvr_attest_curr_med_cd) &&
               (facts.prvr_attest_curr_med_cd !== null) &&
               (facts.prvr_attest_curr_med_cd !== '') &&
               (facts.prvr_attest_curr_med_cd.toUpperCase() == 'N-RU') ) {
        qcdrResult.measures.push('ABG18');
        qcdrResult.eventCodes.push('1010');
        qcdrResult.domains.push('Communication and Care Coordination');
    }

    return qcdrResult;
}

function executeRules(facts) {
    var qcdrVersion = 'ABG.2016.1.0';

    var qcdrEvalResult = {
        "orEventCodes": [],
        "pacuEventCodes": [],
        "measureEventCodes": [],
        "measureList": [],
        "domainList": []
    };

    var abgResult = {
        "qcdrEvalResult": {
            "orEventCodes": [],
            "pacuEventCodes": [],
            "measureEventCodes": [],
            "measureList": [],
            "domainList": []            
        },
        "measureCount": 0,
        "domainCount": 0,
        "evalTimestamp": null
    }

    var abgPhaseMeasures = ['ABG2','ABG3','ABG4',
                            'ABG9','ABG11','ABG14',
                            'ABG17','ABG19','ABG22',
                            'ABG23','ABG24','ABG26',
                            'ABG27'];

    var abgQcdrMeasures = ['ABG7','ABG8','ABG18'];

    var complicationsList = ['cv_cardiac_arrest','cv_unexp_death','pacu_reintub_plnd',
                            'pacu_reintub','misc_surg_fire','med_anaphylaxis',
                            'misc_eye_inj','med_admin_err','pacu_unplnd_hosp_adm',
                            'arwy_fire','misc_pat_fall_or','proc_wrong_site',
                            'proc_wrong_pat', 'proc_wrong_proc','cv_myocard_ischem',
                            'cv_arrythmia'];

    // Step 1: Process Phase measures and accumulate results
    if( facts.comp_or_ind == null ) {
        //Scenario: 1. Provider did not indicate whether or not complications occurred (null)
        //Action: Leave OR and PACU event codes empty (no measures)
        //console.log('DEBUG: Scenario: 1');
        qcdrEvalResult.orEventCodes = [];
        qcdrEvalResult.pacuEventCodes = [];
    } else if( (facts.comp_or_ind !== null) &&
               (facts.comp_or_ind === true) &&
               (facts.all_comp_cnt == 0) ) {
        //Scenario: 2. Provider did indicated that complications did occur (true), but failed to list any complications 
        //Action: Leave OR and PACU event codes empty (no measures)
        //console.log('DEBUG: Scenario: 2');
        qcdrEvalResult.orEventCodes = [];
        qcdrEvalResult.pacuEventCodes = [];
    } else if( (facts.comp_or_ind !== null) && 
               (facts.comp_or_ind === false) ) {
        //Scenario: 3. Provider indicated that no complications occurred (false)
        //Action: Report event code 1 for both OR and PACU phases (13 measures, 2 NQS domains)
        console.log('DEBUG: Scenario: 3');
        qcdrEvalResult.orEventCodes = ['1'];
        qcdrEvalResult.pacuEventCodes = ['1'];
        qcdrEvalResult.measureList.push.apply(qcdrEvalResult.measureList, abgPhaseMeasures);
        qcdrEvalResult.domainList.push.apply(qcdrEvalResult.domainList, ['Patient Safety','Efficiency and Cost Reduction']);    
    } else if( (facts.comp_or_ind !== null) &&
               (facts.comp_or_ind === true) &&
               (facts.all_comp_cnt > 0) &&
               (!arraysOverlap(facts.all_comp_list,complicationsList)) ) {
        //Scenario: 4. Provider indicated that complications did occurr (true), but only complications *not* used by our measures were selected
        //Action: Report event code 1 for both OR and PACU phases (13 measures, 2 NQS domains)
        //console.log('DEBUG: Scenario: 4');
        qcdrEvalResult.orEventCodes = ['1'];
        qcdrEvalResult.pacuEventCodes = ['1'];
        qcdrEvalResult.measureList.push.apply(qcdrEvalResult.measureList, abgPhaseMeasures);
        qcdrEvalResult.domainList.push.apply(qcdrEvalResult.domainList, ['Patient Safety','Efficiency and Cost Reduction']);    
    } else if( (facts.comp_or_ind !== null) &&
               (facts.comp_or_ind === true) &&
               (facts.all_comp_cnt > 0) &&
               (arraysOverlap(facts.all_comp_list,complicationsList)) ) {
        //Scenario: 5. Provider indicated that complications did occurr (true), and one or more complications used by our measures was selected
        //Action: Evaluation each phase-specific measure and report appropriate event code(s) and domain(s)
        //console.log('DEBUG: Scenario: 5');

        //process OR measures and accumulate results
        var orMeasureResult = evalOrPhaseMeasures(facts);
        qcdrEvalResult.orEventCodes = orMeasureResult.eventCodes;
        qcdrEvalResult.measureList.push.apply(qcdrEvalResult.measureList, orMeasureResult.measures);
        qcdrEvalResult.domainList.push.apply(qcdrEvalResult.domainList, orMeasureResult.domains);    

        //process PACU measures and accumulate results
        var pacuMeasureResult = evalPacuPhaseMeasures(facts);
        qcdrEvalResult.pacuEventCodes = pacuMeasureResult.eventCodes;
        qcdrEvalResult.measureList.push.apply(qcdrEvalResult.measureList, pacuMeasureResult.measures);
        qcdrEvalResult.domainList.push.apply(qcdrEvalResult.domainList, pacuMeasureResult.domains);    
    } else {
        //Scenario: 6. Something else went wrong
        //Action: Leave OR and PACU event codes empty (no measures)
        //console.log('DEBUG: Scenario: 6' + '\n' + JSON.stringify(facts,null,4));
        qcdrEvalResult.orEventCodes = [];
        qcdrEvalResult.pacuEventCodes = [];
    }

    // Step 2: Process QCDR measures and accumulate results
    var qcdrMeasureResult = evalQcdrMeasures(facts);
    qcdrEvalResult.measureEventCodes = qcdrMeasureResult.eventCodes;
    qcdrEvalResult.measureList.push.apply(qcdrEvalResult.measureList, qcdrMeasureResult.measures);
    qcdrEvalResult.domainList.push.apply(qcdrEvalResult.domainList, qcdrMeasureResult.domains);    

    // Deduplicate measure and domain arrays
    qcdrEvalResult.measureList = dedupArray(qcdrEvalResult.measureList);
    qcdrEvalResult.domainList = dedupArray(qcdrEvalResult.domainList);

    //Sort measure array 
    qcdrEvalResult.measureList = sortMeasureArray(qcdrEvalResult.measureList);

    //Calculate measure and domain counts
    var measureCount = qcdrEvalResult.measureList.length;
    var domainCount = qcdrEvalResult.domainList.length;
    
    //populate final ABG result
    abgResult.qcdrEvalResult = qcdrEvalResult;
    abgResult.qcdrEvalResult.qcdrVersion = qcdrVersion;
    abgResult.measureCount = measureCount;
    abgResult.domainCount = domainCount;
    abgResult.evalTimestamp = new Date().toISOString();
    abgResult.evalEnctrFormVer = facts.enctr_form_aud_ver;
    
    return abgResult;
}

function runTests() {
      
    var tests = [
        {
            "testName": "Scenario1",
            "enctrFormId": 1,
            "comp_or_ind": null,
            "all_comp_cnt": 0,
            "all_comp_list": [],
            "xfer_locn_cd": "PACU",
            "pacu_pain_score_cd": "1",
            "pat_age_years": 1,
            "xfer_proto_usage_cd": "N-RS",
            "prvr_attest_curr_med_cd": "Y",
            "enctr_form_aud_ver": 5
        },
        {
            "testName": "Scenario2",
            "enctrFormId": 2,
            "comp_or_ind": true,
            "all_comp_cnt": 0,
            "all_comp_list": [],
            "xfer_locn_cd": "PACU",
            "pacu_pain_score_cd": "1",
            "pat_age_years": 2,
            "xfer_proto_usage_cd": "N-RS",
            "prvr_attest_curr_med_cd": null,
            "enctr_form_aud_ver": 14
        },
        {
            "testName": "Scenario3",
            "enctrFormId": 3,
            "comp_or_ind": false,
            "all_comp_cnt": 0,
            "all_comp_list": [],
            "xfer_locn_cd": "PACU",
            "pacu_pain_score_cd": "1",
            "pat_age_years": 3,
            "xfer_proto_usage_cd": "N-RS",
            "prvr_attest_curr_med_cd": "Y",
            "enctr_form_aud_ver": 3
        },
        {
            "testName": "Scenario4",
            "enctrFormId": 4,
            "comp_or_ind": true,
            "all_comp_cnt": 3,
            "all_comp_list": ["complication1","complication2","complication3"],
            "xfer_locn_cd": "PACU",
            "pacu_pain_score_cd": "1",
            "pat_age_years": 4,
            "xfer_proto_usage_cd": "N-RS",
            "prvr_attest_curr_med_cd": "Y",
            "enctr_form_aud_ver": 42
        },
        {
            "testName": "Scenario5a",
            "enctrFormId": 6,
            "comp_or_ind": true,
            "all_comp_cnt": 3,
            "all_comp_list": ["med_anaphylaxis","proc_wrong_site","complication3"],
            "xfer_locn_cd": "PACU",
            "pacu_pain_score_cd": "UNKNOWN",
            "pat_age_years": 17,
            "xfer_proto_usage_cd": "N-RS",
            "prvr_attest_curr_med_cd": "Y",
            "enctr_form_aud_ver": 21
        },
        {
            "testName": "Scenario5b",
            "enctrFormId": 7,
            "comp_or_ind": true,
            "all_comp_cnt": 3,
            "all_comp_list": ["complication1","pacu_reintub_plnd","complication3"],
            "xfer_locn_cd": "ICU",
            "pacu_pain_score_cd": "UNKNOWN",
            "pat_age_years": 18,
            "xfer_proto_usage_cd": "Y",
            "prvr_attest_curr_med_cd": "Y",
            "enctr_form_aud_ver": 11
        },
        {
            "testName": "Scenario5c",
            "enctrFormId": 7,
            "comp_or_ind": true,
            "all_comp_cnt": 0,
            "all_comp_list": [],
            "xfer_locn_cd": "PACU",
            "pacu_pain_score_cd": "7",
            "pat_age_years": 19,
            "xfer_proto_usage_cd": "Y",
            "prvr_attest_curr_med_cd": "N-RU",
            "enctr_form_aud_ver": 19
        }
    ];
    
    // Run tests
    for(var test=0; test<tests.length; test++) {
        console.log('================================================================================');
        var result = executeRules(tests[test]);
        console.log('Test: ' + tests[test].testName);
        console.log('evalTimestamp: ' + result.evalTimestamp.toString());
        console.log('qcdrEvalResult: ' + '\n' + JSON.stringify(result.qcdrEvalResult,null,4));
        console.log('measureCount: ' + result.measureCount.toString());
        console.log('domainCount: ' + result.domainCount.toString());
        console.log('evalEnctrFormVer: ' + result.evalEnctrFormVer.toString());
    }
}
*/