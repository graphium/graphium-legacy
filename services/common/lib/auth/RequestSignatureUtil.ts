// This class helps us deal with the v1 authentication signature for legacy services
//declare function escape(s: string): string;
import * as crypto from 'crypto';
import { EnvironmentConfig } from '../config/EnvironmentConfig';

export class RequestSignatureUtil {

    public static validateRequest(queryParameters:{[parameterName:string]:string}, method:string, url:string, password:string, tl?:any):boolean {
        // First lets create a new query object that we will modify.
        let modifiedQueryParameters:{[parameterName:string]:string} = {};
        for (var param in queryParameters) {
            if (queryParameters[param] !== null) {
                modifiedQueryParameters[param] = queryParameters[param];
            }
        }

        let requestSignature = modifiedQueryParameters["sig"];
        delete modifiedQueryParameters["sig"];

        // Let's get the host and port from the url.
        var urlParseExpression:RegExp = /^((http[s]?|ftp):\/)?\/?([^:\/\s]+)(:([^\/]*))?((\/\w+)*\/)([\w\-\.]+[^#?\s]+)(\?([^#]*))?(#(.*))?$/g;
        var urlPartsArray:RegExpExecArray = urlParseExpression.exec(url);
        var host:string = urlPartsArray[3]; // + (urlPartsArray[4] ? urlPartsArray[4] : "");
        var path:string = urlPartsArray[6] + urlPartsArray[8];

        // We do this because the base path mapping in API gateway (which we use for all evnironments other
        // than local) does not expose the base path mapping through the lambda context object. So we have to 
        // append this so that the client (mobile) sends the same path we are generating here.
        if(EnvironmentConfig.environment != "local") {
            path = "/api" + path;
        }

        tl.logInfo('GEN_QUERY','Generating query data for signing.',{
            url, host, path
        });

        // Create the query data that needs to be signed.
        var queryData:string =
            method +
            "\n" +
            host +
            "\n" +
            path +
            "\n" +
            RequestSignatureUtil.sortAndPrepareUrlVariables(modifiedQueryParameters);

        if(tl) tl.logInfo('GEN_SIG','Generating signature for match.',{signatureData:queryData})

        // Sign the request using hmac sha256.
        let generatedSignature:string = crypto
            .createHmac("sha256", password)
            .update(queryData)
            .digest("base64");

        // TODO: Also make sure timestamp is within reasonable range of
        // current timestamp.
        return generatedSignature === requestSignature;
    }

    private static sortAndPrepareUrlVariables(queryParameters:{[parameterName:string]:string}): string {
        var keys = Object.keys(queryParameters);
        keys.sort();

        var s = "";
        for (var i = 0; i < keys.length; i++) {
            s += keys[i] + "=" + escape(queryParameters[keys[i]]);
            if (i < keys.length - 1) s += "&";
        }
        return s;
    }
}
