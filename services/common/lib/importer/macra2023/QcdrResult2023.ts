import { QcdrMeasure2023 } from './QcdrMeasure2023';

export class QcdrResult2023 {
    qualDataCds: string[]; // = [];
    measRespCds: string[]; // = [];
    orObsCodes: string[]; // = [];
    unspObsCodes: string[]; // = [];
    cptCodes: string[]; // = [];
    measures: QcdrMeasure2023[]; // = [];
    admissible: boolean;
    errors: string[]; // = [];
    qcdrVersion: string;
    evalTimestamp: string;
    evalEnctrFormVer: number;
    constructor(qcdrVersion: string, evalTimestamp: string, evalEnctrFormVer: number) {
        this.measures = [];
        this.qcdrVersion = qcdrVersion;
        this.evalTimestamp = evalTimestamp;
        this.evalEnctrFormVer = evalEnctrFormVer;
        this.admissible = true;
        this.errors = [];
    }
}
