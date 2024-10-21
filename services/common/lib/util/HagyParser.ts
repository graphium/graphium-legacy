import * as _ from 'lodash';

enum HagyRecordType {
    A="A", B="B", C="C", D="D", E="E", F="F", G="G", H="H", I="I"
}

/* We include these because we are pre 2.8 */

interface HagyFieldLocation {
    start: number;
    end: number;
}

interface HagyRecordDefinition<T> {
    recordType: HagyRecordType;
    fieldLocations: HagyRecordFieldLocations<T>;
}

type HagyRecordFieldLocations<T> = {
    [K in keyof T]: HagyFieldLocation;
}

interface HagyBaseRecord {
    recordType: HagyRecordType;

    facilityId: string;
    patientNumber: string;
    patientMrn: string;
    patientLastName: string;
    patientFirstName: string;
    patientMiddleInitial: string;
}

let HagyRecordADefinition = <HagyRecordDefinition<HagyARecord>>{
    recordType: HagyRecordType.A,
    fieldLocations: {
        recordType: { start: 1, end: 1 },
        facilityId: { start: 2, end: 4 },
        patientNumber: { start: 5, end: 13 },
        patientMrn: { start: 17, end: 25 },
        patientLastName: { start: 29, end: 53 },
        patientFirstName: { start: 54, end: 68 },
        patientMiddleInitial: { start: 69, end: 69 },

        patientAddress: { start:70, end:93 },
        patientCityAndState: { start:94, end:112 },
        patientZipCode: { start:113, end:117 },
        patientPhone: { start:118, end:127 },
        patientSocialSecurityNo: { start:128, end:136 },
        patientSex: { start:137, end:137 },
        patientBirthDate: { start:138, end:143 },
        patientBirthCentury: { start:144, end:144 },
        patientMaritalStatus: { start:145, end:145 },
        patientCountryCode: { start:146, end:148 },
        patientWeight: { start:149, end:151 },
        patientPrimaryIdentifier: { start:152, end:163 },
        admitDate: { start:164, end:169 },
        dischargeDate: { start:170, end:175 },
        patientType: { start:176, end:176 },
        financialClass: { start:177, end:178 },
        patientOccupation: { start:179, end:194 },
        deceasedCode: { start:195, end:195 },
        referringDoctorNumber: { start:196, end:201 },
        referringDoctorUpin: { start:202, end:207 },
        referringDoctorLastName: { start:208, end:232 },
        referringDoctorFirstName: { start:233, end:247 },
        referringDoctorMiddleInitial: { start:248, end:248 },
        referringDoctorStateLicNumber: { start:249, end:262 },
        referringDoctorTaxonomyCode: { start:263, end:272 },
        referringDoctorNationalProviderId: { start:273, end:284 },
        serviceCode: { start:285, end:286 },
        siteCode: { start:287, end:288 },
        delayReasonCode: { start:289, end:290 },
        serviceAuthorizationCode: { start:291, end:292 }
    }
}

interface HagyARecord extends HagyBaseRecord {
    patientAddress: string;
    patientCityAndState: string;
    patientZipCode: string;
    patientPhone: string;
    patientSocialSecurityNo: string;
    patientSex: string;
    patientBirthDate: string;
    patientBirthCentury: string;
    patientMaritalStatus: string;
    patientCountryCode: string;
    patientWeight: string;
    patientPrimaryIdentifier: string;
    admitDate: string;
    dischargeDate: string;
    patientType: string;
    financialClass: string;
    patientOccupation: string;
    deceasedCode: string;
    referringDoctorNumber: string;
    referringDoctorUpin: string;
    referringDoctorLastName: string;
    referringDoctorFirstName: string;
    referringDoctorMiddleInitial: string;
    referringDoctorStateLicNumber: string;
    referringDoctorTaxonomyCode: string;
    referringDoctorNationalProviderId: string;
    serviceCode: string;
    siteCode: string;
    delayReasonCode: string;
    serviceAuthorizationCode: string;
}

