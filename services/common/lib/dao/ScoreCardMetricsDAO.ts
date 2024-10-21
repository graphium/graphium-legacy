import Sequelize from 'sequelize';
import * as _ from 'lodash';
import * as moment from 'moment';
import * as Bluebird from 'bluebird';

import ScoreCardGoals from '../model/flow/ScoreCardGoals';
import ScoreCardMetricSample from '../model/flow/ScoreCardMetricSample';
import CalculatedScoreCardMetric from '../model/flow/CalculatedScoreCardMetric';
import ScoreCardFacilitySetting from '../model/flow/ScoreCardFacilitySetting';
import Facility from '../model/flow/Facility';
import FacilitySetting from '../model/flow/FacilitySetting';
import { Macra2017CaseData } from '../model/macra/Macra2017CaseData';
import { MetricCalculationResult } from '../model/flow/ScoreCardMetricDefinition';
import * as ScoreCardMetricDefinitions from '../model/flow/ScoreCardMetricDefinition';
import * as orgModels from '../model/OrgModels.js';
import * as FacilityDAO from '../dao/org/FacilityDAO.js';
import * as FacilitySettingDAO from '../dao/FacilitySettingDAO';
import * as OrgSettingDAO from '../dao/OrgSettingDAO';

var hstore = require('pg-hstore')();

export async function getScoreCardFacilitySettings(orgInternalName:string):Promise<ScoreCardFacilitySetting[]>
{
    const settingName = 'orgScoreCard.facilitySettings';
    var facilitySettingsSetting:any = await OrgSettingDAO.getSetting(orgInternalName, settingName);
    if(facilitySettingsSetting && facilitySettingsSetting.settingValue) {
        return facilitySettingsSetting.settingValue.facilitySettings || [];
    }
    return [];
}

export async function updateScoreCardFacilitySettings(orgInternalName:string, facilitySettings:ScoreCardFacilitySetting[]):Promise<boolean> {
    if(!_.isArray(facilitySettings)) {
        throw new Error('Must pass in an array of facility settings.');
    }

    const settingName = 'orgScoreCard.facilitySettings';
    let setting = {
        lastUpdatedAt: Date.now(),
        facilitySettings: facilitySettings
    };

    let putResult = await OrgSettingDAO.putSetting(orgInternalName, settingName, setting);
    return true;
}

