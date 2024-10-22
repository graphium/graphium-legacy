/// <reference path="../recordDataEntry.d.ts" />

var dataEntryFormDefinitionName = importBatch.dataEntryFormDefinitionName == 'MCRPLS20.001' ? 'MCRPLS20' : 'MCRSMP20';
var dataEntryFormDefinitionVersion = '1';

// Metro2017MacraPlus Form
/**
 * @type {Record<string, { validator?: (value: string) => string | undefined }>}
 */
var formFields = {
    // Patient Tab
    firstName: { validator: dataEntryValidator('notEmpty') },
    lastName: { validator: dataEntryValidator('notEmpty') },
    encounterNumber: { validator: dataEntryValidator('notEmpty') },
    dob: { validator: dataEntryDateValidator() },
    gender: {},

    // Location and Procedure
    orLocn: { validator: stringValidator() },
    orLocn2: {},
    dos: { validator: dataEntryDateValidator() },
    anesStartDate: { validator: dataEntryValidator('notEmpty') },
    anesStartTime: { validator: dataEntryValidator('notEmpty') },
    patientType: { validator: dataEntryValidator('notEmpty') },
    asa: { validator: dataEntryValidator('notEmpty') },
    caseType: { validator: dataEntryValidator('notEmpty') },

    // Provider Information
    surgeon: {},
    mda1: { validator: dataEntryValidator('notEmpty') },
    mda2: {},
    mda3: {},
    mda4: {},
    primaryAnes: { validator: dataEntryValidator('notEmpty') },

    // OB Times
    obCaseType: { validator: validateIfFieldSetTo('caseType','ob') },
    laborEpiduralStartDate: { validator: validDateIfFieldSetTo('primaryAnes','laborEpidural') },
    laborEpiduralStartTime: { validator: validTimeIfFieldSetTo('primaryAnes','laborEpidural') },
    laborEpiduralEndDate: { validator: validDateIfFieldSetTo('primaryAnes','laborEpidural') },
    laborEpiduralEndTime: { validator: validTimeIfFieldSetTo('primaryAnes','laborEpidural') },
    deliveryDate: { validator: validDateIfFieldSetTo('caseType','ob') },
    deliveryTime: { validator: validTimeIfFieldSetTo('caseType','ob') },

    // MACRA Quality
    patientIsSmoker: { validator: dataEntryValidator('notEmpty') },
    recSmokerCssGuidance: { validator: requiredIfFieldSetTo('patientIsSmoker','yes') },
    smokedOnDayOfSurg: { validator: requiredIfFieldSetTo('recSmokerCssGuidance','yes') },
    preOsaDiag: { validator: dataEntryValidator('notEmpty') },
    patientIncapacitated: { validator: requiredIfFieldSetTo('preOsaDiag','no') },
    osaScreenPositive: { validator: requiredIfFieldSetTo('patientIncapacitated','no') },
    osaEducation: { validator: requiredIfFieldSetTo('osaScreenPositive','yes') },
    gteTwoMitigations: { validator: requiredIfFieldSetTo('osaScreenPositive','yes') },
    diffAirway: { validator: dataEntryValidator('notEmpty') },
    plannedEquipUse: { validator: requiredIfFieldSetTo('diffAirway','yes') },
    secondProviderPresent: { validator: requiredIfFieldSetTo('diffAirway','yes') },
    gteThreeRiskFactors: { validator: dataEntryValidator('notEmpty') },
    inhalAgentUsed: { validator: requiredIfFieldSetTo('gteThreeRiskFactors','yes') },
    comboTherapyUsed: { validator: requiredIfExpressionTrue(function(formValues) {
        return formValues["inhalAgentUsed"] == "yes" && formValues["gteThreeRiskFactors"] == "yes" && (formValues["comboTherapyUsed"] == null  || formValues["comboTherapyUsed"] == "");
    })},
    mmPainMgmt: { validator: dataEntryValidator('notEmpty') },
    postOpDispo: { validator: dataEntryValidator('notEmpty') },
    patPostDischStatusAssessed: {},
    postOpPain: { validator: dataEntryValidator('notEmpty') },
    currentMedsInRecord: { validator: dataEntryValidator('notEmpty') },
    safetyChecklistUsed: { validator: dataEntryValidator('notEmpty') },
    handoffProtocolUsed: { validator: dataEntryValidator('notEmpty') },
    outPatientHospitalAsc: { validator: dataEntryValidator('notEmpty') },
    sendGhSatisfactionSurvey: { validator: dataEntryValidator('notEmpty') },
    patientMobileNumber: {},
    patientEmail: {},
    postDischargeStatusAssessed: {},
    /*
    validator: requiredIfExpressionTrue(function(formValues) {
        return formValues["sendGhSatisvactionSurvey"] == "N" || formValues["sendGhSatisvactionSurvey"] == "N-RS";
    })
    */

    // Adverse Events
    complicationsIndicated: { validator: dataEntryValidator('notEmpty') },
    complication1: { validator: requiredIfFieldSetTo('complicationsIndicated','yes','You must specify at least one complication.') },
    complication2: {},

    asaCptCode: {}
}

