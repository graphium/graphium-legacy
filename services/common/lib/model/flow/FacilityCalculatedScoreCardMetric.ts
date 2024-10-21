import CalculatedScoreCardMetric from './CalculatedScoreCardMetric';
import ScoreCardMetricDefinition from './ScoreCardMetricDefinition';

interface FacilityCalculatedScoreCardMetric {
    category:string,
    name:string,
    data:CalculatedScoreCardMetric[],
}

export default FacilityCalculatedScoreCardMetric;