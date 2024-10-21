import * as _ from 'lodash';

enum HcaAdvantxRecordType {
    A=1, B=2, C=3, D=4, E=5, F=6, G=7, H=8, I=0
}

/* We include these because we are pre 2.8 */

interface HcaAdvantxFieldLocation {
    index: number;
}

interface HcaAdvantxRecordDefinition<T> {
    recordType: HcaAdvantxRecordType;
    fieldLocations: HcaAdvantxRecordFieldLocations<T>;
}

type HcaAdvantxRecordFieldLocations<T> = {
    [K in keyof T]: HcaAdvantxFieldLocation;
}

interface HcaAdvantxBaseRecord {
    recordType: HcaAdvantxRecordType;
}

let HcaAdvantxRecordADefinition = <HcaAdvantxRecordDefinition<HcaAdvantxARecord>>{
    recordType: HcaAdvantxRecordType.A,
    fieldLocations: {
        facilityName: { index: 0 }
    }
}

interface HcaAdvantxARecord extends HcaAdvantxBaseRecord {
    facilityName: string;
}

let HcaAdvantxRecordBDefinition = <HcaAdvantxRecordDefinition<HcaAdvantxBRecord>>{
    recordType: HcaAdvantxRecordType.B,
    fieldLocations: {
        accountNumber: { index: 0 },
        chartNumber: { index: 1 },
        patientLastName: { index: 2 },
        patientFirstName: { index: 3 },
        patientMiddleName: { index: 4 },
        patientTitle: { index: 5 },
        patientAddress1: { index: 6 },
        patientAddress2: { index: 7 },
        patientCity: { index: 8 },
        patientState: { index: 9 },
        patientZipCode: { index: 10 },
        patientSex: { index: 11 },
        patientMaidenName: { index: 12 },
        patientSocialSecurityNumber: { index: 13 },
        patientDateOfBirth: { index: 14 },
        patientHomePhone: { index: 15 },
        patientWorkPhone: { index: 16 },
        patientCellPhone: { index: 17 },
        patientEmailAddress: { index: 18 },
        patientMaritalStatus: { index: 19 },
        patientRace: { index: 20 },
        patientReligion: { index: 21 },
        patientNationality: { index: 22 },
        patientOccupation: { index: 23 },
        patientEmployer: { index: 24 },
        patientSpokenLanguage: { index: 25 }
    }
}

interface HcaAdvantxBRecord extends HcaAdvantxBaseRecord {
    accountNumber: string;
    chartNumber: string;
    patientLastName: string;
    patientFirstName: string;
    patientMiddleName: string;
    patientTitle: string;
    patientAddress1: string;
    patientAddress2: string;
    patientCity: string;
    patientState: string;
    patientZipCode: string;
    patientSex: string;
    patientMaidenName: string;
    patientSocialSecurityNumber: string;
    patientDateOfBirth: string;
    patientHomePhone: string;
    patientWorkPhone: string;
    patientCellPhone: string;
    patientEmailAddress: string;
    patientMaritalStatus: string;
    patientRace: string;
    patientReligion: string;
    patientNationality: string;
    patientOccupation: string;
    patientEmployer: string;
    patientSpokenLanguage: string;
}

let HcaAdvantxRecordCDefinition = <HcaAdvantxRecordDefinition<HcaAdvantxCRecord>>{
    recordType: HcaAdvantxRecordType.C,
    fieldLocations: {
        accountNumber: { index: 0 },
        respParty1LastName: { index: 1 },
        respParty1FirstName: { index: 2 },
        respParty1MiddleInitial: { index: 3 },
        respParty1BillAddress1: { index: 4 },
        respParty1Address2: { index: 5 },
        respParty1City: { index: 6 },
        respParty1State: { index: 7 },
        respParty1ZipCode: { index: 8 },
        respParty1SocialSecurityNumber: { index: 9 },
        respParty1HomePhone: { index: 10 },
        respParty1WorkPhone: { index: 11 },
        respParty1PatientRelationshipToRespParty: { index: 12 },
        respParty1EmployerName: { index: 13 },
        respParty1EmployerId: { index: 14 }
    }
}

interface HcaAdvantxCRecord extends HcaAdvantxBaseRecord {
    accountNumber: string;
    respParty1LastName: string;
    respParty1FirstName: string;
    respParty1MiddleInitial: string;
    respParty1BillAddress1: string;
    respParty1Address2: string;
    respParty1City: string;
    respParty1State: string;
    respParty1ZipCode: string;
    respParty1SocialSecurityNumber: string;
    respParty1HomePhone: string;
    respParty1WorkPhone: string;
    respParty1PatientRelationshipToRespParty: string;
    respParty1EmployerName: string;
    respParty1EmployerId: string;
}

