
$('#triggerScheduledFlowButton').click(function() {

    $('#triggerScheduledFlowPendingMessage').css('visibility','visible');
    $('#cancelTriggerScheduledFlowButton, #triggerScheduledFlowButton').prop('disabled', true);
    $('#triggerScheduledFlowForm').prop('action','/org/settings/flow/scripts/'+flow.flowGuid+'/messageRequest');
    $('#triggerScheduledFlowForm').submit();
});

$('#showTriggerScheduledFlowModalButton').click(function() {
    $('#triggerScheduledFlowModal').modal('show');
});

$().ready(function() {

    $('.datepicker').datetimepicker({
        format: 'MM/DD/YYYY',
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

     $('#triggerDate').val(moment().format('MM/DD/YYYY'));
})