var plusFormFields = {
    // Operations
    firstCase: { validator: dataEntryValidator('notEmpty') },
    sameDayAddOn: { validator: dataEntryValidator('notEmpty') },
    evalDayPriorSurg: { validator: dataEntryValidator('notEmpty') },
    scheduledStartDate: { validator: validDateIfFieldSetTo('firstCase','yes') },
    scheduledStartTime: { validator: validTimeIfFieldSetTo('firstCase','yes') },
    anesReadyDate: { validator: requiredIfFieldSetTo('formType','standard') },
    anesReadyTime: { validator: requiredIfFieldSetTo('formType','standard') },
    surgStartDate: {},
    surgStartTime: {},
    surgEndDate: {},
    surgEndTime: {},
    pacuArrivalDate: {},
    pacuArrivalTime: {},
    anesEndDate: { validator: dataEntryDateValidator() },
    anesEndTime: { validator: dataEntryTimeValidator() },

    // Delays
    delayReason: {},

    // Cancellation Tab
    sameDayCancellation: {},
    cancellationReason1: { validator: requiredIfFieldSet('sameDayCancellation', 'You must specify a cancellation reason when Same Day Cancellation is set to \'Yes\'') },
    cancellationReason2: {}
}

if(importBatch.dataEntryFormDefinitionName.indexOf('MCRPLS19') == 0) {
    formFields = _.assign({}, formFields, plusFormFields);
}

if(importBatch.orgInternalName == "haat2028") {
    formFields.laborEpiduralStartDate = {};
    formFields.laborEpiduralStartTime = {};
    formFields.laborEpiduralEndDate = {};
    formFields.laborEpiduralEndTime = {};
}

var validationFields = {};
_.forEach(formFields, function(field, fieldName) {
    if(field.validator) 
        validationFields[fieldName] = field.validator;
});



function updateMdaTimes(mdaInput) {
    console.log('Changed mda1');

    var anesStartDate = $('input#anesStartDate').val();
    var anesStartTime = $('input#anesStartTime').val();
    var anesEndDate = $('input#anesEndDate').val();
    var anesEndTime = $('input#anesEndTime').val();

    var formValidation = $('#recordDataEntryForm').data('formValidation');

    if(anesStartDate && formValidation.isValidField('anesStartDate')) 
        setInputIfNoValue(mdaInput + 'StartDate',anesStartDate);
    if(anesStartTime && formValidation.isValidField('anesStartTime')) 
        setInputIfNoValue(mdaInput + 'StartTime',anesStartTime);
    if(anesEndDate && formValidation.isValidField('anesEndDate')) 
        setInputIfNoValue(mdaInput + 'EndDate',anesEndDate);
    if(anesEndTime && formValidation.isValidField('anesEndTime')) 
        setInputIfNoValue(mdaInput + 'EndTime',anesEndTime);
}

$().ready(function() {
    $('#mda1.selectpicker').change(function(value) {
        updateMdaTimes('mda1');
    });

    $('#mda2.selectpicker').change(function(value) {
        updateMdaTimes('mda2');
    });

    $('input#dos').on('keyup', function() {
        copyDateOfServiceToOtherDateFields();
    });
});

function copyDateOfServiceToOtherDateFields() {
    var dosInput = $('input#dos');
    $('#recordDataEntryForm').data('formValidation').revalidateField('dos');
    var isDateOfServiceValid = $('#recordDataEntryForm').data('formValidation').isValidField('dos')
    if(!isDateOfServiceValid)
        return;

    var dateOfService = dosInput.val();

    setInputIfNoValue('scheduledStartDate',dateOfService);
    setInputIfNoValue('anesStartDate',dateOfService);
    setInputIfNoValue('anesReadyDate',dateOfService);
    setInputIfNoValue('surgStartDate',dateOfService);
    setInputIfNoValue('surgEndDate',dateOfService);
    setInputIfNoValue('pacuArrivalDate',dateOfService);
    setInputIfNoValue('anesEndDate',dateOfService);
};

function setInputIfNoValue(inputName, value) {
    var $input = $('#'+inputName);
    if(!$input.val()) {
        $input.val(value);
        $('#recordDataEntryForm').formValidation('revalidateField',inputName);
    }
}

