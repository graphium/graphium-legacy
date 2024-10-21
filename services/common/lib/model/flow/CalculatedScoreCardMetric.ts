import ScoreCardMetricDefinition from './ScoreCardMetricDefinition';

interface CalculatedScoreCardMetric {
    metricDefinition: ScoreCardMetricDefinition,
    orgInternalName: string,
    facilityId: number,
    facilityName: string
    startDate: Date,
    endDate: Date,
    metricValue: number,
    goal: number,
    goalVarianceValue: number,
    goalValue:number,
    trend:number[],
    detail:string,
    inverted: boolean,
}

export default CalculatedScoreCardMetric;