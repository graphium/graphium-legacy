interface StaticOrgScoreCardMetricSample {
    metricKey:string;
    sampleMonth:number;
    sampleYear:number;
    metricTimestamp:number;
    metricGuid:string;
    orgInternalName:string;
    facilityId:number;
    goal: number;
    goalVariance: number;
    metricValue: number;
    createdAt:number;
    lastUpdatedAt:number;
}

export default StaticOrgScoreCardMetricSample;