
var dataEntryFormDefinitionName = 'MCRPLS17';
var dataEntryFormDefinitionVersion = '1';

// 2017 MACRA Plus Form
var formFields = {
    // Patient Tab
    firstName: { validator: dataEntryValidator('notEmpty') },
    lastName: { validator: dataEntryValidator('notEmpty') },
    encounterNumber: { validator: dataEntryValidator('notEmpty') },
    dob: { validator: dataEntryDateValidator() },

    // Provider Information
    surgeon: { validator: dataEntryValidator('notEmpty') },
    mda1: { validator: dataEntryValidator('notEmpty') },
    mda2: {},
    mda3: {},
    mda4: {},
    orLocn: { validator: dataEntryValidator('notEmpty') },

    // Procedure Times
    dos: { validator: dataEntryDateValidator() },
    firstCase: { validator: dataEntryValidator('notEmpty') },
    scheduledStartDate: { validator: dataEntryDateValidator() },
    scheduledStartTime: {},
    anesStartDate: { validator: dataEntryDateValidator() },
    anesStartTime: { validator: dataEntryTimeValidator() },
    anesReadyDate: { validator: dataEntryDateValidator() }, // NOT REQUIRED
    anesReadyTime: { validator: dataEntryTimeValidator() }, // NOT REQUIRED
    surgStartDate: { validator: dataEntryDateValidator() },
    surgStartTime: { validator: dataEntryTimeValidator() },
    surgEndDate: { validator: dataEntryDateValidator() },
    surgEndTime: { validator: dataEntryTimeValidator() },
    pacuArrivalDate: { validator: dataEntryDateValidator() },
    pacuArrivalTime: { validator: dataEntryTimeValidator() },
    anesEndDate: { validator: dataEntryDateValidator() },
    anesEndTime: { validator: dataEntryTimeValidator() },

    // Clinical Information
    asa: { validator: stringValidator() },
    patientType: { validator: dataEntryValidator('notEmpty') },
    primaryAnes: { validator: stringValidator() },
    gender: { validator: dataEntryValidator('notEmpty') },


    // Preop Screening
    preOpOsa: { validator: dataEntryValidator('notEmpty') },
    preOpGerd: { validator: dataEntryValidator('notEmpty') },
    preOpAlcTob: { validator: dataEntryValidator('notEmpty') },
    preOpGlaucoma: { validator: dataEntryValidator('notEmpty') },
    preOpPonv: { validator: dataEntryValidator('notEmpty') },

    // Patient Safety
    meds: { validator: stringValidator() },
    slu: { validator: stringValidator() },
    handoff: { validator: stringValidator() },
    transferredTo: { validator: stringValidator() },
    pacuPain: { validator: stringValidator() },

    // Adverse Events
    complicationsIndicated: { validator: dataEntryValidator('notEmpty') },
    complication1: { validator: requiredIfFieldSetTo('complicationsIndicated','yes','You must specify at least one complication.') },
    complication2: {},
}

var validationFields = {};
_.forEach(formFields, function(field, fieldName) {
    if(field.validator) 
        validationFields[fieldName] = field.validator;
});

$('input#dos').on('keyup', function() {
    copyDateOfServiceToOtherDateFields();
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

    if (templateName == 'asa1-gen-pacu') {
        setInputIfEmpty('asa','1');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('transferredTo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
    } else if (templateName == 'asa1-gen-icu') {
        setInputIfEmpty('asa','1');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('transferredTo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
    } else if (templateName == 'asa1-mac-pacu') {
        setInputIfEmpty('asa','1');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('transferredTo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
    } else if (templateName == 'asa1-mac-icu') {
        setInputIfEmpty('asa','1');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('transferredTo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
    } else if (templateName == 'asa2-gen-pacu') {
        setInputIfEmpty('asa','2');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('transferredTo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
    } else if (templateName == 'asa2-gen-icu') {
        setInputIfEmpty('asa','2');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('transferredTo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
    } else if (templateName == 'asa2-mac-pacu') {
        setInputIfEmpty('asa','2');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('transferredTo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
    } else if (templateName == 'asa2-mac-icu') {
        setInputIfEmpty('asa','2');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('transferredTo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
    } else if (templateName == 'asa3-gen-pacu') {
        setInputIfEmpty('asa','3');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('transferredTo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
    } else if (templateName == 'asa3-gen-icu') {
        setInputIfEmpty('asa','3');
        setInputIfEmpty('primaryAnes','gen');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('transferredTo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
    } else if (templateName == 'asa3-mac-pacu') {
        setInputIfEmpty('asa','3');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('transferredTo','pacu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
    } else if (templateName == 'asa3-mac-icu') {
        setInputIfEmpty('asa','3');
        setInputIfEmpty('primaryAnes','mac');
        setInputIfEmpty('pacuPain','0');
        setInputIfEmpty('slu','yes');
        setInputIfEmpty('transferredTo','icu');
        setInputIfEmpty('meds','yes');
        setInputIfEmpty('handoff','yes');
        setInputIfEmpty('complicationsIndicated','no');
        setInputIfEmpty('preOpOsa','yes');
        setInputIfEmpty('preOpGerd','yes');
        setInputIfEmpty('preOpAlcTob','yes');
        setInputIfEmpty('preOpGlaucoma','yes');
        setInputIfEmpty('preOpPonv','yes');
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
        copyDateOfServiceToOtherDateFields();
    }
});