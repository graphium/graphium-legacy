function setupFtpScanModal() {
    $('a.scanFtpFolder').click(function() {
        var ftpConnectionGuid = $(this).attr('data-connection');

        swal({
            title: 'Rescan FTP Folder',
            text: 'Would you rescan the folder to look for new files?',
            type: 'question',
            showCancelButton: true,
            confirmButtonText: 'Rescan',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            confirmButtonClass: 'btn btn-info btn-fill btn-alert',
            cancelButtonClass: 'btn btn-default btn-fill btn-alert',
            preConfirm: function() {
                return new Promise(function(resolve, reject) {
                    var url = '/org/settings/ftp/connections/' + ftpConnectionGuid + '/rescan.json';
                    
                    // Was trying to just return this promise for the preConfirm but for
                    // some reason sweetalert didn't like that and wouldn't show the correct
                    // error message when rejecting the promise. So just wrapping a promise in a 
                    // promise, oh joy.
                    $.post(url)
                    .done(function(data, textStatus, jqXHR) {
                        window.location.href = '/org/settings/ftp/connections/' + ftpConnectionGuid; 
                        // we don't resolve here because we want the modal to stay active until the window.href changes.
                    })
                    .fail(function(jqXHR, textStatus, errorThrown) {
                        console.log(errorThrown.message);
                        reject('Unable to scan FTP folder: ' + textStatus);
                    });
                })
            },
        });
    })
}