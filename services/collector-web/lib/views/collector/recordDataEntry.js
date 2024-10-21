

function rotateBase64Image(base64data, degrees, callback) {
    if(importBatchRecord.recordDataType != 'pdf_bitmap_pages')
        return;

    degrees = Math.round(degrees/90)*90;

    if(degrees == 0) {
        callback('data:image/png;base64,' + base64data);
        return;
    }

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext("2d");

    var image = new Image();
    image.src = 'data:image/png;base64,' + base64data;
    image.onload = function() {
        canvas.width = image.width;
        canvas.height = image.height;

        if( degrees == 90 || degrees == 270) {
            canvas.width = image.height;
            canvas.height = image.width;
        }


        if( degrees == 90 )
            ctx.translate( image.height, 0 );
        else if(degrees == 180 || degrees == 0)
            ctx.translate( image.width, image.height );
        else if(degrees == 270 )
            ctx.translate( 0, image.width );

        ctx.rotate(degrees * Math.PI / 180); // A little geometry baby. Wish I would have taken more trig classes.
        ctx.drawImage(image, 0, 0);

        var data = canvas.toDataURL();
        callback(data);
    };
}

function refreshImageLens() {
    if(importBatchRecord.recordDataType != 'pdf_bitmap_pages')
        return;
        
    var image = $('#recordImage');
    var base64Data = importBatchRecord.recordData[currentPagingIndex].bitmapBase64;
    rotateBase64Image(base64Data, currentImageRotation, function(rotatedData) {
        image.attr('src', rotatedData);
        image.attr('data-big', image.src);
        image.mlens({
            imgSrc: image.attr("data-big"), // path of the hi-res version of the image
            lensShape: "square", // shape of the lens (circle/square)
            lensSize: ["35%", "25%"], // lens dimensions (in px or in % with respect to image dimensions)
            // can be different for X and Y dimension
            borderSize: 3, // size of the lens border (in px)
            borderColor: "#999", // color of the lens border (#hex)
            borderRadius: 0, // border radius (optional, only if the shape is square)
            //imgOverlay: $("#gear").attr("data-overlay"), // path of the overlay image (optional)
            //overlayAdapt: true, // true if the overlay image has to adapt to the lens size (boolean)
            zoomLevel: 2, // zoom level multiplicator (number)
            responsive: true // true if mlens has to be responsive (boolean)
        });
    })
    
    //image.attr('src', '/images/image1_small.png');
    //image.attr('data-big', '/images/image1_large.jpg');

}

function toggleTab(target) {
    var tabPanel = $(target);
    var tabOpen = tabPanel.hasClass('in');
    if(tabOpen)
        closeTab(target);
    else
        openTab(target);
}

function getTabPanel(target) {
    var tabPanel;
    if ( typeof target === 'string' ) {
        tabPanel = $(target);
    } else if ( target instanceof $ ) {
    	tabPanel = target;
    } else {
        throw new Error('Attempting to open an object that is not a target element or element ID');
    }
    return tabPanel;
}

function openTab(target) {

    var tabPanel = getTabPanel(target);
    var tabOpen = tabPanel.hasClass('in');

    //var otherPanels = $("#accordion").find(".panel-collapse").not(tabPanel);
    //otherPanels.collapse("hide");

    if(!tabOpen) {
        tabPanel.collapse('show');
    }
    setInitialTabFocus(tabPanel);
}

function closeTab(target) {
    var tabPanel = getTabPanel(target);
    var tabOpen = tabPanel.hasClass('in');

    if(tabOpen) {
        tabPanel.collapse('hide');
    }
}

function setupFormTabbing() {
    /*redirect last tab to first input*/
    $('[tab-to-tab], [tab-back-to-tab], [data-id]').on('keydown', function (e) {

        // First determine if this was a tab key
        if(e.which === 9) {
        //if ((e.which === 9 && !e.shiftKey)) {
            var tabTo;
            var currentInput = this;

            // Now, if this item is a data-id object, that means 
            // we first look to see if the select element associated 
            // with it, if so we use that.
            var dataId = $(this).attr('data-id')
            if(dataId) {
                var select = $('select#' + dataId );
                if( select ) {
                    currentInput = select;
                }
            }
            
            // If we are holding shift, we look for a tab name to tab back to, 
            // otherwise we look for one to go next.
            tabTo = $(currentInput).attr( e.shiftKey ? 'tab-back-to-tab' : 'tab-to-tab');
            // If there is a tab name, let's go to it!
            if(tabTo) {
                // We flag to select the last input in the tab if the shift key is down.
                // This is a really non-well-architected way of doing this, but I have a
                // deadline, so LAYOFF.
                selectLastInputFlag = e.shiftKey;
                e.preventDefault();

                // Close the current tab.
                var currentTabId =  $(currentInput).parents('.panel-collapse').first().attr('id');
                closeTab('#'+currentTabId);

                // Open the tab we are going to.
                openTab(tabTo);
            }
        }
    });
}

function ifPickerReturnFocusableButton(target) {
    if(target && target.hasClass('selectpicker')) {
        return target.siblings('[data-id='+target.attr('id')+']').first();
    }
    return target;
}

/* 
 We use a global flag for this function because I couldn't immedaitely
 figure out an elegant way to deal with brokering this between the wizard component
 event model and this code. It works for now... TODO: Refactor tab input focus management.
 */