export async function getSamplesForDateRange(orgInternalName:string, facilityIds:number[], startDate:string, endDate:string):Promise<ScoreCardMetricSample[]> {
    if (!orgInternalName) {
        throw new Error('Missing parameter orgInternalName.');
    }

    let facilityPredicate:string = '';

    if (facilityIds && facilityIds.length > 0)
    {
        facilityPredicate = `AND fac_id IN (${facilityIds})`;
    }

    var models = await orgModels.getModelsForOrg(orgInternalName);
    let samples = await orgModels.queryReadOnly(orgInternalName, `SELECT
    "org_id" AS "organizationId",
    "fac_id" AS "facilityId",
    "dos" AS "dateOfService",
    "case_cnt" AS "caseCount",
    "anes_mins" AS "anesthesiaMinutes",
    "surgn_tot_surgn_mins" AS "surgeonTurnoverTimeSurgeonMinutes",
    "surgn_tot_surgn_case_cnt" AS "surgeonTurnoverTimeSurgeonCount",
    "surgn_tot_locn_mins" AS "surgeonTurnoverTimeLocationMinutes",
    "surgn_tot_locn_case_cnt" AS "surgeonTurnoverTimeLocationCount",
    "wowi_mins" AS "wheelsOutWheelsInMinutes",
    "wowi_case_cnt" AS "wheelsOutWheelsInCount",
    "anes_tot_mins" AS "anesthesiaTurnoverTimeMinutes",
    "anes_tot_case_cnt" AS "anesthesiaTurnoverTimeCount",
    "anes_rdy_mins" AS "anesthesiaReadyMinutes",
    "surg_prep_mins" AS "surgicalPrepMinutes",
    "first_case_cnt" AS "firstCaseCount",
    "first_case_delay_cnt" AS "firstCaseDelayCount",
    "first_case_delay_mins" AS "firstCaseDelayMinutes",
    "icu_admission_cnt" AS "icuAdmissionCount",
    "pacu_admission_cnt" AS "pacuAdmissionCount",
    "general_anes_cnt" AS "generalAnesthesiaCount",
    "mac_anes_cnt" AS "macAnesthesiaCount",
    "regional_anes_cnt" AS "regionalAnesthesiaCount",
    "spinal_anes_cnt" AS "spinalAnesthesiaCount",
    "epidural_anes_cnt" AS "epiduraAnesthesiaCount",
    "labor_epidural_anes_cnt" AS "laborEpiduralAnesthesiaCount",
    "local_anes_cnt" AS "localAnesthesiaCount",
    "topical_anes_cnt" AS "topicalAnesthesiaCount",
    "safety_chklst_used_cnt" AS "safetyChecklistUsedCount",
    "handoff_proto_used_cnt" AS "handoffProtocolUsedCount",
    "inpatient_pat_cnt" AS "inpatientPatientCount",
    "ambulatory_pat_cnt" AS "ambulatoryPatientCount",
    "hypothermic_pat_cnt" AS "hypothermicPatientCount",
    "nonmajor_comp_cnt" AS "observationCount",
    "major_comp_cnt" AS "majorComplicationCount",
    "sameday_addon_cnt" AS "sameDayAddOnCount",
    "case_cancel_cnt" AS "cancelledCaseCount",
    "case_delay_cnt" AS "delayedCaseCount",
    "preop_prior_cnt" AS "preopPriorCount",
    "airway_lung_prot_vent_cnt" AS "lungVentilationCount",
    "prvr_attest_curr_med_cnt" AS "currentMedsDocumentCount",
    "ponv_high_risk_cnt" AS "ponvHighRiskCount",
    "comb_ther_cnt" AS "combinationTherapyCount",
    "asa_dist_list" AS "asaFrequencyDistribution",
    "age_dist_list" AS "ageFrequencyDistribution",
    "gender_dist_list" AS "genderFrequencyDistribution",
    "pain_score_dist_list" AS "painScoreFrequencyDistribution",
    "locn_util" AS "locationUtilization",
    "hourly_or_util" AS "hourlyORUtilization",
    ARRAY_TO_JSON(comp_list) AS "complicationsList",
    ARRAY_TO_JSON(delay_rsn_list) AS "delayReasonsList",
    ARRAY_TO_JSON(cancel_rsn_list) AS "cancelReasonsList",
    "ins_dttm" AS "insertTimestamp",
    "upd_dttm" AS "lastUpdateTimestamp",
    "aud_ver" AS "auditVersion"
  FROM "scorecard_metrics" AS "ScoreCardMetric"
  WHERE "ScoreCardMetric"."dos" BETWEEN '${startDate}' AND '${endDate}' ${facilityPredicate};`, { type: Sequelize.QueryTypes.SELECT});
    //console.log(samples);
    /*let samples2:any = await models.ScoreCardMetric.findAll({
        logging: console.log,
        where: { 
            dos: {
                $gte: startDate,
                $lte: endDate
            }
        }
    });*/

    return samples.map((sampleEntity) => { 
        var sample = <ScoreCardMetricSample> sampleEntity;
        var isoWeekday = moment.utc(sample.dateOfService).isoWeekday();
        sample.isoWeekdayIndex = isoWeekday;
        sample.isWeekday = isoWeekday <= 5 && isoWeekday >= 1;
        return sample;
    });
}

export async function getFacilityComplicationsForDateRange(orgInternalName:string, facilityIds:number[], startDate:string, endDate:string):Promise<ScoreCardMetricSample[]> {
    if (!orgInternalName) {
        throw new Error('Missing parameter orgInternalName.');
    }

    let facilityClause = ``;
    if (facilityIds && facilityIds.length > 0) {
        facilityClause = `AND fac_id IN (${facilityIds})`;
    }
    
    let query = `WITH
    complications AS (
       SELECT org_id,
              fac_id,
              dos,
              UNNEST(comp_list) AS comps
            FROM scorecard_metrics
            WHERE dos BETWEEN '${startDate}' AND '${endDate}'
            ${facilityClause}
    )
    SELECT org_id,
           fac_id,
           dos,
           comps->'comp_catg' AS comp_catg,           -- string
           comps->'comp_nm' AS comp_nm,               -- string
           comps->'comp_desc' AS comp_desc,           -- string
           comps->'major_comp_ind' AS major_comp_ind, -- boolean
           comps->'anes_prvr_list' AS anes_prvr_list  -- semicolon-delimited string
      FROM complications
     
     ORDER BY 1,2,3,4,5,6;`;
    
     let queryOptions = { 
         type: Sequelize.QueryTypes.SELECT,
         replacements: {
            facilityIds: facilityIds,
          }
    }

    let complications = await orgModels.queryReadOnly(orgInternalName, query, queryOptions);

    return complications;
}