let HagyRecordBDefinition = <HagyRecordDefinition<HagyBRecord>>{
    recordType: HagyRecordType.B,
    fieldLocations: {
        recordType: { start: 1, end: 1 },
        facilityId: { start: 2, end: 4 },
        patientNumber: { start: 5, end: 13 },
        patientMrn: { start: 17, end: 25 },
        patientLastName: { start: 29, end: 53 },
        patientFirstName: { start: 54, end: 68 },
        patientMiddleInitial: { start: 69, end: 69 },

        guarantorLastName: { start:70, end:94 },
        guarantorFirstName: { start:95, end:109 },
        guarantorMiddleInitial: { start:110, end:110 },
        guarantorAddress: { start:111, end:134 },
        guarantorCityAndState: { start:135, end:153 },
        guarantorZipCode: { start:154, end:158 },
        guarantorPhoneNumber: { start:159, end:168 },
        guarantorSocialSecurityNo: { start:169, end:177 },
        guarantorCountryCode: { start:178, end:180 },
        guarantorSexCode: { start:181, end:181 },
        relationshipToPatient: { start:182, end:183 },
        employerName: { start:184, end:204 },
        employerAddress: { start:205, end:228 },
        employerCityAndState: { start:229, end:247 },
        employerZipCode: { start:248, end:252 },
        employerPhoneNumber: { start:253, end:262 },
        patientAddress: { start:263, end:287 },
    }
}

interface HagyBRecord extends HagyBaseRecord {
    guarantorLastName: string;
    guarantorFirstName: string;
    guarantorMiddleInitial: string;
    guarantorAddress: string;
    guarantorCityAndState: string;
    guarantorZipCode: string;
    guarantorPhoneNumber: string;
    guarantorSocialSecurityNo: string;
    guarantorCountryCode: string;
    guarantorSexCode: string;
    relationshipToPatient: string;
    employerName: string;
    employerAddress: string;
    employerCityAndState: string;
    employerZipCode: string;
    employerPhoneNumber: string;
    patientAddress: string;
}

let HagyRecordCDefinition = <HagyRecordDefinition<HagyCRecord>>{
    recordType: HagyRecordType.C,
    fieldLocations: {
        recordType: { start: 1, end: 1 },
        facilityId: { start: 2, end: 4 },
        patientNumber: { start: 5, end: 13 },
        patientMrn: { start: 17, end: 25 },
        patientLastName: { start: 29, end: 53 },
        patientFirstName: { start: 54, end: 68 },
        patientMiddleInitial: { start: 69, end: 69 },

        admittingDoctorNumber: { start:70, end:75 },
        attendingDoctorNumber: { start:76, end:81 },
        attendingDoctorUpin: { start:82, end:87 },
        attendingDoctorLastName: { start:88, end:112 },
        attendingDoctorFirstName: { start:113, end:127 },
        attendingDoctorMiddleInitial: { start:128, end:128 },
        attendingDoctorStateLicNumber: { start:129, end:142 },
        attendingDoctorTaxonomyCode: { start:143, end:152 },
        diagnosis1: { start:153, end:157 },
        diagnosis1Description: { start:158, end:178 },
        diagnosis2: { start:179, end:183 },
        employmentRelatedFlag: { start:184, end:184 },
        accidentFlag: { start:185, end:185 },
        accidentDate: { start:186, end:191 },
        pregnancyIndicator: { start:192, end:192 },
        admitDiagnosisDescription: { start:193, end:212 },
        admitDiagnosisCode: { start:213, end:217 },
        admitDoctorUpin: { start:218, end:223 },
        admitDoctorLastName: { start:224, end:248 },
        admitDoctorFirstName: { start:249, end:263 },
        admitDoctorMiddleInitial: { start:264, end:264 },
        admitDoctorStateLicNumber: { start:265, end:278 },
        admitDoctorTaxonomyCode: { start:279, end:288 },
        clinicCode: { start:289, end:290 },
        occurrenceCode: { start:291, end:292 },
        autoAccidentState: { start:293, end:294 },
        countryCode: { start:295, end:297 },
    }
}

interface HagyCRecord extends HagyBaseRecord {
    admittingDoctorNumber: string;
    attendingDoctorNumber: string;
    attendingDoctorUpin: string;
    attendingDoctorLastName: string;
    attendingDoctorFirstName: string;
    attendingDoctorMiddleInitial: string;
    attendingDoctorStateLicNumber: string;
    attendingDoctorTaxonomyCode: string;
    diagnosis1: string;
    diagnosis1Description: string;
    diagnosis2: string;
    employmentRelatedFlag: string;
    accidentFlag: string;
    accidentDate: string;
    pregnancyIndicator: string;
    admitDiagnosisDescription: string;
    admitDiagnosisCode: string;
    admitDoctorUpin: string;
    admitDoctorLastName: string;
    admitDoctorFirstName: string;
    admitDoctorMiddleInitial: string;
    admitDoctorStateLicNumber: string;
    admitDoctorTaxonomyCode: string;
    clinicCode: string;
    occurrenceCode: string;
    autoAccidentState: string;
    countryCode: string;
}