var selectLastInputFlag;
function setInitialTabFocus($tabPanel) {
    var firstInput = $tabPanel.find(':input:enabled:visible:first');
    var lastInput = $tabPanel.find(':input:enabled:visible:last');

    firstInput = ifPickerReturnFocusableButton(firstInput);
    lastInput = ifPickerReturnFocusableButton(lastInput);
    
    if(selectLastInputFlag && lastInput) {
        lastInput.focus();
    }
    else if(firstInput) {
        firstInput.focus();
    }

    selectLastInputFlag = false;
}

function stringValidator(name, options) {
    return {
        row: '.form-group',
        validators: {
            notEmpty: {
                message: (name || 'Field') + ' is required.'
            }
        }
    }
}

function validateIfFieldSet(value, validator, $field, setField) {
    var setFieldValue = $('#'+setField).val();
    if(setFieldValue !== null && setFieldValue !== "") {
        return value !== null && value !== "";
    }
    return true;
}

function validateIfFieldSetTo(value, validator, $field, setField, setTo) {
    var inputValue = $('#'+setField).val();
    return inputValue == setTo;
}

function validateValueNotNullIfFieldSetTo(value, validator, $field, setField, setTo) {
    var inputValue = $('#'+setField).val();
    if( inputValue == setTo )
        return value !== null && value != "";
    return true;
}

function validateDateIfFieldNotSetTo(value, setField, setTo, validator, $field) {
    var options = {format:'MM-DD-YYYY', min:minDate, max:maxDate};
    var inputValue = $('#'+setField).val();
    if( inputValue != null && inputValue == setTo ) {
        var fieldValue = $field.val();
        if(!fieldValue) {
            return false;
        }
        else if(isDataEntryErrorValue(value)) {
            return true;
        }
        else {
            return FormValidation.Validator["date"].validate(validator, $field, options || {}, $field.attr('id'));
        }
    }
    return null;
}

function validateTimeIfFieldNotSetTo(value, setField, setTo, validator, $field) {
     var options = {
        regexp:/^([0-1]?[0-9]|2[0-3])(:[0-5][0-9])?$/, 
        message:'Please ensure time is in correct format.'
    };
    var inputValue = $('#'+setField).val();
    if( inputValue != null && inputValue != setTo ) {
        var fieldValue = $field.val();
        if(!fieldValue) {
            return false;
        }
        else if(isDataEntryErrorValue(value)) {
            return true;
        }
        else {
            return FormValidation.Validator["regexp"].validate(validator, $field, options || {}, $field.attr('id'));
        }
    }
    return null;
}

function validateDateIfFieldSetTo(value, setField, setTo, validator, $field) {
    var options = {format:'MM-DD-YYYY', min:minDate, max:maxDate};
    var inputValue = $('#'+setField).val();
    if( inputValue == setTo ) {
        var fieldValue = $field.val();
        if(!fieldValue) {
            return false;
        }
        else if(isDataEntryErrorValue(value)) {
            return true;
        }
        else {
            return FormValidation.Validator["date"].validate(validator, $field, options || {}, $field.attr('id'));
        }
    }
    return null;
}

function validateTimeIfFieldSetTo(value, setField, setTo, validator, $field) {
     var options = {
        regexp:/^([0-1]?[0-9]|2[0-3])(:[0-5][0-9])?$/, 
        message:'Please ensure time is in correct format.'
    };
    var inputValue = $('#'+setField).val();
    if( inputValue == setTo ) {
        var fieldValue = $field.val();
        if(!fieldValue) {
            return false;
        }
        else if(isDataEntryErrorValue(value)) {
            return true;
        }
        else {
            return FormValidation.Validator["regexp"].validate(validator, $field, options || {}, $field.attr('id'));
        }
    }
    return null;
}

function validateDateIfFieldNotNull(value, setField, validator, $field) {
    var options = {format:'MM-DD-YYYY', min:minDate, max:maxDate};
    var inputValue = $('#'+setField).val();
    if( inputValue != null && inputValue !== "" ) {
        var fieldValue = $field.val();
        if(!fieldValue) {
            return false;
        }
        else if(isDataEntryErrorValue(value)) {
            return true;
        }
        else {
            return FormValidation.Validator["date"].validate(validator, $field, options || {}, $field.attr('id'));
        }
    }
    return null;
}

function validateTimeIfFieldNotNull(value, setField, validator, $field) {
    var options = {
        regexp:/^([0-1]?[0-9]|2[0-3])(:[0-5][0-9])?$/, 
        message:'Please ensure time is in correct format.'
    };
    var inputValue = $('#'+setField).val();
    if( inputValue != null && inputValue !== "" ) {
        var fieldValue = $field.val();
        if(!fieldValue) {
            return false;
        }
        else if(isDataEntryErrorValue(value)) {
            return true;
        }
        else {
            return FormValidation.Validator["regexp"].validate(validator, $field, options || {}, $field.attr('id'));
        }
    }
    return null;
}


// Validator that checks first to see if an error type has been set, otherwise
// it checks the value that exists to see if it is right.
function dataEntryValidator(validatorType, options) {

    return {
        validators: {
            callback: {
                callback: function(value, validator, $field) {
                    if(helpers.getErrorByLabelOrData(value)) {
                        //console.log('Validating as true since error is selected: ' + value);
                        return true;
                    }

                    if(value == null || value == "")
                        return { valid: false, message: 'This field is required.' }

                    return FormValidation.Validator[validatorType].validate(validator, $field, options || {}, $field.attr('id'));
                }
            }
        }
    }
}

