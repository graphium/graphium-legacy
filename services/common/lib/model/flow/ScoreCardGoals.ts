import * as moment from 'moment';


export interface ScoreCardGoals {
    anesReady:number,
    anesRevenuePerCase:number,
    anesRevenuePerORMin:number,
    anesToT:number,
    aprilAneMinWeekday:number,
    aprilAneMinWeekend:number,
    aprilCaseVolWeekday:number,
    aprilCaseVolWeekend:number,
    augAneMinWeekday:number,
    augAneMinWeekend:number,
    augCaseVolWeekday:number,
    augCaseVolWeekend:number,
    decAneMinWeekday:number,
    decAneMinWeekend:number,
    decCaseVolWeekday:number,
    decCaseVolWeekend:number,
    febAneMinWeekday:number,
    febAneMinWeekend:number,
    febCaseVolWeekday:number,
    febCaseVolWeekend:number,
    firstCaseDelays:number, // DEPRECATE
    firstCaseOnTimeStartRate:number,
    hospitalCostPerORMin:number,
    janAneMinWeekday:number,
    janAneMinWeekend:number,
    janCaseVolWeekday:number,
    janCaseVolWeekend:number,
    julyAneMinWeekday:number,
    julyAneMinWeekend:number,
    julyCaseVolWeekday:number,
    julyCaseVolWeekend:number,
    juneAneMinWeekday:number,
    juneAneMinWeekend:number,
    juneCaseVolWeekday:number,
    juneCaseVolWeekend:number,
    majorComplications:number,
    marAneMinWeekday:number,
    marAneMinWeekend:number,
    marCaseVolWeekday:number,
    marCaseVolWeekend:number,
    mayAneMinWeekday:number,
    mayAneMinWeekend:number,
    mayCaseVolWeekday:number,
    mayCaseVolWeekend:number,
    novAneMinWeekday:number,
    novAneMinWeekend:number,
    novCaseVolWeekday:number,
    novCaseVolWeekend:number,
    observationRate:number,
    octAneMinWeekday:number,
    octAneMinWeekend:number,
    octCaseVolWeekday:number,
    octCaseVolWeekend:number,
    preopPriors:number,
    sameDayAddons:number,
    sameDayCancellations:number,
    septAneMinWeekday:number,
    septAneMinWeekend:number,
    septCaseVolWeekday:number,
    septCaseVolWeekend:number,
    surgeonToTFlipFlop:number,
    surgeonToT:number,
    surgicalPrepMin:number,
    utilization00_07:number,
    utilization07_15:number,
    utilization15_00:number,
    weekdayBudgetedORSites00_01:number,
    weekdayBudgetedORSites01_02:number,
    weekdayBudgetedORSites02_03:number,
    weekdayBudgetedORSites03_04:number,
    weekdayBudgetedORSites04_05:number,
    weekdayBudgetedORSites05_06:number,
    weekdayBudgetedORSites06_07:number,
    weekdayBudgetedORSites07_08:number,
    weekdayBudgetedORSites08_09:number,
    weekdayBudgetedORSites09_10:number,
    weekdayBudgetedORSites10_11:number,
    weekdayBudgetedORSites11_12:number,
    weekdayBudgetedORSites12_13:number,
    weekdayBudgetedORSites13_14:number,
    weekdayBudgetedORSites14_15:number,
    weekdayBudgetedORSites15_16:number,
    weekdayBudgetedORSites16_17:number,
    weekdayBudgetedORSites17_18:number,
    weekdayBudgetedORSites18_19:number,
    weekdayBudgetedORSites19_20:number,
    weekdayBudgetedORSites20_21:number,
    weekdayBudgetedORSites21_22:number,
    weekdayBudgetedORSites22_23:number,
    weekdayBudgetedORSites23_00:number,
    wowi:number
}

export interface TimeSpecificScorecardGoals {
    anesthesiaMinutes: number,
    caseVolume: number,
    budgetedOrSites: number | null,
    utilization: number | null
}

