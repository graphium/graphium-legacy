function setupUpdateBatchTemplateModal() {
    $('a.update-batch-template').click(function(event) {
        event.preventDefault();
      
        var batchGuid = $(this).attr('data-batch');
        var templateOptions = {};
        for(var i = 0; i < templates.length; i++) {
            var template = templates[i];
            if(template.batchDataType == 'pdf')
                templateOptions[template.templateGuid.toString()] = (template.systemGlobal ? '(Global) ' : '') + template.templateName;
        }
        swal({
            title: 'Select Template',
            text: 'Use a different template for this batch..',
            input: 'select',
            inputPlaceholder: 'Select a Template',
            inputValidator: function(value) {
                return new Promise(function(resolve,reject) {
                    if(value)
                        resolve();
                    else
                        reject('You must select a template.');
                });
            },
            inputOptions: templateOptions,
            inputClass: 'selectpicker',
            type: 'question',
            showCancelButton: true,
            confirmButtonText: 'Change Template',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            confirmButtonClass: 'btn btn-info btn-fill btn-alert',
            cancelButtonClass: 'btn btn-default btn-fill btn-alert',
            preConfirm: function(templateGuid) {
                return new Promise(function(resolve, reject) {

                    $('<form>', {
                    "action": '/collector/batch/'+batchGuid+'/template/'+templateGuid,
                    "method": 'post'
                    }).appendTo(document.body).submit();
                })
            },
        });
        
        return false;
    })
}