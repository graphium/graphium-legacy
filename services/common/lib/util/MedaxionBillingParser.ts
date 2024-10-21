import * as _ from 'lodash';
import * as xmljs from 'xml-js';

interface MedaxionRecord {
    caseId: string;
    syntheticCaseId: string;
    caseNumber: string;
    locationId: string;
    locationName: string;
    scheduledAtDate: string;
    scheduledAtTime: string;
    scheduledProcedure: string;
    scheduledDiagnosis: string;
    arrivedAtDate: string;
    arrivedAtTime: string;
    dischargedAtDate: string;
    dischargedAtTime: string;
    patientNumber: string;
    patientSex: string;
    patientDateOfBirth: string;
    patientLastName: string;
    patientFirstName: string;
    patientMiddleName: string;
    patientAddress1: string;
    patientAddress2: string;
    patientCity: string;
    patientState: string;
    patientZipCode: string;
    patientPhoneNumber: string;
    patientEmail: string;
    asaClassification: string;
    inOutStatus: string;
    primaryAnestheticType: string;
    anesthesiaReadyDate: string;
    anesthesiaReadyTime: string;
    anesthesiaStartDate: string;
    anesthesiaStartTime: string;
    anesthesiaEndDate: string;
    anesthesiaEndTime: string;
    surgeryStartDate: string;
    surgeryStartTime: string;
    surgeryEndDate: string;
    surgeryEndTime: string;
    pacuArrivalDate: string;
    pacuArrivalTime: string;
    enterOrDate: string;
    enterOrTime: string;
    convertCSectionDate: string;
    convertCSectionTime: string;
    uterineIncisionDate: string;
    uterineIncisionTime: string;
    timeoutDate: string;
    timeoutTime: string;
    deliveryDate: string;
    deliveryTime: string;
    surgeonLastName: string;
    surgeonFirstName: string;
    surgeonNpi: string;
    providerLastName1: string;
    providerFirstName1: string;
    providerNpi1: string;
    providerType1: string;
    providerCredential1: string;
    providerStartDate1: string;
    providerStartTime1: string;
    providerEndDate1: string;
    providerEndTime1: string;
    providerLastName2: string;
    providerFirstName2: string;
    providerNpi2: string;
    providerType2: string;
    providerCredential2: string;
    providerStartDate2: string;
    providerStartTime2: string;
    providerEndDate2: string;
    providerEndTime2: string;
    providerLastName3: string;
    providerFirstName3: string;
    providerNpi3: string;
    providerType3: string;
    providerCredential3: string;
    providerStartDate3: string;
    providerStartTime3: string;
    providerEndDate3: string;
    providerEndTime3: string;
    providerLastName4: string;
    providerFirstName4: string;
    providerNpi4: string;
    providerType4: string;
    providerCredential4: string;
    providerStartDate4: string;
    providerStartTime4: string;
    providerEndDate4: string;
    providerEndTime4: string;
    providerLastName5: string;
    providerFirstName5: string;
    providerNpi5: string;
    providerType5: string;
    providerCredential5: string;
    providerStartDate5: string;
    providerStartTime5: string;
    providerEndDate5: string;
    providerEndTime5: string;
    providerLastName6: string;
    providerFirstName6: string;
    providerNpi6: string;
    providerType6: string;
    providerCredential6: string;
    providerStartDate6: string;
    providerStartTime6: string;
    providerEndDate6: string;
    providerEndTime6: string;
    icd10Code1: string;
    icd10Description1: string;
    icd10Code2: string;
    icd10Description2: string;
    icd10Code3: string;
    icd10Description3: string;
    icd10Code4: string;
    icd10Description4: string;
    icd10Code5: string;
    icd10Description5: string;
    icd10Code6: string;
    icd10Description6: string;
    icd10Code7: string;
    icd10Description7: string;
    icd10Code8: string;
    icd10Description8: string;
    icd10Code9: string;
    icd10Description9: string;
    icd10Code10: string;
    icd10Description10: string;
    guarantorLastName: string;
    guarantorFirstName: string;
    guarantorGender: string;
    guarantorAddress1: string;
    guarantorAddress2: string;
    guarantorCity: string;
    guarantorState: string;
    guarantorZipCode: string;
    guarantorPhoneNumber: string;
    guarantorAreaCode: string;
    guarantorDateOfBirth: string;
    guarantorEmployerName: string;
    guarantorEmployerAddress1: string;
    guarantorRelationshipToPatient: string;
    ins1InsuredLastName: string;
    ins1InsuredFirstName: string;
    ins1InsuredMiddleName: string;
    ins1InsuredGender: string;
    ins1InsuredDateOfBirth: string;
    ins1InsuranceGroupNumber: string;
    ins1SubscriberPolicyNumber: string;
    ins1PayerName: string;
    ins1PayerAddress1: string;
    ins1PayerAddress2: string;
    ins1PayerCity: string;
    ins1PayerState: string;
    ins1PayerZipCode: string;
    ins1PlanId: string;
    ins1RelationshipToPatient: string;
    ins2InsuredLastName: string;
    ins2InsuredFirstName: string;
    ins2InsuredMiddleName: string;
    ins2InsuredGender: string;
    ins2InsuredDateOfBirth: string;
    ins2InsuranceGroupNumber: string;
    ins2SubscriberPolicyNumber: string;
    ins2PayerName: string;
    ins2PayerAddress1: string;
    ins2PayerAddress2: string;
    ins2PayerCity: string;
    ins2PayerState: string;
    ins2PayerZipCode: string;
    ins2PlanId: string;
    ins2RelationshipToPatient: string;
    ins3InsuredLastName: string;
    ins3InsuredFirstName: string;
    ins3InsuredMiddleName: string;
    ins3InsuredGender: string;
    ins3InsuredDateOfBirth: string;
    ins3InsuranceGroupNumber: string;
    ins3SubscriberPolicyNumber: string;
    ins3PayerName: string;
    ins3PayerAddress1: string;
    ins3PayerAddress2: string;
    ins3PayerCity: string;
    ins3PayerState: string;
    ins3PayerZipCode: string;
    ins3PlanId: string;
    ins3RelationshipToPatient: string;
}

