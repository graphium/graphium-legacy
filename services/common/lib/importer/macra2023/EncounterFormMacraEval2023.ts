import { GraphiumServiceUtils } from '../GraphiumServiceUtils';
import { EncounterFormFactsEval2023 } from './EncounterFormFactsEval2023';
import { QcdrFormEvalResult2023 } from './QcdrFormEvalResult2023';
import { EncounterFormFacts2023 } from './EncounterFormFacts2023';
import * as PqrsAnalyticsDAO from '../../dao/PQRSAnalyticsDAO';

// may need to comment out this line for local utility script execution
var moment = require('moment');
var _ = require('lodash');
var Bluebird = require('bluebird');

export interface EvalFactsResults2023 {
    hasError: boolean;
    errorText: string | null;
    results: QcdrFormEvalResult2023[];
}
export default class EncounterFormMacraEval2023 {
    private serviceUtils: GraphiumServiceUtils;

    constructor(private serviceConfig, private facilityId) {
        this.serviceUtils = new GraphiumServiceUtils(this.serviceConfig);
    }

    private generateResults(formFacts: EncounterFormFacts2023[]): EvalFactsResults2023 {
        if (!formFacts || formFacts.length == 0) {
            return <EvalFactsResults2023>{
                hasError: true,
                errorText: 'Unable to find form facts for form, unable to evaluate PQRS rules.',
                results: null,
            };
        }

        let qcdrResults = new Array<QcdrFormEvalResult2023>();
        let engine = new EncounterFormFactsEval2023();
        for (let facts of formFacts) {
            qcdrResults.push(engine.evalFacts(facts));
        }

        return {
            hasError: false,
            errorText: null,
            results: qcdrResults,
        };
    }

    async evaluateAllPendingForms(includeFactsInResults) {
        // 1. Get a list of all MACRA 2023 forms that have been updated (eval ver OR survey vers don't match) - update PqrsAnalyticsDAO.get2023QcdrFormFacts
        // 2. Get all surveys from the framework db for form facts that have returned survey IDs.
        // 3. Run data through evalFacts (need to update evalFacts to take into account the udpated EncounterFormFacts2023 object.)
        // 4. Update the `qcdr_eval_survey_aud_ver` in the enctr_form table along with the other existing udpates.

        let formFacts = await PqrsAnalyticsDAO.get2023QcdrFormFacts(
            this.serviceConfig.orgInternalName,
            this.facilityId,
            EncounterFormFactsEval2023.qcdrRulesEngineVersion,
            true,
        );
        return this.generateResults(formFacts);
    }

    async evaluateAllForms() {
        // 1. Get a list of all MACRA 2023 forms that have been updated (eval ver OR survey vers don't match) - update PqrsAnalyticsDAO.get2023QcdrFormFacts
        // 2. Get all surveys from the framework db for form facts that have returned survey IDs.
        // 3. Run data through evalFacts (need to update evalFacts to take into account the udpated EncounterFormFacts2023 object.)
        // 4. Update the `qcdr_eval_survey_aud_ver` in the enctr_form table along with the other existing udpates.

        let formFacts = await PqrsAnalyticsDAO.get2023QcdrFormFacts(
            this.serviceConfig.orgInternalName,
            this.facilityId,
            EncounterFormFactsEval2023.qcdrRulesEngineVersion,
            false,
        );
        return this.generateResults(formFacts);
    }

    private async evaluateForm(encounterFormId: number) {
        let formFacts = await PqrsAnalyticsDAO.get2023QcdrFormFacts(
            this.serviceConfig.orgInternalName,
            this.facilityId,
            EncounterFormFactsEval2023.qcdrRulesEngineVersion,
            false,
            encounterFormId,
        );
        return this.generateResults(formFacts);
    }
}