var minDate = '01-01-1900';
var maxDate = moment().add(1,'y').format('MM-DD-YYYY');

function dataEntryDateValidator() {
    //return dataEntryValidator('date',{format:'MM-DD-YYYY', min:minDate, max:maxDate});
    return {
        validators: {
            callback: {
                callback: function(value, validator, $field) {
                    if(helpers.getErrorByLabelOrData(value)) {
                        return true;
                    }

                    if(value == null || value == "")
                        return { valid: false, message: 'This field is required.' }

                    return FormValidation.Validator['date'].validate(validator, $field, {format:'MM-DD-YYYY', min:minDate, max:maxDate}, $field.attr('id'));
                }
            }
        }
    }
}

function dataEntryTimeValidator() {
    /*return dataEntryValidator('regexp',{
        regexp:/^([0-1]?[0-9]|2[0-3])(:[0-5][0-9])?$/, 
        message:'Please ensure time is in correct format.'
    });*/

    return {
        validators: {
            callback: {
                callback: function(value, validator, $field) {
                    if(helpers.getErrorByLabelOrData(value)) {
                        return true;
                    }

                    if(value == null || value == "")
                        return { valid: false, message: 'This field is required.' }

                    return FormValidation.Validator['regexp'].validate(
                        validator, 
                        $field, 
                        {
                            regexp:/^([0-1]?[0-9]|2[0-3])(:[0-5][0-9])?$/, 
                            message:'Please ensure time is in correct format.'
                        }, 
                        $field.attr('id'));
                }
            }
        }
    }
}

function requiredIfFieldSetTo(setField, setFieldValue, message ) {
    return {
        row: '.form-group',
        validators: {
            callback: {
                message: message || 'This field is required.',
                callback: function(value, validator, $field) {
                    return validateValueNotNullIfFieldSetTo(value, validator, $field, setField, setFieldValue);
                }
            }
        }
    }
}

function requiredIfFieldSet(setField, message ) {
    return {
        row: '.form-group',
        validators: {
            callback: {
                message: message || 'This field is required.',
                callback: function(value, validator, $field) {
                    return validateIfFieldSet(value, validator, $field, setField);
                }
            }
        }
    }
}

function validIfFieldSetTo(setField, setFieldValue, message) {
    //validateIfFieldSetTo
    return {
        row: '.form-group',
        validators: {
            callback: {
                message: message || 'This field is required.',
                callback: function(value, validator, $field) {
                    return validateIfFieldSetTo(value, validator, $field, setField, setFieldValue);
                }
            }
        }
    }
}

function validDateIfFieldSetTo(setField, setFieldValue, message) {
    return {
        row: '.form-group',
        validators: {
            callback: {
                message: message || 'This field is required.',
                callback: function(value, validator, $field) {
                    return validateDateIfFieldSetTo(value, setField, setFieldValue, validator, $field);
                }
            }
        }
    }
}

function validTimeIfFieldSetTo(setField, setFieldValue, message) {
    return {
        row: '.form-group',
        validators: {
            callback: {
                message: message || 'This field is required.',
                callback: function(value, validator, $field) {
                    return validateTimeIfFieldSetTo(value, setField, setFieldValue, validator, $field);
                }
            }
        }
    }
}

function validDateIfFieldNotNull(setField, message) {
    return {
        row: '.form-group',
        validators: {
            callback: {
                message: message || 'This field is required.',
                callback: function(value, validator, $field) {
                    return validateDateIfFieldNotNull(value, setField, validator, $field);
                }
            }
        }
    }
}

function validTimeIfFieldNotNull(setField, message) {
    return {
        row: '.form-group',
        validators: {
            callback: {
                message: message || 'This field is required.',
                callback: function(value, validator, $field) {
                    return validateTimeIfFieldNotNull(value, setField, validator, $field);
                }
            }
        }
    }
}

function validSome(validatorFunctionDefinitions) {
    return {
        row: '.form-group',
        validators: {
            callback: {
                message: 'This field is required.',
                callback: function(value, validator, $field) {
                    return validatorFunctionDefinitions.some(function(definition, index, array) {
                        var valid = definition.validators.callback.callback.apply(this, [value, validator, $field]);
                        if(valid != null && valid.hasOwnProperty('valid')) {
                            return valid.valid;
                        }
                        else {
                            return valid;
                        }
                    });
                }
            }
        }
    }
}

function validEvery(validatorFunctionDefinitions, validatorName) {
    return {
        row: '.form-group',
        validators: {
            callback: {
                message: 'This field is required.',
                callback: function(value, validator, $field) {
                    return validatorFunctionDefinitions.every(function(definition, index, array) {
                        var valid = definition.validators.callback.callback.apply(this, [value, validator, $field]);
                        if(valid && valid.hasOwnProperty('valid')) {
                            return valid.valid;
                        }
                        else {
                            return valid;
                        }
                    });
                    console.log(' # Returning for validEvery: ' + isValid);
                    return isValid;
                }
            }
        }
    }
}

function requiredIfExpressionTrue(expressionFunction, message ) {
    return {
        row: '.form-group',
        validators: {
            callback: {
                message: message || 'This field is required.',
                callback: function(value, validator, $field) {
                    // input.element presents the field element
                    // input.elements presents all field elements
                    // input.field is the field name
                    // input.value is the field value
                    // input.options is the validator options                        
                    let formValues = getAllInputValues('#'+$field.parents('form').attr('id'));
                    let isRequired = expressionFunction.call(this, formValues);
                    return isRequired == false;
                }
            }
        }
    }
}

