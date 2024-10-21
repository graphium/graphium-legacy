
$('button.set-batch-facility').click(function() {
    var batchGuid = $(this).attr('data-batch');
    var facilityOptions = {};
    for(var i = 0; i < facilities.length; i++) {
        var fac = facilities[i];
        facilityOptions[fac.facilityId.toString()] = fac.facilityName;
    }
    swal({
        title: 'Set Batch Facility',
        text: 'Set the facility this batch belongs to.',
        input: 'select',
        inputPlaceholder: 'Select a Facility',
        inputValidator: function(value) {
            return new Promise(function(resolve,reject) {
                if(value)
                    resolve();
                else
                    reject('You must select a facility.');
            });
        },
        inputOptions: facilityOptions,
        inputClass: 'selectpicker',
        type: 'question',
        showCancelButton: true,
        confirmButtonText: 'Save',
        showLoaderOnConfirm: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonClass: 'btn btn-info btn-fill btn-alert',
        cancelButtonClass: 'btn btn-default btn-fill btn-alert',
        preConfirm: function(facilityId) {
            return new Promise(function(resolve, reject) {
                $('<form>', {
                  "action": '/collector/batch/'+batchGuid+'/facility/'+facilityId,
                  "method": 'post'
                }).appendTo(document.body).submit();
            })
        },
    });
});