function getDate(dateTimeString: string): string {
    const dateParts = dateTimeString ? dateTimeString.split('T') : [];
    const date = dateParts.length > 0 ? dateParts[0] : null;
    return date;
}

function getTime(dateTimeString: string): string {
    const dateParts = dateTimeString ? dateTimeString.split('T') : [];
    const timeParts = dateParts[1] ? dateParts[1].split(/[+-]/) : [];
    const time = timeParts.length > 0 ? timeParts[0] : null;
    return time;
}

function getValueAtPath(obj: any, path: string): any {
    const keys = path.split('.'); // Split the path into keys
    try {
        let currentObj = obj;
        for (const key of keys) {
            // Check if the current object has the property
            if (!(key in currentObj)) {
                return null;
            }

            // Move to the next object using the current key
            currentObj = currentObj[key];
        }

        if (_.trim(currentObj) === '') {
            return null;
        }
        return currentObj;
    } catch (error) {
        return null;
    }
}

function getKeyEventTimestamp(caseItem: object, eventName: string): string {
    try {
      if (caseItem &&
          caseItem["case-info"] &&
          caseItem["case-info"]["events"] &&
          caseItem["case-info"]["events"]["key-events"] &&
          caseItem["case-info"]["events"]["key-events"]["key-event"]) {
          let keyEvents = caseItem["case-info"]["events"]["key-events"]["key-event"];
          if (!Array.isArray(keyEvents)) {
              keyEvents = [keyEvents];
          }
          let dateString: string = "";
          for (const event of keyEvents) {
              if (event.sysid._text === eventName) {
                  dateString = event["performed-at"]._text;
                  break;
              }
          }
          if (_.trim(dateString) === "") {
              return null;
          }
          return dateString;
      }
      return null;
    } catch (error) {
        return null;
    }
}
function getPrimaryAnesthetic(caseItem: object): object {
    try {
        const anesthetics = caseItem['case-info']['anesthetic-types']['anesthetic-type'];
        if (Array.isArray(anesthetics)) {
            return anesthetics[0];
        } else {
            return anesthetics;
        }
    } catch (error) {
        return {};
    }
}