let HcaAdvantxRecordDDefinition = <HcaAdvantxRecordDefinition<HcaAdvantxDRecord>>{
    recordType: HcaAdvantxRecordType.D,
    fieldLocations: {
        accountNumber: { index: 0 },
        respParty2LastName: { index: 1 },
        respParty2FirstName: { index: 2 },
        respParty2MiddleInitial: { index: 3 },
        respParty2BillAddress1: { index: 4 },
        respParty2Address2: { index: 5 },
        respParty2City: { index: 6 },
        respParty2State: { index: 7 },
        respParty2ZipCode: { index: 8 },
        respParty2SocialSecurityNumber: { index: 9 },
        respParty2HomePhone: { index: 10 },
        respParty2WorkPhone: { index: 11 },
        respParty2EmployerName: { index: 12 },
        respParty2EmployerId: { index: 13 }
    }
}

interface HcaAdvantxDRecord extends HcaAdvantxBaseRecord {
    accountNumber: string;
    respParty2LastName: string;
    respParty2FirstName: string;
    respParty2MiddleInitial: string;
    respParty2BillAddress1: string;
    respParty2Address2: string;
    respParty2City: string;
    respParty2State: string;
    respParty2ZipCode: string;
    respParty2SocialSecurityNumber: string;
    respParty2HomePhone: string;
    respParty2WorkPhone: string;
    respParty2EmployerName: string;
    respParty2EmployerId: string;
}

let HcaAdvantxRecordEDefinition = <HcaAdvantxRecordDefinition<HcaAdvantxERecord>>{
    recordType: HcaAdvantxRecordType.E,
    fieldLocations: {
        accountNumber: { index: 0 },
        primaryInsuranceCarrier: { index: 1 },
        primaryInsuranceCarrierQuickCode: { index: 2 },
        primaryInsuranceClaimOffice: { index: 3 },
        primaryInsuranceClaimOfficeAddress1: { index: 4 },
        primaryInsuranceClaimOfficeAddress2: { index: 5 },
        primaryInsuranceClaimOfficeCity: { index: 6 },
        primaryInsuranceClaimOfficeState: { index: 7 },
        primaryInsuranceClaimOfficeZipCode: { index: 8 },
        primaryInsuranceClaimOfficePhoneNumber: { index: 9 },
        primaryInsuranceSubscriberInsuredId: { index: 10 },
        primaryInsuranceGroupName: { index: 11 },
        primaryInsuranceGroupNumber: { index: 12 },
        primaryInsurancePreAuthNumber: { index: 13 },
        primaryInsuranceWCFileNumber: { index: 14 },
        primaryInsuranceInsuredLastName: { index: 15 },
        primaryInsuranceInsuredFirstName: { index: 16 },
        primaryInsuranceInsuredAddress1: { index: 17 },
        primaryInsuranceInsuredAddress2: { index: 18 },  //2 (if Address 2 is blank it will populate City, State and Zip)
        primaryInsuranceInsuredCity: { index: 19 },  //(If Address 2 is populated then City, State and Zip are populated here)
        primaryInsuranceInsuredDOB: { index: 20 },
        primaryInsuranceInsuredSocialSecurityNumber: { index: 21 },  //(No Punctuation)
        primaryInsuranceInsuredSex: { index: 22 },
        primaryInsurancePatientRelationshipToInsured: { index: 23 },
        primaryInsuranceInsuredEmployerName: { index: 24 },
        primaryInsuranceInsuredEmployerId: { index: 25 },
        primaryInsuranceInsuredEmployerAddress1: { index: 26 },
        primaryInsuranceInsuredEmployerCity: { index: 27 },
        primaryInsuranceInsuredEmployerState: { index: 28 },
        primaryInsuranceInsuredEmployerZipCode: { index: 29 }
    }
}

