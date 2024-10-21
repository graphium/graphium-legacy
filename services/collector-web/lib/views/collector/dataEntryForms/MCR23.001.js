var dataEntryFormDefinitionName = importBatch.dataEntryFormDefinitionName == 'MCRPLS23.001' ? 'MCRPLS23' : 'MCRSMP23';
var dataEntryFormDefinitionVersion = '1';

var formFields = {
    // Patient Tab
    firstName: { validator: dataEntryValidator('notEmpty') },
    lastName: { validator: dataEntryValidator('notEmpty') },
    encounterNumber: { validator: dataEntryValidator('notEmpty') },
    dob: { validator: dataEntryDateValidator() },
    gender: {},

    // Location and Procedure / Case Information
    dos: { validator: dataEntryDateValidator() },
    anesStartDate: { validator: dataEntryValidator('notEmpty') },
    anesStartTime: { validator: dataEntryValidator('notEmpty') },
    anesEndDate: { validator: dataEntryDateValidator() },
    anesEndTime: { validator: dataEntryTimeValidator() },
    caseType: { validator: dataEntryValidator('notEmpty') },
    patientType: { validator: dataEntryValidator('notEmpty') },
    asa: { validator: dataEntryValidator('notEmpty') },
    primaryAnes: { validator: dataEntryValidator('notEmpty') },
    
    // Provider Information
    surgeon: {},
    mda1: { validator: dataEntryValidator('notEmpty') },
    mda2: {},
    anesthetist1: {},
    anesthetist2: {},
    
    // ASA CPT Code
    asaCptCode: {},
    
    // MACRA Quality
    sendGhSatisfactionSurvey: { validator: dataEntryValidator('notEmpty') },
    patientMobileNumber: {},
    patientEmail: {},
    patientIsSmoker: { validator: dataEntryValidator('notEmpty') },
    recSmokerCssGuidance: { validator: requiredIfFieldSetTo('patientIsSmoker','yes') },
    smokedOnDayOfSurg: { validator: requiredIfFieldSetTo('recSmokerCssGuidance','yes') },
    preOsaDiag: { validator: dataEntryValidator('notEmpty') },
    osaScreenPerformed: { validator: requiredIfFieldSetTo('preOsaDiag','no') },
    osaScreenPositive: { validator: requiredIfFieldSetTo('osaScreenPerformed','yes') },
    gteTwoMitigations: { validator: requiredIfFieldSetTo('osaScreenPositive','yes') },
    nonOrSetting: { validator: dataEntryValidator('notEmpty') },
    etco2MonitoringUsed: { validator: requiredIfFieldSetTo('nonOrSetting','yes') },
    diffAirwayAndGetaPlanned: { validator: dataEntryValidator('notEmpty') },
    plannedEquipUseAndSecondProviderPresent: { validator: requiredIfFieldSetTo('diffAirwayAndGetaPlanned','yes') },
    mmPainMgmt: { validator: dataEntryValidator('notEmpty') },
    inhalAgentUsed: { validator: dataEntryValidator('notEmpty') },
    lowFlowMaintenance: { validator: requiredIfFieldSetTo('inhalAgentUsed','yes') },
    gteThreeRiskFactors: { validator: requiredIfFieldSetTo('inhalAgentUsed','yes') },
    comboTherapyUsed: { validator: requiredIfExpressionTrue(function(formValues) {
        return formValues["inhalAgentUsed"] == "yes" && formValues["gteThreeRiskFactors"] == "yes" && (formValues["comboTherapyUsed"] == null  || formValues["comboTherapyUsed"] == "");
    })},
    arterialLine: {},
    arterialSterileTechniqueUsed: {},
    
    // Speciality Surgery
    primaryTotalKneeArthroplasty: {},
    shoulderArthroplasty: {},
    hipArthroplasty: {},
    shoulderArthroscopy: {},
    neuraxialOrRegBlock: {},
    anemiaScreenPerformed: {},
    anemiaScreenResult: { validator: requiredIfFieldSetTo('anemiaScreenPerformed','yes') },
    gte1DefinedAnemiaMngmntStrategy: {},
    laborEpidConvToCs: { validator: dataEntryValidator('notEmpty') },
    laborEpidFailed: { validator: requiredIfFieldSetTo('laborEpidConvToCs','yes') },
    csPerformed: { validator: dataEntryValidator('notEmpty') },
    phenylGiven: { validator: requiredIfFieldSetTo('csPerformed','yes') },
    bypassPerformed: { validator: dataEntryValidator('notEmpty') },
    hypoDuringBypass: { validator: requiredIfFieldSetTo('bypassPerformed','yes') },
    
    // Quality Measures
    postOpDispo: { validator: dataEntryValidator('notEmpty') },
    postOpPain: { validator: dataEntryValidator('notEmpty') },
    currentMedsInRecord: { validator: dataEntryValidator('notEmpty') },
    safetyChecklistUsed: { validator: dataEntryValidator('notEmpty') },
    handoffProtocolUsed: { validator: dataEntryValidator('notEmpty') },
    centralLineType: {},
    centralLineSterileTechnique: { validator: requiredIfFieldSet('centralLineType') },
    centralLineUltrasoundUsed: { validator: requiredIfFieldSet('centralLineType') },

    // Adverse Events
    complicationsIndicated: { validator: dataEntryValidator('notEmpty') },
    complication1: { validator: requiredIfFieldSetTo('complicationsIndicated','yes','You must specify at least one complication.') },
    complication2: {}
}

