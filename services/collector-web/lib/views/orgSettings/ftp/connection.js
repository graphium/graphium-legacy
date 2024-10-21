$().ready(function() {
  setupFtpScanModal();
})

function showGenerateBatchForFileModal(ftpSiteGuid, ftpFileGuid) {
    swal({
        title: 'Generate Batch',
        text: 'This will generate a batch for this file. Are you sure you want to do this?',
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Generate Batch',
        showLoaderOnConfirm: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonClass: 'btn btn-warning btn-fill btn-alert',
        cancelButtonClass: 'btn btn-default btn-fill btn-alert',
        preConfirm: function() {
            return new Promise(function(resolve, reject) {
              var url = '/org/settings/ftp/connections/' + ftpSiteGuid + '/file/' + ftpFileGuid + '/batch/generate';
              $('<form>', {
                //"html": '<input type="text" id="recordIndexes" name="recordIndexes" value="' + recordIndexes + '" />',
                "action": url,
                "method": 'post'
              }).appendTo(document.body).submit();
            })
        },
    });
}

$('.generateBatchButton').click(function() {
  var ftpSiteGuid = ftpSite.ftpSiteGuid;
  var ftpFileGuid = $(this).attr('data-file');
  showGenerateBatchForFileModal(ftpSiteGuid, ftpFileGuid);
})