interface HcaAdvantxERecord extends HcaAdvantxBaseRecord {
    accountNumber: string;
    primaryInsuranceCarrier: string;
    primaryInsuranceCarrierQuickCode: string;
    primaryInsuranceClaimOffice: string;
    primaryInsuranceClaimOfficeAddress1: string;
    primaryInsuranceClaimOfficeAddress2: string;
    primaryInsuranceClaimOfficeCity: string;
    primaryInsuranceClaimOfficeState: string;
    primaryInsuranceClaimOfficeZipCode: string;
    primaryInsuranceClaimOfficePhoneNumber: string;
    primaryInsuranceSubscriberInsuredId: string;
    primaryInsuranceGroupName: string;
    primaryInsuranceGroupNumber: string;
    primaryInsurancePreAuthNumber: string;
    primaryInsuranceWCFileNumber: string;
    primaryInsuranceInsuredLastName: string;
    primaryInsuranceInsuredFirstName: string;
    primaryInsuranceInsuredAddress1: string;
    primaryInsuranceInsuredAddress2: string;
    primaryInsuranceInsuredCity: string;
    primaryInsuranceInsuredDOB: string;
    primaryInsuranceInsuredSocialSecurityNumber: string;
    primaryInsuranceInsuredSex: string;
    primaryInsurancePatientRelationshipToInsured: string;
    primaryInsuranceInsuredEmployerName: string;
    primaryInsuranceInsuredEmployerId: string;
    primaryInsuranceInsuredEmployerAddress1: string;
    primaryInsuranceInsuredEmployerCity: string;
    primaryInsuranceInsuredEmployerState: string;
    primaryInsuranceInsuredEmployerZipCode: string;
}

let HcaAdvantxRecordFDefinition = <HcaAdvantxRecordDefinition<HcaAdvantxFRecord>>{
    recordType: HcaAdvantxRecordType.F,
    fieldLocations: {
        accountNumber: { index: 0 },
        secondaryInsuranceCarrier: { index: 1 },
        secondaryInsuranceCarrierQuickCode: { index: 2 },
        secondaryInsuranceClaimOffice: { index: 3 },
        secondaryInsuranceClaimOfficeAddress1: { index: 4 },
        secondaryInsuranceClaimOfficeAddress2: { index: 5 },
        secondaryInsuranceClaimOfficeCity: { index: 6 },
        secondaryInsuranceClaimOfficeState: { index: 7 },
        secondaryInsuranceClaimOfficeZipCode: { index: 8 },
        secondaryInsuranceClaimOfficePhoneNumber: { index: 9 },
        secondaryInsuranceSubscriberInsuredId: { index: 10 },
        secondaryInsuranceGroupName: { index: 11 },
        secondaryInsuranceGroupNumber: { index: 12 },
        secondaryInsurancePreAuthNumber: { index: 13 },
        secondaryInsuranceInsuredLastName: { index: 14 },
        secondaryInsuranceInsuredFirstName: { index: 15 },
        secondaryInsuranceInsuredAddress1: { index: 16 },
        primaryInsuranceInsuredAddress2: { index: 17 },  //2 (if Address 2 is blank it will populate City, State and Zip)
        primaryInsuranceInsuredCity: { index: 18 },  //(If Address 2 is populated then City, State and Zip are populated here)
        secondaryInsuranceInsuredDOB: { index: 19 },
        secondaryInsuranceInsuredSocialSecurityNumber: { index: 20 },  //(No Punctuation)
        secondaryInsuranceInsuredSex: { index: 21 },
        secondaryInsurancePatientRelationshipToInsured: { index: 22 },
        secondaryInsuranceInsuredEmployerName: { index: 23 },
        secondaryInsuranceInsuredEmployerId: { index: 24 },
        secondaryInsuranceInsuredEmployerAddress1: { index: 25 },
        secondaryInsuranceInsuredEmployerCity: { index: 26 },
        secondaryInsuranceInsuredEmployerState: { index: 27 },
        secondaryInsuranceInsuredEmployerZipCode: { index: 28 },
        secondaryInsuranceInsuredEmployerZipExtended: { index: 29 }
    }
}