function getPrimarySurgeonProvider(caseItem: object): object {
    try {
        const surgeons = caseItem['case-info']['surgeons']['surgeon'];
        if (Array.isArray(surgeons)) {
            return surgeons[0];
        } else {
            return surgeons;
        }
    } catch (error) {
        return {};
    }
}

interface Key {
    _text: string;
}

interface Value {
    _text: string;
}

interface KeyValue {
    key: Key;
    value: Value;
}

function getDemographicValueByKey(demographics: KeyValue[], keyIdToFind: string): string | null {
    if (demographics && demographics.length > 0) {
        let object = demographics.find((obj) => obj.key._text === keyIdToFind);
        return object ? object.value._text : null;
    }
    return null;
}

function getDemographicValueByKeySafe(caseItem: any, key: string): string | null {
    if (
        caseItem &&
        caseItem['case-info'] &&
        caseItem['case-info']['demographics-and-insurance-data'] &&
        caseItem['case-info']['demographics-and-insurance-data']['demographics-and-insurance-datum']
    ) {
        return getDemographicValueByKey(
            caseItem['case-info']['demographics-and-insurance-data']['demographics-and-insurance-datum'],
            key,
        );
    }
    return null;
}

function formatDate(date: string): string | null {
    if (!date) {
        return null;
    }
    return date.slice(0, 4) + '-' + date.slice(4, 6) + '-' + date.slice(6, 8);
}

function getAnesthesiaProvider(assignment: any, sequence: number, path: string): string | null {
    try {
        if (Array.isArray(assignment)) {
            return getValueAtPath(assignment[sequence - 1], path);
        } else {
            return sequence === 1 ? getValueAtPath(assignment, path) : null;
        }
    } catch (error) {
        return null;
    }
}

function getAnesthesiaProviderSafe(caseItem: any, providerIndex: number, property: string): string | null {
    try {
        if (
            caseItem &&
            caseItem['case-info'] &&
            caseItem['case-info'].assignments &&
            caseItem['case-info'].assignments.assignment
        ) {
            return getAnesthesiaProvider(caseItem['case-info'].assignments.assignment, providerIndex, property);
        }
        return null;
    } catch (error) {
        return null;
    }
}

function getDiagnosis(icds: any, sequence: number, path: string): string | null {
    try {
        if (Array.isArray(icds)) {
            return getValueAtPath(icds[sequence - 1], path);
        } else {
            return sequence === 1 ? getValueAtPath(icds, path) : null;
        }
    } catch (error) {
        console.log(error);
        return null;
    }
}

function getDiagnosisSafe(caseItem: any, index: number, property: string): string | null {
    try {
        if (caseItem && caseItem['case-info'] && caseItem['case-info'].icd10s && caseItem['case-info'].icd10s.icd10) {
            return getDiagnosis(caseItem['case-info'].icd10s.icd10, index, property);
        }
        return null;
    } catch (error) {
        return null;
    }
}

