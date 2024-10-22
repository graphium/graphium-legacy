/// <reference path="../recordDataEntry.d.ts" />

var dataEntryFormDefinitionName = 'PqrsReady';
var dataEntryFormDefinitionVersion = '1';

// PQRS 2016 Form
var formFields = {
    // Patient Tab
    facility: { validator: dataEntryValidator('notEmpty') },
    firstName: { validator: dataEntryValidator('notEmpty') },
    lastName: { validator: dataEntryValidator('notEmpty') },
    encounterNumber: { validator: dataEntryValidator('notEmpty') },
    gender: { validator: dataEntryValidator('notEmpty') },
    dob: { validator: dataEntryDateValidator() },

    // Prov./Times Tab
    surgeon: { validator: dataEntryValidator('notEmpty') },
    mda1: { validator: dataEntryValidator('notEmpty') },
    mda2: {},
    mda3: {},
    mda4: {},
    dos: { validator: dataEntryDateValidator() },
    anesStartDate: { validator: validSome([
        { validator: validateValueNotNullIfFieldSetTo, args: [] },
        { validator: dataEntryDateValidator, args: [] }
    ]) },
    anesStartTime: { validator: dataEntryTimeValidator() },
    anesEndDate: { validator: dataEntryDateValidator() },
    anesEndTime: { validator: dataEntryTimeValidator() },

    // Clinical Tab
    asa: { validator: stringValidator() },
    primaryAnes: { validator: stringValidator() },
    pacuPain: { validator: stringValidator() },
    slu: { validator: stringValidator() },
    transferredTo: { validator: stringValidator() },
    meds: { validator: stringValidator() },
    handoff: { validator: stringValidator() },

    // Cancellation Tab
    sameDayCancellation: { validator: dataEntryValidator('notEmpty') },
    cancellationReason1: { validator: requiredIfFieldSetTo('sameDayCancellation','yes', 'You must specify a cancellation reason when Same Day Cancellation is set to \'Yes\'') },
    cancellationReason2: {},

    // Complications Tab
    complicationsIndicated: { validator: dataEntryValidator('notEmpty') },
    complication1: { validator: requiredIfFieldSetTo('complicationsIndicated','yes','You must specify at least one complication.') },
    complication2: {}
}

var notEmptyValidatorIfSameDayCancellation = validSome([
    validIfFieldSetTo('sameDayCancellation','yes'),
    dataEntryValidator('notEmpty')
]);

var validationFields = {
    // Patient Tab
    facility: dataEntryValidator('notEmpty'),
    firstName: dataEntryValidator('notEmpty'),
    lastName: dataEntryValidator('notEmpty'),
    encounterNumber: dataEntryValidator('notEmpty'),
    gender: dataEntryValidator('notEmpty'),
    dob: dataEntryDateValidator(),
    
    // Prov./Times Tab
    surgeon: dataEntryValidator('notEmpty'),
    mda1: dataEntryValidator('notEmpty'),
    //mda2: stringValidator(), NOT REQUIRED
    //mda3: stringValidator(), NOT REQUIRED
    //mda4: stringValidator(), NOT REQUIRED
    dos: dataEntryDateValidator(),
    anesStartDate: validSome([
        validIfFieldSetTo('sameDayCancellation','yes'),
        dataEntryDateValidator()
    ]),
    anesStartTime: validSome([
        validIfFieldSetTo('sameDayCancellation','yes'),
        dataEntryTimeValidator()
    ]),
    anesEndDate: validSome([
        validIfFieldSetTo('sameDayCancellation','yes'),
        dataEntryDateValidator()
    ]),
    anesEndTime: validSome([
        validIfFieldSetTo('sameDayCancellation','yes'),
        dataEntryTimeValidator()
    ]),

    // Clinical Tab
    asa: notEmptyValidatorIfSameDayCancellation,
    primaryAnes: notEmptyValidatorIfSameDayCancellation,
    pacuPain: notEmptyValidatorIfSameDayCancellation,
    slu: notEmptyValidatorIfSameDayCancellation,
    transferredTo: notEmptyValidatorIfSameDayCancellation,
    meds: notEmptyValidatorIfSameDayCancellation,
    handoff: notEmptyValidatorIfSameDayCancellation,

    // Cancellation Tab
    sameDayCancellation: dataEntryValidator('notEmpty'),
    cancellationReason1: requiredIfFieldSetTo('sameDayCancellation','yes', 'You must specify a cancellation reason when Same Day Cancellation is set to \'Yes\''),
    // cancellationReason2 NOT REQUIRED

    // Complications Tab
    complicationsIndicated: notEmptyValidatorIfSameDayCancellation,
    complication1: requiredIfFieldSetTo('complicationsIndicated','yes','You must specify at least one complication.'),
    //complication2: NOT REQURIED
}

