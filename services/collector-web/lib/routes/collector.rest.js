var express = require('express');
var auth = require('../util/authMiddleware');
var router = express.Router();
var ImportBatchDAO = require('@common/lib/dao/ImportBatchDAO.js');
var multer = require('multer');
var autoReap = require('multer-autoreap');
var upload = multer()
var templateHelpers = require('../util/templateHelpers');
var roleGroups = require('../util/roleGroups');
var _ = require('lodash');
var OrgUserDAO = require('@common/lib/dao/org/OrgUserDAO.js');
var FacilityDAO = require('@common/lib/dao/org/FacilityDAO.js');
var ProviderDAO = require('@common/lib/dao/org/ProviderDAO.js');
var ImportEventDAO = require('@common/lib/dao/ImportEventDAO.js');
var ExternalWebFormDAO = require('@common/lib/dao/ExternalWebFormDAO');
var FlowDAO = require('@common/lib/dao/FlowDAO.js');
var Promise = require('bluebird');

router.get('/externalWebForm/:externalWebFormGuid/records.json',
           auth.ensureAuthenticatedOrg({permissions:{some:['IMPORT_BATCH:READ_ASSIGNED','IMPORT_BATCH:READ_ALL']}}),
function(req, res) {
    var externalWebFormGuid = req.params.externalWebFormGuid;
    
    return ExternalWebFormDAO.getForm(externalWebFormGuid)
    .then(function(externalWebForm) {
        if(externalWebForm.orgInternalName != req.session.org) {
            res.status(401).send('User does not have access to this Exteranl Web Form.');
        }
        else {
            return ExternalWebFormDAO.getExternalWebFormRecords(externalWebFormGuid);
        }
    })
    .then(function(records) {
        res.send(records);
    })
    .catch(function(error) {
        console.error(error.message);
        console.error(error.stack);
        res.status(400).send(error.message);
    });
});

// Used by the form to post the data for saving in a ajax request.
router.post('/batch/record/:importBatchGuid/:recordIndex(\\d+)/imageRotation.json', 
            auth.ensureAuthenticatedOrg({permissions:{some:['BATCH_RECORD:EDIT_ALL','BATCH_RECORD:EDIT_ASSIGNED']}}), 
function(req, res) {
    console.log(req.body.degrees);
    var importBatchGuid = req.params.importBatchGuid;
    var recordIndex = parseInt(req.params.recordIndex);
    var degrees = parseInt(req.body.degrees);
    var importBatchRecord;
    var importBatch;
    
    return ImportBatchDAO.getBatchByGuid(importBatchGuid)
    .then(function(importBatchResult) {
        importBatch = importBatchResult;

        if(_.includes(req.permissions, 'IMPORT_BATCH:EDIT_ASSIGNED') && req.orgUser.userName != importBatch.assignedTo) {
          return Promise.reject(new Error('Unable to update record, you are not assigned to this import batch.'));
        }

        return ImportBatchDAO.updateRecordImageRotation(importBatchGuid, recordIndex, degrees);
    })
    .then(function() {
      res.status(200).send();
    })
    .catch(function(error) {
        console.error(error.message);
        console.error(error.stack);
        res.status(400).send(error.message);
    });
});

