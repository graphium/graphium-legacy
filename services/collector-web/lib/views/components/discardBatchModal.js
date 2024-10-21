$('button.discard-batch').click(function() {
    var batchGuid = $(this).attr('data-batch');
    showDiscardBatchModal(batchGuid);
});

function showDiscardBatchModal(batchGuid) {
    swal({
        title: 'Discard Batch',
        text: 'Are you sure you want to discard this batch? Records in this batch will no longer be editable.',
        input: 'text',
        inputPlaceholder: 'Reason Discarding Batch',
        inputValidator: function(value) {
            return new Promise(function(resolve,reject) {
                if(value)
                    resolve();
                else
                    reject('You must specify a reason you are discarding this batch.');
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
                var url = '/collector/batch/'+batchGuid+'/discard.json';
                
                // Was trying to just return this promise for the preConfirm but for
                // some reason sweetalert didn't like that and wouldn't show the correct
                // error message when rejecting the promise. So just wrapping a promise in a 
                // promise, oh joy.
                $.post(url, {reason:reason})
                .done(function(data, textStatus, jqXHR) {
                    window.location.href = '/collector/batches/';
                    // we don't resolve here because we want the modal to stay active until the window.href changes.
                })
                .fail(function(jqXHR, textStatus, errorThrown) {
                    reject('Unable to discard this batch.');
                });
            })
        },
    });
}