var http = require("http");
var request = require("requestretry");
var crypto = require("crypto");
var bluebird = require("bluebird");
var _ = require("lodash");

import { GraphiumServiceConfig } from "./GraphiumServiceConfig";

declare function escape(s: string): string;

export class ServiceRequest {
    static baseServiceUrl: string = "https://service-dev.graphiumemr.com/emr/rest/";

    readonly orgName: string;
    readonly username: string;
    readonly password: string;
    readonly config: GraphiumServiceConfig;

    constructor(
        orgNameOrOptions: string | GraphiumServiceConfig,
        username: string,
        password: string
    ) {
        if (_.isString(orgNameOrOptions)) {
            this.orgName = <string>orgNameOrOptions;
            this.username = username;
            this.password = password;
        } else {
            this.config = <GraphiumServiceConfig>orgNameOrOptions;
            this.orgName = this.config.orgInternalName;
            this.username = this.config.username;
            this.password = this.config.password;
        }
    }

    private addSignature(requestOptions) {
        // First remove an queryParams that are undefined.
        for (var key in requestOptions.qs) {
            if (requestOptions.qs[key] === null) delete requestOptions.qs[key];
        }

        requestOptions.qs.un = this.username;
        if (this.orgName != null && this.orgName != "")
            requestOptions.qs.org = this.orgName;
        requestOptions.qs.apiVer = "1.0";
        requestOptions.qs.encTyp = "HmacSHA256";
        requestOptions.qs.sigVer = "1";
        requestOptions.qs.ts = this.createTimestampString();

        // Let's get the host and port from the url.
        var url = requestOptions.uri;
        var urlParseExpression = /^((http[s]?|ftp):\/)?\/?([^:\/\s]+)(:([^\/]*))?((\/\w+)*\/)([\w\-\.]+[^#?\s]+)(\?([^#]*))?(#(.*))?$/g;
        var urlPartsArray = urlParseExpression.exec(url);
        var host =
            urlPartsArray[3] + (urlPartsArray[4] ? urlPartsArray[4] : "");
        var path = urlPartsArray[6] + urlPartsArray[8];

        // Create the query data that needs to be signed.
        var queryData =
            requestOptions.method +
            "\n" +
            host +
            "\n" +
            path +
            "\n" +
            this.sortAndPrepareUrlVariables(requestOptions.qs);

        // Sign the request using hmac sha256.
        requestOptions.qs.sig = crypto
            .createHmac("sha256", this.password)
            .update(queryData)
            .digest("base64");
    }

    private sortAndPrepareUrlVariables(urlVariables): string {
        var keys = new Array();
        for (var key in urlVariables) keys.push(key);
        keys.sort();

        var s = "";
        for (var i = 0; i < keys.length; i++) {
            s += keys[i] + "=" + escape(urlVariables[keys[i]]);
            if (i < keys.length - 1) s += "&";
        }
        return s;
    }

    private createTimestampString(): string {
        //timestamp should look like 2012-01-11T20%3A20%3A02.952Z
        var now = new Date();
        var timestamp = JSON.stringify(now);
        return timestamp.substr(1, timestamp.length - 2);

        //timestamp+=now.fullYearUTC+"-"+this.padZeros(now.monthUTC + 1)+"-"+this.padZeros(now.dateUTC)+"T";
        //timestamp+=this.padZeros(now.hoursUTC)+":"+this.padZeros(now.minutesUTC)+":"+this.padZeros(now.secondsUTC)+"."+now.millisecondsUTC+"Z";
        //console.log( "Generating timestamp:" + timestamp);
        //return timestamp;
    }

    private padZeros(number, minDigits) {
        if (!number) return "";
        if (!minDigits) minDigits = 2;

        var outStr = number.toString();
        while (outStr.length < minDigits) outStr = "0" + outStr;
        return outStr;
    }

    public async callService(requestOptions) {
        var _this = this;
        return new Promise(function(resolve, reject) {
            var baseUrl =
                _this.config && _this.config.hasOwnProperty("baseServiceUrl")
                    ? _this.config.baseServiceUrl
                    : ServiceRequest.baseServiceUrl;
            requestOptions.uri = baseUrl + requestOptions.uri;

            _this.addSignature(requestOptions);

            requestOptions.withCredentials = false;
            requestOptions.maxAttempts = 3;
            requestOptions.retryDelay = 2500;
            requestOptions.retryStrategy =
                request.RetryStrategies.HTTPOrNetworkError;

            request(requestOptions, function(error, response, body) {
                _this.executeServiceCallback(
                    resolve,
                    reject,
                    error,
                    response,
                    body
                );
            });
        });
    }

    private executeServiceCallback(
        promiseResolve,
        promiseReject,
        error,
        response,
        body
    ) {
        var result;
        try {
            result = JSON.parse(response.body);
        } catch (err) {
            if (!error && response != null) result = response.body;
        }

        var resultIsValid =
            result &&
            result.hasOwnProperty("hasError") &&
            result.hasOwnProperty("result");

        if (resultIsValid) {
            if (this.config.rejectServiceError && result.hasError) {
                var promiseError = new Error(
                    "Service call returned with error."
                );
                promiseError["result"] = result;
                promiseReject(promiseError);
            } else {
                promiseResolve(result);
            }
        } else if (!error) {
            promiseReject(
                new Error(
                    "Request responded but result is not in proper format or is empty: " +
                        response.body
                )
            );
        } else {
            promiseReject(error);
        }
    }
}