function initializeFormValidation() {
    if( importBatchRecord.recordDataType != 'pdf_bitmap_pages')
        return;
        
    $('#recordDataEntryForm').formValidation({
        framework: 'bootstrap',
        live: 'enabled',
        trigger: 'focus blur change keyup',
        excluded: [],
        fields: validationFields,
        button: {
            selector: 'dataEntryCompleteButton'
        }
    })
    .on('err.form.fv', function() {
        //console.log('Form invalid...');
    })
    .on('success.form.fv', function() {
        //console.log('Form valid!');
    });
    //.data('formValidation').validate()
    
    $('#recordDataEntryForm').on('focus blur change keyup',function() {
        invalidateWorkflowButtons();
        invalidateBadges();
    })

    // Here we initialize the select options so that they work with the validator.
    var revalidateBootstrapSelect = function() {
        //var selectId = $(this).siblings('select').first().attr('id');
        //$(this).parents('form').first().formValidation('revalidateField', selectId);
        $('#recordDataEntryForm').data('formValidation').resetForm();
        $('#recordDataEntryForm').data('formValidation').validate();
        invalidateBadges();
        invalidateWorkflowButtons();
    };
    $('.bootstrap-select button.dropdown-toggle').blur(revalidateBootstrapSelect);
    $('.bootstrap-select button.dropdown-toggle').focus(revalidateBootstrapSelect);
    $('.selectpicker').change(revalidateBootstrapSelect);

    $('#recordDataEntryForm').data('formValidation').validate();
    invalidateBadges();
    invalidateWorkflowButtons();
}

function setChildText($element, text) {
    //console.log('Setting child text: ');
    var nodes = $element.contents().filter(function(){ 
        //console.log(' - Evaluating node type: ' + this.nodeType);
        return this.nodeType == 3; 
    });
    
    if(nodes && nodes.length > 0) {
        nodes[0].nodeValue = text;
    }
}

function invalidateBadges() {
    if( importBatchRecord.recordDataType != 'pdf_bitmap_pages')
        return;
        
    $('#recordDataEntryForm .panel').each(function() {
        var invalidCount = 0;
        var warningCount = 0;
        $(this).find('input, select').each(function() {
            var id = $(this).attr('id');
            var val = $(this).val();
            if(id) {
                var valid = $('#recordDataEntryForm').data('formValidation').isValidField(id);
                if(!valid)
                    invalidCount++;
                if(isDataEntryErrorValue(val))
                    warningCount++;
            }
        });

        var invalidBadge = $(this).find('.invalid-badge');
        var successBadge = $(this).find('.success-badge');
        var warningBadge = $(this).find('.warning-badge');
        invalidBadge.find('.badge-count').text(invalidCount.toString());
        warningBadge.find('.badge-count').text(warningCount.toString());

        //setChildText(invalidBadge.find('.badge-count'), invalidCount.toString());
        //setChildText(warningBadge, warningCount.toString());
        invalidCount == 0 && warningCount == 0 ? successBadge.removeClass('hidden') : successBadge.addClass('hidden');
        invalidCount > 0 ? invalidBadge.removeClass('hidden') : invalidBadge.addClass('hidden');
        warningCount > 0 ? warningBadge.removeClass('hidden') : warningBadge.addClass('hidden');

    })
}

function isFormValid() {
    var formValid = $('#recordDataEntryForm').data('formValidation').isValid();
    return formValid;
}

function invalidateWorkflowButtons() {
    $('#discardButton').prop('disabled', false);
    $('#undiscardButton').prop('disabled', false);
    $('#unignoreButton').prop('disabled', false);
    $('#ignoreButton').prop('disabled', false);
    $('#reprocessButton').prop('disabled', false);
    $('#saveAndReprocessButton').prop('disabled',  !isFormValid());
    $('#dataEntryCompleteButton').prop('disabled',  !isFormValid());
}

function getErrorLabel(errorType) {
    var error = helpers.getErrorByLabelOrData(errorType);
    if(error)
        return error.label;

    return null;
}

function isDataEntryErrorValue(value) {
    return helpers.getErrorByLabelOrData(value);
}

function getDataEntryErrorValue(errorString) {
    var error = helpers.getErrorByLabelOrData(errorString);
    if(error) {
        return error.data;
    }
    return null;
}

function countFormReviewInputs() {
    var reviewCount = 0;
    for( var fieldName in formFields ) {
        var fieldValue = $('#recordDataEntryForm #'+fieldName).val();
        if(isDataEntryErrorValue(fieldValue))
           reviewCount++;
    }
    return reviewCount;
}

function isValidForReview() {
    return $('#recordDataEntryForm').data('formValidation').isValid();
}

