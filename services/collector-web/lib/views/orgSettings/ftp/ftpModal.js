
$('#saveOrCreateModalButton').click(function() {
    $('#modalPendingMessage').css('visibility','visible');
    $('#cancelModalButton, #saveFlowButton').prop('disabled', true);

    if(window.ftpSite) {
      $('#ftpFolderForm').prop('action','/org/settings/ftp/connections/'+ftpSite.ftpSiteGuid);
    }
    else {
      $('#ftpFolderForm').prop('action','/org/settings/ftp/connections');
    }

    $('#ftpFolderForm').submit();
});

$('#showFtpModalButton').click(function() {
    if(window.ftpSite) {
      $('#ftpSiteName').val(ftpSite.ftpSiteName);
      $('#facilityId').val(ftpSite.facilityId).selectpicker('refresh');
      $('#folder').val(ftpSite.folder);
      $('#fileFilter').val(ftpSite.fileFilter);
      $('#ftpProtocol').val(ftpSite.ftpProtocol).selectpicker('refresh');
      $('#ftpUsername').val(ftpSite.ftpSiteConfig.ftpUsername);
      $('#ftpPassword').val(ftpSite.ftpSiteConfig.ftpPassword);
      $('#ftpHost').val(ftpSite.ftpSiteConfig.ftpHost);
      $('#ftpPort').val(ftpSite.ftpSiteConfig.ftpPort);
      $('#generateBatchTemplateGuid').val(ftpSite.generateBatchTemplateGuid).selectpicker('refresh');
      $('#activeCheckbox').prop('checked', ftpSite.activeIndicator);
    }

    $('#ftpFolderModal').modal('show');
});