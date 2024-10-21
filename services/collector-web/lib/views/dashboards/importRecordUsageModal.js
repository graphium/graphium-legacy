
function initializeImportRecordUsageModal() {
    $('.importRecordsMonthDetail').click(function() {
        var startDate = $(this).attr('data-start-date');
        var endDate = $(this).attr('data-end-date');
        var facilityId = $(this).attr('data-fac');
        loadAndDisplayMonthlyImportRecordUsageData(facilityId, startDate, endDate);

        $('#importRecordUsageModal').modal('show');
    });
}

function loadAndDisplayMonthlyImportRecordUsageData(facilityId, startDate, endDate) {
    var $importRecordUsageTable = $('#importRecordUsageTable');
    $importRecordUsageTable.empty();

    var url = '/dashboards/usage/importRecords.json?facilityId='+facilityId+'&startDate='+startDate+'&endDate='+endDate;
    $.get(url)
    .done(function(data, textStatus, jqXHR) {
      if(data.importRecordUsage) { 

        var html = "";
        _.forEach(data.importRecordUsage.byTemplateCount, function(templateCount) {
            var template = _.find(importBatchTemplates, {templateGuid: templateCount.importBatchTemplateGuid});
            html += createRowHtml(template.templateName, templateCount.count);
        })
        html += createRowHtml('Unknown Template', data.importRecordUsage.missingTemplateCount);
        $importRecordUsageTable.append(html);
      }
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
        //hideRefreshingMessagesMessage();
    });
}

function addRowToTable(importBatchTemplateGuid, count) {
}

function createRowHtml(templateName, count) {
    var html =  '<tr>'
    +               '<td class="text-left"><strong>'+templateName+'</strong></td>';
        html +=     '<td class="text-right">' + count + '</td>';
        html += '</tr>';
    return html;
}
