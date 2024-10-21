
window.intercomSettings = {
    app_id: htmlEnv.INTERCOM_APP_ID,
    name: orgUser.userName, // Full name
    email: orgUser.emailAddress, // Email address
    created_at: (new Date(orgUser.createTime).getTime()) / 1000 // Signup date as a Unix timestamp
};