export class MedaxionParser {
    parse(data: string): MedaxionRecord[] {
        let recordSet = [];
        const xmlData = xmljs.xml2json(data, { compact: true, spaces: 4 });
        const jsonData = JSON.parse(xmlData);

        let medaxionCases = Array.isArray(jsonData.cases.case) ? jsonData.cases.case : [jsonData.cases.case];
        medaxionCases.forEach((caseItem) => {
            const currentRecord: MedaxionRecord = {
                caseId: getValueAtPath(caseItem, 'case-info.case-id._text'),
                syntheticCaseId: getValueAtPath(caseItem, 'case-info.synthetic-case-id._text'),
                caseNumber: getValueAtPath(caseItem, 'case-info.case-number._text'),
                locationId: getValueAtPath(caseItem, 'case-info.location.location-id._text'),
                locationName: getValueAtPath(caseItem, 'case-info.location.name._text'),
                scheduledAtDate: getDate(getValueAtPath(caseItem, 'case-info.scheduled-at._text')),
                scheduledAtTime: getTime(getValueAtPath(caseItem, 'case-info.scheduled-at._text')),
                scheduledProcedure: getValueAtPath(caseItem, 'case-info.scheduled-procedure._text'),
                scheduledDiagnosis: getValueAtPath(caseItem, 'case-info.scheduled-diagnosis._text'),
                arrivedAtDate: getDate(getValueAtPath(caseItem, 'case-info.arrived-at._text')),
                arrivedAtTime: getTime(getValueAtPath(caseItem, 'case-info.arrived-at._text')),
                dischargedAtDate: getDate(getValueAtPath(caseItem, 'case-info.discharged-at._text')),
                dischargedAtTime: getTime(getValueAtPath(caseItem, 'case-info.discharged-at._text')),
                patientNumber: getValueAtPath(caseItem, 'case-info.patient.patient-number._text'),
                patientSex: getValueAtPath(caseItem, 'case-info.sex._text'),
                patientDateOfBirth: getValueAtPath(caseItem, 'case-info.patient.date-of-birth._text'),
                patientLastName: getValueAtPath(caseItem, 'case-info.patient.last-name._text'),
                patientFirstName: getValueAtPath(caseItem, 'case-info.patient.first-name._text'),
                patientMiddleName: getDemographicValueByKeySafe(caseItem, 'pt_middle_name'),
                patientAddress1: getDemographicValueByKeySafe(caseItem, 'pt_address_1'),
                patientAddress2: getDemographicValueByKeySafe(caseItem, 'pt_address_2'),
                patientCity: getDemographicValueByKeySafe(caseItem, 'pt_city'),
                patientState: getDemographicValueByKeySafe(caseItem, 'pt_state_territory'),
                patientZipCode: getDemographicValueByKeySafe(caseItem, 'pt_postal_code'),
                patientPhoneNumber: getValueAtPath(caseItem, 'case-info.patient.phone-number._text'),
                patientEmail: getValueAtPath(caseItem, 'case-info.patient.email._text'),
                asaClassification: getValueAtPath(caseItem, 'case-info.asa-classification.class._text'),
                inOutStatus: getValueAtPath(caseItem, 'case-info.in-out-status._text'),
                primaryAnestheticType: getValueAtPath(getPrimaryAnesthetic(caseItem), 'sysid._text'),
                anesthesiaReadyDate: getDate(getKeyEventTimestamp(caseItem, 'anesthesia_ready')),
                anesthesiaReadyTime: getTime(getKeyEventTimestamp(caseItem, 'anesthesia_ready')),
                anesthesiaStartDate: getDate(getKeyEventTimestamp(caseItem, 'anesthesia_start')),
                anesthesiaStartTime: getTime(getKeyEventTimestamp(caseItem, 'anesthesia_start')),
                anesthesiaEndDate: getDate(getKeyEventTimestamp(caseItem, 'anesthesia_stop')),
                anesthesiaEndTime: getTime(getKeyEventTimestamp(caseItem, 'anesthesia_stop')),
                surgeryStartDate: getDate(getKeyEventTimestamp(caseItem, 'surgery_start')),
                surgeryStartTime: getTime(getKeyEventTimestamp(caseItem, 'surgery_start')),
                surgeryEndDate: getDate(getKeyEventTimestamp(caseItem, 'surgery_stop')),
                surgeryEndTime: getTime(getKeyEventTimestamp(caseItem, 'surgery_stop')),
                pacuArrivalDate: getDate(getKeyEventTimestamp(caseItem, 'pacu_arrival')),
                pacuArrivalTime: getTime(getKeyEventTimestamp(caseItem, 'pacu_arrival')),
                enterOrDate: getDate(getKeyEventTimestamp(caseItem, 'enter_or')),
                enterOrTime: getTime(getKeyEventTimestamp(caseItem, 'enter_or')),
                convertCSectionDate: getDate(getKeyEventTimestamp(caseItem, 'convert_csection')),
                convertCSectionTime: getTime(getKeyEventTimestamp(caseItem, 'convert_csection')),
                uterineIncisionDate: getDate(getKeyEventTimestamp(caseItem, 'uterine_incision')),
                uterineIncisionTime: getTime(getKeyEventTimestamp(caseItem, 'uterine_incision')),
                timeoutDate: getDate(getKeyEventTimestamp(caseItem, 'timeout')),
                timeoutTime: getTime(getKeyEventTimestamp(caseItem, 'timeout')),
                deliveryDate: getDate(getKeyEventTimestamp(caseItem, 'delivery')),
                deliveryTime: getTime(getKeyEventTimestamp(caseItem, 'delivery')),
                surgeonLastName: getValueAtPath(getPrimarySurgeonProvider(caseItem), 'last-name._text'),
                surgeonFirstName: getValueAtPath(getPrimarySurgeonProvider(caseItem), 'first-name._text'),
                surgeonNpi: getValueAtPath(getPrimarySurgeonProvider(caseItem), 'national-provider-id._text'),
                providerLastName1: getAnesthesiaProviderSafe(caseItem, 1, 'assignee.user.last-name._text'),
                providerFirstName1: getAnesthesiaProviderSafe(caseItem, 1, 'assignee.user.first-name._text'),
                providerNpi1: getAnesthesiaProviderSafe(caseItem, 1, 'assignee.user.national-provider-id._text'),
                providerType1: getAnesthesiaProviderSafe(caseItem, 1, 'assignee.user.provider-type._text'),
                providerCredential1: getAnesthesiaProviderSafe(caseItem, 1, 'assignee.user.primary-credential._text'),
                providerStartDate1: getDate(getAnesthesiaProviderSafe(caseItem, 1, 'start-time._text')),
                providerStartTime1: getTime(getAnesthesiaProviderSafe(caseItem, 1, 'start-time._text')),
                providerEndDate1: getDate(getAnesthesiaProviderSafe(caseItem, 1, 'end-time._text')),
                providerEndTime1: getTime(getAnesthesiaProviderSafe(caseItem, 1, 'end-time._text')),
                providerLastName2: getAnesthesiaProviderSafe(caseItem, 2, 'assignee.user.last-name._text'),
                providerFirstName2: getAnesthesiaProviderSafe(caseItem, 2, 'assignee.user.first-name._text'),
                providerNpi2: getAnesthesiaProviderSafe(caseItem, 2, 'assignee.user.national-provider-id._text'),
                providerType2: getAnesthesiaProviderSafe(caseItem, 2, 'assignee.user.provider-type._text'),
                providerCredential2: getAnesthesiaProviderSafe(caseItem, 2, 'assignee.user.primary-credential._text'),
                providerStartDate2: getDate(getAnesthesiaProviderSafe(caseItem, 2, 'start-time._text')),
                providerStartTime2: getTime(getAnesthesiaProviderSafe(caseItem, 2, 'start-time._text')),
                providerEndDate2: getDate(getAnesthesiaProviderSafe(caseItem, 2, 'end-time._text')),
                providerEndTime2: getTime(getAnesthesiaProviderSafe(caseItem, 2, 'end-time._text')),
                providerLastName3: getAnesthesiaProviderSafe(caseItem, 3, 'assignee.user.last-name._text'),
                providerFirstName3: getAnesthesiaProviderSafe(caseItem, 3, 'assignee.user.first-name._text'),
                providerNpi3: getAnesthesiaProviderSafe(caseItem, 3, 'assignee.user.national-provider-id._text'),
                providerType3: getAnesthesiaProviderSafe(caseItem, 3, 'assignee.user.provider-type._text'),
                providerCredential3: getAnesthesiaProviderSafe(caseItem, 3, 'assignee.user.primary-credential._text'),
                providerStartDate3: getDate(getAnesthesiaProviderSafe(caseItem, 3, 'start-time._text')),
                providerStartTime3: getTime(getAnesthesiaProviderSafe(caseItem, 3, 'start-time._text')),
                providerEndDate3: getDate(getAnesthesiaProviderSafe(caseItem, 3, 'end-time._text')),
                providerEndTime3: getTime(getAnesthesiaProviderSafe(caseItem, 3, 'end-time._text')),
                providerLastName4: getAnesthesiaProviderSafe(caseItem, 4, 'assignee.user.last-name._text'),
                providerFirstName4: getAnesthesiaProviderSafe(caseItem, 4, 'assignee.user.first-name._text'),
                providerNpi4: getAnesthesiaProviderSafe(caseItem, 4, 'assignee.user.national-provider-id._text'),
                providerType4: getAnesthesiaProviderSafe(caseItem, 4, 'assignee.user.provider-type._text'),
                providerCredential4: getAnesthesiaProviderSafe(caseItem, 4, 'assignee.user.primary-credential._text'),
                providerStartDate4: getDate(getAnesthesiaProviderSafe(caseItem, 4, 'start-time._text')),
                providerStartTime4: getTime(getAnesthesiaProviderSafe(caseItem, 4, 'start-time._text')),
                providerEndDate4: getDate(getAnesthesiaProviderSafe(caseItem, 4, 'end-time._text')),
                providerEndTime4: getTime(getAnesthesiaProviderSafe(caseItem, 4, 'end-time._text')),
                providerLastName5: getAnesthesiaProviderSafe(caseItem, 5, 'assignee.user.last-name._text'),
                providerFirstName5: getAnesthesiaProviderSafe(caseItem, 5, 'assignee.user.first-name._text'),
                providerNpi5: getAnesthesiaProviderSafe(caseItem, 5, 'assignee.user.national-provider-id._text'),
                providerType5: getAnesthesiaProviderSafe(caseItem, 5, 'assignee.user.provider-type._text'),
                providerCredential5: getAnesthesiaProviderSafe(caseItem, 5, 'assignee.user.primary-credential._text'),
                providerStartDate5: getDate(getAnesthesiaProviderSafe(caseItem, 5, 'start-time._text')),
                providerStartTime5: getTime(getAnesthesiaProviderSafe(caseItem, 5, 'start-time._text')),
                providerEndDate5: getDate(getAnesthesiaProviderSafe(caseItem, 5, 'end-time._text')),
                providerEndTime5: getTime(getAnesthesiaProviderSafe(caseItem, 5, 'end-time._text')),
                providerLastName6: getAnesthesiaProviderSafe(caseItem, 6, 'assignee.user.last-name._text'),
                providerFirstName6: getAnesthesiaProviderSafe(caseItem, 6, 'assignee.user.first-name._text'),
                providerNpi6: getAnesthesiaProviderSafe(caseItem, 6, 'assignee.user.national-provider-id._text'),
                providerType6: getAnesthesiaProviderSafe(caseItem, 6, 'assignee.user.provider-type._text'),
                providerCredential6: getAnesthesiaProviderSafe(caseItem, 6, 'assignee.user.primary-credential._text'),
                providerStartDate6: getDate(getAnesthesiaProviderSafe(caseItem, 6, 'start-time._text')),
                providerStartTime6: getTime(getAnesthesiaProviderSafe(caseItem, 6, 'start-time._text')),
                providerEndDate6: getDate(getAnesthesiaProviderSafe(caseItem, 6, 'end-time._text')),
                providerEndTime6: getTime(getAnesthesiaProviderSafe(caseItem, 6, 'end-time._text')),
                icd10Code1: getDiagnosisSafe(caseItem, 1, '_attributes.code'),
                icd10Description1: getDiagnosisSafe(caseItem, 1, 'name._text'),
                icd10Code2: getDiagnosisSafe(caseItem, 2, '_attributes.code'),
                icd10Description2: getDiagnosisSafe(caseItem, 2, 'name._text'),
                icd10Code3: getDiagnosisSafe(caseItem, 3, '_attributes.code'),
                icd10Description3: getDiagnosisSafe(caseItem, 3, 'name._text'),
                icd10Code4: getDiagnosisSafe(caseItem, 4, '_attributes.code'),
                icd10Description4: getDiagnosisSafe(caseItem, 4, 'name._text'),
                icd10Code5: getDiagnosisSafe(caseItem, 5, '_attributes.code'),
                icd10Description5: getDiagnosisSafe(caseItem, 5, 'name._text'),
                icd10Code6: getDiagnosisSafe(caseItem, 6, '_attributes.code'),
                icd10Description6: getDiagnosisSafe(caseItem, 6, 'name._text'),
                icd10Code7: getDiagnosisSafe(caseItem, 7, '_attributes.code'),
                icd10Description7: getDiagnosisSafe(caseItem, 7, 'name._text'),
                icd10Code8: getDiagnosisSafe(caseItem, 8, '_attributes.code'),
                icd10Description8: getDiagnosisSafe(caseItem, 8, 'name._text'),
                icd10Code9: getDiagnosisSafe(caseItem, 9, '_attributes.code'),
                icd10Description9: getDiagnosisSafe(caseItem, 9, 'name._text'),
                icd10Code10: getDiagnosisSafe(caseItem, 10, '_attributes.code'),
                icd10Description10: getDiagnosisSafe(caseItem, 10, 'name._text'),
                guarantorLastName: getDemographicValueByKeySafe(caseItem, 'gt_last_name'),
                guarantorFirstName: getDemographicValueByKeySafe(caseItem, 'gt_first_name'),
                guarantorGender: getDemographicValueByKeySafe(caseItem, 'gt_gender'),
                guarantorAddress1: getDemographicValueByKeySafe(caseItem, 'gt_address_1'),
                guarantorAddress2: getDemographicValueByKeySafe(caseItem, 'gt_address_2'),
                guarantorCity: getDemographicValueByKeySafe(caseItem, 'gt_city'),
                guarantorState: getDemographicValueByKeySafe(caseItem, 'gt_state_territory'),
                guarantorZipCode: getDemographicValueByKeySafe(caseItem, 'gt_postal_code'),
                guarantorPhoneNumber: getDemographicValueByKeySafe(caseItem, 'gt_phone_number'),
                guarantorAreaCode: getDemographicValueByKeySafe(caseItem, 'gt_area_code'),
                guarantorDateOfBirth: formatDate(getDemographicValueByKeySafe(caseItem, 'gt_date_of_birth')),
                guarantorEmployerName: getDemographicValueByKeySafe(caseItem, 'gt_employer_name'),
                guarantorEmployerAddress1: getDemographicValueByKeySafe(caseItem, 'gt_employer_address_1'),
                guarantorRelationshipToPatient: getDemographicValueByKeySafe(caseItem, 'gt_relationship_to_patient'),
                ins1InsuredLastName: getDemographicValueByKeySafe(caseItem, 'in_last_name'),
                ins1InsuredFirstName: getDemographicValueByKeySafe(caseItem, 'in_first_name'),
                ins1InsuredMiddleName: getDemographicValueByKeySafe(caseItem, 'in_middle_name'),
                ins1InsuredGender: getDemographicValueByKeySafe(caseItem, 'in_gender'),
                ins1InsuredDateOfBirth: formatDate(getDemographicValueByKeySafe(caseItem, 'in_date_of_birth')),
                ins1InsuranceGroupNumber: getDemographicValueByKeySafe(caseItem, 'in_group_number'),
                ins1SubscriberPolicyNumber: getDemographicValueByKeySafe(caseItem, 'in_subscriber_policy_number'),
                ins1PayerName: getDemographicValueByKeySafe(caseItem, 'in_payer_name'),
                ins1PayerAddress1: getDemographicValueByKeySafe(caseItem, 'in_payer_address_1'),
                ins1PayerAddress2: getDemographicValueByKeySafe(caseItem, 'in_payer_address_2'),
                ins1PayerCity: getDemographicValueByKeySafe(caseItem, 'in_payer_city'),
                ins1PayerState: getDemographicValueByKeySafe(caseItem, 'in_payer_state_territory'),
                ins1PayerZipCode: getDemographicValueByKeySafe(caseItem, 'in_payer_postal_code'),
                ins1PlanId: getDemographicValueByKeySafe(caseItem, 'in_plan_id'),
                ins1RelationshipToPatient: getDemographicValueByKeySafe(caseItem, 'in_relationship_to_patient'),
                ins2InsuredLastName: getDemographicValueByKeySafe(caseItem, 'in2_last_name'),
                ins2InsuredFirstName: getDemographicValueByKeySafe(caseItem, 'in2_first_name'),
                ins2InsuredMiddleName: getDemographicValueByKeySafe(caseItem, 'in2_middle_name'),
                ins2InsuredGender: getDemographicValueByKeySafe(caseItem, 'in2_gender'),
                ins2InsuredDateOfBirth: formatDate(getDemographicValueByKeySafe(caseItem, 'in2_date_of_birth')),
                ins2InsuranceGroupNumber: getDemographicValueByKeySafe(caseItem, 'in2_group_number'),
                ins2SubscriberPolicyNumber: getDemographicValueByKeySafe(caseItem, 'in2_subscriber_policy_number'),
                ins2PayerName: getDemographicValueByKeySafe(caseItem, 'in2_payer_name'),
                ins2PayerAddress1: getDemographicValueByKeySafe(caseItem, 'in2_payer_address_1'),
                ins2PayerAddress2: getDemographicValueByKeySafe(caseItem, 'in2_payer_address_2'),
                ins2PayerCity: getDemographicValueByKeySafe(caseItem, 'in2_payer_city'),
                ins2PayerState: getDemographicValueByKeySafe(caseItem, 'in2_payer_state_territory'),
                ins2PayerZipCode: getDemographicValueByKeySafe(caseItem, 'in2_payer_postal_code'),
                ins2PlanId: getDemographicValueByKeySafe(caseItem, 'in2_plan_id'),
                ins2RelationshipToPatient: getDemographicValueByKeySafe(caseItem, 'in2_relationship_to_patient'),
                ins3InsuredLastName: getDemographicValueByKeySafe(caseItem, 'in3_last_name'),
                ins3InsuredFirstName: getDemographicValueByKeySafe(caseItem, 'in3_first_name'),
                ins3InsuredMiddleName: getDemographicValueByKeySafe(caseItem, 'in3_middle_name'),
                ins3InsuredGender: getDemographicValueByKeySafe(caseItem, 'in3_gender'),
                ins3InsuredDateOfBirth: formatDate(getDemographicValueByKeySafe(caseItem, 'in3_date_of_birth')),
                ins3InsuranceGroupNumber: getDemographicValueByKeySafe(caseItem, 'in3_group_number'),
                ins3SubscriberPolicyNumber: getDemographicValueByKeySafe(caseItem, 'in3_subscriber_policy_number'),
                ins3PayerName: getDemographicValueByKeySafe(caseItem, 'in3_payer_name'),
                ins3PayerAddress1: getDemographicValueByKeySafe(caseItem, 'in3_payer_address_1'),
                ins3PayerAddress2: getDemographicValueByKeySafe(caseItem, 'in3_payer_address_2'),
                ins3PayerCity: getDemographicValueByKeySafe(caseItem, 'in3_payer_city'),
                ins3PayerState: getDemographicValueByKeySafe(caseItem, 'in3_payer_state_territory'),
                ins3PayerZipCode: getDemographicValueByKeySafe(caseItem, 'in3_payer_postal_code'),
                ins3PlanId: getDemographicValueByKeySafe(caseItem, 'in3_plan_id'),
                ins3RelationshipToPatient: getDemographicValueByKeySafe(caseItem, 'in3_relationship_to_patient'),
            };
            recordSet.push(currentRecord);
        });

        return recordSet;
    }
}

export default MedaxionParser;