$('.data-entry-error-selector ul.dropdown-menu a').click(function() {
    var errorType = $(this).attr('value');
    var inputId = $(this).parents('.data-entry-error-selector').first().find('a.dropdown-toggle').attr('parentId');
    var input = $('#'+inputId);
    var form = input.parents('form').first();
    
    if( errorType == '#clear' ) {
        if(input.attr('dataEntryErrorType') == '#clear')
            return;

        var oldValue = input.attr('oldValue');
        input.attr('oldValue',null);
        input.attr('dataEntryErrorType',null);
        input.val(oldValue);
        input.prop('disabled',false);
        form.formValidation('enableFieldValidators',inputId,true);
        form.formValidation('revalidateField', inputId);
        input.trigger("change");
    }
    else {
        if(input.attr('dataEntryErrorType') == errorType)
            return;
        
        // We only set the oldValue if we aren't just switching
        // to a different error type.
        if(!input.attr('dataEntryErrorType'))
            input.attr('oldValue', input.val());

        input.attr('dataEntryErrorType', errorType);
        input.val( getErrorLabel(errorType) );
        input.prop('disabled',true);
        form.formValidation('enableFieldValidators',inputId,true);
        form.formValidation('revalidateField', inputId);
        input.trigger("change");
    }


    // Trigger the revalidation of this field.
    //input.parents('form').first().formValidation('revalidateField', inputId);
});

function initializeCollapseEvents() {
    $('.panel-toggle').click(function(e) {
        var target = $(this).data('target');
        toggleTab(target);
    });
}

$('#discardButton').click(function() {
    showDiscardRecordModal();
});

$('#undiscardButton').click(function() {
    showUndiscardRecordModal();
});

$('#unignoreButton').click(function() {
    showUnignoreModal();
});

$('#ignoreButton').click(function() {
    showIgnoreModal();
});

$('#reprocessButton').click(function() {
    showAddToProcessingQueueModal();
});

$('#saveAndReprocessButton').click(function() {
    submitFormData();
});

$('#dataEntryCompleteButton').click(function() {
    submitFormData();
});

function showDiscardRecordModal() {
    swal({
        title: 'Discard Record',
        text: 'Are you sure you want to discard this record? Discarded records will not be processed and will not require further data entry.',
        input: 'text',
        inputPlaceholder: 'Reason Discarding Record',
        inputValidator: function(value) {
            return new Promise(function(resolve,reject) {
                if(value)
                    resolve();
                else
                    reject('You must specify a reason you are discarding this record.');
            });
        },
        type: 'error',
        showCancelButton: true,
        confirmButtonText: 'Discard',
        showLoaderOnConfirm: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonClass: 'btn btn-danger btn-fill btn-alert',
        cancelButtonClass: 'btn btn-default btn-fill btn-alert',
        preConfirm: function(reason) {
            return new Promise(function(resolve, reject) {
                var url = '/collector/batch/record/'+importBatchRecord.importBatchGuid+'/'+importBatchRecord.recordIndex+'/discard.json';
                
                // Was trying to just return this promise for the preConfirm but for
                // some reason sweetalert didn't like that and wouldn't show the correct
                // error message when rejecting the promise. So just wrapping a promise in a 
                // promise, oh joy.
                $.post(url, {reason:reason})
                .done(function(data, textStatus, jqXHR) {
                    window.location.href = '/collector/batch/'+importBatchRecord.importBatchGuid+'/openNextRecordForDataEntry?fromRecord='+importBatchRecord.importBatchRecordGuid; 
                    // we don't resolve here because we want the modal to stay active until the window.href changes.
                })
                .fail(function(jqXHR, textStatus, errorThrown) {
                    reject('Unable to discard this record.');
                });
            })
        },
    });
}

function showAddToProcessingQueueModal() {
    swal({
        title: 'Reprocess Record',
        text: 'This will add the record back to the reprocessing queue.',
        type: 'error',
        showCancelButton: true,
        confirmButtonText: 'Reprocess',
        showLoaderOnConfirm: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonClass: 'btn btn-danger btn-fill btn-alert',
        cancelButtonClass: 'btn btn-default btn-fill btn-alert',
        preConfirm: function() {
            return new Promise(function(resolve, reject) {
                var url = '/collector/batch/record/'+importBatchRecord.importBatchGuid+'/'+importBatchRecord.recordIndex+'/reprocess.json';

                $.post(url)
                .done(function(data, textStatus, jqXHR) {
                    window.location.href = '/collector/batch/record/'+importBatchRecord.importBatchGuid+'/' + importBatchRecord.recordIndex + '/dataEntry'; 
                    // we don't resolve here because we want the modal to stay active until the window.href changes.
                })
                .fail(function(jqXHR, textStatus, errorThrown) {
                    reject('Unable to reprocess this record.');
                });
            })
        },
    });
}

function showUndiscardRecordModal() {
    swal({
        title: 'Undiscard Record',
        text: 'This will reopen the record and mark the status as Pending Data Entry.',
        type: 'error',
        showCancelButton: true,
        confirmButtonText: 'Undiscard',
        showLoaderOnConfirm: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonClass: 'btn btn-danger btn-fill btn-alert',
        cancelButtonClass: 'btn btn-default btn-fill btn-alert',
        preConfirm: function() {
            return new Promise(function(resolve, reject) {
                var url = '/collector/batch/record/'+importBatchRecord.importBatchGuid+'/'+importBatchRecord.recordIndex+'/undiscard.json';

                $.post(url)
                .done(function(data, textStatus, jqXHR) {
                    window.location.href = '/collector/batch/record/'+importBatchRecord.importBatchGuid+'/' + importBatchRecord.recordIndex + '/dataEntry'; 
                    // we don't resolve here because we want the modal to stay active until the window.href changes.
                })
                .fail(function(jqXHR, textStatus, errorThrown) {
                    reject('Unable to undiscard this record.');
                });
            })
        },
    });
}

