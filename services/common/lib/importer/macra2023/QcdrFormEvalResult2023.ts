import { QcdrResult2023 } from './QcdrResult2023';
import { EncounterFormFacts2023 } from './EncounterFormFacts2023';

export interface QcdrFormEvalResult2023 {
    modelUpdates: any[];
    actualResult: QcdrResult2023;
    projectedResult: QcdrResult2023;
    missingFieldList: string[];
    missingFieldCount: number;
    facts: EncounterFormFacts2023;
}