interface HcaAdvantxFRecord extends HcaAdvantxBaseRecord {
    accountNumber: string;
    secondaryInsuranceCarrier: string;
    secondaryInsuranceCarrierQuickCode: string;
    secondaryInsuranceClaimOffice: string;
    secondaryInsuranceClaimOfficeAddress1: string;
    secondaryInsuranceClaimOfficeAddress2: string;
    secondaryInsuranceClaimOfficeCity: string;
    secondaryInsuranceClaimOfficeState: string;
    secondaryInsuranceClaimOfficeZipCode: string;
    secondaryInsuranceClaimOfficePhoneNumber: string;
    secondaryInsuranceSubscriberInsuredId: string;
    secondaryInsuranceGroupName: string;
    secondaryInsuranceGroupNumber: string;
    secondaryInsurancePreAuthNumber: string;
    secondaryInsuranceInsuredLastName: string;
    secondaryInsuranceInsuredFirstName: string;
    secondaryInsuranceInsuredAddress1: string;
    primaryInsuranceInsuredAddress2: string;
    primaryInsuranceInsuredCity: string;
    secondaryInsuranceInsuredDOB: string;
    secondaryInsuranceInsuredSocialSecurityNumber: string;
    secondaryInsuranceInsuredSex: string;
    secondaryInsurancePatientRelationshipToInsured: string;
    secondaryInsuranceInsuredEmployerName: string;
    secondaryInsuranceInsuredEmployerId: string;
    secondaryInsuranceInsuredEmployerAddress1: string;
    secondaryInsuranceInsuredEmployerCity: string;
    secondaryInsuranceInsuredEmployerState: string;
    secondaryInsuranceInsuredEmployerZipCode: string;
    secondaryInsuranceInsuredEmployerZipExtended: string;
}

let HcaAdvantxRecordGDefinition = <HcaAdvantxRecordDefinition<HcaAdvantxGRecord>>{
    recordType: HcaAdvantxRecordType.G,
    fieldLocations: {
        accountNumber: { index: 0 },
        tertiaryInsuranceCarrier: { index: 1 },
        tertiaryInsuranceCarrierQuickCode: { index: 2 },
        tertiaryInsuranceClaimOfficePhoneNumber: { index: 3 },
        tertiaryInsuranceSubscriberInsuredId: { index: 4 },
        tertiaryInsuranceGroupName: { index: 5 },
        tertiaryInsuranceGroupNumber: { index: 6 },
        tertiaryInsurancePreAuthNumber: { index: 7 },
        tertiaryInsuranceInsuredLastName: { index: 8 },
        tertiaryInsuranceInsuredFirstName: { index: 9 },
        tertiaryInsurancePatientRelationshipToInsured: { index: 10 },
        tertiaryInsuranceInsuredEmployerName: { index: 11 },
        tertiaryInsuranceInsuredEmployerAddress1: { index: 12 },
        tertiaryInsuranceInsuredEmployerCity: { index: 13 },
        tertiaryInsuranceInsuredEmployerState: { index: 14 },
        tertiaryInsuranceInsuredEmployerZipCode: { index: 15 }
    }
}

interface HcaAdvantxGRecord extends HcaAdvantxBaseRecord {
    accountNumber: string;
    tertiaryInsuranceCarrier: string;
    tertiaryInsuranceCarrierQuickCode: string;
    tertiaryInsuranceClaimOfficePhoneNumber: string;
    tertiaryInsuranceSubscriberInsuredId: string;
    tertiaryInsuranceGroupName: string;
    tertiaryInsuranceGroupNumber: string;
    tertiaryInsurancePreAuthNumber: string;
    tertiaryInsuranceInsuredLastName: string;
    tertiaryInsuranceInsuredFirstName: string;
    tertiaryInsurancePatientRelationshipToInsured: string;
    tertiaryInsuranceInsuredEmployerName: string;
    tertiaryInsuranceInsuredEmployerAddress1: string;
    tertiaryInsuranceInsuredEmployerCity: string;
    tertiaryInsuranceInsuredEmployerState: string;
    tertiaryInsuranceInsuredEmployerZipCode: string;
}

let HcaAdvantxRecordHDefinition = <HcaAdvantxRecordDefinition<HcaAdvantxHRecord>>{
    recordType: HcaAdvantxRecordType.H,
    fieldLocations: {
        accountNumber: { index: 0 },
        patientEmergencyContactLastName: { index: 1 },
        patientEmergencyContactFirstName: { index: 2 },
        patientRelationshipToEmergencyContact: { index: 3 },
        emergencyContactAddress1: { index: 4 },
        emergencyContactCity: { index: 5 },
        emergencyContactState: { index: 6 },
        emergencyContactZipPlusExt: { index: 7 },
        emergencyContactPhone: { index: 8 }
    }
}

interface HcaAdvantxHRecord extends HcaAdvantxBaseRecord {
    accountNumber: string;
    patientEmergencyContactLastName: string;
    patientEmergencyContactFirstName: string;
    patientRelationshipToEmergencyContact: string;
    emergencyContactAddress1: string;
    emergencyContactCity: string;
    emergencyContactState: string;
    emergencyContactZipPlusExt: string;
    emergencyContactPhone: string;
}