function showIgnoreModal() {
    swal({
        title: 'Ignore Record',
        text: 'Ignored records are records that will not have any further processing performed, even though it is a valid record. Are you sure you want to ignore this record?',
        type: 'error',
        showCancelButton: true,
        confirmButtonText: 'Ignore',
        showLoaderOnConfirm: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonClass: 'btn btn-danger btn-fill btn-alert',
        cancelButtonClass: 'btn btn-default btn-fill btn-alert',
        preConfirm: function() {
            return new Promise(function(resolve, reject) {
                var url = '/collector/batch/record/'+importBatchRecord.importBatchGuid+'/'+importBatchRecord.recordIndex+'/ignore.json';

                $.post(url)
                .done(function(data, textStatus, jqXHR) {
                    window.location.href = '/collector/batch/'+importBatchRecord.importBatchGuid+'/openNextRecordForDataEntry?fromRecord='+importBatchRecord.importBatchRecordGuid; 
                    // we don't resolve here because we want the modal to stay active until the window.href changes.
                })
                .fail(function(jqXHR, textStatus, errorThrown) {
                    reject('Unable to ignore this record.');
                });
            })
        },
    });
}

function showUnignoreModal() {
    swal({
        title: 'Unignore Record',
        text: 'This will reopen the record and mark the status as Pending Review.',
        type: 'error',
        showCancelButton: true,
        confirmButtonText: 'Unignore',
        showLoaderOnConfirm: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonClass: 'btn btn-danger btn-fill btn-alert',
        cancelButtonClass: 'btn btn-default btn-fill btn-alert',
        preConfirm: function() {
            return new Promise(function(resolve, reject) {
                var url = '/collector/batch/record/'+importBatchRecord.importBatchGuid+'/'+importBatchRecord.recordIndex+'/unignore.json';

                $.post(url)
                .done(function(data, textStatus, jqXHR) {
                    window.location.href = '/collector/batch/record/'+importBatchRecord.importBatchGuid+'/' + importBatchRecord.recordIndex + '/dataEntry'; 
                    // we don't resolve here because we want the modal to stay active until the window.href changes.
                })
                .fail(function(jqXHR, textStatus, errorThrown) {
                    reject('Unable to unignore this record.');
                });
            })
        },
    });
}

function initializeFormData() {

    if( importBatchRecord.recordDataType != 'pdf_bitmap_pages')
        return;

    if( !importBatchRecord.dataEntryData )
        return;

    // We add a little logic to deal with older form dataentrydata storage.
    var fieldValues = importBatchRecord.dataEntryData;
    if(importBatchRecord.dataEntryData.hasOwnProperty('recordData'))
        fieldValues = fieldValues.fieldValues;

    for(var inputName in fieldValues) {
        var $input = $('#recordDataEntryForm #'+inputName).first();
        if($input) {
            $input.val(fieldValues[inputName]);
            $input.change(); // Trigger event so that validation framework is triggered.
            if($input.prop('tagName') != 'SELECT' && isDataEntryErrorValue($input.val())) {
                $input.prop('disabled',true);
            }
        }
    }

    $('.selectpicker').selectpicker('refresh');
    //$('#recordDataEntryForm').data('formValidation').validate();

    if(!helpers.isImportBatchRecordEditable(importBatchRecord)) {
        $("#recordDataEntryForm :input").prop("disabled", true);
        $('#templateDropdownButton').prop('disabled', true);
        $('.data-entry-error-selector-button').prop('disabled', true);
    }
}

function disableActionButtons() {
    $('#discardButton').prop('disabled', true);
    $('#undiscardButton').prop('disabled', true);
    $('#unignoreButton').prop('disabled', true);
    $('#ignoreButton').prop('disabled', true);
    $('#reprocessButton').prop('disabled', true);
    $('#saveAndReprocessButton').prop('disabled', true);
    $('#dataEntryCompleteButton').prop('disabled', true);
}

function getExistingRecordData(fieldName) {
    if(importBatchRecord && importBatchRecord.dataEntryData && importBatchRecord.dataEntryData.recordData)
       return importBatchRecord.dataEntryData.recordData[fieldName];
    return null;
}