export interface ProvidedData {
    samples?: ScoreCardMetricSample[],
    facilityGoalsSettings?: FacilitySetting[],
    facilityScorecardSettings?: ScoreCardFacilitySetting[],
    facilities?: Facility[],
    macraSamples?: Macra2017CaseData[]
}

// Consider renaming to reflect ability to handle org and single facility
export async function calculateMetricsForOrg(
    orgInternalName: string,
    facilityIds: number[],
    providedData: ProvidedData,
    startDate: string,
    endDate: string,
    enforceRollup: boolean = true,
    runTrend: boolean = false
): Promise<{
    samples: ScoreCardMetricSample[];
    metrics: CalculatedScoreCardMetric[];
}> {
    let trendSamples;
    let monthsInTrend: number = 6;
    let samples: ScoreCardMetricSample[];

    if (providedData && providedData.samples) samples = providedData.samples;
    else
        samples = await getSamplesForDateRange(
            orgInternalName,
            facilityIds,
            startDate,
            endDate
        );

    if (runTrend) {
        trendSamples = await Bluebird.map(_.range(monthsInTrend), (month) => {
            return getSamplesForDateRange(
                orgInternalName,
                facilityIds,
                moment(startDate)
                    .subtract(month + 1, 'months')
                    .format('YYYY-MM-DD'),
                moment(endDate)
                    .subtract(month + 1, 'months')
                    .format('YYYY-MM-DD')
            );
        });
    }

    let calculatedMetrics = new Array<CalculatedScoreCardMetric>();
    let facilityGoalsSettings: FacilitySetting[];
    let facilityScorecardSettings: ScoreCardFacilitySetting[];
    let facilities: Facility[];
    let prefetchDataPromises = [];
    
    prefetchDataPromises.push(
        (providedData && providedData.facilityGoalsSettings) 
            ? providedData.facilityGoalsSettings
            : FacilitySettingDAO.getAllSettingsForOrg(
                orgInternalName,
                'facilityGoals'
            )
    );

    prefetchDataPromises.push(
        (providedData && providedData.facilityScorecardSettings)
            ? providedData.facilityScorecardSettings
            : getScoreCardFacilitySettings(
                orgInternalName
            )
    );

    prefetchDataPromises.push(
        (providedData && providedData.facilities)
            ? providedData.facilities
            : FacilityDAO.getFacilities(orgInternalName)
    );

    let prefetchData = await Bluebird.all(prefetchDataPromises);
    facilityGoalsSettings = prefetchData[0];
    facilityScorecardSettings = prefetchData[1];
    facilities = prefetchData[2]

    if (facilityIds && facilityIds.length > 0) {
        facilities = facilities.filter((facility: Facility) => {
            return facilityIds.indexOf(facility.facilityId) !== -1;
        });
    }

    for (var facility of facilities) {
        let facilityGoalsSetting = _.find<FacilitySetting>(facilityGoalsSettings, {
            facilityId: facility.facilityId
        });
        let rollupFacilityIds = [];

        if (enforceRollup === true) {
            rollupFacilityIds = facilityScorecardSettings
                .filter(
                    (setting) => setting.rollupToFacility == facility.facilityId
                )
                .map((setting) => setting.facilityId);
        }

        if (rollupFacilityIds.indexOf(facility.facilityId) > -1) {
            continue;
        }
        if (!facilityGoalsSetting) continue;
        if (!samples) continue;

        let facilityTrendSamples;
        let facilitySamples = samples.filter((sample, index, array) => {
            return (
                sample.facilityId == facility.facilityId ||
                rollupFacilityIds.indexOf(sample.facilityId) >= 0
            );
        });

        if (runTrend) {
            facilityTrendSamples = [];
            for (let i = 0; i < monthsInTrend; i++) {
                facilityTrendSamples.push(
                    trendSamples[i].filter((sample) => {
                        return (
                            sample.facilityId == facility.facilityId ||
                            rollupFacilityIds.indexOf(sample.facilityId) >= 0
                        );
                    })
                );
            }
        }

        for (let definition of ScoreCardMetricDefinitions.ScoreCardMetricDefinitions) {
            let calculatedTrends: MetricCalculationResult[] = [];
            let calculatedMetric = definition.calculateMetric(
                facilitySamples,
                JSON.parse(facilityGoalsSetting.settingValue),
                startDate,
                endDate
            );
            if (runTrend) {
                for (let i = 0; i < monthsInTrend; i++) {
                    const newStartDate: moment.Moment = moment(
                        startDate
                    ).subtract(i + 1, 'months');
                    const newEndDate: moment.Moment = moment(
                        newStartDate
                    ).endOf('month');
                    calculatedTrends.push(
                        definition.calculateMetric(
                            facilityTrendSamples[i],
                            JSON.parse(facilityGoalsSetting.settingValue),
                            newStartDate.format('YYYY-MM-DD'),
                            newEndDate.format('YYYY-MM-DD')
                        )
                    );
                }
            }

            let trendData = null;

            if (calculatedTrends.length > 0) {
                trendData = [
                    calculatedTrends[5].value,
                    calculatedTrends[4].value,
                    calculatedTrends[3].value,
                    calculatedTrends[2].value,
                    calculatedTrends[1].value,
                    calculatedTrends[0].value,
                    calculatedMetric.value
                ];
            }

            let metric = <CalculatedScoreCardMetric>{
                orgInternalName: orgInternalName,
                facilityId: facility.facilityId,
                facilityName: facility.facilityName,
                metricDefinition: definition,
                startDate: moment(startDate).toDate(),
                endDate: moment(endDate).toDate(),
                metricValue: calculatedMetric.value,
                goal: calculatedMetric.goal,
                goalVarianceValue: calculatedMetric.variance,
                goalValue: calculatedMetric.goalValue,
                trend: trendData,
                detail: calculatedMetric.detail,
                inverted: calculatedMetric.inverted,
            };
            calculatedMetrics.push(metric);
        }
    }

    return {
        samples: samples,
        metrics: calculatedMetrics
    };
}