let HcaAdvantxRecordIDefinition = <HcaAdvantxRecordDefinition<HcaAdvantxIRecord>>{
    recordType: HcaAdvantxRecordType.I,
    fieldLocations: {
        accountNumber: { index: 0 },
        patientLastName: { index: 1 },
        patientFirstName: { index: 2 },
        patientMiddleName: { index: 3 },
        patientDateOfBirth: { index: 4 },  // (mmddyyyy)
        patientSex: { index: 5 },  // (M or F)
        dateOfService: { index: 6 },
        room: { index: 7 },
        beginTime: { index: 8 },  // (Military Time)
        endTime: { index: 9 },  // (Military Time)
        totalAppointmentTime: { index: 10 },  // (Minutes)
        anesthesiaType: { index: 11 },
        physiciansLastName: { index: 12 },
        physiciansFirstName: { index: 13 },
        caseProviderNPI: { index: 14 },
        anesthesiologistLastName: { index: 15 },
        anesthesiologistFirstName: { index: 16 },
        crnaLastName: { index: 17 },
        crnaFirstName: { index: 18 },
        cptCodeForPrimaryScheduledProcedure: { index: 19 },
        procedureDescription1: { index: 20 },
        scheduledProcedure2CPTCode: { index: 21 },
        procedureDescription2: { index: 22 },
        scheduledProcedure3CPTCode: { index: 23 },
        procedureDescription3: { index: 24 },
        scheduledProcedure4CPTCode: { index: 25 },
        procedureDescription4: { index: 26 },
        diagnosisCode1: { index: 27 },
        diagnosisCode2: { index: 28 },
        diagnosisCode3: { index: 29 },
        diagnosisCode4: { index: 30 },
        caseNumber: { index: 31 }
    }
}

interface HcaAdvantxIRecord extends HcaAdvantxBaseRecord {
    accountNumber: string;
    patientLastName: string;
    patientFirstName: string;
    patientMiddleName: string;
    patientDateOfBirth: string;
    patientSex: string;
    dateOfService: string;
    room: string;
    beginTime: string;
    endTime: string;
    totalAppointmentTime: string;
    anesthesiaType: string;
    physiciansLastName: string;
    physiciansFirstName: string;
    caseProviderNPI: string;
    anesthesiologistLastName: string;
    anesthesiologistFirstName: string;
    crnaLastName: string;
    crnaFirstName: string;
    cptCodeForPrimaryScheduledProcedure: string;
    procedureDescription1: string;
    scheduledProcedure2CPTCode: string;
    procedureDescription2: string;
    scheduledProcedure3CPTCode: string;
    procedureDescription3: string;
    scheduledProcedure4CPTCode: string;
    procedureDescription4: string;
    diagnosisCode1: string;
    diagnosisCode2: string;
    diagnosisCode3: string;
    diagnosisCode4: string;
    caseNumber: string;
}

interface HcaAdvantxRecordSet {
    sources: string[];
    facility: HcaAdvantxARecord
    patient: HcaAdvantxBRecord;
    primaryGuarantor: HcaAdvantxCRecord;
    secondaryGuarantor: HcaAdvantxDRecord;
    primaryInsurance: HcaAdvantxERecord;
    secondaryInsurance: HcaAdvantxFRecord;
    tertiaryInsurance: HcaAdvantxGRecord;
    contact: HcaAdvantxHRecord;
    schedule: HcaAdvantxIRecord;
}

export class HcaAdvantxParser {