function submitFormData() {

    var dataEntryData = {
        fieldValues: {},
        dataEntryErrorFields: [],
        invalidFields: [],
        recordData: {},
        responsibleProviderIds: [],
        primaryResponsibleProviderId: null,
        formServiceDate: null
    };

    var url;
    if(importBatchRecord.recordDataType == 'pdf_bitmap_pages') {
        var formValidation = $('#recordDataEntryForm').data('formValidation');
        $('#recordDataEntryForm *').filter(':input').each(function(){
            if(this.name) {
                var value = this.value;
                if(value == "") value = null;

                dataEntryData.fieldValues[this.name] = value;

                var isInvalid = !formValidation.isValidField(this.name);
                var isDataEntryError = isDataEntryErrorValue(value);

                if(isInvalid) {
                    dataEntryData.invalidFields.push(this.name);
                }

                if(isDataEntryError) {
                    dataEntryData.dataEntryErrorFields.push({fieldName:this.name, error:getDataEntryErrorValue(value)});
                }

                if(!isInvalid && !isDataEntryError) {
                    dataEntryData.recordData[this.name] = value;
                }
                else {
                    dataEntryData.recordData[this.name] = null;
                }

                if($(this).hasClass('form-service-date') && value != null && !isInvalid ) {
                    dataEntryData.formServiceDate = value;
                }

                if($(this).hasClass('responsible-provider') && value != null && !isNaN(parseInt(value))) {
                    dataEntryData.responsibleProviderIds.push(parseInt(value));
                }

                if($(this).hasClass('primary-responsible-provider') && value != null && !isNaN(parseInt(value))) {
                    dataEntryData.primaryResponsibleProviderId = parseInt(value);
                }
            }
        });
        
        if(facilityDataEntryFormSettings.autoGenerateEncounterNumber &&
           !getExistingRecordData('encounterNumber') &&
           dataEntryData.recordData.dos && dataEntryData.recordData.anesStartTime &&
           dataEntryData.recordData.firstName && dataEntryData.recordData.lastName ) {

            var firstInitial = dataEntryData.recordData.firstName.substr(0,1).toUpperCase();
            var lastInitial = dataEntryData.recordData.lastName.substr(0,1).toUpperCase();
            var dos = moment(dataEntryData.recordData.dos,'MM-DD-YYYY').format('YYYYMMDD');
            var anesStartTime = moment(dataEntryData.recordData.anesStartTime,'HH:mm').format('HHmm');
            var generatedEncounterNumber = [firstInitial + lastInitial, dos, anesStartTime].join(':');

            dataEntryData.recordData.encounterNumber = generatedEncounterNumber;
            dataEntryData.fieldValues.encounterNumber = generatedEncounterNumber;
        }
        else if(facilityDataEntryFormSettings.autoGenerateEncounterNumber && getExistingRecordData('encounterNumber')) {
            dataEntryData.recordData.encounterNumber = getExistingRecordData('encounterNumber');
            dataEntryData.fieldValues.encounterNumber = getExistingRecordData('encounterNumber');
        }

        url = '/collector/batch/record/'+importBatchRecord.importBatchGuid+'/'+importBatchRecord.recordIndex+'/'+dataEntryFormDefinitionName+'/'+dataEntryFormDefinitionVersion+'/data.json';
    }
    else if(importBatchRecord.recordDataType == 'dsv_row') {
        $('#dsvRecordForm *').filter(':input').each(function(){
            if(this.name) {
                var value = this.value;
                    if(value == "") value = null;
                dataEntryData.recordData[this.name] = value;
                dataEntryData.fieldValues[this.name] = value;
            }
        });

        var formDefinitionName = 'DefaultDsvForm';
        var formDefinitionVersion = '1';
        url = '/collector/batch/record/'+importBatchRecord.importBatchGuid+'/'+importBatchRecord.recordIndex+'/'+formDefinitionName+'/'+formDefinitionVersion+'/data.json';
    }

    // Disable the save buttons.
    disableActionButtons();

    // Show the loading message.
    $('#submitLoadingMessage').css('visibility','visible')

    // Disable the entire form.
    $("#recordDataEntryForm :input").prop("disabled", true);

    $.ajax({
        type: 'POST',
        url: url,
        data: JSON.stringify(dataEntryData),
        contentType: 'application/json; charset=utf-8'
    })
    .done(function(data, textStatus, jqXHR) {
        if($('#goToNextCheck').is(':checked')) {
            window.location.href = '/collector/batch/'+importBatchRecord.importBatchGuid+'/openNextRecordForDataEntry?fromRecord='+importBatchRecord.importBatchRecordGuid;
        }
        else {
            window.location.reload();
            //invalidateWorkflowButtons();
            //$('#submitLoadingMessage').css('visibility','hidden');
        }

    })
    .fail(function(jqXHR, textStatus, errorThrown) {
        invalidateWorkflowButtons();
        $('#submitLoadingMessage').css('visibility','hidden');
    });
}

function getAllInputValues(selector) {
    var fieldValues = {};

    if(importBatchRecord.recordDataType == 'pdf_bitmap_pages') {
        var formValidation = $(selector).data('formValidation');
        $(selector+' *').filter(':input').each(function(){
            if(this.name) {
                var value = this.value;
                if(value == "") value = null;

                fieldValues[this.name] = value;

                var isInvalid = !formValidation.isValidField(this.name);
                var isDataEntryError = isDataEntryErrorValue(value);
            }
        });
    }
    else if(importBatchRecord.recordDataType == 'dsv_row') {
        $('#dsvRecordForm *').filter(':input').each(function(){
            if(this.name) {
                var value = this.value;
                    if(value == "") value = null;
                fieldValues[this.name] = value;
            }
        });
    }

    return fieldValues;
}

$('.selectpicker').selectpicker({
  selectOnTab: true
});

var currentImageRotation = 0;
function setInitialImageRotation() {
    if(importBatchRecord.recordDataImageRotation != null) {
        currentImageRotation = importBatchRecord.recordDataImageRotation;
    }
    else if(_.isEmpty(importBatchRecord.dataEntryData) && previousRecord && previousRecord.recordDataImageRotation != null) {
        currentImageRotation = previousRecord.recordDataImageRotation;
        updateRecordRotation();
    }
}

function flipImage() {
    currentImageRotation += 90;
    currentImageRotation = currentImageRotation % 360;
    if (currentImageRotation < 0)
        currentImageRotation += 360;

    refreshImageLens();
}

$('#flipImageButton').click(function() {
    flipImage();
    updateRecordRotation();
});

