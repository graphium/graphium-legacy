function setupIgnoreRecordsPendingReviewModal() {
    $('button.ignore-records-pending-review').click(function() {
        var batchGuid = $(this).attr('data-batch');
        swal({
            title: 'Ignore Records Pending Review',
            text: 'Would you like to ignore all records in this batch that are pending reivew? If no other records are awaiting data entry or processing this will mark this batch as complete.',
            type: 'question',
            showCancelButton: true,
            confirmButtonText: 'Ignore Records',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            confirmButtonClass: 'btn btn-info btn-fill btn-alert',
            cancelButtonClass: 'btn btn-default btn-fill btn-alert',
            preConfirm: function() {
                return new Promise(function(resolve, reject) {

                    $('<form>', {
                    "action": '/collector/batch/'+batchGuid+'/ignoreRecordsPendingReview',
                    "method": 'post'
                    }).appendTo(document.body).submit();
                })
            },
        });
    })
}