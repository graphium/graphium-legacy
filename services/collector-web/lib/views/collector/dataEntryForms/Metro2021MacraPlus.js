/// <reference path="../recordDataEntry.d.ts" />

var dataEntryFormDefinitionName = 'Metro2021MacraPlus';
var dataEntryFormDefinitionVersion = '1';

// Metro2017MacraPlus Form
var formFields = {
    // Patient Tab
    caseType: { validator: dataEntryValidator('notEmpty') },
    firstName: { validator: dataEntryValidator('notEmpty') },
    lastName: { validator: dataEntryValidator('notEmpty') },
    encounterNumber: { validator: dataEntryValidator('notEmpty') },
    dob: { validator: dataEntryDateValidator() },
    gender: {},

    // Procedure Times
    dos: { validator: dataEntryDateValidator() },
    obCaseType: { validator: requiredIfFieldSetTo('caseType','ob') },
    laborEpiduralStartDate: { validator: validDateIfFieldSetTo('caseType','ob') },
    laborEpiduralStartTime: { validator: validTimeIfFieldSetTo('caseType','ob') },
    laborEpiduralEndDate: { validator: validDateIfFieldSetTo('caseType','ob') },
    laborEpiduralEndTime: { validator: validTimeIfFieldSetTo('caseType','ob') },
    deliveryDate: { validator: validDateIfFieldSetTo('caseType','ob') },
    deliveryTime: { validator: validTimeIfFieldSetTo('caseType','ob') },

    // Times
    firstCase: { validator: requiredIfFieldSetTo('caseType','standard') },
    arrivalDate: { validator: validDateIfFieldSetTo('caseType','standard') },
    arrivalTime: { validator: validTimeIfFieldSetTo('caseType','standard') },
    scheduledStartDate: { validator: validDateIfFieldSetTo('firstCase','yes') },
    scheduledStartTime: { validator: validTimeIfFieldSetTo('firstCase','yes') },
    anesStartDate: { validator: validDateIfFieldSetTo('caseType','standard') },
    anesStartTime: { validator: validTimeIfFieldSetTo('caseType','standard') },
    anesReadyDate: { validator: validDateIfFieldSetTo('caseType','standard') },
    anesReadyTime: { validator: validTimeIfFieldSetTo('caseType','standard') },
    surgStartDate: { validator: validDateIfFieldSetTo('caseType','standard') },
    surgStartTime: { validator: validTimeIfFieldSetTo('caseType','standard') },
    surgEndDate: { validator: validDateIfFieldSetTo('caseType','standard') },
    surgEndTime: { validator: validTimeIfFieldSetTo('caseType','standard') },
    pacuArrivalDate: { validator: validDateIfFieldSetTo('caseType','standard') },
    pacuArrivalTime: { validator: validTimeIfFieldSetTo('caseType','standard') },
    anesEndDate: { validator: validDateIfFieldSetTo('caseType','standard') },
    anesEndTime: { validator: validTimeIfFieldSetTo('caseType','standard') },

    // Location and Procedure
    call: { validator: stringValidator() },
    sameDayAddOn: { validator: requiredIfFieldSetTo('caseType','standard') },
    orLocn: { validator: stringValidator() },
    orLocn2: {},
    traumaInd: { validator: requiredIfFieldSetTo('caseType','standard') },
    asa: { validator: stringValidator() },
    patientType: { validator: dataEntryValidator('notEmpty') },
    primaryAnes: { validator: stringValidator() },
    courtesy: { validator: stringValidator() },
    contactPhysician: { validator: stringValidator() },

    // Provider Information
    surgeon: {},
    mda1: { validator: dataEntryValidator('notEmpty') },
    mda1StartDate: { validator: dataEntryDateValidator() },
    mda1StartTime: { validator: dataEntryTimeValidator() },
    mda1EndDate: { validator: dataEntryDateValidator() },
    mda1EndTime: { validator: dataEntryTimeValidator() },
    mda2: {},
    mda2StartDate: { validator: validDateIfFieldNotNull('mda2') },
    mda2StartTime: { validator: validTimeIfFieldNotNull('mda2') },
    mda2EndDate: { validator: validDateIfFieldNotNull('mda2') },
    mda2EndTime: { validator: validTimeIfFieldNotNull('mda2') },

    // MACRA Quality
    patientIsSmoker: { validator: dataEntryValidator('notEmpty') },
    recSmokerCssGuidance: { validator: requiredIfFieldSetTo('patientIsSmoker','yes') },
    smokedOnDayOfSurg: { validator: requiredIfFieldSetTo('recSmokerCssGuidance','yes') },
    preOsaDiag: { validator: dataEntryValidator('notEmpty') },
    osaScreenPositive: { validator: requiredIfFieldSetTo('preOsaDiag','no') },
    gteTwoMitigations: {},
    diffAirway: { validator: dataEntryValidator('notEmpty') },
    plannedEquipUse: { validator: requiredIfFieldSetTo('diffAirway','yes') },
    secondProviderPresent: { validator: requiredIfFieldSetTo('diffAirway','yes') },
    gteThreeRiskFactors: { validator: dataEntryValidator('notEmpty') },
    inhalAgentUsed: { validator: requiredIfFieldSetTo('gteThreeRiskFactors','yes') },
    comboTherapyUsed: { validator: requiredIfFieldSetTo('inhalAgentUsed','yes') },
    mmPainMgmt: { validator: dataEntryValidator('notEmpty') },
    postOpDispo: { validator: dataEntryValidator('notEmpty') },
    postOpPain: { validator: dataEntryValidator('notEmpty') },
    lungProtectVentUsed: { validator: dataEntryValidator('notEmpty') },
    currentMedsInRecord: { validator: dataEntryValidator('notEmpty') },
    laborEpidConvToCs: { validator: dataEntryValidator('notEmpty') },
    laborEpidFailed: { validator: requiredIfFieldSetTo('laborEpidConvToCs','yes') },
    safetyChecklistUsed: { validator: dataEntryValidator('notEmpty') },
    handoffProtocolUsed: { validator: dataEntryValidator('notEmpty') },

    // Adverse Events
    complicationsIndicated: { validator: dataEntryValidator('notEmpty') },
    complication1: { validator: requiredIfFieldSetTo('complicationsIndicated','yes','You must specify at least one complication.') },
    complication2: {},

    // Delays
    delayReason: {},

    // Cancellation Tab
    sameDayCancellation: {},
    cancellationReason1: { validator: requiredIfFieldSet('sameDayCancellation', 'You must specify a cancellation reason when Same Day Cancellation is set to \'Yes\'') },
    cancellationReason2: {},

    asaCptCode: {}
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

    setInputIfNoValue('arrivalDate',dateOfService);
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

    setInputIfEmpty('handoffProtocolUsed', 'yes');
    setInputIfEmpty('currentMedsInRecord', 'yes');
    setInputIfEmpty('safetyChecklistUsed','yes');

    if (templateName == 'asa1-amb-gen-pacu') {
        setInputIfEmpty('asa','1');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa1-amb-gen-icu') {
        setInputIfEmpty('asa','1');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
          setInputIfEmpty('pacuPain','0');
          setInputIfEmpty('slu','yes');
          setInputIfEmpty('postOpDispo','icu');
          setInputIfEmpty('meds','yes');
          setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
          setInputIfEmpty('sameDayCancellation','no');
          setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa1-amb-mac-pacu') {
        setInputIfEmpty('asa','1');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
          setInputIfEmpty('pacuPain','0');
          setInputIfEmpty('slu','yes');
          setInputIfEmpty('postOpDispo','pacu');
          setInputIfEmpty('meds','yes');
          setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
          setInputIfEmpty('sameDayCancellation','no');
          setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa1-amb-mac-icu') {
        setInputIfEmpty('asa','1');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa2-amb-gen-pacu') {
        setInputIfEmpty('asa','2');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa2-amb-gen-icu') {
        setInputIfEmpty('asa','2');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa2-amb-mac-pacu') {
        setInputIfEmpty('asa','2');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa2-amb-mac-icu') {
        setInputIfEmpty('asa','2');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa3-amb-gen-pacu') {
        setInputIfEmpty('asa','3');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa3-amb-gen-icu') {
        setInputIfEmpty('asa','3');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa3-amb-mac-pacu') {
        setInputIfEmpty('asa','3');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa3-amb-mac-icu') {
        setInputIfEmpty('asa','3');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('patientType','amb');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa1-inpt-gen-pacu') {
        setInputIfEmpty('asa','1');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('patientType','inp');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa1-inpt-gen-icu') {
        setInputIfEmpty('asa','1');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('patientType','inp');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
          setInputIfEmpty('pacuPain','0');
          setInputIfEmpty('slu','yes');
          setInputIfEmpty('postOpDispo','icu');
          setInputIfEmpty('meds','yes');
          setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
          setInputIfEmpty('sameDayCancellation','no');
          setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa1-inpt-mac-pacu') {
        setInputIfEmpty('asa','1');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('patientType','inp');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
          setInputIfEmpty('pacuPain','0');
          setInputIfEmpty('slu','yes');
          setInputIfEmpty('postOpDispo','pacu');
          setInputIfEmpty('meds','yes');
          setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
          setInputIfEmpty('sameDayCancellation','no');
          setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa1-inpt-mac-icu') {
        setInputIfEmpty('asa','1');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('patientType','inp');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa2-inpt-gen-pacu') {
        setInputIfEmpty('asa','2');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('patientType','inp');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa2-inpt-gen-icu') {
        setInputIfEmpty('asa','2');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('patientType','inp');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa2-inpt-mac-pacu') {
        setInputIfEmpty('asa','2');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('patientType','inp');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa2-inpt-mac-icu') {
        setInputIfEmpty('asa','2');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('patientType','inp');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa3-inpt-gen-pacu') {
        setInputIfEmpty('asa','3');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('patientType','inp');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa3-inpt-gen-icu') {
        setInputIfEmpty('asa','3');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('patientType','inp');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa3-inpt-mac-pacu') {
        setInputIfEmpty('asa','3');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('patientType','inp');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    } else if (templateName == 'asa3-inpt-mac-icu') {
        setInputIfEmpty('asa','3');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('patientType','inp');
        setInputIfEmpty('traumaInd', 'no');
        setInputIfEmpty('call', 'NONE');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('postOpDispo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('delayIndicated','no');
        setInputIfEmpty('sameDayCancellation','no');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
        setInputIfEmpty('ponvRisk','yes');
    }

    $('.selectpicker').selectpicker('refresh');
    $('#recordDataEntryForm').data('formValidation').validate();
});

$('a#copyDataFromPreviousRecordButton').on('click',function() {
    var previousRecordData = previousRecord.dataEntryData && previousRecord.dataEntryData.fieldValues ? previousRecord.dataEntryData.fieldValues : {};
    $('#copyDataFromPreviousRecordRow').css('visibility','hidden');
    if(_.isEmpty(importBatchRecord.dataEntryData.recordData)) {
        setInputIfEmpty('surgeon', previousRecordData.surgeon);
        setInputIfEmpty('mda1', previousRecordData.mda1);
        setInputIfEmpty('mda2', previousRecordData.mda2);
        setInputIfEmpty('dos', previousRecordData.dos);
        copyDateOfServiceToOtherDateFields();
    }
});