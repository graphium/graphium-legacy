$('a.select-org').click(function() {
	var organizationNameInternal = $(this).attr('value');
	$('<form>', {
			"html": '<input type="text" id="organizationNameInternal" name="organizationNameInternal" value="' + organizationNameInternal + '" />',
			"action": '/organization/select',
			"method": 'post'
	}).appendTo(document.body).submit();
});