let HagyRecordDDefinition = <HagyRecordDefinition<HagyDRecord>>{
    recordType: HagyRecordType.D,
    fieldLocations: {
        recordType: { start: 1, end: 1 },
        facilityId: { start: 2, end: 4 },
        patientNumber: { start: 5, end: 13 },
        patientMrn: { start: 17, end: 25 },
        patientLastName: { start: 29, end: 53 },
        patientFirstName: { start: 54, end: 68 },
        patientMiddleInitial: { start: 69, end: 69 },

        operatingPhysicianNumber: { start:70, end:75 },
        otherPhysicianNumber: { start:76, end:81 },
        operatingPhysicianUpin: { start:82, end:87 },
        operatingPhysicianLastName: { start:88, end:112 },
        operatingPhysicianFirstName: { start:113, end:127 },
        operatingPhysicianMiddleInitial: { start:128, end:128 },
        operatingPhysicianStateLicNumber: { start:129, end:142 },
        operatingPhysicianTaxonomyCode: { start:143, end:152 },
        otherPhysicianUpin: { start:153, end:158 },
        otherPhysicianLastName: { start:159, end:183 },
        otherPhysicianFirstName: { start:184, end:198 },
        otherPhysicianMiddleInitial: { start:199, end:199 },
        otherPhysicianStateLicNumber: { start:200, end:213 },
        otherPhysicianTaxonomyCode: { start:214, end:223 },
        operatingPhysicianNationalProviderId: { start:224, end:235 },
        otherPhysicianNationalProviderId: { start:236, end:247 },
        attendingDoctorNationalProviderId: { start:248, end:259 },
        admitDoctorNationalProviderId: { start:260, end:271 },
        primaryInsuranceTelNumber: { start:281, end:290 },
        secondaryInsuranceTelNumber: { start:291, end:300 },
    }
}

interface HagyDRecord extends HagyBaseRecord {
    operatingPhysicianNumber: string;
    otherPhysicianNumber: string;
    operatingPhysicianUpin: string;
    operatingPhysicianLastName: string;
    operatingPhysicianFirstName: string;
    operatingPhysicianMiddleInitial: string;
    operatingPhysicianStateLicNumber: string;
    operatingPhysicianTaxonomyCode: string;
    otherPhysicianUpin: string;
    otherPhysicianLastName: string;
    otherPhysicianFirstName: string;
    otherPhysicianMiddleInitial: string;
    otherPhysicianStateLicNumber: string;
    otherPhysicianTaxonomyCode: string;
    operatingPhysicianNationalProviderId: string;
    otherPhysicianNationalProviderId: string;
    attendingDoctorNationalProviderId: string;
    admitDoctorNationalProviderId: string;
    primaryInsuranceTelNumber: string;
    secondaryInsuranceTelNumber: string;
}

let HagyRecordEDefinition = <HagyRecordDefinition<HagyERecord>>{
    recordType: HagyRecordType.E,
    fieldLocations: {
        recordType: { start: 1, end: 1 },
        facilityId: { start: 2, end: 4 },
        patientNumber: { start: 5, end: 13 },
        patientMrn: { start: 17, end: 25 },
        patientLastName: { start: 29, end: 53 },
        patientFirstName: { start: 54, end: 68 },
        patientMiddleInitial: { start: 69, end: 69 },

        insurancePriority: { start:70, end:70 },
        insuranceCode: { start:71, end:75 },
        insuranceName: { start:76, end:89 },
        insuranceAddress: { start:90, end:112 },
        insuranceCityAndState: { start:113, end:131 },
        insuranceZipCode: { start:132, end:136 },
        certificationNumber: { start:137, end:152 },
        groupNumber: { start:153, end:169 },
        insuredLastName: { start:170, end:194 },
        insuredFirstName: { start:195, end:209 },
        insuredMiddleName: { start:210, end:210 },
        insuredAddress: { start:211, end:235 },
        insuredCity: { start:236, end:250 },
        insuredState: { start:251, end:252 },
        insuredZipCode: { start:253, end:257 },
        insuredZip2Code: { start:258, end:261 },
        insuredCountryCode: { start:262, end:264 },
        insuredPrimaryIdentifier: { start:265, end:276 },
        insuredDob: { start:277, end:284 },
        insuredPlanId: { start:285, end:289 },
        relationshipToPatient: { start:290, end:291 },
        sexOfInsured: { start:292, end:292 },
        authorizationNumber: { start:293, end:308 },
    }
}

