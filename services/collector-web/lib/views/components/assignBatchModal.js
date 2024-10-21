function setupAssignBatchModal() {
    $('button.assign-batch').click(function() {
        var batchGuid = $(this).attr('data-batch');
        var dataEntryUserOptions = {};
        for(var i = 0; i < dataEntryUsers.length; i++) {
            var deu = dataEntryUsers[i];
            dataEntryUserOptions[deu.userId.toString()] = deu.lastName + ', ' + deu.firstName + ' ('+deu.userName+')';
        }
        swal({
            title: 'Assign Batch to User',
            text: 'Assign this batch to another user for data entry or review.',
            input: 'select',
            inputPlaceholder: 'Select a User',
            inputValidator: function(value) {
                return new Promise(function(resolve,reject) {
                    if(value)
                        resolve();
                    else
                        reject('You must select a user.');
                });
            },
            inputOptions: dataEntryUserOptions,
            inputClass: 'selectpicker',
            type: 'question',
            showCancelButton: true,
            confirmButtonText: 'Assign',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            confirmButtonClass: 'btn btn-info btn-fill btn-alert',
            cancelButtonClass: 'btn btn-default btn-fill btn-alert',
            preConfirm: function(userId) {
                return new Promise(function(resolve, reject) {

                    $('<form>', {
                    "action": '/collector/batch/'+batchGuid+'/assign/'+userId,
                    "method": 'post'
                    }).appendTo(document.body).submit();
                })
            },
        });
    })
}