
var currentData;

$(function() {
    loadAnalyticsData();
});

function loadAnalyticsData() {
    updateCharts({});

    $.get('/dashboards/usage.json')
    .done(function(data, textStatus, jqXHR) {
        updateCharts(data);
        //hideRefreshNotesLoadingMessage();
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
        //hideRefreshNotesLoadingMessage();
    });
}

function updateCharts(data) {
    currentData = data;
    updateUsageTable(data, true);
}

function updateUsageTable(data, reset) {
    
    var $usageTableBody = $('#usageTableBody');
    $usageTableBody.empty();

    if(!data || !data.importBatchCounts)
        return;

    var range = moment.range(moment().subtract(18,'months'), moment());
    var months = range.toArray('months')

    var importRecordTotals = {};

    for( var i = 0; i < facilities.length; i++ ) {
        var facility = facilities[i];
        var facilityImportRecordCountResults = _.find(data.importBatchCounts, {facilityId: facility.facilityId}) || {};
        var facilityCaseCountResults =  _.find(data.caseCounts, {facilityId: facility.facilityId}) || {};
        var facilityCaseCountWithDosResults = _.find(data.caseCountsWithDos, {facilityId: facility.facilityId}) || {};
        var dataEntryCounts = _.find(data.dataEntryByFacilityAndMonth, {key: facility.facilityId}) || {};
        // Imported Records Metric
        var importedRecordsTotal = 0;
        var html =  '<tr>'
        +               '<td rowspan="4" style="border-color:#AAAAAA"><strong>'+facility.facilityName+'</strong></td>'
        +               '<td class="text-right" style="border-color:#AAAAAA"><strong><em>Imported Records</em></strong></td>';
        _.forEach(months, function(month) { 
            var importRecordCountResult = _.find(facilityImportRecordCountResults.counts, {month: month.format('YYYY-MM')});
            var startDate = month.startOf('month').format('YYYY-MM-DD');
            var endDate = month.endOf('month').format('YYYY-MM-DD');
            var metric = importRecordCountResult != null ? '<a class="importRecordsMonthDetail" href="#" data-start-date="'+startDate+'" data-end-date="'+endDate+'" data-fac="'+facility.facilityId+'">' + importRecordCountResult.count + '</a>' : '-';
            html +=     '<td class="text-center" style="border-color:#AAAAAA">' + metric + '</td>';
            importedRecordsTotal += importRecordCountResult != null ? importRecordCountResult.count : 0;

            if(!importRecordTotals.hasOwnProperty(month.format('YYYY-MM')))
                importRecordTotals[month.format('YYYY-MM')] = 0;
            importRecordTotals[month.format('YYYY-MM')] += importRecordCountResult != null ? importRecordCountResult.count : 0;;
        })
        html +=         '<td class="text-center" style="border-color:#AAAAAA">' + importedRecordsTotal + '</a></td>'
        +           '</tr>';

        // Cases Created Metric
        var casesCreatedTotal = 0;
        html +=     '<tr>'
        +               '<td class="text-right"><strong><em>Cases Created</em></strong></td>';
        _.forEach(months, function(month) { 
            var caseCountResult = _.find(facilityCaseCountResults.counts, {month: month.format('YYYY-MM')});
            var caseCountMetric = caseCountResult != null ? caseCountResult.count : '-';
            html +=     '<td class="text-center">' + caseCountMetric + '</td>';
            casesCreatedTotal += caseCountResult != null ? caseCountResult.count : 0;
        })
        html +=         '<td class="text-center">' + casesCreatedTotal +  '</td>'
        +           '</tr>';

        // Cases Performed Metric
        var casesPerformedTotal = 0;
        html +=     '<tr>'
        +               '<td class="text-right"><strong><em>Cases Performed</em></strong></td>';
        _.forEach(months, function(month) { 
            var caseCountWithDosResult = _.find(facilityCaseCountWithDosResults.counts, {month: month.format('YYYY-MM')});
            var caseCountWithDosMetric = caseCountWithDosResult != null ? caseCountWithDosResult.count : '-';
            html +=     '<td class="text-center">' + caseCountWithDosMetric + '</td>';
            casesPerformedTotal += caseCountWithDosResult != null ? caseCountWithDosResult.count : 0;
        })
        html +=         '<td class="text-center">' + casesPerformedTotal + '</td>'
        +           '</tr>';

        
        // Data Entry Metric
        html +=     '<tr>'
        +               '<td class="text-right"><strong><em>Data Entry Forms Transcribed</em></strong></td>';
        let dataEntryCountTotal = 0;
        _.forEach(months, function(month) { 
            let monthCount = ' - ';
            if(dataEntryCounts.byMonth && dataEntryCounts.byMonth.buckets) {
                let bucket = _.find(dataEntryCounts.byMonth.buckets, {key_as_string: month.format('YYYY-MM') + '-01' });
                if(bucket) {
                    monthCount = bucket.doc_count;
                    dataEntryCountTotal += bucket.doc_count;
                }
            }
            html +=     '<td class="text-center">' + monthCount + '</td>';
        })
        html +=         '<td class="text-center">' + dataEntryCountTotal + '</td>'
        +           '</tr>';

        $usageTableBody.append(html);
        $('#usageTable').stickyTableHeaders({scrollableArea: $('.main-panel')});
    }

    // Generated Data for Unassigned Import Batchs (Not By Facility)
    var html =  '<tr>'
    +               '<td style="border-color:#AAAAAA"><em>Unassigned</em></td>'
    +               '<td class="text-right" style="border-color:#AAAAAA">Imported Records</td>';
    _.forEach(months, function(month) { 
        var unassignedImportRecordResult = _.find(data.unassignedImportRecordCounts, {month: month.format('YYYY-MM')});
        var metric = unassignedImportRecordResult != null ? unassignedImportRecordResult.count : '-';
        html +=     '<td class="text-center" style="border-color:#AAAAAA">' + metric + '</td>';

        if(!importRecordTotals.hasOwnProperty(month.format('YYYY-MM')))
            importRecordTotals[month.format('YYYY-MM')] = 0;
        importRecordTotals[month.format('YYYY-MM')] += unassignedImportRecordResult != null ? unassignedImportRecordResult.count : 0;;
    })
    html +=         '<td class="text-center" style="border-color:#AAAAAA">-</td>'
    +           '</tr>';
    $usageTableBody.append(html);

    // TOTALS
    var html =  '<tr>'
    +               '<td style="border-color:#AAAAAA"><strong><em>Totals</em></strong></td>'
    +               '<td class="text-right" style="border-color:#AAAAAA">Imported Records</td>';
    _.forEach(months, function(month) { 
        html +=     '<td class="text-center" style="border-color:#AAAAAA"><strong>' + importRecordTotals[month.format('YYYY-MM')] + '</strong></td>';
    })
    html +=         '<td class="text-center" style="border-color:#AAAAAA">-</td>'
    +           '</tr>';
    $usageTableBody.append(html);

    //initializeImportRecordUsageModal();
}