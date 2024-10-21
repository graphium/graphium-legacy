import * as AWS from 'aws-sdk';
var uuid = require('uuid');
var winston = require('winston');
var https = require('https');
var _ = require('lodash');
import * as Joi from 'joi';
var ddb = require('../util/ddbUtil.js');
import Flow from '../model/flow/Flow.js';
import StaticOrgScoreCardMetricSample from '../model/flow/StaticOrgScoreCardMetricSample';
import StaticOrgScoreCardMetricDefinition from '../model/flow/StaticOrgScoreCardMetricDefinition';
import * as OrgSettingDAO from './OrgSettingDAO';
import * as DateUtil from '../util/DateUtil';

var createDynamoDbDocClient = function():AWS.DynamoDB.DocumentClient {
    var ddbService = new AWS.DynamoDB({
        region:"us-east-1"
    });

    return new AWS.DynamoDB.DocumentClient({
        service: ddbService
    });
}

function generateUniqueGuid(existingGuids:string[]):string {
    var guid = uuid.v4();
    var guidAttempts = 0;
    while(existingGuids.indexOf(guid) >= 0) {
        if(guidAttempts > 100) {
            throw new Error('Unable to generate unique guid, too many attempts.');
        }

        guidAttempts++;
        guid = uuid.v4();
    }
    return guid;
}

export async function updateMetricDefinition(orgInternalName:string, metric:StaticOrgScoreCardMetricDefinition):Promise<StaticOrgScoreCardMetricDefinition> {
    if(!metric.guid) {
        throw new Error('Metric ID not set.');
    }

    const settingName = 'orgScoreCard.staticMetrics';
    var existingSetting:any = await OrgSettingDAO.getSetting(orgInternalName, settingName);
    var metricsSetting = <{metrics:StaticOrgScoreCardMetricDefinition[]}>existingSetting.settingValue;
    if(!metricsSetting.metrics) {
        throw new Error('The metric does not exist in this org.');
    }

    var existingMetricIndex = metricsSetting.metrics.findIndex((md:StaticOrgScoreCardMetricDefinition) => md.guid == metric.guid);
    if(existingMetricIndex == -1) {
        console.log(metric);
        console.log(orgInternalName);
        throw new Error('The metric does not exist in this org.');
    }

    metric.createdAt = metricsSetting.metrics[existingMetricIndex].createdAt || new Date().getTime(); // take into account when we weren't setting create time and now set it.
    metric.lastUpdatedAt = new Date().getTime();
    metricsSetting.metrics[existingMetricIndex] = metric;

    let putResult = await OrgSettingDAO.putSetting(orgInternalName, settingName, metricsSetting);
    return metric;
}

export async function createMetricDefinition(orgInternalName:string, metric:StaticOrgScoreCardMetricDefinition):Promise<StaticOrgScoreCardMetricDefinition> {

    const settingName = 'orgScoreCard.staticMetrics';
    let metricsSetting = { 
        metrics: new Array<StaticOrgScoreCardMetricDefinition>()
    };

    try {
        var existingSetting:any = await OrgSettingDAO.getSetting(orgInternalName, settingName);
        metricsSetting = existingSetting.settingValue;
        if(!metricsSetting.metrics) 
            metricsSetting.metrics = new Array<StaticOrgScoreCardMetricDefinition>();
    }
    catch(error) {
        // We are setting the metric for the first time.
    }

    metric.guid = generateUniqueGuid(metricsSetting.metrics.map((m) => m.guid));
    metric.createdAt = new Date().getTime();
    metric.lastUpdatedAt = metric.createdAt;
    metricsSetting.metrics.push(metric);

    let putResult = await OrgSettingDAO.putSetting(orgInternalName, settingName, metricsSetting);
    return metric;
}

export async function getMetricDefinitions(orgInternalName:string):Promise<StaticOrgScoreCardMetricDefinition[]>
{
    const settingName = 'orgScoreCard.staticMetrics';
    var metricsSetting:any = await OrgSettingDAO.getSetting(orgInternalName, settingName);
    if(metricsSetting && metricsSetting.settingValue) {
        return metricsSetting.settingValue.metrics || [];
    }
    return [];
}

