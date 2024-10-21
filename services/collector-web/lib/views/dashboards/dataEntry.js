
var currentStartDate = moment().subtract(30,'days');
var currentEndDate = moment();
var currentData;

$(function() {
    initializeDateRangePicker();
    loadAnalyticsData();
});


function initializeDateRangePicker() {
    $('#dateRangeButton').daterangepicker({
        startDate: currentStartDate,
        endDate: currentEndDate,
        ranges: {
           'Today': [moment(), moment()],
           'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
           'This Week (Sun-Sat)': [moment().startOf('week'), moment().endOf('week')],
           'This Month': [moment().startOf('month'), moment().endOf('month')],
           'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month'), ],
           'Last 7 Days': [moment().subtract(6, 'days'), moment()],
           'Last 30 Days': [moment().subtract(29, 'days'), moment()],
           'Q1 2016': [moment('2016-01-01').startOf('quarter'),moment('2016-01-01').endOf('quarter')],
           'Q2 2016': [moment('2016-04-01').startOf('quarter'),moment('2016-04-01').endOf('quarter')],
           'Q3 2016': [moment('2016-07-01').startOf('quarter'),moment('2016-07-01').endOf('quarter')],
           'Q4 2016': [moment('2016-10-01').startOf('quarter'),moment('2016-10-01').endOf('quarter')],
           'All 2016': [moment('2016-01-01'),moment('2016-12-31')]
        }
    }, updateSelectedDateRange);
}

function updateSelectedDateRange(startDate, endDate) {
    currentStartDate = startDate;
    currentEndDate = endDate; 
    $('#dateRangeButton .date-range-label').html(currentStartDate.format('MMMM D, YYYY') + ' - ' + currentEndDate.format('MMMM D, YYYY'));
    loadAnalyticsData();
}

function loadAnalyticsData() {
    updateCharts({});

    $.get('/dashboards/dataEntry.json?startDate=' + currentStartDate.format('YYYY-MM-DD') + '&endDate=' + currentEndDate.format('YYYY-MM-DD'))
    .done(function(data, textStatus, jqXHR) {
        updateCharts(data);
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
    });
}

function updateCharts(data) {
    currentData = data;
    updateDataEntryByDayChart(data);
    updateDataEntryByClerkTable(data);
    //updateBatchStatusChart(data);
    //updateRecordStatusChart(data);
    //updateRecordStatusByFacilityTable(data);
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

function updateDataEntryByDayChart(data) { 
    drawDailyTimeSeriesBarChart('#dataEntryByDayChart', data.dataEntryCounts ? data.dataEntryCounts.byDay : [] );
}


function updateDataEntryByClerkTable(data) {
    var byClerkData = data && data.dataEntryCounts && data.dataEntryCounts.byClerk ? _.orderBy(data.dataEntryCounts.byClerk, ['doc_count'], ['desc']) : [];

    var counts = _.map(byClerkData, 'doc_count');
    var labels = _.map(byClerkData, 'key');

    new Chartist.Bar('#byClerkTable', {
        labels: labels,
        series: [counts]
    }, 
    {
        //seriesBarDistance: 10,
        height: (labels.length * 45) + 50,
        reverseData: true,
        horizontalBars: true,
        axisY: {
            offset: 100
        },
        axisX: {
            high: data.totalCount,
            low: 0,
            onlyInteger: true
        },
        labelInterpolationFnc: function(value) {
          return value;
        }
    }).on('draw', function(data) {
        if(data.type === 'bar') {
            data.element.attr({
                style: 'stroke-width: 30px'
            });
        }

        drawBarLabel(data);
    });


}

function drawBarLabel(data) {
    if (data.type === "bar") {
        var label, labelText, barLength, labelWidth, barClasses,
            barWidth = 40,
            barHorizontalCenter = (data.x1 + (data.element.width() * .5)),
            barRightEdge = (data.x1 + data.element.width()),
            barVerticalCenter =  (data.y1 + (barWidth * .12));

        // set the width of the bar
        data.element.attr({
            style: "stroke-width: " + barWidth + "px"
        });

        labelText = data.value.x;
        // add the custom label text as an attribute to the bar for use by a tooltip
        data.element.attr({ label: labelText }, "ct:series");

        // create a custom label element to insert into the bar
        label = new Chartist.Svg("text");
        label.text(labelText);
        label.attr({
            x: barHorizontalCenter,
            y: barVerticalCenter,
            "text-anchor": "middle",
            style: "font-family: 'proxima-nova-alt', Helvetica, Arial, sans-serif; font-size: 12px; fill: white"
        });


        // only *now* that its been added to the bar and written to the DOM
        // can we measure it to see if it actually fits in the bar
        barLength = data.element.width(); // get the width of the bar itself
        labelWidth = label._node.clientWidth; // now get the width of the custom label
        // if the padded width of the label is larger than the bar...
        if ((labelWidth + 20) >= barLength) {
            // don't show it
            label.attr({
              x: barRightEdge + 10,
              style: "font-family: 'proxima-nova-alt', Helvetica, Arial, sans-serif; font-size: 12px; fill: #666"
            });
        }

        // add the new custom text label to the bar
        data.group.append(label);
    }
}