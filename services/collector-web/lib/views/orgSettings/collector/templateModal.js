
$('#saveOrCreateModalButton').click(function() {
    $('#modalPendingMessage').css('visibility','visible');
    $('#cancelModalButton, #saveFlowButton').prop('disabled', true);

    var currentTemplateGuid = $('#templateModal').attr('data-template');

    if(currentTemplateGuid) {
      $('#templateForm').prop('action','/org/settings/collector/templates/'+currentTemplateGuid);
    }
    else {
      $('#templateForm').prop('action','/org/settings/collector/templates');
    }

    $('#templateForm').submit();
});

function setCheckbox(checkbox, selected) {
    checkbox.prop('checked', selected);
}

$('#showTemplateModalButton').click(function() {
    $('#saveOrCreateModalButton').html('Create');
    $('#templateModal').attr('data-template', null);

    $('#templateName').val(null);
    $('#columnNames').val(null);
    $('#columnTitles').val(null);
    $('#templateDescription').val(null);
    $('#batchDataType').val(null).selectpicker('refresh');
    setCheckbox($('#requiresDataEntryCheckbox'), false);
    $('#dataEntryFormDefinitionName').val(null).selectpicker('refresh');
    $('#defaultAssigneeUserName').val(null).selectpicker('refresh');
    $('#flowScriptGuid').val(null).selectpicker('refresh');
    setCheckbox($('#activeCheckbox'), true);
    $('#linesToSkip').val(null);
    setCheckbox($('#hasHeaderCheckbox'), false);
    setCheckbox($('#skipEmptyLinesCheckbox'), false);
    setCheckbox($('#skipLinesWithEmptyValuesCheckbox'), false);
    setCheckbox($('#relaxColumnCountCheckbox'), false);
    setCheckbox($('#systemGlobalCheckbox'), false);

    $('#templateModal').modal('show');
});

$('.edit-template').click(function() {
    $('#saveOrCreateModalButton').html('Update');
    var templateGuid = $(this).attr('data-template');
    var template = _.find(templates, {templateGuid: templateGuid});
    $('#templateName').val(template.templateName);
    $('#columnNames').val(template.batchDataTypeOptions ? template.batchDataTypeOptions.columnNames : null);
    $('#columnTitles').val(template.batchDataTypeOptions ? template.batchDataTypeOptions.columnTitles : null);
    $('#templateDescription').val(template.templateDescription);
    $('#batchDataType').val(template.batchDataType).selectpicker('refresh');
    setCheckbox($('#requiresDataEntryCheckbox'), template.requiresDataEntry);
    $('#dataEntryFormDefinitionName').val(template.dataEntryFormDefinitionName).selectpicker('refresh');
    $('#defaultAssigneeUserName').val(template.defaultAssigneeUserName).selectpicker('refresh');
    $('#flowScriptGuid').val(template.flowScriptGuid).selectpicker('refresh');
    setCheckbox($('#activeCheckbox'), template.activeIndicator);
    $('#linesToSkip').val(template.batchDataTypeOptions.linesToSkip);
    setCheckbox($('#hasHeaderCheckbox'), template.batchDataTypeOptions ? template.batchDataTypeOptions.hasHeader : false);
    setCheckbox($('#skipEmptyLinesCheckbox'), template.batchDataTypeOptions ? template.batchDataTypeOptions.skipEmptyLines : false);
    setCheckbox($('#relaxColumnCountCheckbox'), template.batchDataTypeOptions ? template.batchDataTypeOptions.relaxColumnCount : false);
    setCheckbox($('#skipLinesWithEmptyValuesCheckbox'), template.batchDataTypeOptions ? template.batchDataTypeOptions.skipLinesWithEmptyValues : false);
    setCheckbox($('#systemGlobalCheckbox'), template.systemGlobal);

    if(template.batchDataType == 'pdf') {
        $('#batchDataType').val('pdf').selectpicker('refresh');
    }
    else if(template.batchDataType == 'dsv') {
        switch(template.batchDataTypeOptions.delimiter) {
            case 'comma': $('#batchDataType').val('dsv_comma').selectpicker('refresh'); break;
            case 'pipe': $('#batchDataType').val('dsv_pipe').selectpicker('refresh'); break;
            case 'colon': $('#batchDataType').val('dsv_colon').selectpicker('refresh'); break;
            case 'tab': $('#batchDataType').val('dsv_tab').selectpicker('refresh'); break;
        }
    }

    $('#templateModal').attr('data-template', templateGuid);
    $('#templateModal').modal('show');
})