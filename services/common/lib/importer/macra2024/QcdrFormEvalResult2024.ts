import { QcdrResult2024 } from './QcdrResult2024';
import { EncounterFormFacts2024 } from './EncounterFormFacts2024';

export interface QcdrFormEvalResult2024 {
    modelUpdates: any[];
    actualResult: QcdrResult2024;
    projectedResult: QcdrResult2024;
    missingFieldList: string[];
    missingFieldCount: number;
    facts: EncounterFormFacts2024;
}
