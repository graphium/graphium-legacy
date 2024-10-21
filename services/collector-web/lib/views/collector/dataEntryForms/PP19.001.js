var dataEntryFormDefinitionName = 'PP19';
var dataEntryFormDefinitionVersion = '1';

// Metro2017MacraPlus Form
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
    pongGerdEtohAssessed: { validator: dataEntryValidator('notEmpty') },
    preOsaDiag: { validator: dataEntryValidator('notEmpty') },
    patientIncapacitated: { validator: requiredIfFieldSetTo('preOsaDiag','no') },
    osaScreenPositive: { validator: requiredIfFieldSetTo('patientIncapacitated','no') },
    osaEducation: { validator: requiredIfFieldSetTo('osaScreenPositive','yes') },
    gteTwoMitigations: { validator: requiredIfFieldSetTo('osaScreenPositive','yes') },
    gteThreeRiskFactors: { validator: dataEntryValidator('notEmpty') },
    inhalAgentUsed: { validator: requiredIfFieldSetTo('gteThreeRiskFactors','yes') },
    comboTherapyUsed: { validator: requiredIfFieldSetTo('inhalAgentUsed','yes') },
    diffAirway: { validator: dataEntryValidator('notEmpty') },
    plannedEquipUse: { validator: requiredIfFieldSetTo('diffAirway','yes') },
    nmbUsed: { validator: dataEntryValidator('notEmpty') },
    tofAfterLastDose: { validator: requiredIfFieldSetTo('nmbUsed','yes') },
    reversalGiven: { validator: requiredIfFieldSetTo('nmbUsed','yes') },
    reversalNotIndicated: { validator: requiredIfFieldSetTo('reversalGiven','no') },
    remainedIntubated: { validator: requiredIfFieldSetTo('reversalGiven','no') },
    gtThreeHrtsExtubNmb: { validator: requiredIfFieldSetTo('reversalGiven','no') },
    mmPainMgmt: { validator: dataEntryValidator('notEmpty') },
    postOpDispo: { validator: dataEntryValidator('notEmpty') },
    postOpPain: { validator: dataEntryValidator('notEmpty') },
    currentMedsInRecord: { validator: dataEntryValidator('notEmpty') },
    safetyChecklistUsed: { validator: dataEntryValidator('notEmpty') },
    handoffProtocolUsed: { validator: dataEntryValidator('notEmpty') },

    // Adverse Events
    complicationsIndicated: { validator: dataEntryValidator('notEmpty') },
    complication1: { validator: requiredIfFieldSetTo('complicationsIndicated','yes','You must specify at least one complication.') },
    complication2: {},
}

var plusFormFields = {
    // Operations
    firstCase: { validator: dataEntryValidator('notEmpty') },
    sameDayAddOn: { validator: dataEntryValidator('notEmpty') },
    evalDayPriorSurg: { validator: dataEntryValidator('notEmpty') },
    scheduledStartDate: { validator: validDateIfFieldSetTo('firstCase','yes') },
    scheduledStartTime: { validator: validTimeIfFieldSetTo('firstCase','yes') },
    anesReadyDate: { validator: dataEntryValidator('notEmpty') },
    anesReadyTime: { validator: dataEntryValidator('notEmpty') },
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
        setInputIfEmpty('dos', previousRecordData.dos);
        setInputIfEmpty('surgeon', previousRecordData.surgeon);
        setInputIfEmpty('mda1', previousRecordData.mda1);
        copyDateOfServiceToOtherDateFields();
    }
});