$('a.template').on('click', function() {
    var templateName = $(this).attr('data-template');
​
    setInputIfEmpty('handoffProtocolUsed', 'yes');
    setInputIfEmpty('currentMedsInRecord', 'yes');
    setInputIfEmpty('safetyChecklistUsed','yes');
​
    if (templateName == 'asa1-gen-pacu') {
        setInputIfEmpty('asa','1');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('pongGerdEtohAssessed','yes');
        setInputIfEmpty('preOsaDiag','no');
        setInputIfEmpty('patientIncapacitated','no');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('gteThreeRiskFactors','no');
        setInputIfEmpty('mmPainMgmt','yes');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('formType','standard');
        
    } else if (templateName == 'asa1-gen-icu') {
        setInputIfEmpty('asa','1');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('pongGerdEtohAssessed','yes');
        setInputIfEmpty('preOsaDiag','no');
        setInputIfEmpty('patientIncapacitated','no');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('gteThreeRiskFactors','no');
        setInputIfEmpty('mmPainMgmt','yes');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('formType','standard');
    } else if (templateName == 'asa1-mac-pacu') {
        setInputIfEmpty('asa','1');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('pongGerdEtohAssessed','yes');
        setInputIfEmpty('preOsaDiag','no');
        setInputIfEmpty('patientIncapacitated','no');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('gteThreeRiskFactors','no');
        setInputIfEmpty('mmPainMgmt','yes');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('formType','standard');
    } else if (templateName == 'asa1-mac-icu') {
        setInputIfEmpty('asa','1');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('pongGerdEtohAssessed','yes');
        setInputIfEmpty('preOsaDiag','no');
        setInputIfEmpty('patientIncapacitated','no');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('gteThreeRiskFactors','no');
        setInputIfEmpty('mmPainMgmt','yes');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('formType','standard');
    } else if (templateName == 'asa2-gen-pacu') {
        setInputIfEmpty('asa','2');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('pongGerdEtohAssessed','yes');
        setInputIfEmpty('preOsaDiag','no');
        setInputIfEmpty('patientIncapacitated','no');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('gteThreeRiskFactors','no');
        setInputIfEmpty('mmPainMgmt','yes');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('formType','standard');
    } else if (templateName == 'asa2-gen-icu') {
        setInputIfEmpty('asa','2');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('pongGerdEtohAssessed','yes');
        setInputIfEmpty('preOsaDiag','no');
        setInputIfEmpty('patientIncapacitated','no');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('gteThreeRiskFactors','no');
        setInputIfEmpty('mmPainMgmt','yes');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('formType','standard');
    } else if (templateName == 'asa2-mac-pacu') {
        setInputIfEmpty('asa','2');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('pongGerdEtohAssessed','yes');
        setInputIfEmpty('preOsaDiag','no');
        setInputIfEmpty('patientIncapacitated','no');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('gteThreeRiskFactors','no');
        setInputIfEmpty('mmPainMgmt','yes');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('formType','standard');
    } else if (templateName == 'asa2-mac-icu') {
        setInputIfEmpty('asa','2');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('pongGerdEtohAssessed','yes');
        setInputIfEmpty('preOsaDiag','no');
        setInputIfEmpty('patientIncapacitated','no');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('gteThreeRiskFactors','no');
        setInputIfEmpty('mmPainMgmt','yes');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('formType','standard');
    } else if (templateName == 'asa3-gen-pacu') {
        setInputIfEmpty('asa','3');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('pongGerdEtohAssessed','yes');
        setInputIfEmpty('preOsaDiag','no');
        setInputIfEmpty('patientIncapacitated','no');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('gteThreeRiskFactors','no');
        setInputIfEmpty('mmPainMgmt','yes');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('formType','standard');
    } else if (templateName == 'asa3-gen-icu') {
        setInputIfEmpty('asa','3');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('pongGerdEtohAssessed','yes');
        setInputIfEmpty('preOsaDiag','no');
        setInputIfEmpty('patientIncapacitated','no');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('gteThreeRiskFactors','no');
        setInputIfEmpty('mmPainMgmt','yes');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('formType','standard');
    } else if (templateName == 'asa3-mac-pacu') {
        setInputIfEmpty('asa','3');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('pongGerdEtohAssessed','yes');
        setInputIfEmpty('preOsaDiag','no');
        setInputIfEmpty('patientIncapacitated','no');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('gteThreeRiskFactors','no');
        setInputIfEmpty('mmPainMgmt','yes');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('formType','standard');
    } else if (templateName == 'asa3-mac-icu') {
        setInputIfEmpty('asa','3');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('pongGerdEtohAssessed','yes');
        setInputIfEmpty('preOsaDiag','no');
        setInputIfEmpty('patientIncapacitated','no');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('gteThreeRiskFactors','no');
        setInputIfEmpty('mmPainMgmt','yes');
        setInputIfEmpty('osaScreenPositive','no');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('formType','standard');
    }
​
    $('.selectpicker').selectpicker('refresh');
    $('#recordDataEntryForm').data('formValidation').validate();
});

$('a#copyDataFromPreviousRecordButton').on('click',function() {
    var previousRecordData = previousRecord.dataEntryData && previousRecord.dataEntryData.fieldValues ? previousRecord.dataEntryData.fieldValues : {};
    $('#copyDataFromPreviousRecordRow').css('visibility','hidden');
    if(_.isEmpty(importBatchRecord.dataEntryData.recordData)) {
        setInputIfEmpty('dos', previousRecordData.dos);
        setInputIfEmpty('surgeon', previousRecordData.surgeon);
        setInputIfEmpty('mda1', previousRecordData.mda1);
        copyDateOfServiceToOtherDateFields();
    }
});