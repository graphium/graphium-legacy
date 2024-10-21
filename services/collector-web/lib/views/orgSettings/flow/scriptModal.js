
$('#saveFlowButton').click(function() {
    $('#createFlowPendingMessage').css('visibility','visible');
    $('#cancelCreateFlowButton, #saveFlowButton').prop('disabled', true).css('visibility','hidden');

    if(window.flow) {
      $('#createFlowForm').prop('action','/org/settings/flow/scripts/'+flow.flowGuid);
    }
    else {
      $('#createFlowForm').prop('action','/org/settings/flow/scripts');
    }

    $('#createFlowForm').submit();
});

$('#showFlowModalButton').click(function() {

    if(window.flow) {
      $('#flowName').val(flow.flowName);
      $('#flowDescription').val(flow.flowDescription);
      $('#facilityId').val(flow.facilityId).selectpicker('refresh');
      $('#streamType').val(flow.streamType);
      $('#messageTypes').val(flow.messageTypes ? flow.messageTypes.join(', ') : '');
      $('#flowType').val(flow.flowType).selectpicker('refresh');
      $('#runtimeVersion').val(flow.runtimeVersion).selectpicker('refresh');
      $('#scriptLanguage').val(flow.scriptLanguage).selectpicker('refresh');
      $('#defaultHandler').val(flow.defaultHandler);
      if(flow.flowType == 'system') {
        $('#systemFlowScript').val(flow.systemFlowScript).selectpicker('refresh');
      }
      else if(flow.flowType == 'script') {
        $('#flowContent').val(flow.flowContent);
      }
      
      $('#activeCheckbox').prop('checked', flow.active);
      $('#systemGlobalCheckbox').prop('checked', flow.systemGlobal);

      invalidateFlowType();

      _.forOwn(flow.flowConfig, function(value, key) {
        $('#'+key).val(value.toString());
      })

      $('#configurationFields .selectpicker').selectpicker('refresh');
    }

    $('#createFlowModal').modal('show');
});

function generateBooleanSelectHtml(parameterName) {
  return '<select class="selectpicker" id="'+parameterName+'" name="flowConfig.'+parameterName+'" data-title="Select Yes/No" data-style="btn-default btn-block" data-menu-style="dropdown-blue">' +
            '<option value=""></option>' +
            '<option value="true">Yes</option>' +
            '<option value="false">No</option>' +
         '</select>';
}

function getConfigInputHtml(parameter) {
  var input;
  switch(parameter.type) {
    case 'string': input = '<input class="form-control" id="'+parameter.name+'" name="flowConfig.'+parameter.name+'" type="'+(parameter.isPassword ? 'password' : 'text')+'"></input>'; break;
    case 'integer': input = '<input class="form-control" id="'+parameter.name+'" name="flowConfig.'+parameter.name+'" type="text"></input>'; break;
    case 'array': input = '<input class="form-control" id="'+parameter.name+'" name="flowConfig.'+parameter.name+'" type="text"></input>'; break;
    case 'boolean': input = generateBooleanSelectHtml(parameter.name); break;
    default: input = '<div class="form-control">Invalid Parameter Type</div>'; break;
  }

  var helpText = [];
  if(!parameter.required) {
    helpText.push('(Optional)');
  }
  if(parameter.description) {
    helpText.push(parameter.description);
  }
  if(helpText.length > 0) {
    input += '<span class="help-block">'+helpText.join(' ')+'</span>';

  }
  return  '<div class="form-group">'
    +       '<label class="col-md-4 control-label">'+parameter.title+'</label>'
    +       '<div class="col-md-8">'
    +         input
    +       '</div>'
    +     '</div>';
}

function getParameterType(templateName, parameterName) {
  var template = _.find(systemFlowScripts, {systemFlowScriptName:templateName});
  if(template) {
    var parameter = _.find(template.parameters, {name:parameterName});
    if(parameter) {
      return parameter.type;
    }
  }
  return null;
}

function updateTemplateConfig() {
  var currentTemplate = $('#systemFlowScript').val();
  var flowType = $('#flowType').val();
  var $configurationFields = $('#configurationFields');
  $configurationFields.empty();       

  if(flowType == 'system' && currentTemplate) {

    var template = _.find(systemFlowScripts, {systemFlowScriptName:currentTemplate});
    if(template.parameters) {
      for(var i = 0; i < template.parameters.length; i++) {
        var html = getConfigInputHtml(template.parameters[i]); 
        $configurationFields.append(html);
      }
      $configurationFields.find('.selectpicker').selectpicker('refresh');
      $('#templateConfiguration').collapse('show');
    }

  }
  else {
    $('#templateConfiguration').collapse('hide');
  }
}

function invalidateFlowType() {
    var flowType = $('#flowType').val();
    var showTemplates = flowType == 'system' ? 'show' : 'hide';
    var showContent = flowType == 'script' ? 'show' : 'hide';
    //$('#flowTemplatesGroup').css('visibility',templatesVisibility);
    $('#flowTemplatesGroup').collapse(showTemplates);
    $('#flowContentGroup').collapse(showContent);
    updateTemplateConfig();
}

$().ready(function() {

  $('#flowType').change(function() {
    invalidateFlowType();
  });

  $('#systemFlowScript').change(function() {
    updateTemplateConfig();
  })

  $("#flowName").alpha({
      allow :    '.', // Specify characters to allow
      allowNumeric: true
  });

  updateTemplateConfig();
})