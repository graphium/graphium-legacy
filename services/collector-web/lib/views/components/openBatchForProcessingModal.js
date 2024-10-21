
$('button.open-batch-for-processing').click(function() {
    var batchGuid = $(this).attr('data-batch');
    var dataEntryUserOptions = {};
    for(var i = 0; i < dataEntryUsers.length; i++) {
        var deu = dataEntryUsers[i];
        dataEntryUserOptions[deu.userId.toString()] = deu.lastName + ', ' + deu.firstName + ' ('+deu.userName+')';
    }
    swal({
        title: 'Open Batch for Processing',
        text: 'Open this batch and assign it to a Data Entry Clerk. Note: You will NOT be able to change the facility once the batch is open. Please make sure this is correct before proceeding.',
        input: 'select',
        inputPlaceholder: 'Select a Data Entry Clerk',
        inputValidator: function(value) {
            return new Promise(function(resolve,reject) {
                if(value)
                    resolve();
                else
                    reject('You must select a clerk.');
            });
        },
        inputOptions: dataEntryUserOptions,
        inputClass: 'selectpicker',
        type: 'question',
        showCancelButton: true,
        confirmButtonText: 'Open',
        showLoaderOnConfirm: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonClass: 'btn btn-info btn-fill btn-alert',
        cancelButtonClass: 'btn btn-default btn-fill btn-alert',
        preConfirm: function(userId) {
            return new Promise(function(resolve, reject) {

                $('<form>', {
                  "action": '/collector/batch/'+batchGuid+'/openForProcessing/'+userId,
                  "method": 'post'
                }).appendTo(document.body).submit();
            })
        },
    });
});