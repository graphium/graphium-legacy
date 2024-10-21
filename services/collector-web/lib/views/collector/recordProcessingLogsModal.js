
$('.viewRecordProcessingEventLogsButton').click(function() {

  var importEventGuid = $(this).attr('data-import-event');
  console.log('Opening results:' + importEventGuid);
  loadAndDisplayResultData(importEventGuid);

  $('#recordProcessingLogsModal').modal('show');
});

function loadAndDisplayResultData(importEventGuid) {
    var url = '/collector/event/'+importEventGuid;
    $.get(url)
    .done(function(data, textStatus, jqXHR) {
      console.log(data);
        var resultsJsonDisplay = ace.edit('resultsJsonDisplay');
        //resultsJsonDisplay.setAutoScrollEditorIntoView(true);
        resultsJsonDisplay.setOption("maxLines", Infinity);
        resultsJsonDisplay.setOption("minLines", 5);
        resultsJsonDisplay.setHighlightActiveLine(false);
        resultsJsonDisplay.setTheme('ace/theme/clouds');
        resultsJsonDisplay.getSession().setMode('ace/mode/javascript');
        resultsJsonDisplay.setReadOnly(true); //flow.flowType != 'script');
        resultsJsonDisplay.setValue(JSON.stringify(data,null,4), -1);
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
        //hideRefreshingMessagesMessage();
    });
}
