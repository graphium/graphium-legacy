export class QcdrMeasure2024 {
    name: string;
    eligible: number = 0;
    perfMet: number = 0;
    perfNotMet: number = 0;
    exception: number = 0;
    qualDataCds: string[]; // = [];
    measRespCds: string[]; // = [];
    orObsCodes: string[]; // = [];
    unspObsCodes: string[]; // = [];
    missingFields: string[]; // = [];

    constructor(measureName: string) {
        this.name = measureName;
        this.eligible = 0;
        this.perfMet = 0;
        this.perfNotMet = 0;
        this.exception = 0;
        this.qualDataCds = [];
        this.measRespCds = [];
        this.orObsCodes = [];
        this.unspObsCodes = [];
        this.missingFields = [];
    }
}
