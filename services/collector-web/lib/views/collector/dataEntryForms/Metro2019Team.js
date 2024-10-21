var dataEntryFormDefinitionName = 'Metro2019Team';
var dataEntryFormDefinitionVersion = '1';

// Metro2017MacraPlus Form
var formFields = {
    // Patient Tab
    formType: { validator: dataEntryValidator('notEmpty') },
    firstName: { validator: dataEntryValidator('notEmpty') },
    lastName: { validator: dataEntryValidator('notEmpty') },
    encounterNumber: { validator: dataEntryValidator('notEmpty') },
    dob: { validator: dataEntryDateValidator() },
    gender: {},

    // Procedure Times
    dos: { validator: dataEntryDateValidator() },
    firstCase: { validator: dataEntryValidator('notEmpty') },
    arrivalDate: { validator: dataEntryDateValidator() },
    arrivalTime: { validator: dataEntryTimeValidator() },
    scheduledStartDate: { validator: dataEntryDateValidator() },
    scheduledStartTime: { validator: dataEntryTimeValidator() },
    anesStartDate: { validator: dataEntryDateValidator() },
    anesStartTime: { validator: dataEntryTimeValidator() },
    anesReadyDate: { validator: dataEntryDateValidator() },
    anesReadyTime: { validator: dataEntryTimeValidator() },
    surgStartDate: { validator: dataEntryDateValidator() },
    surgStartTime: { validator: dataEntryTimeValidator() },
    surgEndDate: { validator: dataEntryDateValidator() },
    surgEndTime: { validator: dataEntryTimeValidator() },
    pacuArrivalDate: { validator: dataEntryDateValidator() },
    pacuArrivalTime: { validator: dataEntryTimeValidator() },
    anesEndDate: { validator: dataEntryDateValidator() },
    anesEndTime: { validator: dataEntryTimeValidator() },

    // Location and Procedure
    call: { validator: stringValidator() },
    sameDayAddOn: { validator: dataEntryValidator('notEmpty') },
    orLocn: { validator: stringValidator() },
    orLocn2: {},
    asa: { validator: stringValidator() },
    patientType: { validator: dataEntryValidator('notEmpty') },
    primaryAnes: { validator: stringValidator() },
    surgPrepReadyDate: { validator: dataEntryDateValidator() },
    surgPrepReadyTime: { validator: dataEntryTimeValidator() },
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
    anesthetist1: {},
    anesthetist1StartDate: { validator: validDateIfFieldNotNull('anesthetist1') },
    anesthetist1StartTime: { validator: validTimeIfFieldNotNull('anesthetist1') },
    anesthetist1EndDate: { validator: validDateIfFieldNotNull('anesthetist1') },
    anesthetist1EndTime: { validator: validTimeIfFieldNotNull('anesthetist1') },
    anesthetist2: {},
    anesthetist2StartDate: { validator: validDateIfFieldNotNull('anesthetist2') },
    anesthetist2StartTime: { validator: validTimeIfFieldNotNull('anesthetist2') },
    anesthetist2EndDate: { validator: validDateIfFieldNotNull('anesthetist2') },
    anesthetist2EndTime: { validator: validTimeIfFieldNotNull('anesthetist2') },
    anesthetist3: {},
    anesthetist3StartDate: { validator: validDateIfFieldNotNull('anesthetist3') },
    anesthetist3StartTime: { validator: validTimeIfFieldNotNull('anesthetist3') },
    anesthetist3EndDate: { validator: validDateIfFieldNotNull('anesthetist3') },
    anesthetist3EndTime: { validator: validTimeIfFieldNotNull('anesthetist3') },
    
    // MACRA Quality
    pongGerdEtohAssessed: { validator: dataEntryValidator('notEmpty') },
    gteThreeRiskFactors: { validator: dataEntryValidator('notEmpty') },
    inhalAgentUsed: { validator: requiredIfFieldSetTo('gteThreeRiskFactors','yes') },
    comboTherapyUsed: { validator: requiredIfFieldSetTo('inhalAgentUsed','yes') },
    mmPainMgmt: { validator: dataEntryValidator('notEmpty') },
    nmbUsed: { validator: dataEntryValidator('notEmpty') },
    tofAfterLastDose: { validator: requiredIfFieldSetTo('nmbUsed','yes') },
    reversalGiven: { validator: requiredIfFieldSetTo('nmbUsed','yes') },
    reversalNotIndicated: { validator: requiredIfFieldSetTo('reversalGiven','no') },
    remainedIntubated: { validator: requiredIfFieldSetTo('reversalGiven','no') },
    gtThreeHrtsExtubNmb: { validator: requiredIfFieldSetTo('reversalGiven','no') },
    diffAirway: { validator: dataEntryValidator('notEmpty') },
    plannedEquipUse: { validator: requiredIfFieldSetTo('diffAirway','yes') },
    postOpDispo: { validator: dataEntryValidator('notEmpty') },
    postOpPain: { validator: dataEntryValidator('notEmpty') },
    lungProtectVentUsed: { validator: dataEntryValidator('notEmpty') },
    currentMedsInRecord: { validator: dataEntryValidator('notEmpty') },
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
    cancellationReason2: {}
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