interface HagyERecord extends HagyBaseRecord {
    insurancePriority: string;
    insuranceCode: string;
    insuranceName: string;
    insuranceAddress: string;
    insuranceCityAndState: string;
    insuranceZipCode: string;
    certificationNumber: string;
    groupNumber: string;
    insuredLastName: string;
    insuredFirstName: string;
    insuredMiddleName: string;
    insuredAddress: string;
    insuredCity: string;
    insuredState: string;
    insuredZipCode: string;
    insuredZip2Code: string;
    insuredCountryCode: string;
    insuredPrimaryIdentifier: string;
    insuredDob: string;
    insuredPlanId: string;
    relationshipToPatient: string;
    sexOfInsured: string;
    authorizationNumber: string;
}

let HagyRecordFDefinition = <HagyRecordDefinition<HagyFRecord>>{
    recordType: HagyRecordType.F,
    fieldLocations: {
        recordType: { start: 1, end: 1 },
        facilityId: { start: 2, end: 4 },
        patientNumber: { start: 5, end: 13 },
        patientMrn: { start: 17, end: 25 },
        patientLastName: { start: 29, end: 53 },
        patientFirstName: { start: 54, end: 68 },
        patientMiddleInitial: { start: 69, end: 69 },

        otherInsuredLastName: { start:70, end:94 },
        otherInsuredFirstName: { start:95, end:109 },
        otherInsuredMiddleInitial: { start:110, end:110 },
        otherInsuredSexCode: { start:111, end:111 },
        otherInsuredAddress: { start:112, end:136 },
        otherInsuredCity: { start:137, end:151 },
        otherInsuredState: { start:152, end:153 },
        otherInsuredZipCode: { start:154, end:158 },
        otherInsuredZip2: { start:159, end:162 },
        otherInsuredCountryCode: { start:163, end:165 },
        otherInsuredPrimaryIdentifier: { start:166, end:177 },
        otherInsuredDob: { start:178, end:185 },
        diagnosisCode3: { start:186, end:190 },
        diagnosisCode4: { start:191, end:195 },
        diagnosisCode5: { start:196, end:200 },
        diagnosisCode6: { start:201, end:205 },
        diagnosisCode7: { start:206, end:210 },
        diagnosisCode8: { start:211, end:215 },
        diagnosisCode9: { start:216, end:220 },
        diagnosisCode10: { start:221, end:225 },
        diagnosisCode11: { start:226, end:230 },
        diagnosisCode12: { start:231, end:235 },
        primaryInsurancePayerId: { start:236, end:247 },
        secondaryInsurancePayerId: { start:248, end:259 },
    }
}

interface HagyFRecord extends HagyBaseRecord {
    otherInsuredLastName: string;
    otherInsuredFirstName: string;
    otherInsuredMiddleInitial: string;
    otherInsuredSexCode: string;
    otherInsuredAddress: string;
    otherInsuredCity: string;
    otherInsuredState: string;
    otherInsuredZipCode: string;
    otherInsuredZip2: string;
    otherInsuredCountryCode: string;
    otherInsuredPrimaryIdentifier: string;
    otherInsuredDob: string;
    diagnosisCode3: string;
    diagnosisCode4: string;
    diagnosisCode5: string;
    diagnosisCode6: string;
    diagnosisCode7: string;
    diagnosisCode8: string;
    diagnosisCode9: string;
    diagnosisCode10: string;
    diagnosisCode11: string;
    diagnosisCode12: string;
    primaryInsurancePayerId: string;
    secondaryInsurancePayerId: string;
}

let HagyRecordGDefinition = <HagyRecordDefinition<HagyGRecord>>{
    recordType: HagyRecordType.G,
    fieldLocations: {
        recordType: { start: 1, end: 1 },
        facilityId: { start: 2, end: 4 },
        patientNumber: { start: 5, end: 13 },
        patientMrn: { start: 17, end: 25 },
        patientLastName: { start: 29, end: 53 },
        patientFirstName: { start: 54, end: 68 },
        patientMiddleInitial: { start: 69, end: 69 },

        serviceDate: { start:70, end:75 },
        quantity: { start:76, end:78 },
        chargeDepartment: { start:79, end:81 },
        chargeItemNumber: { start:82, end:85 },
        cptCode: { start:87, end:91 },
        chargeDescription: { start:95, end:110 },
        modifier1: { start:111, end:112 },
        modifier2: { start:113, end:114 },
        modifier3: { start:115, end:116 },
        modifier4: { start:117, end:118 },
        medicareIndicator: { start:119, end:119 },
        medicaidIndicator: { start:120, end:120 },
        chargeCredit: { start:121, end:121 },
        postingDate: { start:122, end:127 },
    }
}

