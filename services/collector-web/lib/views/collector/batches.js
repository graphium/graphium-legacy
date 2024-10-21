

function submitCreateBatchForm() {
    $('#createBatchLoadingMessage').css('visibility','visible');
    $('#createBatchButton, #cancelNewBatchButton').prop('disabled', true).css('visibility','hidden');

    var receivedAtTimestamp = $('#receivedAt').data('DateTimePicker').date().valueOf();
    //$('#createBatchForm').append('<input type="hidden" name="receivedAtTimestamp" value="'+receivedAtTimestamp+'" />');
    //$('#createBatchForm').submit();
    var file = $('#importBatchFile').prop('files')[0];
    var fileType = file.type;
    var fileId;
    axios.get('/collector/signed-s3.json?fileType=' + encodeURIComponent(fileType))
        .then(function(response) {
            fileId = response.data.id;
            return axios.put(response.data.signedRequest, file, {responseType: 'text'});
        })
        .then(function(response) {
            return axios.post('/collector/batches', {
                templateGuid: $('#templateGuid').val(),
                batchName: $('#batchName').val(),
                receivedAtTimestamp: receivedAtTimestamp,
                facilityId: $('#facilityId').val(),
                fileId: fileId,
                fileType: fileType
            });
        })
        .then(function(response) {
            window.location = response.data.batchUrl;
        })
        .catch(function(error) {
            console.log(error);
        });
}

$(document).on('change', ':file', function() {
    var input = $(this),
        numFiles = input.get(0).files ? input.get(0).files.length : 1,
        label = input.val().replace(/\\/g, '/').replace(/.*\//, '');
    input.trigger('fileselect', [numFiles, label]);
});

$(document).ready(function() {
    $(':file').on('fileselect', function(event, numFiles, label) {
        $('#fileName').val(label);

        var batchNameInput = $('input#batchName');
        if(!batchNameInput.val()) {
            batchNameInput.val(label.substr(0, label.lastIndexOf('.')) || label);
        }
    });

    $('.bootstrap-table').bootstrapTable({
        toolbar: ".toolbar",
        //clickToSelect: true,
        //showRefresh: true,
        search: true,
        //showToggle: true,
        showColumns: true,
        pagination: true,
        searchAlign: 'right',
        pageSize: 10,
        //clickToSelect: false,
        pageList: [10,25,50,100,250],

        formatShowingRows: function(pageFrom, pageTo, totalRows){
            //do nothing here, we don't want to show the text "showing x of y from..."
            return 'Showing records ' + pageFrom + ' to ' + pageTo + ' (' + totalRows + ' Total Records)';
        },
        icons: {
            refresh: 'fa fa-refresh',
            toggle: 'fa fa-th-list',
            columns: 'fa fa-columns',
            detailOpen: 'fa fa-plus-circle',
            detailClose: 'fa fa-minus-circle'
        },
        onPageChange: function() {
            setupResumeHandlers();
            setupAssignBatchModal();
            setupGrabBatchModal();
            setupIgnoreRecordsPendingReviewModal();
        },
        onColumnSwitch: function() {
            setupResumeHandlers();
            setupAssignBatchModal();
            setupGrabBatchModal();
            setupIgnoreRecordsPendingReviewModal();
        }
    }).show();
    
    setupResumeHandlers();
    setupAssignBatchModal();
    setupGrabBatchModal();
    setupIgnoreRecordsPendingReviewModal();
});

function setupResumeHandlers() {
    $('button.resume-data-entry').click(function() {
        console.log('HIT');
        var batchGuid = $(this).attr('data-batch');
        location.href = '/collector/batch/'+batchGuid+'/openNextRecordForDataEntry';
    });
}

// 08/25/1980 4:30 AM
$('#showNewBatchButton').click(function() {
    $('#receivedAt').data('DateTimePicker').date(moment());
    $('#create-batch-modal').modal('show');
});

$('.datetimepicker').datetimepicker({
    icons: {
        time: "fa fa-clock-o",
        date: "fa fa-calendar",
        up: "fa fa-chevron-up",
        down: "fa fa-chevron-down",
        previous: 'fa fa-chevron-left',
        next: 'fa fa-chevron-right',
        today: 'fa fa-screenshot',
        clear: 'fa fa-trash',
        close: 'fa fa-remove'
    }
});