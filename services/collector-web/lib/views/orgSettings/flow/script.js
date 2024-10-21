
function showRefreshingMessagesMessage() {
    $('#refreshMessagesButton').prop('disabled',true);
    $('#refreshingMessagesMessage').css('visibility','visible');
}

function hideRefreshingMessagesMessage() {
    $('#refreshMessagesButton').prop('disabled',false);
    $('#refreshingMessagesMessage').css('visibility','hidden');
}

function refreshMessages() {
    showRefreshingMessagesMessage();

    var url = '/org/settings/flow/scripts/'+flow.flowGuid+'/messages.json';
    $.get(url)
    .done(function(data, textStatus, jqXHR) {
        var $messagesTable = $('#messagesTableBody');
        $messagesTable.empty();
        for( var i = 0; i < data.length; i++ ) {
            var messageInstance = data[i];

            var html =  '<tr>'
            +               '<td class="text-center">'+messageInstance.messageInstanceGuid+'</td>'
            +               '<td class="text-center">'+helpers.getMessageRequestTypeDisplay(messageInstance.messageRequest)+'</td>'
            +               '<td class="text-center">'+messageInstance.facilityId+'</td>'
            +               '<td class="text-center">'+moment(messageInstance.messageInstanceCreated).format('MM-DD-YYYY HH:mm')+'</td>'
            +               '<td class="text-center">'+messageInstance.processingStatus+'</td>'
            +               '<td class="text-right td-actions">ACTION BUTTONS</td>'
            +           '<tr>';                        
            $messagesTable.append(html);
        }
        hideRefreshingMessagesMessage();
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
        hideRefreshingMessagesMessage();
    });
}

$('#refreshMessagesButton').click(function() {
    refreshMessages();
})

$().ready(function(){
    var editor = ace.edit('scriptEditor');
    editor.setAutoScrollEditorIntoView(true);
    editor.setOption("maxLines", Infinity);
    editor.setOption("minLines", 5);
    editor.setHighlightActiveLine(false);
    editor.setTheme('ace/theme/clouds');
    editor.getSession().setMode('ace/mode/javascript');
    editor.setReadOnly(true); //flow.flowType != 'script');
    editor.setValue(flow.flowContent, -1);

    refreshMessages();
});