interface HagyGRecord extends HagyBaseRecord {
    serviceDate: string;
    quantity: string;
    chargeDepartment: string;
    chargeItemNumber: string;
    cptCode: string;
    chargeDescription: string;
    modifier1: string;
    modifier2: string;
    modifier3: string;
    modifier4: string;
    medicareIndicator: string;
    medicaidIndicator: string;
    chargeCredit: string;
    postingDate: string;
}

let HagyRecordHDefinition = <HagyRecordDefinition<HagyHRecord>>{
    recordType: HagyRecordType.H,
    fieldLocations: {
        recordType: { start: 1, end: 1 },
        facilityId: { start: 2, end: 4 },
        patientNumber: { start: 5, end: 13 },
        patientMrn: { start: 17, end: 25 },
        patientLastName: { start: 29, end: 53 },
        patientFirstName: { start: 54, end: 68 },
        patientMiddleInitial: { start: 69, end: 69 },

        diagnosisCode1: { start:70, end:77 },
        diagnosisCode1Description: { start:78, end:137 },
        diagnosisCode2: { start:138, end:145 },
        admittingDiagnosisDescription: { start:146, end:205 },
        admittingDiagnosisCode: { start:206, end:213 },
    }
}

interface HagyHRecord extends HagyBaseRecord {
    diagnosisCode1: string;
    diagnosisCode1Description: string;
    diagnosisCode2: string;
    admittingDiagnosisDescription: string;
    admittingDiagnosisCode: string;
}

let HagyRecordIDefinition = <HagyRecordDefinition<HagyIRecord>>{
    recordType: HagyRecordType.I,
    fieldLocations: {
        recordType: { start: 1, end: 1 },
        facilityId: { start: 2, end: 4 },
        patientNumber: { start: 5, end: 13 },
        patientMrn: { start: 17, end: 25 },
        patientLastName: { start: 29, end: 53 },
        patientFirstName: { start: 54, end: 68 },
        patientMiddleInitial: { start: 69, end: 69 },

        diagnosisCode3: { start:70, end:77 },
        diagnosisCode4: { start:78, end:85 },
        diagnosisCode5: { start:86, end:93 },
        diagnosisCode6: { start:94, end:101 },
        diagnosisCode7: { start:102, end:109 },
        diagnosisCode8: { start:110, end:117 },
        diagnosisCode9: { start:118, end:125 },
        diagnosisCode10: { start:126, end:133 },
        diagnosisCode11: { start:134, end:141 },
        diagnosisCode12: { start:142, end:149 },
    }
}

interface HagyIRecord extends HagyBaseRecord {
    diagnosisCode3: string;
    diagnosisCode4: string;
    diagnosisCode5: string;
    diagnosisCode6: string;
    diagnosisCode7: string;
    diagnosisCode8: string;
    diagnosisCode9: string;
    diagnosisCode10: string;
    diagnosisCode11: string;
    diagnosisCode12: string;
}

interface HagyRecordSet {
    sources: string[];
    patient: HagyARecord;
    guarantor: HagyBRecord;
    doctorsAndDiagnosis: HagyCRecord;
    additionalDoctor: HagyDRecord;
    primaryInsurance: HagyERecord;
    secondaryInsurance: HagyERecord;
    other: HagyFRecord;
    charges: HagyGRecord[];
    diagnosisAndAdmitting: HagyHRecord;
    additionalDiagnosis: HagyIRecord;
}

export class HagyParser {

