var gm = require('gm');
var fs = require('fs');
var tmp = require('tmp');
var pdfjs = require('pdfjs-dist');
var Promise = require('bluebird');
var _ = require('lodash');

function generateTempDir(prefix) {
    return new Promise(function(resolve, reject) {
        tmp.dir({unsafeCleanup:true, prefix: prefix}, function(err, path, cleanupCallback) {
            if (err) {
                reject(err);
                return;
            }
            resolve({path:path, cleanup:cleanupCallback});
        });
    });
}

function getPdfPageCount(pdfBuffer) {
    return pdfjs.getDocument(new Uint8Array(pdfBuffer)).then(function (doc) {
        return Promise.resolve(doc.numPages);
    });
}

function generateImageForPage(filePrefix, pdfFilePath, tempDirPath, pageNum) {
    console.log('Generating image for page: ' + [pdfFilePath, tempDirPath, pageNum].join(', '));
    return new Promise(function(resolve, reject) {

        var pngTempFile = tempDirPath + '/'+ filePrefix + '_' + pageNum + '.png';

        try {
            gm(pdfFilePath+'['+pageNum+']')
            .density(150, 150)
            .write(pngTempFile, function(err) {
                if( err ) {
                    reject(err);
                    return;
                }

                var pngBuffer;
                try {
                    pngBuffer = fs.readFileSync(pngTempFile);
                }
                catch(error) {
                    reject(error);
                }

                resolve(pngBuffer);
            });
        }
        catch(error) {
            reject(error);
        }
        
    });
}

function writePdfFile(pdfBuffer, fileLocation) {
    return new Promise(function(resolve, reject) {
        fs.writeFile(fileLocation, pdfBuffer, function(err) {
            if(err) {
                console.log('Error writing pdf file: ' + err.message);
                console.log(err.stack);
                reject(err);
            }
            else {
                resolve();
            }
        })
    });
}

function generateImages(pdfName, pdfBuffer, startIndex, length) {
    var pdfPageCount;
    var tmpDir;
    var tmpDirPath;
    var pdfFilePath;

    if(startIndex == null || !_.isInteger(startIndex) || startIndex < 0)
        startIndex = 0;

    //console.log('Generating images for PDF pages.');
    return getPdfPageCount(pdfBuffer)
    .then(function(pageCount) {

        if(startIndex > pageCount) {
            return Promise.reject(new Error('Unable to regenerate images from PDF, start index greater than page count.'));
        }
        else {
            //console.log('Determined page count for PDF: ' + pageCount);
            pdfPageCount = pageCount;
            //console.log('Generating temp directory.');
            return generateTempDir(pdfName);
        }
    })
    .then(function(tempDirResult) {
        tmpDir = tempDirResult;
        //console.log(JSON.stringify(tmpDir,null,4));
        tempDirPath = tempDirResult.path;
        
        pdfFilePath = tempDirPath + '/' + pdfName + '.pdf';
        //console.log('Writing pdf to disk for conversion: ' + pdfFilePath);
        //console.log(pdfBuffer);
        return writePdfFile(pdfBuffer, pdfFilePath);
    })
    .then(function() {
        var currentPageNumber = startIndex;
        //console.log('Generating page images.');
        if(length == undefined || !_.isInteger(length)) {
            length = pdfPageCount - startIndex;
        }
        
        return Promise.mapSeries(new Array(length), function(nullItem) {
            return generateImageForPage(pdfName, pdfFilePath, tempDirPath, currentPageNumber++); 
        });
    })
    .then(function(imageBuffers) {
        tmpDir.cleanup();
        return Promise.resolve(imageBuffers);
    })
    .catch(function(error) {
        if(tmpDir) tmpDir.cleanup();
        return Promise.reject(error);
    })
}

module.exports = {
    getPdfPageCount: getPdfPageCount,
    generateImages: generateImages
}