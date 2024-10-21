
function safeExtractDate(dateTimeString) {
    if( !dateTimeString )
    	return null;
			
    var matches = dateTimeString.match( /(\d{4}-\d{2}-\d{2})/g );
    if( matches.length > 0 )
        return matches[0];
    return null;
}

function safeExtractTime(dateTimeString) {
    if( !dateTimeString )
        return null;
    
    var matches = dateTimeString.match( /(\d{2}:\d{2}:\d{2})/g );
    if( matches.length > 0 )
        return matches[0];
    return null;
}

function copyPropertyIfSet(targetObject, targetPropertyName, sourceObject, sourcePropertyName, formatFunction ) {
    if( sourceObject.hasOwnProperty(sourcePropertyName) ) {
        var value = sourceObject[sourcePropertyName];
        if(value != null && formatFunction != null)
            value = formatFunction(value);
        targetObject[targetPropertyName] = value;
    }
}

function generatePatchedEncounterFromGicMessage(messageContent) {
    var encounter = {};    
    copyPropertyIfSet(encounter, "encounterNumber", messageContent, "AccountNumber");
    copyPropertyIfSet(encounter, "patientMrn", messageContent, "PatientID_EMR");
    copyPropertyIfSet(encounter, "patientLastName", messageContent, "LastName");
    copyPropertyIfSet(encounter, "patientFirstName", messageContent, "FirstName");
    copyPropertyIfSet(encounter, "patientMiddleName", messageContent, "MiddleName");
    copyPropertyIfSet(encounter, "patientSsn", messageContent, "SSN");
    copyPropertyIfSet(encounter, "patientDob", messageContent, "DOB", function(value) { return moment(messageContent.DOB).format('YYYY-MM-DD'); });
    // We first run this on StartDate/EndDate, and it might be overwritten if AdmissionDate and DischargeDate are set, which 
    // is the priority.
    copyPropertyIfSet(encounter, "admitDate", messageContent, "StartDate", safeExtractDate);
    copyPropertyIfSet(encounter, "admitTime", messageContent, "StartDate", safeExtractTime);
    copyPropertyIfSet(encounter, "dischargeDate", messageContent, "EndDate", safeExtractDate);
    copyPropertyIfSet(encounter, "dischargeTime", messageContent, "EndDate", safeExtractTime);
    // Now we run this on Admission/DischargeDate
    copyPropertyIfSet(encounter, "admitDate", messageContent, "AdmissionDate", safeExtractDate);
    copyPropertyIfSet(encounter, "admitTime", messageContent, "AdmissionDate", safeExtractTime);
    copyPropertyIfSet(encounter, "dischargeDate", messageContent, "DischargeDate", safeExtractDate);
    copyPropertyIfSet(encounter, "dischargeTime", messageContent, "DischargeDate", safeExtractTime);
    // ...
    //
    copyPropertyIfSet(encounter, "patientAddressLine1", messageContent, "Address1");
    copyPropertyIfSet(encounter, "patientAddressLine2", messageContent, "Address2");
    copyPropertyIfSet(encounter, "patientCity", messageContent, "City");
    copyPropertyIfSet(encounter, "patientState", messageContent, "State");
    copyPropertyIfSet(encounter, "patientState", messageContent, "StateAbbreviation");
    copyPropertyIfSet(encounter, "patientZipCode", messageContent, "Postal");
    copyPropertyIfSet(encounter, "patientCountryCode", messageContent, "Country");
    copyPropertyIfSet(encounter, "patientHomePhone", messageContent, "HomePhone");
    copyPropertyIfSet(encounter, "patientWorkPhone", messageContent, "WorkPhone");
    copyPropertyIfSet(encounter, "patientMobilePhone", messageContent, "CellPhone");
    copyPropertyIfSet(encounter, "patientHomeEmail", messageContent, "HomeEmailAddress");
    copyPropertyIfSet(encounter, "patientWorkEmail", messageContent, "WorkEmailAddress");
    copyPropertyIfSet(encounter, "patientDriversLicenseNum", messageContent, "DriversLicense");
    copyPropertyIfSet(encounter, "patientDriversLicenseState", messageContent, "DriversLicenseState");
    copyPropertyIfSet(encounter, "patientDriversLicenseExpDt", messageContent, "DriversLicenseExpiration", safeExtractDate);
    copyPropertyIfSet(encounter, "patientPrimaryLang", messageContent, "PrimaryLanguage");
    copyPropertyIfSet(encounter, "patientMaritalStatus", messageContent, "MaritalStatus");
    copyPropertyIfSet(encounter, "patientReligion", messageContent, "Religion");
    copyPropertyIfSet(encounter, "patientGenderCd", messageContent, "Gender");
    copyPropertyIfSet(encounter, "patientRace", messageContent, "Race");
    copyPropertyIfSet(encounter, "patientEthnicGroup", messageContent, "Ethnicity");
    copyPropertyIfSet(encounter, "patientNationality", messageContent, "NationalityID");
    copyPropertyIfSet(encounter, "patientDeceasedInd", messageContent, "Deceased");
    copyPropertyIfSet(encounter, "patientDeceasedDt", messageContent, "DOD");
    copyPropertyIfSet(encounter, "admitType", messageContent, "AdmissionType");
    copyPropertyIfSet(encounter, "patientClass", messageContent, "PatientClass");
    copyPropertyIfSet(encounter, "patientType", messageContent, "PatientType");
    copyPropertyIfSet(encounter, "hospitalServiceCd", messageContent, "HospitalService");
    copyPropertyIfSet(encounter, "financialClass", messageContent, "FinancialClass");
    copyPropertyIfSet(encounter, "accidentDt", messageContent, "AccidentDate");
    copyPropertyIfSet(encounter, "accidentCode", messageContent, "AccidentCode");
    copyPropertyIfSet(encounter, "accidentDescription", messageContent, "AccidentCodeText");
    copyPropertyIfSet(encounter, "accidentLocation", messageContent, "AccidentLocation");
    copyPropertyIfSet(encounter, "accidentAutoStateCd", messageContent, "AutoAccidentStateCode");
    copyPropertyIfSet(encounter, "accidentAutoStateName", messageContent, "AutoAccidentStateName");
    copyPropertyIfSet(encounter, "accidentJobRelInd", messageContent, "AccidentJobRelatedIndicator");
    copyPropertyIfSet(encounter, "accidentDeathInd", messageContent, "AccidentDeathIndicator");
    
    if(messageContent.hasOwnProperty('IN1s')) {
        encounter.insuranceJsonDocument = [];
        for(var i = 0; i < messageContent.IN1s.length; i++) {
            var in1 = messageContent.IN1s[i];
            var doc = {};
            
            copyPropertyIfSet(doc,"id",in1,"ID");
            copyPropertyIfSet(doc,"insurancePlanId",in1,"InsurancePlanID");
            copyPropertyIfSet(doc,"insurerId",in1,"Insurer_ID");
            copyPropertyIfSet(doc,"insurerName",in1,"Insurer_Name");
            copyPropertyIfSet(doc,"insurerAddress1",in1,"Insurer_Address1");
            copyPropertyIfSet(doc,"insurerAddress2",in1,"Insurer_Address2");
            copyPropertyIfSet(doc,"insurerCity",in1,"Insurer_City");
            copyPropertyIfSet(doc,"insurerPostalCode",in1,"Insurer_PostalCode");
            copyPropertyIfSet(doc,"insurerStateAbbrev",in1,"Insurer_StateAbbreviation");
            copyPropertyIfSet(doc,"insurerContactPerson",in1,"Insurer_ContactPerson");
            copyPropertyIfSet(doc,"insurerPhone",in1,"Insurer_Phone");
            copyPropertyIfSet(doc,"insuredGroupEmplId",in1,"Insured_GroupEmployerID");
            copyPropertyIfSet(doc,"insuredGroupEmplName",in1,"Insured_GroupEmployerName");
            copyPropertyIfSet(doc,"insuredFirstName",in1,"Insured_FirstName");
            copyPropertyIfSet(doc,"insuredLastName",in1,"Insured_LastName");
            copyPropertyIfSet(doc,"insuredMiddleName",in1,"Insured_MiddleName");
            copyPropertyIfSet(doc,"insuredSuffix",in1,"Insured_Suffix");
            copyPropertyIfSet(doc,"insuredRelToPatient",in1,"Insured_RelationshipToPatient");
            copyPropertyIfSet(doc,"insuredDOB",in1,"Insured_DOB");
            copyPropertyIfSet(doc,"insuredSSN",in1,"InsuredSSN");
            copyPropertyIfSet(doc,"insuredAddress1",in1,"Insured_Address1");
            copyPropertyIfSet(doc,"insuredAddress2",in1,"Insured_Address2");
            copyPropertyIfSet(doc,"insuredCity",in1,"Insured_City");
            copyPropertyIfSet(doc,"insuredPostalCode",in1,"Insured_PostalCode");
            copyPropertyIfSet(doc,"insuredStateAbbrev",in1,"Insured_StateAbbreviation");
            copyPropertyIfSet(doc,"insuredPhone",in1,"InsuredPhone");
            copyPropertyIfSet(doc,"insuredEmail",in1,"InsuredEmail");
            copyPropertyIfSet(doc,"insuredMaritalStatus",in1,"MaritalStatus");
            copyPropertyIfSet(doc,"insuredPrimLanguage",in1,"PrimaryLanguage");
            copyPropertyIfSet(doc,"insuredJobTitle",in1,"JobTitle");
            copyPropertyIfSet(doc,"insuredJobStatus",in1,"JobStatus");
            copyPropertyIfSet(doc,"insuredEmployerName",in1,"InsuredEmployerOrganizationName");
            copyPropertyIfSet(doc,"insuredEmployerStatus",in1,"Insured_EmployerStatus");
            copyPropertyIfSet(doc,"insuredGender",in1,"Insured_Gender");
            copyPropertyIfSet(doc,"insuredMaleGender",in1,"Insured_MaleGender");
            copyPropertyIfSet(doc,"patRelToInsuredId",in1,"PatientRelationshipToInsuredID");
            copyPropertyIfSet(doc,"patRelToInsuredText",in1,"PatientRelationshipToInsuredText");
            copyPropertyIfSet(doc,"groupNumber",in1,"GroupNumber");
            copyPropertyIfSet(doc,"groupName",in1,"GroupName");
            copyPropertyIfSet(doc,"planEffectiveDate",in1,"PlanEffectiveDate");
            copyPropertyIfSet(doc,"planExpirationDate",in1,"PlanExpirationDate");
            copyPropertyIfSet(doc,"authorizationCode",in1,"AuthorizationInformation");
            copyPropertyIfSet(doc,"authorizationDate",in1,"AuthorizationDate");
            copyPropertyIfSet(doc,"planType",in1,"PlanType");
            copyPropertyIfSet(doc,"companyPlanCode",in1,"CompanyPlanCode");
            copyPropertyIfSet(doc,"policyNumber",in1,"Policy_Number");
            copyPropertyIfSet(doc,"policyLimitAmount",in1,"Policy_LimitAmount");
            copyPropertyIfSet(doc,"policyLimitDays",in1,"Policy_LimitDays");
            copyPropertyIfSet(doc,"verificationDateTime",in1,"VerificationDateTime");
            copyPropertyIfSet(doc,"verificationBy",in1,"VerificationBy");
            copyPropertyIfSet(doc,"verificationStatus",in1,"VerificationStatus");
            copyPropertyIfSet(doc,"assignmentOfBenefits",in1,"AssignmentOfBenefits");
            copyPropertyIfSet(doc,"coordOfBenefits",in1,"CoordinationOfBenefits");
            copyPropertyIfSet(doc,"coordOfBenefitsPriority",in1,"CoordinationOfBenefitsPriority");
            copyPropertyIfSet(doc,"noticeOfAdmissionFlag",in1,"NoticeOfAdmissionFlag");
            copyPropertyIfSet(doc,"noticeOfAdmissionDate",in1,"NoticeOfAdmissionDate");
            copyPropertyIfSet(doc,"releaseInformationCode",in1,"ReleaseInformationCode");
            copyPropertyIfSet(doc,"preAdmissionCert",in1,"PreAdmissionCertification");
            copyPropertyIfSet(doc,"typeOfAgreementCode",in1,"TypeOfAgreementCode");
            copyPropertyIfSet(doc,"billingStatus",in1,"BillingStatus");
            copyPropertyIfSet(doc,"lifetimeReserveDays",in1,"LifetimeReserveDays");
            copyPropertyIfSet(doc,"delayBeforeLRDay",in1,"DelayBeforeLRDay");
            copyPropertyIfSet(doc,"roomRateSemiPrivate",in1,"RoomRate_SemiPrivate");
            copyPropertyIfSet(doc,"roomRatePrivate",in1,"RoomRate_Private");
            
            encounter.insuranceJsonDocument.push(doc);
        }
        encounter.insuranceJsonDocument = JSON.stringify(encounter.insuranceJsonDocument);
    }
    
    if(messageContent.hasOwnProperty('Diagnoses')) {
        encounter.diagnosisJsonDocument = [];
        for(var i = 0; i < messageContent.Diagnoses.length; i++) {
            var diag = messageContent.Diagnoses[i];
            var doc = {};
            
            copyPropertyIfSet(doc,"id",diag,"ID");
            copyPropertyIfSet(doc,"codingMethod",diag,"CodingMethod");
            copyPropertyIfSet(doc,"diagCode",diag,"DiagnosisCodeID");
            copyPropertyIfSet(doc,"diagDesc",diag,"DiagnosisCodeText");
            copyPropertyIfSet(doc,"diagDate",diag,"DiagnosisDate");
            copyPropertyIfSet(doc,"diagTime",diag,"DiagnosisDate");
            copyPropertyIfSet(doc,"diagType",diag,"Type");
            
            
            encounter.diagnosisJsonDocument.push(doc);
        }
        encounter.diagnosisJsonDocument = JSON.stringify(encounter.diagnosisJsonDocument);
    }
    
    if(messageContent.hasOwnProperty('NextOfKins')) {
        encounter.relationsJsonDocument = [];
        for(var i = 0; i < messageContent.NextOfKins.length; i++) {
            var kin = messageContent.NextOfKins[i];
            var doc = {};
            
            
            copyPropertyIfSet(doc,"id",kin,"SetIdentifier");
            copyPropertyIfSet(doc,"lastName",kin,"LastName");
            copyPropertyIfSet(doc,"firstName",kin,"FirstName");
            copyPropertyIfSet(doc,"middleName",kin,"MiddleName");
            copyPropertyIfSet(doc,"address1",kin,"Address1");
            copyPropertyIfSet(doc,"address2",kin,"Address2");
            copyPropertyIfSet(doc,"city",kin,"City");
            copyPropertyIfSet(doc,"stateAbbrev",kin,"StateAbbreviation");
            copyPropertyIfSet(doc,"postalCode",kin,"Postal");
            copyPropertyIfSet(doc,"countryCode",kin,"Country");
            copyPropertyIfSet(doc,"homePhone",kin,"HomePhone");
            copyPropertyIfSet(doc,"businessPhone",kin,"WorkPhone");
            copyPropertyIfSet(doc,"maritalStatus",kin,"MaritalStatus");
            copyPropertyIfSet(doc,"gender",kin,"Gender");
            copyPropertyIfSet(doc,"dob",kin,"DOB");
            copyPropertyIfSet(doc,"primaryLanguage",kin,"Language");
            copyPropertyIfSet(doc,"jobTitle",kin,"JobTitle");
            copyPropertyIfSet(doc,"jobStatus",kin,"JobStatus");
            copyPropertyIfSet(doc,"relToPatient",kin,"RelationshipID");
            copyPropertyIfSet(doc,"ssn",kin,"SSN");
            
            
            encounter.relationsJsonDocument.push(doc);
        }
        encounter.relationsJsonDocument = JSON.stringify(encounter.relationsJsonDocument);
    }
    
    if(messageContent.hasOwnProperty('Guarantors')) {
        encounter.guarantorJsonDocument = [];
        for(var i = 0; i < messageContent.Guarantors.length; i++) {
            var gar = messageContent.Guarantors[i];
            var doc = {};
            
            copyPropertyIfSet(doc,"id",gar,"SetIdentifier");
            copyPropertyIfSet(doc,"lastName",gar,"LastName");
            copyPropertyIfSet(doc,"firstName",gar,"FirstName");
            copyPropertyIfSet(doc,"middleName",gar,"MiddleName");
            copyPropertyIfSet(doc,"addressLine1",gar,"Address1");
            copyPropertyIfSet(doc,"addressLine2",gar,"Address2");
            copyPropertyIfSet(doc,"city",gar,"City");
            copyPropertyIfSet(doc,"stateAbbrev",gar,"StateAbbreviation");
            copyPropertyIfSet(doc,"postalCode",gar,"Postal");
            copyPropertyIfSet(doc,"countryCode",gar,"Country");
            copyPropertyIfSet(doc,"ssn",gar,"SSN");
            copyPropertyIfSet(doc,"dob",gar,"DOB");
            copyPropertyIfSet(doc,"gender",gar,"Gender");
            copyPropertyIfSet(doc,"homePhone",gar,"HomePhoneNumber");
            copyPropertyIfSet(doc,"businessPhone",gar,"WorkPhoneNumber");
            copyPropertyIfSet(doc,"relToPatient",gar,"Relationship");
            copyPropertyIfSet(doc,"employmentStatus",gar,"EmploymentStatus");
            copyPropertyIfSet(doc,"type",gar,"Type");
            copyPropertyIfSet(doc,"maritalStatus",gar,"MaritalStatus");
            copyPropertyIfSet(doc,"occupation",gar,"JobTitle");
            copyPropertyIfSet(doc,"primaryLanguage",gar,"LanguageID");
            copyPropertyIfSet(doc,"employerLastName",gar,"EmployerLastName");
            copyPropertyIfSet(doc,"employerFirstName",gar,"EmployerFirstName");
            copyPropertyIfSet(doc,"employerMiddleName",gar,"EmployerMiddleName");
            copyPropertyIfSet(doc,"employerAddress1",gar,"EmployerAddress1");
            copyPropertyIfSet(doc,"employerAddress2",gar,"EmployerAddress2");
            copyPropertyIfSet(doc,"employerPostalCode",gar,"EmployerPostal");
            copyPropertyIfSet(doc,"employerCity",gar,"EmployerCity");
            copyPropertyIfSet(doc,"employerStateAbbrev",gar,"EmployerStateAbbreviation");
            copyPropertyIfSet(doc,"employerCountryCode",gar,"EmployerCountry");
            copyPropertyIfSet(doc,"employerPhone",gar,"EmployerPhone");        
            
            encounter.guarantorJsonDocument.push(doc);
        }
        encounter.guarantorJsonDocument = JSON.stringify(encounter.guarantorJsonDocument);
    }
    
    return encounter;
}

module.exports = {
    safeExtractDate: safeExtractDate,
    safeExtractTime: safeExtractTime,
    copyPropertyIfSet: copyPropertyIfSet,
    generatePatchedEncounterFromGicMessage: generatePatchedEncounterFromGicMessage
}