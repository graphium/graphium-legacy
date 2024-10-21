
var currentStartDate = moment().subtract(30,'days');
var currentEndDate = moment();
var currentData;

$(function() {
    loadAnalyticsData();
});

function loadAnalyticsData() {
    updateCharts({});

    $.get('/dashboards/importBatch.json?startDate=' + currentStartDate.format('YYYY-MM-DD') + '&endDate=' + currentEndDate.format('YYYY-MM-DD'))
    .done(function(data, textStatus, jqXHR) {
        updateCharts(data);
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
    });
}

function updateCharts(data) {
    currentData = data;
    updateNewRecordsByDayChart(data);
    updateBatchStatusChart(data);
    updateRecordStatusChart(data);
    updateRecordStatusByFacilityTable(data);
}

function updateRecordStatusByFacilityTable(data, reset) {
    var statusData = data.recordStatusCountsByFacility || [];
    var labels = _.map(statusData, function(facilityResults) { return helpers.getFacilityName(facilities, facilityResults.facilityId)});
    var legendNames = ['Pending Data Entry','Pending Processing','Processing','Processing Complete','Pending Review','Discarded','Ignored'];
    new Chartist.Bar('#recordStatusByFacilityTable', {
        labels: labels,
        series: [
            {
                className: 'ct-series-danger',
                data: _.map(statusData, function(facilityResult) { return facilityResult.byStatus["ignored"] || 0; })
            },
            {
                className: 'ct-series-danger',
                data: _.map(statusData, function(facilityResult) { return facilityResult.byStatus["discarded"] || 0; })
            },
            {
                className: 'ct-series-warning',
                data: _.map(statusData, function(facilityResult) { return facilityResult.byStatus["pending_review"] || 0; })
            },
            {
                className: 'ct-series-success',
                data: _.map(statusData, function(facilityResult) { return facilityResult.byStatus["processing_complete"] || 0; })
            },
            {
                className: 'ct-series-active',
                data: _.map(statusData, function(facilityResult) { return facilityResult.byStatus["processing"] || 0; })
            },
            {
                className: 'ct-series-active',
                data: _.map(statusData, function(facilityResult) { return facilityResult.byStatus["pending_processing"] || 0; })
            },
            {
                className: 'ct-series-inactive',
                data: _.map(statusData, function(facilityResult) { return facilityResult.byStatus["pending_data_entry"] || 0; }),
            }
        ]
    }, 
    {
        stackBars: true,
        height: (labels.length * 45) + 50,
        reverseData: true,
        horizontalBars: true,
        axisY: {
            offset: 350
        },
        axisX: {
            scaleMinSpace: 30,
            onlyInteger: true
        }
    }).on('draw', function(data) {
        if(data.type === 'bar') {
            data.element.attr({
                style: 'stroke-width: 20px'
            });
        }
    });


}

var batchStatusColors = {
    'pending_generation': 'ct-series-inactive',
    'generating': 'ct-series-inactive',
    'generation_error': 'ct-series-danger',
    'triage': 'ct-series-inactive',
    'processing': 'ct-series-active',
    'pending_processing': 'ct-series-active',
    'pending_review': 'ct-series-warning',
    'complete': 'ct-series-success',
    'discarded': 'ct-series-danger'
}

var recordStatusColors = {
    'pending_data_entry': 'ct-series-inactive',
    'pending_processing': 'ct-series-active',
    'processing': 'ct-series-active',
    'pending_review': 'ct-series-warning',
    'processing_complete': 'ct-series-success',
    'discarded': 'ct-series-danger',
    'ignored': 'ct-series-danger'
}

function updateBatchStatusChart(data) {
    var batchStatusData = data.batchStatusCounts || [];

    var data = _.map(batchStatusData, function(seriesData) {
        return {
            className: batchStatusColors[seriesData.key],
            value: seriesData.doc_count
        }
    });
    new Chartist.Pie('#allBatchesByStatusChart', {series: data}, {
        height: 250,
        labelDirection: 'explode',
        labelOffset: 60,
        chartPadding: 30,
        labelInterpolationFnc: function(value) {
            return value;
        }
    });
}

function updateRecordStatusChart(data) {
    var recordStatusData = data.recordStatusCounts || [];
    var data = _.map(recordStatusData, function(seriesData) {
        return {
            className: recordStatusColors[seriesData.key],
            value: seriesData.doc_count
        }
    });


    new Chartist.Pie('#allRecordsByStatusChart', { series: data }, {
        height: 250,
        labelDirection: 'explode',
        labelOffset: 60,
        chartPadding: 30,
        labelInterpolationFnc: function(value) {
            return value;
        }
    });
}


function drawDailyTimeSeriesBarChart(id, data) {
    var seriesValues = _.map(data, function(v) { return {
        x: v.timestamp, 
        y: v.count,
        meta: moment(v.timestamp).format('YYYY-MM-DD') + '\n' + v.count + ' Records'
    }});

    var xLow = 0;
    var xHigh = 1;
    if(seriesValues.length > 0) {
        xLow = seriesValues[0].x - (24*60*60*1000);
        xHigh = seriesValues[seriesValues.length-1].x + (24*60*60*1000);
    }
    var $dataEntryByDayChart = $(id);
    new Chartist.Bar(id, {
        series: [
            seriesValues
        ]
    }, {
        axisX: {
            fullWidth: true,
            low: xLow,
            high: xHigh,
            type: Chartist.FixedScaleAxis,
            divisor: 10,
            labelInterpolationFnc: function(value) {
                if(value)
                    return moment(value).format('YYYY-MM-DD');
                return null;
            }
        },
        plugins: [
            Chartist.plugins.tooltip({
                anchorToPoint: false,
                tooltipFnc: function(a,b,c) {
                    return a;
                },
                transformTooltipTextFnc: function(data) {
                    return JSON.stringify(data);
                }
            })
        ]
    })
    .on('draw', function(data) {
        if(data.type === 'bar') {
            var barWidth = $dataEntryByDayChart.width() / ((seriesValues.length+2)*1.3);
            data.element.attr({
                style: 'stroke-width: ' + barWidth + 'px'
            });
        }
    });
}

function updateNewRecordsByDayChart(data) { 
    drawDailyTimeSeriesBarChart('#newRecordsByDayChart', data.dailyRecordCreatedCounts || [])

}