function updateRecordRotation() {
    var url = '/collector/batch/record/'+importBatchRecord.importBatchGuid+'/'+importBatchRecord.recordIndex+'/imageRotation.json';
    $.post(url, {degrees:currentImageRotation})
    .done(function(data, textStatus, jqXHR) {
        //console.log('Completed updating degrees.');
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
        //console.log('Unable to update degrees.');
    });
};

$().ready(function(){

    setInitialImageRotation();
    refreshImageLens();
    setupFormTabbing();
    initializeFormValidation();
    initializeCollapseEvents();
    initializeFormData();
    //refreshFacilityDependentPickers();
    refreshNotesDisplay();

    if(!_.isEmpty(importBatchRecord.dataEntryData)) {
        hideCopyDataButtons();
    }

    var editor = ace.edit('dataEntryDataEditor');
    editor.setAutoScrollEditorIntoView(true);
    editor.setOption("maxLines", Infinity);
    editor.setOption("minLines", 5);
    editor.setReadOnly(true);
    editor.setHighlightActiveLine(false);
    editor.setTheme('ace/theme/clouds');
    editor.getSession().setMode('ace/mode/json');
    editor.setValue(JSON.stringify(importBatchRecord.dataEntryData,null,4), -1);

    if(importBatchRecord.recordDataType == 'external_web_form') {
        var editor = ace.edit('externalWebFormDataContent');
        editor.setAutoScrollEditorIntoView(true);
        editor.setOption("maxLines", Infinity);
        editor.setOption("minLines", 5);
        editor.setReadOnly(true);
        editor.setHighlightActiveLine(false);
        editor.setTheme('ace/theme/clouds');
        editor.getSession().setMode('ace/mode/json');
        editor.setValue(JSON.stringify(importBatchRecord.recordData,null,4), -1);
    }

    initializePagingButtons();
});

var currentPagingIndex = 0;
function initializePagingButtons() {
    $('#previousRecordPageButton').click(function(event) {
        currentPagingIndex--;
        if(currentPagingIndex < 0)
            currentPagingIndex = importBatchRecord.recordData.length - 1;

        invalidateSelectedPagingButton();
        event.preventDefault();
    });

    $('#nextRecordPageButton').click(function(event) {
        currentPagingIndex++;
        if(currentPagingIndex >= importBatchRecord.recordData.length)
            currentPagingIndex = 0;

        invalidateSelectedPagingButton();
        event.preventDefault();
    });

    $('.selectRecordPageButton').click(function(event) {
        currentPagingIndex = parseInt($(this).attr('data-record-page-index'));
        invalidateSelectedPagingButton();
        event.preventDefault();
    })

    invalidateSelectedPagingButton();
}

function invalidateSelectedPagingButton() {
    $('li.selectRecordPageListItem').removeClass('active');
    $('li.selectRecordPageListItem[data-record-page-index=\''+currentPagingIndex+'\']').addClass('active');
    refreshImageLens();
}

$('#addNoteButton').on('click', function(event) {
    event.preventDefault();
    var noteText = $('#noteText').first().val();

    if(!noteText)
        return;

    showAddNoteLoadingMessage();

    var url = '/collector/batch/record/'+importBatchRecord.importBatchGuid+'/'+importBatchRecord.recordIndex+'/notes.json';
    $.post(url, {noteText:noteText})
    .done(function(data, textStatus, jqXHR) {
        $('#noteText').val(null);
        refreshNotesDisplay();
        hideAddNoteLoadingMessage();
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
        alert('Unable to add note: ' + textStatus);
        refreshNotesDisplay();
        hideAddNoteLoadingMessage();
    });
});

function showAddNoteLoadingMessage() {
    // addingNoteLoadingMessage
    $('#noteText').prop('disabled', true);
    $('#addNoteButton').prop('disabled', true);
    $('#addingNoteLoadingMessage').css('visibility','visible');
}

function hideAddNoteLoadingMessage() {
    $('#noteText').prop('disabled', false);
    $('#addNoteButton').prop('disabled', false);
    $('#addingNoteLoadingMessage').css('visibility','hidden');
}

//refreshingNotesLoadingMessage
function showRefreshNotesLoadingMessage() {
    $('#refreshingNotesLoadingMessage').css('visibility','visible');
}

function hideRefreshNotesLoadingMessage() {
    $('#refreshingNotesLoadingMessage').css('visibility','hidden');
}

function refreshNotesDisplay() {
    showRefreshNotesLoadingMessage();
    var url = '/collector/batch/record/'+importBatchRecord.importBatchGuid+'/'+importBatchRecord.recordIndex+'/notes.json';
    $.get(url)
    .done(function(data, textStatus, jqXHR) {
        var $notes = $('#notes');
        $notes.empty();
        for( var i = 0; i < data.length; i++ ) {
            var note = data[i];
            var html = '<blockquote><p>'+note.note+'</p><small>'+note.createdBy+' at '+moment(note.createdAt).fromNow()+'</small></blockquote>'
            $notes.append(html);
        }
        hideRefreshNotesLoadingMessage();
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
        hideRefreshNotesLoadingMessage();
    });
}

function setInputIfEmpty(inputName, value) {
    var $input = $('#'+inputName).first();
    var currentVal = $input.val();
    if(currentVal == null || currentVal == '') {
        $input.val(value);
        $input.change();
    }
}

function hideCopyDataButtons() {
    $('.copyDataFromPreviousRecord').css('visibility','hidden');
}
