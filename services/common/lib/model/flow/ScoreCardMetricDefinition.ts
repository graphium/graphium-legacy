import { ScoreCardGoals, getGoalsForDate } from './ScoreCardGoals';
import ScoreCardMetricSample from './ScoreCardMetricSample'

import * as moment from 'moment';
import * as _ from 'lodash';
var hstore = require('pg-hstore')();

export interface MetricCalculationResult {
    value: number,
    goal:number,
    goalValue: number,
    variance: number,
    detail: string,
    inverted: boolean,
}

export interface ScoreCardMetricDefinition {
    category: string,
    title: string,
    name: string,
    valueUnit: string,
    goalUnit: string,
    calculateMetric(samples:Object[], goals:ScoreCardGoals, startDate:string, endDate:string): MetricCalculationResult,
};

export let ScoreCardMetricDefinitions:ScoreCardMetricDefinition[] = [
    {
        category: "Outcomes",
        title: "Major",
        name: "outcomes:major",
        valueUnit: "%",
        goalUnit: "%",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {
            
            var totalComplications = null;
            var totalCaseCount = null;

            for(var sample of samples) {
                totalComplications += sample.majorComplicationCount;
                totalCaseCount += sample.caseCount;
            }
            
            var complicationGoal = totalCaseCount * (goals.majorComplications/100);

            return {
                value: totalComplications / totalCaseCount,
                goal: goals.majorComplications / 100,
                goalValue: goals.majorComplications / 100,
                variance: (goals.majorComplications / 100) - (totalComplications / totalCaseCount),
                detail: null,
                inverted: false,
            }
        },
    },
    {
        category: "Outcomes",
        title: "Observations",
        name: "outcomes:observations",
        valueUnit: "%",
        goalUnit: "%",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {
            var totalObservations = null;
            var totalCaseCount = null;

            for(var sample of samples) {
                totalObservations += sample.observationCount;
                totalCaseCount += sample.caseCount;
            }

            var observationsGoal = totalCaseCount * (goals.observationRate/100);

            return {
                value: totalObservations / totalCaseCount,
                goal: goals.observationRate / 100,
                goalValue: goals.observationRate / 100,
                variance: (goals.observationRate / 100) - (totalObservations / totalCaseCount),
                detail: null,
                inverted: false,
            }

        },
    },
    {
        category: "Outcomes",
        title: "Details",
        name: "outcomes:details",
        valueUnit: "String",
        goalUnit: "String",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {
            let complications:string[] = [];

            for(var sample of samples) {
                if (sample.complicationsList) {
                    let descriptions = sample.complicationsList.map((current) => {
                        if(current.hasOwnProperty('comp_desc')) {
                            return current["comp_desc"];
                        }
                        else {
                            let parsedValue = hstore.parse(current);
                            return parsedValue.comp_desc;
                        }
                    });
                    complications = complications.concat(descriptions);
                }
            }

            return {
                value: null,
                goal: null,
                goalValue: null,
                variance: null,
                detail: complications.join(', '),
                inverted: false,
            }

        },
    },
    {
        category: "Quality",
        title: "Handoff Protocol Used",
        name: "quality:handoffprotocol",
        valueUnit: "%",
        goalUnit: "",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {
            let totalHandoffs = null;
            let totalCaseCount = null;

            for(var sample of samples) {
                totalHandoffs += sample.handoffProtocolUsedCount;
                totalCaseCount += sample.caseCount;
            }

            return {
                value: (totalHandoffs / totalCaseCount),
                goal: null,
                goalValue: null,
                variance: null,
                detail: `(${totalHandoffs} / ${totalCaseCount})`,
                inverted: false,
            }

        },
    },
    {
        category: "Quality",
        title: "PostOp Pain Control",
        name: "quality:postoppain",
        valueUnit: "%",
        goalUnit: "",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {
            let total = null;
            let totalCaseCount = null;
            
            for(var sample of samples) {
                let painUnder7 = JSON.parse(sample.painScoreFrequencyDistribution).reduce((sum:number, current:any) => {
                    return (
                        sum +
                        current.pain_score_0 +
                        current.pain_score_1 +
                        current.pain_score_2 +
                        current.pain_score_3 + 
                        current.pain_score_4 +
                        current.pain_score_5 +
                        current.pain_score_6 +
                        current.pain_score_unknown
                    );
                }, 0);
                total += painUnder7;
                totalCaseCount += sample.caseCount;
            }

            return {
                value: (total / totalCaseCount),
                goal: null,
                goalValue: null,
                variance: null,
                detail: `(${total} / ${totalCaseCount})`,
                inverted: false,
            }

        },
    },
    {
        category: "Quality",
        title: "Normothermia",
        name: "quality:normothermia",
        valueUnit: "%",
        goalUnit: "",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {
            let totalHypothermic = null;
            let totalCaseCount = null;
            
            
            for(var sample of samples) {
                totalHypothermic += sample.hypothermicPatientCount;
                totalCaseCount += sample.caseCount;
            }
            
            return {
                value: (1 - (totalHypothermic / totalCaseCount)),
                goal: null,
                goalValue: null,
                variance: null,
                detail: `(${totalCaseCount - totalHypothermic} / ${totalCaseCount})`,
                inverted: false,
            }

        },
    },
    {
        category: "Quality",
        title: "Safety Checklist Used",
        name: "quality:safetychecklist",
        valueUnit: "%",
        goalUnit: "",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {
            let total = null;
            let totalCaseCount = null;
            
            for(var sample of samples) {
                total += sample.safetyChecklistUsedCount;
                totalCaseCount += sample.caseCount;
            }

            return {
                value: (total / totalCaseCount),
                goal: null,
                goalValue: null,
                variance: null,
                detail: `(${total} / ${totalCaseCount})`,
                inverted: false,
            }

        },
    },
    {
        category: "Quality",
        title: "Protective Lung Ventilation",
        name: "quality:lungventilation",
        valueUnit: "%",
        goalUnit: "",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {
            let totalLungVentilationCount = null;
            let totalCaseCount = null;

            for(var sample of samples) {
                totalLungVentilationCount += sample.lungVentilationCount;
                totalCaseCount += sample.caseCount;
            }

            return {
                value: (totalLungVentilationCount / totalCaseCount),
                goal: null,
                goalValue: null,
                variance: null,
                detail: `(${totalLungVentilationCount} / ${totalCaseCount})`,
                inverted: false,
            }

        },
    },
    {
        category: "Quality",
        title: "Current Medications Documented",
        name: "quality:currentmedsdocumented",
        valueUnit: "%",
        goalUnit: "",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {
            let totalMedsDocumentedCount = null;
            let totalCaseCount = null;

            for(var sample of samples) {
                totalMedsDocumentedCount += sample.currentMedsDocumentCount;
                totalCaseCount += sample.caseCount;
            }

            return {
                value: (totalMedsDocumentedCount / totalCaseCount),
                goal: null,
                goalValue: null,
                variance: null,
                detail: `(${totalMedsDocumentedCount} / ${totalCaseCount})`,
                inverted: false,
            }

        },
    },
    {
        category: "Quality",
        title: "PONV Combination Therapy",
        name: "quality:ponvcombotherapy",
        valueUnit: "%",
        goalUnit: "",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {
            let totalPONVHighRiskCount = null;
            let totalComboTherapyCount = null;

            for(var sample of samples) {
                totalPONVHighRiskCount += sample.ponvHighRiskCount;
                totalComboTherapyCount += sample.combinationTherapyCount;
            }

            return {
                value: (totalComboTherapyCount / totalPONVHighRiskCount),
                goal: null,
                goalValue: null,
                variance: null,
                detail: `(${totalComboTherapyCount} / ${totalPONVHighRiskCount})`,
                inverted: false,
            }

        },
    },
    
    {
        category: "Productivity",
        title: "Cases",
        name: "productivity:cases",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {
            var totalCaseCount = null;
            var totalGoal = null;
            let dateMap = new Map();
            
            for(var sample of samples) {
                let timeSpecificGoals = null;

                if (dateMap.has(sample.dateOfService) === false) {
                    timeSpecificGoals = getGoalsForDate(sample.dateOfService, null, goals);
                    dateMap.set(sample.dateOfService, '');
                }
                
                totalGoal += timeSpecificGoals ? timeSpecificGoals.caseVolume : 0;
                totalCaseCount += sample.caseCount;
            }
            
            
            return {
                value: totalCaseCount,
                goal: null,
                goalValue: totalGoal,
                variance: totalCaseCount - totalGoal,
                detail: null,
                inverted: false,
            }

        }
    },
    
    {
        category: "Productivity",
        title: "By Case Revenue",
        name: "productivity:cases:revenueOpportunity",
        valueUnit: "$",
        goalUnit: "$",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {
            let totalRevenue = null;
            let totalRevenueGoal = null;
            let dateMap = new Map();

            for(var sample of samples) {
                let timeSpecificGoals = null;
                
                if (dateMap.has(sample.dateOfService) === false) {
                    timeSpecificGoals = getGoalsForDate(sample.dateOfService, null, goals);
                    dateMap.set(sample.dateOfService, '');
                }
                
                totalRevenue += sample.caseCount * goals.anesRevenuePerCase;
                totalRevenueGoal += (timeSpecificGoals ? timeSpecificGoals.caseVolume : 0) * goals.anesRevenuePerCase;
            }

            return {
                value: totalRevenue,
                goal: null,
                goalValue: totalRevenueGoal,
                variance: totalRevenue - totalRevenueGoal,
                detail: null,
                inverted: false,
            }
        },
    },
    {
        category: "Productivity",
        title: "Minutes",
        name: "productivity:minutes",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {
            let totalAnesMinutes = null;
            let totalGoal = null;
            let dateMap = new Map();

            for(var sample of samples) {
                let timeSpecificGoals = null;
                
                if (dateMap.has(sample.dateOfService) === false) {
                    timeSpecificGoals = getGoalsForDate(sample.dateOfService, null, goals);
                    dateMap.set(sample.dateOfService, '');
                }

                totalGoal += timeSpecificGoals ? timeSpecificGoals.anesthesiaMinutes : 0;
                totalAnesMinutes += parseFloat(sample.anesthesiaMinutes) || 0;
            }

            return {
                value: totalAnesMinutes,
                goal: null,
                goalValue: totalGoal,
                variance: totalAnesMinutes - totalGoal,
                detail: null,
                inverted: false,
            }

        }
    },
    {
        category: "Productivity",
        title: "By Minute Revenue",
        name: "productivity:minutes:revenueOpportunity",
        valueUnit: "$",
        goalUnit: "$",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {
            let totalRevenue = null;
            let totalGoal = null;
            let dateMap = new Map();

            for(var sample of samples) {
                let timeSpecificGoals = null;
                
                if (dateMap.has(sample.dateOfService) === false) {
                    timeSpecificGoals = getGoalsForDate(sample.dateOfService, null, goals);
                    dateMap.set(sample.dateOfService, '');
                }

                totalRevenue += (parseFloat(sample.anesthesiaMinutes) || 0) * goals.anesRevenuePerORMin;
                totalGoal += (timeSpecificGoals ? timeSpecificGoals.anesthesiaMinutes : 0) * goals.anesRevenuePerORMin;
            }

            return {
                value: totalRevenue,
                goal: null,
                goalValue: totalGoal,
                variance: totalRevenue - totalGoal,
                detail: null,
                inverted: false,
            }
        },
    },
    {
        category: "Efficiency",
        title: "Surgeon ToT (Flip Flop)",
        name: "efficiency:surgeontot:flipflop",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalSurgeonTot = null;
            let totalCaseCount = null;

            for(var sample of samples) {
                totalSurgeonTot += (parseFloat(sample.surgeonTurnoverTimeSurgeonMinutes) || 0) * sample.surgeonTurnoverTimeSurgeonCount;
                totalCaseCount += sample.surgeonTurnoverTimeSurgeonCount;
            }

            return {
                value: totalSurgeonTot / totalCaseCount,
                goal: goals.surgeonToTFlipFlop,
                goalValue: goals.surgeonToTFlipFlop,
                variance: goals.surgeonToTFlipFlop - (totalSurgeonTot / totalCaseCount),
                detail: null,
                inverted: false,
            }
        },
    },
    {
        category: "Efficiency",
        title: "Surgeon ToT",
        name: "efficiency:surgeontot",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalSurgeonTotLoc = null;
            let totalCaseCount = null;

            for(var sample of samples) { 
                totalSurgeonTotLoc += (parseFloat(sample.surgeonTurnoverTimeLocationMinutes) || 0) * (sample.surgeonTurnoverTimeLocationCount || 0);
                totalCaseCount += sample.surgeonTurnoverTimeLocationCount;
            }

            return {
                value: totalSurgeonTotLoc / totalCaseCount,
                goal: goals.surgeonToT,
                goalValue: goals.surgeonToT,
                variance: goals.surgeonToT - (totalSurgeonTotLoc / totalCaseCount),
                detail: null,
                inverted: false,
            }
        },
    },
    {
        category: "Efficiency",
        title: "Surgical Prep Minutes",
        name: "efficiency:surgicalprepmin",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalMin = null;
            let totalCases = null;

            for(var sample of samples) { 
                totalMin += sample.surgicalPrepMinutes;
                if (sample.surgicalPrepMinutes) {
                    totalCases += sample.caseCount;
                }
            }

            return {
                value: totalMin / totalCases,
                goal: goals.surgicalPrepMin,
                goalValue: goals.surgicalPrepMin,
                variance: goals.surgicalPrepMin - totalMin / totalCases,
                detail: null,
                inverted: false,
            }
        },
    },
    {
        category: "Efficiency",
        title: "Wo/Wi",
        name: "efficiency:wowi",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalWoWi = null;
            let totalCaseCount = null;

            for(var sample of samples) {
                totalWoWi += (parseFloat(sample.wheelsOutWheelsInMinutes) || 0) * (sample.wheelsOutWheelsInCount || 0);
                totalCaseCount += sample.wheelsOutWheelsInCount;
            }

            return {
                value: totalWoWi / totalCaseCount,
                goal: goals.wowi,
                goalValue: goals.wowi,
                variance: goals.wowi - (totalWoWi / totalCaseCount),
                detail: null,
                inverted: false,
            }
        },
    },
    {
        category: "Efficiency",
        title: "Anesthesia ToT",
        name: "efficiency:anestot",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalAnesTot = null;
            let totalCaseCount = null;

            for(var sample of samples) {
                totalAnesTot += (parseFloat(sample.anesthesiaTurnoverTimeMinutes) || 0) * (sample.anesthesiaTurnoverTimeCount || 0);
                totalCaseCount += sample.anesthesiaTurnoverTimeCount;
            }

            return {
                value: totalAnesTot / totalCaseCount,
                goal: goals.anesToT,
                goalValue: goals.anesToT,
                variance: goals.anesToT - (totalAnesTot / totalCaseCount),
                detail: null,
                inverted: false,
            }
        },
    },
    {
        category: "Efficiency",
        title: "Anesthesia Ready",
        name: "efficiency:anesready",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalAnesReady = null;
            let totalCases = null;

            for(var sample of samples) {
                totalAnesReady += sample.anesthesiaReadyMinutes;
                totalCases += sample.caseCount;
            }

            return {
                value: totalAnesReady/totalCases,
                goal: goals.anesReady,
                goalValue: goals.anesReady,
                variance: goals.anesReady - (totalAnesReady/totalCases),
                detail: null,
                inverted: false,
            }
        },
    },
    {
        category: "Utilization",
        title: "Prime Time",
        name: "utilization:primetime",
        valueUnit: "%",
        goalUnit: "%",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            const primeTimes = ["07:00:00", "08:00:00", "09:00:00", "10:00:00", "11:00:00", "12:00:00", "13:00:00", "14:00:00"];
            let totalPrimeTimeORMin = null;
            let availablePrimeTimeORMin = null;
            let weekDayCount = null;

            // find total number of weekdays in data range
            const stopDate = moment().utcOffset(-6).isBefore(endDate) ? moment().subtract(1, 'day').format('YYYY-MM-DD') : endDate;
            const days:number = moment(stopDate).diff(moment(startDate), 'days');
            for (let i = 0; i <= days; i++) {
                let isoWeekdayIndex = moment(startDate).add(1*i, 'd').isoWeekday();
                if (isoWeekdayIndex <= 5 && isoWeekdayIndex >= 1) {
                    weekDayCount++;
                } 
            }

            // calculate total prime time OR mins
            for(var sample of samples) {
                let parsedHourlyOrUtilization = JSON.parse(sample.hourlyORUtilization);
                if(parsedHourlyOrUtilization) {
                    totalPrimeTimeORMin += parsedHourlyOrUtilization
                                            .filter((current:any) => {
                                                let weekdayIndex = moment(current.proc_dt).isoWeekday();
                                                return primeTimes.indexOf(current.blk) > -1 && (weekdayIndex <= 5 && weekdayIndex >= 1);
                                            })
                                            .map((current:any) => { return current.or_mins })
                                            .reduce((total, current) => { return total + current }, 0);
                }
            }

            // calculate total available prime time OR mins
            availablePrimeTimeORMin = ( goals.weekdayBudgetedORSites07_08 +
                                        goals.weekdayBudgetedORSites08_09 +
                                        goals.weekdayBudgetedORSites09_10 +
                                        goals.weekdayBudgetedORSites10_11 +
                                        goals.weekdayBudgetedORSites11_12 +
                                        goals.weekdayBudgetedORSites12_13 +
                                        goals.weekdayBudgetedORSites13_14 +
                                        goals.weekdayBudgetedORSites14_15 ) * 60 * weekDayCount;
            
            const primeTimeUtilization = (totalPrimeTimeORMin / availablePrimeTimeORMin);
            
            return {
                value: primeTimeUtilization,
                goal: goals.utilization07_15 / 100,
                goalValue: goals.utilization07_15 / 100,
                variance: primeTimeUtilization - (goals.utilization07_15 / 100),
                detail: null,
                inverted: false,
            }
        },
    },
    {
        category: "Utilization",
        title: "Cost of Under Utilization",
        name: "utilization:primetime:revenuelost",
        valueUnit: "$",
        goalUnit: "$",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            const primeTimes = ["07:00:00", "08:00:00", "09:00:00", "10:00:00", "11:00:00", "12:00:00", "13:00:00", "14:00:00"];
            let totalPrimeTimeORMin = null;
            let availablePrimeTimeORMin = null;
            let weekDayCount = null;

            // find total number of weekdays in date range
            const stopDate = moment().utcOffset(-6).isBefore(endDate) ? moment().subtract(1, 'day').format('YYYY-MM-DD') : endDate;
            const days:number = moment(stopDate).diff(moment(startDate), 'days');
            for (let i = 0; i <= days; i++) {
                let isoWeekdayIndex = moment(startDate).add(1*i, 'd').isoWeekday();
                if (isoWeekdayIndex <= 5 && isoWeekdayIndex >= 1) {
                    weekDayCount++;
                } 
            }

            // calculate total prime time OR mins
            for(var sample of samples) {
                let parsedHourlyOrUtilization = JSON.parse(sample.hourlyORUtilization);
                if(parsedHourlyOrUtilization) {
                    totalPrimeTimeORMin += parsedHourlyOrUtilization
                                            .filter((current:any) => {
                                                let weekdayIndex = moment(current.proc_dt).isoWeekday();
                                                return primeTimes.indexOf(current.blk) > -1 && (weekdayIndex <= 5 && weekdayIndex >= 1);
                                            })
                                            .map((current:any) => { return current.or_mins })
                                            .reduce((total, current) => { return total + current }, 0);
                }
            }

            // calculate total available prime time OR mins
            availablePrimeTimeORMin = ( goals.weekdayBudgetedORSites07_08 +
                                        goals.weekdayBudgetedORSites08_09 +
                                        goals.weekdayBudgetedORSites09_10 +
                                        goals.weekdayBudgetedORSites10_11 +
                                        goals.weekdayBudgetedORSites11_12 +
                                        goals.weekdayBudgetedORSites12_13 +
                                        goals.weekdayBudgetedORSites13_14 +
                                        goals.weekdayBudgetedORSites14_15 ) * 60 * weekDayCount;
            
            const primeTimeUtilization = (totalPrimeTimeORMin / availablePrimeTimeORMin);

            return {
                value: ((primeTimeUtilization - (goals.utilization07_15 / 100)) * availablePrimeTimeORMin * goals.hospitalCostPerORMin) * -1,
                goal: null,
                goalValue: null,
                variance: null,
                detail: null,
                inverted: true,
            }
        },
    },
    {
        category: "Utilization",
        title: "Morning (00:00-07:00)",
        name: "utilization:morning",
        valueUnit: "%",
        goalUnit: "%",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            const targetTimes = ["00:00:00", "01:00:00", "02:00:00", "03:00:00", "04:00:00", "05:00:00", "06:00:00"];
            let totalMorningORMin = null;
            let availableMorningORMin = null;
            let weekDayCount = null;

            // find total number of weekdays in data range
            const days:number = moment(endDate).diff(moment(startDate), 'days');
            for (let i = 0; i <= days; i++) {
                let isoWeekdayIndex = moment(startDate).add(1*i, 'd').isoWeekday();
                if (isoWeekdayIndex <= 5 && isoWeekdayIndex >= 1) {
                    weekDayCount++;
                } 
            }

            // calculate total prime time OR mins
            for(var sample of samples) {
                let parsedHourlyOrUtilization = JSON.parse(sample.hourlyORUtilization);
                if(parsedHourlyOrUtilization) {
                    totalMorningORMin += parsedHourlyOrUtilization
                                            .filter((current:any) => { return targetTimes.indexOf(current.blk) > -1 })
                                            .map((current:any) => { return current.or_mins })
                                            .reduce((total, current) => { return total + current }, 0);
                }
            }
            // calculate total available prime time OR mins
            availableMorningORMin = ( goals.weekdayBudgetedORSites00_01 +
                                        goals.weekdayBudgetedORSites01_02 +
                                        goals.weekdayBudgetedORSites02_03 +
                                        goals.weekdayBudgetedORSites03_04 +
                                        goals.weekdayBudgetedORSites04_05 +
                                        goals.weekdayBudgetedORSites05_06 +
                                        goals.weekdayBudgetedORSites06_07 ) * 60 * weekDayCount;
            
            const morningUtilization = (totalMorningORMin !== null)
                                        ? (totalMorningORMin / availableMorningORMin)
                                        : null;
            
            return {
                value: morningUtilization,
                goal: goals.utilization00_07 / 100,
                goalValue: goals.utilization00_07 / 100,
                variance: morningUtilization - (goals.utilization00_07 / 100),
                detail: null,
                inverted: false,
            }
        },
    },
    {
        category: "Utilization",
        title: "Evening (15:00-24:00)",
        name: "utilization:evening",
        valueUnit: "%",
        goalUnit: "%",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            const targetTimes = ["15:00:00", "16:00:00", "17:00:00", "18:00:00", "19:00:00", "20:00:00", "21:00:00", "22:00:00", "23:00:00"];
            let totalEveningORMin = null;
            let availableEveningORMin = null;
            let weekDayCount = null;

            // find total number of weekdays in data range
            const days:number = moment(endDate).diff(moment(startDate), 'days');
            for (let i = 0; i <= days; i++) {
                let isoWeekdayIndex = moment(startDate).add(1*i, 'd').isoWeekday();
                if (isoWeekdayIndex <= 5 && isoWeekdayIndex >= 1) {
                    weekDayCount++;
                } 
            }
            
            // calculate total prime time OR mins
            for(var sample of samples) {
                let parsedHourlyOrUtilization = JSON.parse(sample.hourlyORUtilization);
                if(parsedHourlyOrUtilization) {
                    totalEveningORMin += parsedHourlyOrUtilization
                                            .filter((current:any) => { return targetTimes.indexOf(current.blk) > -1 })
                                            .map((current:any) => { return current.or_mins })
                                            .reduce((total, current) => { return total + current }, 0);
                }
            }

            // calculate total available prime time OR mins
            availableEveningORMin = (   goals.weekdayBudgetedORSites15_16 +
                                        goals.weekdayBudgetedORSites16_17 +
                                        goals.weekdayBudgetedORSites17_18 +
                                        goals.weekdayBudgetedORSites18_19 +
                                        goals.weekdayBudgetedORSites19_20 +
                                        goals.weekdayBudgetedORSites20_21 +
                                        goals.weekdayBudgetedORSites21_22 +
                                        goals.weekdayBudgetedORSites22_23 +
                                        goals.weekdayBudgetedORSites23_00 ) * 60 * weekDayCount;
            
            const eveningUtilization = (totalEveningORMin !== null)
                                        ? (totalEveningORMin / availableEveningORMin)
                                        : null;
            
            return {
                value: eveningUtilization,
                goal: goals.utilization15_00 / 100,
                goalValue: goals.utilization15_00 / 100,
                variance: eveningUtilization - (goals.utilization15_00 / 100),
                detail: null,
                inverted: false,
            }
        },
    },
    {
        category: "Throughput",
        title: "No of First Cases",
        name: "throughput:firstcases",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {
            let totalFirstCaseCount = null;
            let totalGoal = null;
            
            for(var sample of samples) {
                totalFirstCaseCount += sample.firstCaseCount;
            }

            return {
                value: totalFirstCaseCount,
                goal: null,
                goalValue: null,
                variance: null,
                detail: null,
                inverted: false,
            }
        },
    },
    {
        category: "Throughput",
        title: "First Case On Time Start Rate",
        name: "throughput:firstcase:delays",
        valueUnit: "%",
        goalUnit: "%",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalFirstCaseDelays = null;
            let totalFirstCases = null;

            for(var sample of samples) {
                totalFirstCaseDelays += sample.firstCaseDelayCount;
                totalFirstCases += sample.firstCaseCount;
            }

            var onTimeStartRate = (1 - totalFirstCaseDelays/totalFirstCases);
            var onTimeStartGoal = goals.firstCaseOnTimeStartRate / 100;

            return {
                value: onTimeStartRate,
                goal: onTimeStartGoal,
                goalValue: onTimeStartGoal,
                variance:  onTimeStartRate - onTimeStartGoal,
                detail: null,
                inverted: false,
            }
        }
    },
    {
        category: "Throughput",
        title: "Cost of First Case Delays",
        name: "throughput:firstcase:delays:cost",
        valueUnit: "$",
        goalUnit: "$",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {
            let totalMinutesDelayed = null;

            for(var sample of samples) {
                totalMinutesDelayed += sample.firstCaseDelayMinutes;
            }

            let delayCost = (totalMinutesDelayed !== null)
                            ? (totalMinutesDelayed * goals.hospitalCostPerORMin)
                            : null;

            return {
                value: delayCost,
                goal: null,
                goalValue: null,
                variance: null,
                detail: null,
                inverted: true,
            }
        }
    },
    {
        category: "Throughput",
        title: "Same Day Cancellation",
        name: "throughput:samedaycancellations",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalSameDayCancellations = null;
            let totalCaseCount = null;

            for(var sample of samples) {
                totalSameDayCancellations += sample.sameDayCancelledCaseCount;
                totalCaseCount += sample.caseCount;
            }

            const goal = totalCaseCount * goals.sameDayCancellations;

            return {
                value: totalSameDayCancellations,
                goal: goals.sameDayCancellations,
                goalValue: goal,
                variance: goal - totalSameDayCancellations,
                detail: null,
                inverted: false,
            }
        }
    },
    {
        category: "Throughput",
        title: "Same Day Add Ons",
        name: "throughput:samedayaddons",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalSameDayAddOns = null;
            let totalCaseCount = null;

            for(var sample of samples) {
                totalSameDayAddOns += sample.sameDayAddOnCount;
                totalCaseCount += sample.caseCount;
            }

            const goal = totalCaseCount * goals.sameDayAddons;

            return {
                value: totalSameDayAddOns,
                goal: goals.sameDayAddons,
                goalValue: goal,
                variance: goal - totalSameDayAddOns,
                detail: null,
                inverted: false,
            }
        }
    },
    {
        category: "Throughput",
        title: "Eval Prior Day",
        name: "throughput:preopprior",
        valueUnit: "%",
        goalUnit: "%",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalPreopPriorCount = null;
            let totalCaseCount = null;

            for(var sample of samples) {
                totalPreopPriorCount += sample.preopPriorCount;
                totalCaseCount += sample.caseCount;
            }

            const goalValue = totalCaseCount * (goals.preopPriors/100);
            const evalPriorDayValue = totalPreopPriorCount / totalCaseCount;
            
            return {
                value: evalPriorDayValue,
                goal: goals.preopPriors / 100,
                goalValue: goals.preopPriors / 100,
                variance: (evalPriorDayValue || 0) - (goals.preopPriors / 100),
                detail: null, 
                inverted: false,
            }
        }
    },
    {
        category: "Primary Anesthetic",
        title: "General",
        name: "primaryanesthetic:general",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalGeneralCount = null;

            for(var sample of samples) {
                totalGeneralCount += sample.generalAnesthesiaCount;
            }
            
            return {
                value: totalGeneralCount,
                goal: null,
                goalValue: null,
                variance: null,
                detail: null, 
                inverted: false,
            }
        }
    },
    {
        category: "Primary Anesthetic",
        title: "MAC",
        name: "primaryanesthetic:mac",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalMACCount = null;

            for(var sample of samples) {
                totalMACCount += sample.macAnesthesiaCount;
            }
            
            return {
                value: totalMACCount,
                goal: null,
                goalValue: null,
                variance: null,
                detail: null, 
                inverted: false,
            }
        }
    },
    {
        category: "Primary Anesthetic",
        title: "Regional",
        name: "primaryanesthetic:regional",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalRegionalCount = null;

            for(var sample of samples) {
                totalRegionalCount += sample.regionalAnesthesiaCount;
            }
            
            return {
                value: totalRegionalCount,
                goal: null,
                goalValue: null,
                variance: null,
                detail: null, 
                inverted: false,
            }
        }
    },
    {
        category: "Primary Anesthetic",
        title: "Spinal",
        name: "primaryanesthetic:spinal",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalSpinalCount = null;

            for(var sample of samples) {
                totalSpinalCount += sample.spinalAnesthesiaCount;
            }
            
            return {
                value: totalSpinalCount,
                goal: null,
                goalValue: null,
                variance: null,
                detail: null, 
                inverted: false,
            }
        }
    },
    {
        category: "Primary Anesthetic",
        title: "Epidural",
        name: "primaryanesthetic:epidural",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalEpiduralCount = null;

            for(var sample of samples) {
                totalEpiduralCount += sample.epiduraAnesthesiaCount;
            }
            
            return {
                value: totalEpiduralCount,
                goal: null,
                goalValue: null,
                variance: null,
                detail: null, 
                inverted: false,
            }
        }
    },
    {
        category: "Primary Anesthetic",
        title: "Labor Epidural",
        name: "primaryanesthetic:laborepidural",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalLaborEpiduralCount = null;

            for(var sample of samples) {
                totalLaborEpiduralCount += sample.laborEpiduralAnesthesiaCount;
            }
            
            return {
                value: totalLaborEpiduralCount,
                goal: null,
                goalValue: null,
                variance: null,
                detail: null, 
                inverted: false,
            }
        }
    },
    {
        category: "Primary Anesthetic",
        title: "Local",
        name: "primaryanesthetic:local",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalLocalCount = null;

            for(var sample of samples) {
                totalLocalCount += sample.localAnesthesiaCount;
            }
            
            return {
                value: totalLocalCount,
                goal: null,
                goalValue: null,
                variance: null,
                detail: null, 
                inverted: false,
            }
        }
    },
    {
        category: "Primary Anesthetic",
        title: "Topical",
        name: "primaryanesthetic:topical",
        valueUnit: "#",
        goalUnit: "#",
        calculateMetric: function( samples:ScoreCardMetricSample[], goals:ScoreCardGoals, startDate:string, endDate:string ): MetricCalculationResult {

            let totalTopicalCount = null;

            for(var sample of samples) {
                totalTopicalCount += sample.topicalAnesthesiaCount;
            }
            
            return {
                value: totalTopicalCount,
                goal: null,
                goalValue: null,
                variance: null,
                detail: null, 
                inverted: false,
            }
        }
    },
];

export default ScoreCardMetricDefinition;