    parse(data:string):HagyRecordSet[] {
        let recordSets = [];
        let currentRecordSet:HagyRecordSet;
        let rows = data.split('\n');

        for(let row of rows) {
            let parsedRecord = this.parseRecord(row);
            if(!parsedRecord) {
                continue;
            }

            let { recordType, record } = parsedRecord;

            if(recordType == HagyRecordType.A) {
                if(currentRecordSet) {
                    recordSets.push(currentRecordSet);
                }

                currentRecordSet = <HagyRecordSet>{
                    sources: [],
                    patient: null,
                    guarantor: null,
                    doctorsAndDiagnosis: null,
                    additionalDoctor: null,
                    primaryInsurance: null,
                    secondaryInsurance: null,
                    other: null,
                    charges: [],
                    diagnosisAndAdmitting: null,
                    additionalDiagnosis: null
                };
                currentRecordSet.patient = record as HagyARecord;
            }
            else if(recordType == HagyRecordType.B) {
                currentRecordSet.guarantor = record as HagyBRecord;
            }
            else if(recordType == HagyRecordType.C) {
                currentRecordSet.doctorsAndDiagnosis = record as HagyCRecord;
            }
            else if(recordType == HagyRecordType.D) {
                currentRecordSet.additionalDoctor = record as HagyDRecord;
            }
            else if(recordType == HagyRecordType.E) {
                let insuranceRecord = record as HagyERecord;
                if(insuranceRecord.insurancePriority == "1") {
                    currentRecordSet.primaryInsurance = insuranceRecord;
                }
                else if(insuranceRecord.insurancePriority == "2") {
                    currentRecordSet.secondaryInsurance = insuranceRecord;
                }
            }
            else if(recordType == HagyRecordType.F) {
                currentRecordSet.other = record as HagyFRecord;
            }
            else if(recordType == HagyRecordType.G) {
                currentRecordSet.charges.push(record as HagyGRecord);
            }
            else if(recordType == HagyRecordType.H) {
                currentRecordSet.diagnosisAndAdmitting = record as HagyHRecord;
            }
            else if(recordType == HagyRecordType.I) {
                currentRecordSet.additionalDiagnosis = record as HagyIRecord;
            }

            currentRecordSet.sources.push(row);
        }
        recordSets.push(currentRecordSet);
        return recordSets;
    }

    private parseRecord(row:string):{recordType:HagyRecordType, record:HagyBaseRecord}|null {        
        let recordTypeCode = row.substring(0,1);
        let recordTypeDefinition;

        let record:HagyBaseRecord;
        switch(recordTypeCode) {
            case HagyRecordType.A: record = this.generateRecord<HagyARecord>(row, HagyRecordADefinition); recordTypeDefinition = HagyRecordADefinition; break;
            case HagyRecordType.B: record = this.generateRecord<HagyBRecord>(row, HagyRecordBDefinition); recordTypeDefinition = HagyRecordBDefinition; break;
            case HagyRecordType.C: record = this.generateRecord<HagyCRecord>(row, HagyRecordCDefinition); recordTypeDefinition = HagyRecordCDefinition; break;
            case HagyRecordType.D: record = this.generateRecord<HagyDRecord>(row, HagyRecordDDefinition); recordTypeDefinition = HagyRecordDDefinition; break;
            case HagyRecordType.E: record = this.generateRecord<HagyERecord>(row, HagyRecordEDefinition); recordTypeDefinition = HagyRecordEDefinition; break;
            case HagyRecordType.F: record = this.generateRecord<HagyFRecord>(row, HagyRecordFDefinition); recordTypeDefinition = HagyRecordFDefinition; break;
            case HagyRecordType.G: record = this.generateRecord<HagyGRecord>(row, HagyRecordGDefinition); recordTypeDefinition = HagyRecordGDefinition; break;
            case HagyRecordType.H: record = this.generateRecord<HagyHRecord>(row, HagyRecordHDefinition); recordTypeDefinition = HagyRecordHDefinition; break;
            case HagyRecordType.I: record = this.generateRecord<HagyIRecord>(row, HagyRecordIDefinition); recordTypeDefinition = HagyRecordIDefinition; break;
            default: console.log('Unable to determine record type, unknown code: ' + recordTypeCode); return null;
        }

        let recordType = recordTypeDefinition.recordType;
        return {recordType, record};
    }

    private generateRecord<T extends HagyBaseRecord>(row:string, recordDefinition:HagyRecordDefinition<T>):T {
        let record:T = <T>{};
        // tslint:disable-next-line:forin
        for(let field in recordDefinition.fieldLocations) {
            Object.assign(record, { [field]: this.getField(row, recordDefinition.fieldLocations[field]) });
        }
        return record;
    }

    private getField(row:string, fieldLocation:HagyFieldLocation):string|null {
        try {
            let value = row.substring(fieldLocation.start-1, fieldLocation.end);
            value = _.trim(value);
            if(value === "") value = null;
            return value;
        }
        catch(error) {
            return null;
        }
    }
}

export default HagyParser;