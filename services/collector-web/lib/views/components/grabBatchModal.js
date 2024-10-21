function setupGrabBatchModal() {
    $('button#grabBatchButton').click(function() {
        swal({
            title: 'Grab Batch',
            text: 'Would you like to request a new batch for data entry and start on that batch?',
            type: 'question',
            showCancelButton: true,
            confirmButtonText: 'Grab New Batch',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            confirmButtonClass: 'btn btn-info btn-fill btn-alert',
            cancelButtonClass: 'btn btn-default btn-fill btn-alert',
            preConfirm: function() {
                return new Promise(function(resolve, reject) {
                    var url = '/collector/batch/grab.json';
                    
                    // Was trying to just return this promise for the preConfirm but for
                    // some reason sweetalert didn't like that and wouldn't show the correct
                    // error message when rejecting the promise. So just wrapping a promise in a 
                    // promise, oh joy.
                    $.post(url)
                    .done(function(data, textStatus, jqXHR) {
                        window.location.href = '/collector/batch/'+data.importBatchGuid+'/openNextRecordForDataEntry'; 
                        // we don't resolve here because we want the modal to stay active until the window.href changes.
                    })
                    .fail(function(jqXHR, textStatus, errorThrown) {
                        console.log(errorThrown.message);
                        reject('Unable to grab a new batch: ' + textStatus);
                    });
                })
            },
        });
    })
}