    parse(data:string):HcaAdvantxRecordSet[] {
        let recordSets = [];
        let currentRecordSet:HcaAdvantxRecordSet;
        let rows = data.split('\n');

        for (let line = 0; line < rows.length ; line++) {
            let row = rows[line];
            let parsedRecord = this.parseRecord(line, row);
            if(!parsedRecord) {
                continue;
            }

            let { recordType, record } = parsedRecord;

            if(recordType == HcaAdvantxRecordType.A) {
                if(currentRecordSet) {
                    recordSets.push(currentRecordSet);
                }

                currentRecordSet = <HcaAdvantxRecordSet>{
                    sources: [],
                    facility: null,
                    patient: null,
                    primaryGuarantor: null,
                    secondaryGuarantor: null,
                    primaryInsurance: null,
                    secondaryInsurance: null,
                    tertiaryInsurance: null,
                    contact: null,
                    schedule: null
                };
                currentRecordSet.facility = record as HcaAdvantxARecord;
            }
            else if(recordType == HcaAdvantxRecordType.B) {
                currentRecordSet.patient = record as HcaAdvantxBRecord;
            }
            else if(recordType == HcaAdvantxRecordType.C) {
                currentRecordSet.primaryGuarantor = record as HcaAdvantxCRecord;
            }
            else if(recordType == HcaAdvantxRecordType.D) {
                currentRecordSet.secondaryGuarantor = record as HcaAdvantxDRecord;
            }
            else if(recordType == HcaAdvantxRecordType.E) {
                currentRecordSet.primaryInsurance = record as HcaAdvantxERecord;;
            }
            else if(recordType == HcaAdvantxRecordType.F) {
                currentRecordSet.secondaryInsurance = record as HcaAdvantxFRecord;
            }
            else if(recordType == HcaAdvantxRecordType.G) {
                currentRecordSet.tertiaryInsurance = record as HcaAdvantxGRecord;
            }
            else if(recordType == HcaAdvantxRecordType.H) {
                currentRecordSet.contact = record as HcaAdvantxHRecord;
            }
            else if(recordType == HcaAdvantxRecordType.I) {
                currentRecordSet.schedule = record as HcaAdvantxIRecord;
            }

            currentRecordSet.sources.push(row);
        }
        recordSets.push(currentRecordSet);
        return recordSets;
    }

    private parseRecord(line:number,row:string):{recordType:HcaAdvantxRecordType, record:HcaAdvantxBaseRecord}|null {
        let recordTypeCode = ((line+1) % 9);
        let recordTypeDefinition;

        let record:HcaAdvantxBaseRecord;
        switch(recordTypeCode) {
            case HcaAdvantxRecordType.A: record = this.generateRecord<HcaAdvantxARecord>(row, HcaAdvantxRecordADefinition); recordTypeDefinition = HcaAdvantxRecordADefinition; break;
            case HcaAdvantxRecordType.B: record = this.generateRecord<HcaAdvantxBRecord>(row, HcaAdvantxRecordBDefinition); recordTypeDefinition = HcaAdvantxRecordBDefinition; break;
            case HcaAdvantxRecordType.C: record = this.generateRecord<HcaAdvantxCRecord>(row, HcaAdvantxRecordCDefinition); recordTypeDefinition = HcaAdvantxRecordCDefinition; break;
            case HcaAdvantxRecordType.D: record = this.generateRecord<HcaAdvantxDRecord>(row, HcaAdvantxRecordDDefinition); recordTypeDefinition = HcaAdvantxRecordDDefinition; break;
            case HcaAdvantxRecordType.E: record = this.generateRecord<HcaAdvantxERecord>(row, HcaAdvantxRecordEDefinition); recordTypeDefinition = HcaAdvantxRecordEDefinition; break;
            case HcaAdvantxRecordType.F: record = this.generateRecord<HcaAdvantxFRecord>(row, HcaAdvantxRecordFDefinition); recordTypeDefinition = HcaAdvantxRecordFDefinition; break;
            case HcaAdvantxRecordType.G: record = this.generateRecord<HcaAdvantxGRecord>(row, HcaAdvantxRecordGDefinition); recordTypeDefinition = HcaAdvantxRecordGDefinition; break;
            case HcaAdvantxRecordType.H: record = this.generateRecord<HcaAdvantxHRecord>(row, HcaAdvantxRecordHDefinition); recordTypeDefinition = HcaAdvantxRecordHDefinition; break;
            case HcaAdvantxRecordType.I: record = this.generateRecord<HcaAdvantxIRecord>(row, HcaAdvantxRecordIDefinition); recordTypeDefinition = HcaAdvantxRecordIDefinition; break;
            default: console.log('Unable to determine record type, unknown code: ' + recordTypeCode); return null;
        }

        let recordType = recordTypeDefinition.recordType;
        return {recordType, record};
    }

    private generateRecord<T extends HcaAdvantxBaseRecord>(row:string, recordDefinition:HcaAdvantxRecordDefinition<T>):T {
        let record:T = <T>{};
        // tslint:disable-next-line:forin
        for(let field in recordDefinition.fieldLocations) {
            Object.assign(record, { [field]: this.getField(row, recordDefinition.fieldLocations[field]) });
        }
        return record;
    }

    private getField(row:string, fieldLocation:HcaAdvantxFieldLocation):string|null {
        let recordDelimiter:string = String.fromCharCode(94); //caret (^)
        try {
            let value = row.split(recordDelimiter)[fieldLocation.index];
            value = _.trim(value);
            if(value === "") value = null;
            return value;
        }
        catch(error) {
            return null;
        }
    }
}

export default HcaAdvantxParser;