// Used by the form to post the data for saving in a ajax request.
router.post('/batch/record/:importBatchGuid/:recordIndex(\\d+)/notes.json', 
            auth.ensureAuthenticatedOrg({permissions:{some:['BATCH_RECORD:EDIT_ALL','BATCH_RECORD:EDIT_ASSIGNED']}}), 
function(req, res) {

    var importBatchGuid = req.params.importBatchGuid;
    var recordIndex = parseInt(req.params.recordIndex);
    var noteText = req.body.noteText;
    var importBatchRecord;
    var importBatch;
    var noteGuid;

    if(!_.isString(noteText)) {
        console.log('Note text is not in correct format.');
        res.status(400).send('Note text is not in correct format.');
        return;
    }

    return Promise.all([
      ImportBatchDAO.getBatchByGuid(importBatchGuid),
      ImportBatchDAO.getBatchRecord(importBatchGuid, recordIndex)
    ])
    .then(function([importBatchResult, importBatchRecordResult]) {
        importBatch = importBatchResult;
        importBatchRecord = importBatchRecordResult;

        if(_.includes(req.permissions, 'IMPORT_BATCH:EDIT_ASSIGNED') && req.orgUser.userName != importBatch.assignedTo) {
          return Promise.reject(new Error('Unable to add note, you are not assigned to this import batch.'));
        }

        return ImportBatchDAO.addNoteToRecord(importBatchGuid, recordIndex, req.orgUser.userName, noteText);
    })
    .then(function(noteGuid) {

        return ImportEventDAO.createEvent({
            eventType: 'record_note_added',
            importBatchGuid: importBatchRecord.importBatchGuid,
            importBatchRecordGuid: importBatchRecord.importBatchRecordGuid,
            importBatchGuidRecordIndex: importBatchGuid + ':' + recordIndex,
            userName: req.orgUser.userName,
            indexUserId: req.indexUserId,
            orgUserId: req.orgUserId,
            orgInternalName: req.session.org,
            eventData: {
                noteGuid: noteGuid,
            }
        });
    })
    .then(function() {
        res.send(noteGuid);
    })
    .catch(function(error) {
        console.error(error.message);
        console.error(error.stack);
        res.status(400).send(error.message);
    });
});

router.get('/event/:importEventGuid',
           auth.ensureAuthenticatedOrg({permissions:{some:['BATCH_RECORD:EDIT_ALL','BATCH_RECORD:EDIT_ASSIGNED']}}),
function(req, res) {
    var importEventGuid = req.params.importEventGuid;
    console.log('Retrieving event: ' + importEventGuid);
    return ImportEventDAO.getEvent(importEventGuid)
    .then(function(event) {
        console.log('Retrieved event: ');
        console.log(event);

        if(event.orgInternalName && event.orgInternalName == req.session.org) { 
            return ImportEventDAO.getEventFlowScriptResult(importEventGuid);
        }
        else {
            return Promise.reject(new Error('Unable to find event.'));
        }
    })
    .then(function(processingResult) {
        res.send(processingResult);
    })
    .catch(function(error) {
        console.error(error.message);
        console.error(error.stack);
        res.status(400).send(error.message);
    })

});

// Used by the form to post the data for saving in a ajax request.
router.get('/batch/record/:importBatchGuid/:recordIndex(\\d+)/notes.json', 
            auth.ensureAuthenticatedOrg({permissions:{some:['BATCH_RECORD:EDIT_ALL','BATCH_RECORD:EDIT_ASSIGNED']}}), 
function(req, res) {
    var importBatchGuid = req.params.importBatchGuid;
    var recordIndex = parseInt(req.params.recordIndex);
    var importBatchRecord;
    var importBatch;
    
    return ImportBatchDAO.getBatchByGuid(importBatchGuid)
    .then(function(importBatchResult) {
        importBatch = importBatchResult;

        if(_.includes(req.permissions, 'IMPORT_BATCH:EDIT_ASSIGNED') && req.orgUser.userName != importBatch.assignedTo) {
          return Promise.reject(new Error('Unable to add note, you are not assigned to this import batch.'));
        }

        return ImportBatchDAO.getRecordNotes(importBatchGuid, recordIndex);
    })
    .then(function(notes) {
      res.send(notes);
    })
    .catch(function(error) {
        console.error(error.message);
        console.error(error.stack);
        res.status(400).send(error.message);
    });
});


// Request a new batch to be assigned to the current user.
router.post('/batch/grab.json', 
            auth.ensureAuthenticatedOrg({permissions:{some:['BATCH_RECORD:EDIT_ALL','BATCH_RECORD:EDIT_ASSIGNED']}}), 
function(req, res) {
    
    return ImportBatchDAO.grabBatch(req.session.org, req.orgUser.userName)
    .then(function(grabbedImportBatchGuid) {
        res.status(200).send({importBatchGuid:grabbedImportBatchGuid});
    })
    .catch(function(error) {
        console.error(error.message);
        console.error(error.stack);
        res.status(400).send(error.message);
    });
});

module.exports = router;