export function getGoalsForDate(date:string, time:string|null, goals:ScoreCardGoals):TimeSpecificScorecardGoals {
    var timeSpecificGoals = <TimeSpecificScorecardGoals> {};
    var momentDate = moment.utc(date);
    var month = momentDate.month();
    var isoWeekdayIndex = momentDate.isoWeekday();
    var isWeekday = isoWeekdayIndex >= 1 && isoWeekdayIndex <= 5;

    switch( month ) {
        case 0: 
            timeSpecificGoals.anesthesiaMinutes = isWeekday ? goals.janAneMinWeekday : goals.janAneMinWeekend;
            timeSpecificGoals.caseVolume = isWeekday ? goals.janCaseVolWeekday : goals.janCaseVolWeekend;
            break;
        case 1: 
            timeSpecificGoals.anesthesiaMinutes = isWeekday ? goals.febAneMinWeekday : goals.febAneMinWeekend;
            timeSpecificGoals.caseVolume = isWeekday ? goals.febCaseVolWeekday : goals.febCaseVolWeekend;
            break;
        case 2:
            timeSpecificGoals.anesthesiaMinutes = isWeekday ? goals.marAneMinWeekday : goals.marAneMinWeekend;
            timeSpecificGoals.caseVolume = isWeekday ? goals.marCaseVolWeekday : goals.marCaseVolWeekend;
            break;
        case 3:
            timeSpecificGoals.anesthesiaMinutes = isWeekday ? goals.aprilAneMinWeekday : goals.aprilAneMinWeekend;
            timeSpecificGoals.caseVolume = isWeekday ? goals.aprilCaseVolWeekday : goals.aprilCaseVolWeekend;
            break;
        case 4:
            timeSpecificGoals.anesthesiaMinutes = isWeekday ? goals.mayAneMinWeekday : goals.mayAneMinWeekend;
            timeSpecificGoals.caseVolume = isWeekday ? goals.mayCaseVolWeekday : goals.mayCaseVolWeekend;
            break;
        case 5:
            timeSpecificGoals.anesthesiaMinutes = isWeekday ? goals.juneAneMinWeekday : goals.juneAneMinWeekend;
            timeSpecificGoals.caseVolume = isWeekday ? goals.juneCaseVolWeekday : goals.juneCaseVolWeekend;
            break;
        case 6:
            timeSpecificGoals.anesthesiaMinutes = isWeekday ? goals.julyAneMinWeekday : goals.julyAneMinWeekend;
            timeSpecificGoals.caseVolume = isWeekday ? goals.julyCaseVolWeekday : goals.julyCaseVolWeekend;
            break;
        case 7:
            timeSpecificGoals.anesthesiaMinutes = isWeekday ? goals.augAneMinWeekday : goals.augAneMinWeekend;
            timeSpecificGoals.caseVolume = isWeekday ? goals.augCaseVolWeekday : goals.augCaseVolWeekend;
            break;
        case 8:
            timeSpecificGoals.anesthesiaMinutes = isWeekday ? goals.septAneMinWeekday : goals.septAneMinWeekend;
            timeSpecificGoals.caseVolume = isWeekday ? goals.septCaseVolWeekday : goals.septCaseVolWeekend;
            break;
        case 9:
            timeSpecificGoals.anesthesiaMinutes = isWeekday ? goals.octAneMinWeekday : goals.octAneMinWeekend;
            timeSpecificGoals.caseVolume = isWeekday ? goals.octCaseVolWeekday : goals.octCaseVolWeekend;
            break;
        case 10: 
            timeSpecificGoals.anesthesiaMinutes = isWeekday ? goals.novAneMinWeekday : goals.novAneMinWeekend;
            timeSpecificGoals.caseVolume = isWeekday ? goals.novCaseVolWeekday : goals.novCaseVolWeekend;
            break;
        case 11: 
            timeSpecificGoals.anesthesiaMinutes = isWeekday ? goals.decAneMinWeekday : goals.decAneMinWeekend;
            timeSpecificGoals.caseVolume = isWeekday ? goals.decCaseVolWeekday : goals.decCaseVolWeekend;
            break;
        default: throw new Error('Invalid date entry for retrieving goals.');
    }

    if(time != null) {
        var hour = momentDate.hour();

        if(hour >= 0 && hour <= 23) {
            var paddedHour = ("0" + hour.toString()).slice(-2);
            var paddedEndHour = ("0" + (hour+1).toString()).slice(-2);
            timeSpecificGoals.budgetedOrSites = isWeekday ? goals["weekdayBudgetedORSites"+paddedHour+"_"+paddedEndHour] : null;
        }
        else {
            throw new Error('Invalid time when retrieving goals for specific time block.');
        }

        if(hour >= 0 && hour < 7) {
            timeSpecificGoals.utilization = isWeekday ? goals.utilization00_07 : null;
        }
        else if(hour >= 8 && hour < 15) {
            timeSpecificGoals.utilization = isWeekday ? goals.utilization07_15 : null;
        }
        else if(hour >= 15 && hour < 23) {
            timeSpecificGoals.utilization = isWeekday ? goals.utilization15_00 : null;
        }
    }
    else {
        timeSpecificGoals.budgetedOrSites = null;
        timeSpecificGoals.utilization = null;
    }

    return timeSpecificGoals;
}

export default ScoreCardGoals;