$('input#dos').on('keyup', function() {

    $('#recordDataEntryForm').data('formValidation').revalidateField('dos');
    var isDateOfServiceValid = $('#recordDataEntryForm').data('formValidation').isValidField('dos')
    console.log('Is DOS Valid? => ' + JSON.stringify(isDateOfServiceValid));
    if(!isDateOfServiceValid)
        return;

    var dateOfService = $(this).val();
    var startDateInput = $('#anesStartDate');
    var endDateInput = $('#anesEndDate');

    if(!startDateInput.val()) {
        startDateInput.val(dateOfService)
        $('#recordDataEntryForm').formValidation('revalidateField','anesStartDate');
    }
    if(!endDateInput.val()) {
        endDateInput.val(dateOfService);
        $('#recordDataEntryForm').formValidation('revalidateField','anesEndDate');
    }
});

$('a.template').on('click', function() {
    var templateName = $(this).attr('data-template');

    if (templateName == 'asa1-gen-pacu') {
       setInputIfEmpty('asa','1');
       setInputIfEmpty('primaryAnes','gen');
       setInputIfEmpty('pacuPain','0_6');
       setInputIfEmpty('slu','yes');
       setInputIfEmpty('transferredTo','pacu');
       setInputIfEmpty('meds','yes');
       setInputIfEmpty('handoff','yes');
       setInputIfEmpty('sameDayCancellation','no');
       setInputIfEmpty('complicationsIndicated','no');
    } else if (templateName == 'asa1-gen-icu') {
    setInputIfEmpty('asa','1');
    setInputIfEmpty('primaryAnes','gen');
           setInputIfEmpty('pacuPain','0_6');
           setInputIfEmpty('slu','yes');
           setInputIfEmpty('transferredTo','icu');
           setInputIfEmpty('meds','yes');
           setInputIfEmpty('handoff','yes');
           setInputIfEmpty('sameDayCancellation','no');
           setInputIfEmpty('complicationsIndicated','no');
    } else if (templateName == 'asa1-mac-pacu') {
    setInputIfEmpty('asa','1');
    setInputIfEmpty('primaryAnes','mac');
           setInputIfEmpty('pacuPain','0_6');
           setInputIfEmpty('slu','yes');
           setInputIfEmpty('transferredTo','pacu');
           setInputIfEmpty('meds','yes');
           setInputIfEmpty('handoff','yes');
           setInputIfEmpty('sameDayCancellation','no');
           setInputIfEmpty('complicationsIndicated','no');
    } else if (templateName == 'asa1-mac-icu') {
    setInputIfEmpty('asa','1');
    setInputIfEmpty('primaryAnes','mac');
           setInputIfEmpty('pacuPain','0_6');
           setInputIfEmpty('slu','yes');
           setInputIfEmpty('transferredTo','icu');
           setInputIfEmpty('meds','yes');
           setInputIfEmpty('handoff','yes');
           setInputIfEmpty('sameDayCancellation','no');
           setInputIfEmpty('complicationsIndicated','no');
    } else if (templateName == 'asa2-gen-pacu') {
    setInputIfEmpty('asa','2');
    setInputIfEmpty('primaryAnes','gen');
           setInputIfEmpty('pacuPain','0_6');
           setInputIfEmpty('slu','yes');
           setInputIfEmpty('transferredTo','pacu');
           setInputIfEmpty('meds','yes');
           setInputIfEmpty('handoff','yes');
           setInputIfEmpty('sameDayCancellation','no');
           setInputIfEmpty('complicationsIndicated','no');
    } else if (templateName == 'asa2-gen-icu') {
    setInputIfEmpty('asa','2');
    setInputIfEmpty('primaryAnes','gen');
           setInputIfEmpty('pacuPain','0_6');
           setInputIfEmpty('slu','yes');
           setInputIfEmpty('transferredTo','icu');
           setInputIfEmpty('meds','yes');
           setInputIfEmpty('handoff','yes');
           setInputIfEmpty('sameDayCancellation','no');
           setInputIfEmpty('complicationsIndicated','no');
    } else if (templateName == 'asa2-mac-pacu') {
    setInputIfEmpty('asa','2');
    setInputIfEmpty('primaryAnes','mac');
           setInputIfEmpty('pacuPain','0_6');
           setInputIfEmpty('slu','yes');
           setInputIfEmpty('transferredTo','pacu');
           setInputIfEmpty('meds','yes');
           setInputIfEmpty('handoff','yes');
           setInputIfEmpty('sameDayCancellation','no');
           setInputIfEmpty('complicationsIndicated','no');
    } else if (templateName == 'asa2-mac-icu') {
    setInputIfEmpty('asa','2');
    setInputIfEmpty('primaryAnes','mac');
           setInputIfEmpty('pacuPain','0_6');
           setInputIfEmpty('slu','yes');
           setInputIfEmpty('transferredTo','icu');
           setInputIfEmpty('meds','yes');
           setInputIfEmpty('handoff','yes');
           setInputIfEmpty('sameDayCancellation','no');
           setInputIfEmpty('complicationsIndicated','no');
    } else if (templateName == 'asa3-gen-pacu') {
    setInputIfEmpty('asa','3');
    setInputIfEmpty('primaryAnes','gen');
           setInputIfEmpty('pacuPain','0_6');
           setInputIfEmpty('slu','yes');
           setInputIfEmpty('transferredTo','pacu');
           setInputIfEmpty('meds','yes');
           setInputIfEmpty('handoff','yes');
           setInputIfEmpty('sameDayCancellation','no');
           setInputIfEmpty('complicationsIndicated','no');
    } else if (templateName == 'asa3-gen-icu') {
    setInputIfEmpty('asa','3');
    setInputIfEmpty('primaryAnes','gen');
           setInputIfEmpty('pacuPain','0_6');
           setInputIfEmpty('slu','yes');
           setInputIfEmpty('transferredTo','icu');
           setInputIfEmpty('meds','yes');
           setInputIfEmpty('handoff','yes');
           setInputIfEmpty('sameDayCancellation','no');
           setInputIfEmpty('complicationsIndicated','no');
    } else if (templateName == 'asa3-mac-pacu') {
    setInputIfEmpty('asa','3');
    setInputIfEmpty('primaryAnes','mac');
           setInputIfEmpty('pacuPain','0_6');
           setInputIfEmpty('slu','yes');
           setInputIfEmpty('transferredTo','pacu');
           setInputIfEmpty('meds','yes');
           setInputIfEmpty('handoff','yes');
           setInputIfEmpty('sameDayCancellation','no');
           setInputIfEmpty('complicationsIndicated','no');
    } else if (templateName == 'asa3-mac-icu') {
    setInputIfEmpty('asa','3');
    setInputIfEmpty('primaryAnes','mac');
           setInputIfEmpty('pacuPain','0_6');
           setInputIfEmpty('slu','yes');
           setInputIfEmpty('transferredTo','icu');
           setInputIfEmpty('meds','yes');
           setInputIfEmpty('handoff','yes');
           setInputIfEmpty('sameDayCancellation','no');
           setInputIfEmpty('complicationsIndicated','no');
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
        setInputIfEmpty('mda3', previousRecordData.mda3);
        setInputIfEmpty('mda4', previousRecordData.mda4);
        setInputIfEmpty('dos', previousRecordData.dos);
        setInputIfEmpty('anesStartDate', previousRecordData.dos);
        setInputIfEmpty('anesEndDate', previousRecordData.dos);
    }
});