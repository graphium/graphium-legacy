import axios from 'axios';

export function sendToPqrsChannel(message) {
    var options = {
        method: 'POST',
        url: 'https://hooks.slack.com/services/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',
        data: {
            text: message,
            username: "Graphium Dashboard",
            icon_emoji: ":graphium:"
        },
        json: true
    };
    
    return axios(options)
        .catch(function(error) {
            // Swallowing slack errors.
            console.log('Unable to send slack message: '+error.message);
        });
}