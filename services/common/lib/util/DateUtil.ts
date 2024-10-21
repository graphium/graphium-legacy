import * as moment from 'moment';

// THIS IS BROKEN AND NEEDS TO BE FIXED.
export function getMonthUtcTimestamp(year:number, month:number):number {
    var monthDate = new Date(year, month);
    return monthDate.getTime() + monthDate.getTimezoneOffset()*60*1000;
}

export function dateStringToUtcTimestamp(dateString:string):number {
    var date:moment.Moment = moment.utc(dateString, ['YYYY-MM-DD','YYYY-MM']);
    if(date.isValid()) {
        return date.valueOf();
    }
    return null;
}