var plusFormFields = {
    // Location and Procedure / Case Information
    orLocn: { validator: stringValidator() },
    firstCase: { validator: dataEntryValidator('notEmpty') },
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
    obCaseType: { validator: validateIfFieldSetTo('caseType','ob') },
    laborEpiduralStartDate: { validator: validDateIfFieldSetTo('primaryAnes','laborEpidural') },
    laborEpiduralStartTime: { validator: validTimeIfFieldSetTo('primaryAnes','laborEpidural') },
    laborEpiduralEndDate: { validator: validDateIfFieldSetTo('primaryAnes','laborEpidural') },
    laborEpiduralEndTime: { validator: validTimeIfFieldSetTo('primaryAnes','laborEpidural') },
        
    // Delays
    delayReason: {},
    delayReason2: {},
    delayReason3: {},
    delayReason4: {},
    
    // Cancellation Tab
    sameDayCancellation: {},
    cancellationReason1: { validator: requiredIfFieldSet('sameDayCancellation', 'You must specify a cancellation reason when Same Day Cancellation is set to \'Yes\'') },
    cancellationReason2: {},
    cancellationReason3: {},
    cancellationReason4: {}
}

if(dataEntryFormDefinitionName == 'MCRPLS21') {
    formFields = _.assign({}, formFields, plusFormFields);

    if(importBatch.orgInternalName == "haat2028") {
        formFields.laborEpiduralStartDate = {};
        formFields.laborEpiduralStartTime = {};
        formFields.laborEpiduralEndDate = {};
        formFields.laborEpiduralEndTime = {};
    }
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
    } else if (templateName == 'addl-macra-no') {
        setInputIfEmpty('nonOrSetting','no');
        setInputIfEmpty('laborEpidConvToCs','no');
        setInputIfEmpty('csPerformed','no');
        setInputIfEmpty('primaryTotalKneeArthroplasty','no');
        setInputIfEmpty('shoulderArthro','no');
    } else if (templateName == 'addl-macra-dne') {
        setInputIfEmpty('nonOrSetting','#dataNotEntered');
        setInputIfEmpty('etco2MonitoringUsed','#dataNotEntered');
        setInputIfEmpty('laborEpidConvToCs','#dataNotEntered');
        setInputIfEmpty('laborEpidFailed','#dataNotEntered');
        setInputIfEmpty('csPerformed','#dataNotEntered');
        setInputIfEmpty('phenylGiven','#dataNotEntered');
        setInputIfEmpty('primaryTotalKneeArthroplasty','#dataNotEntered');
        setInputIfEmpty('neuraxialOrRegBlock','#dataNotEntered');
        setInputIfEmpty('shoulderArthro','#dataNotEntered');
        setInputIfEmpty('upperExtremityBlock','#dataNotEntered');
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