// DEPRECATED - calculateMetricsForOrg can now handle single facility calls
// Delete once satisfied with changes to calculateMetricsForOrg
/*export async function calculateMetricsForFacility(orgInternalName:string, facilityId:number, startDate:string, endDate:string):Promise<{metrics:CalculatedScoreCardMetric[]}> {
    let samples = await getSamplesForDateRange(orgInternalName, startDate, endDate);
    let facilityGoalsSettings = await FacilitySettingDAO.getAllSettingsForOrg(orgInternalName, 'facilityGoals');
    let facilityGoalsSetting:any = _.find(facilityGoalsSettings, {facilityId: facilityId});
    let facilityScorecardSettings = await getScoreCardFacilitySettings(orgInternalName);
    let facilities = await FacilityDAO.getFacilities(orgInternalName);
    let facility = _.find<Facility>(facilities, {facilityId: facilityId});
    let rollupFacilityIds = facilityScorecardSettings.filter((setting) => setting.rollupToFacility == facility.facilityId).map((setting) => setting.facilityId);
    console.log(facilityScorecardSettings);
    let calculatedMetrics = new Array<CalculatedScoreCardMetric>();
    
    if(!facilityGoalsSetting) throw new Error('No Facility Goals Found.');
    if(!samples) return;

    let facilitySamples = samples.filter((sample, index, array) => { return sample.facilityId == facility.facilityId || rollupFacilityIds.indexOf(sample.facilityId) >= 0 });

    for( var definition of ScoreCardMetricDefinitions.ScoreCardMetricDefinitions ) {
        var calculatedMetric = definition.calculateMetric(facilitySamples, JSON.parse(facilityGoalsSetting.settingValue), startDate, endDate);

        let metric = <CalculatedScoreCardMetric> {
            orgInternalName: orgInternalName,
            facilityId: facilityId,
            facilityName: facility.facilityName,
            metricDefinition: definition,
            startDate: moment(startDate).toDate(),
            endDate: moment(endDate).toDate(),
            metricValue: calculatedMetric.value,
            goalVarianceValue: calculatedMetric.variance,
            goalValue: calculatedMetric.goal,
            detail: calculatedMetric.detail,
        };
        calculatedMetrics.push(metric);
    }
    
    return {
        metrics: calculatedMetrics,
    }
}*/