// orgInternalName:YYYY:MM:facilityId:metricName
// CHANGE TO ForOrg for clarity
export async function getStaticMetricsForOrg(orgInternalName:string, startDate:number, endDate:number):Promise<StaticOrgScoreCardMetricSample[]> {
    let ddbClient = createDynamoDbDocClient();
    var params = <AWS.DynamoDB.ScanInput> {
        TableName : process.env.DDB_TABLE_ORG_SCORECARD_METRICS,
        IndexName: process.env.DDB_TABLE_ORG_SCORECARD_METRICS_ORG_IDX,
        FilterExpression : 'metricTimestamp BETWEEN :startDate AND :endDate AND orgInternalName = :orgInternalName',
        ExpressionAttributeValues : {
            ':startDate' : startDate,
            ':endDate': endDate,
            ':orgInternalName': orgInternalName
        }
    };
    
    let result = await ddb.scanAll(
        params.TableName,
        params.FilterExpression,
        params.ExpressionAttributeValues,
        {
            IndexName: params.IndexName
        }
    );
    
    return <StaticOrgScoreCardMetricSample[]>result;
}

export async function setMetrics(orgInternalName:string, facilityId:number, year:number, month:number, samples:Array<{guid:string, value:number, goal:number}>) {

    var paddedYear = ("0000" + year).slice(-4);
    var paddedMonth = ("00" + month).slice(-2);
    var docClient = createDynamoDbDocClient();
    var now = new Date().getTime();

    var monthUtcTimestamp = DateUtil.getMonthUtcTimestamp(year, month);

    for(var sample of samples) {
        if(!sample.guid) {
            continue;
        }

        var metric = <StaticOrgScoreCardMetricSample>{
            metricKey: [orgInternalName,paddedYear,paddedMonth,facilityId,sample.guid].join(':'),
            sampleMonth: month,
            sampleYear: year,
            orgInternalName: orgInternalName,
            facilityId: facilityId,
            metricTimestamp: monthUtcTimestamp,
            createdAt: new Date().getTime(),
            lastUpdatedAt: new Date().getTime(),
            metricValue: sample.value,
            goal: sample.goal,
            goalVariance: (_.isNumber(sample.value) && _.isNumber(sample.goal) ? sample.value - sample.goal : null),
            metricGuid: sample.guid
        };

        var params = <AWS.DynamoDB.UpdateItemInput>{  
            TableName: process.env.DDB_TABLE_ORG_SCORECARD_METRICS,
            Key: {
                metricKey: metric.metricKey.toString()
            },
            UpdateExpression: 'set goal = :goal, goalVariance = :goalVariance, metricValue = :metricValue, lastUpdatedAt = :lastUpdatedAt, ' +
                                    'metricGuid = if_not_exists(metricGuid, :metricGuid),' +
                                    'orgInternalName = if_not_exists(orgInternalName, :orgInternalName),' +
                                    'facilityId = if_not_exists(facilityId, :facilityId),' +
                                    'sampleMonth = if_not_exists(sampleMonth, :sampleMonth),' +
                                    'sampleYear = if_not_exists(sampleYear, :sampleYear),' +
                                    'metricTimestamp = if_not_exists(metricTimestamp, :metricTimestamp),' +
                                    'createdAt = if_not_exists(createdAt, :now)',
            ExpressionAttributeValues: {
                ':goal': metric.goal,
                ':goalVariance': metric.goalVariance,
                ':metricValue': metric.metricValue,
                ':lastUpdatedAt': metric.lastUpdatedAt,
                ':metricGuid': metric.metricGuid,
                ':orgInternalName': metric.orgInternalName,
                ':facilityId': metric.facilityId,
                ':sampleMonth': metric.sampleMonth,
                ':sampleYear': metric.sampleYear,
                ':metricTimestamp': metric.metricTimestamp,
                ':now': now
            }
        };
        
        let result = await docClient.update(params).promise();
    }
}