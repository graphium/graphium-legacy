import { QcdrMeasure2024 } from './QcdrMeasure2024';

export class QcdrResult2024 {
    qualDataCds: string[]; // = [];
    measRespCds: string[]; // = [];
    orObsCodes: string[]; // = [];
    unspObsCodes: string[]; // = [];
    cptCodes: string[]; // = [];
    measures: QcdrMeasure2024[]; // = [];
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
