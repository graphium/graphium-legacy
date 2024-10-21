function showErrorNotification(message) {
    $.notify({
        icon: "pe-7s-attention",
        message: message
    }, {
        type: 'danger',
        delay: 0,
        timer: 4000,
        placement: {
            from: 'top',
            align: 'center'
        }
    });
}

function showSuccessNotification(message, url) {
    var options = {
        icon: "pe-7s-check",
        message: message
    }

    if (url != null)
        options.url = url;

    $.notify(options, {
        autoHide: true,
        autoHideDelay: 5000,
        type: 'success',
        delay: 0,
        timer: 4000,
        placement: {
            from: 'top',
            align: 'center'
        }
    });
}

$(document).ready(function() {
    if (errorMessages && errorMessages.length > 0) {
        for (var i = 0; i < errorMessages.length; i++)
            showErrorNotification(errorMessages[i]);
    }

    if (successMessages && successMessages.length > 0) {
        for (var i = 0; i < successMessages.length; i++)
            showSuccessNotification(successMessages[i]);
    }
});