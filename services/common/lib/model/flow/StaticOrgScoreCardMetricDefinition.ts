export interface StaticOrgScoreCardMetricDefinition {
    guid?: string,
    category: string,
    title: string,
    hasGoal: boolean,
    goalInverted: boolean,
    valueUnit: string,
    goalUnit: string,
    displayOrder?: number,
    enabled: boolean,
    createdAt?:number,
    lastUpdatedAt?: number
}

export default StaticOrgScoreCardMetricDefinition;