var $table = $('#recordsTable');

$().ready(function(){
    $table.bootstrapTable({
        toolbar: ".toolbar",
        //clickToSelect: true,
        //showRefresh: true,
        search: true,
        //showToggle: true,
        showColumns: true,
        pagination: true,
        searchAlign: 'right',
        pageSize: 10,
        //clickToSelect: false,
        pageList: [10,25,50,100,250],

        formatShowingRows: function(pageFrom, pageTo, totalRows){
            //do nothing here, we don't want to show the text "showing x of y from..."
        },
        icons: {
            refresh: 'fa fa-refresh',
            toggle: 'fa fa-th-list',
            columns: 'fa fa-columns',
            detailOpen: 'fa fa-plus-circle',
            detailClose: 'fa fa-minus-circle'
        }
    });

    setupAssignBatchModal();
    setupUpdateBatchTemplateModal();

    $table.on('check.bs.table uncheck.bs.table check-all.bs.table uncheck-all.bs.table', function(row, $element) {
      var itemsSelected = $table.bootstrapTable('getAllSelections').length > 0;
      $('#mergeRecordsButton').prop('disabled',!itemsSelected);
      $('#reprocessRecordsButton').prop('disabled',!itemsSelected);
    });

    //activate the tooltips after the data table is initialized
    $('[rel="tooltip"]').tooltip();

    $(window).resize(function () {
        $table.bootstrapTable('resetView');
    });

    $('#reprocessRecordsButton').on('click', function() {
      var selectedRows = $table.bootstrapTable('getAllSelections');
      if(selectedRows.length > 0) {
        var recordIndexes = _.map(selectedRows, 'recordIndex').join(',');
        showProcessRecordsModal(recordIndexes);
      }
    });

    $('#mergeRecordsButton').on('click', function() {
      var selectedRows = $table.bootstrapTable('getAllSelections');
      if(selectedRows.length > 0) {
        var recordIndexes = _.map(selectedRows, 'recordIndex').join(',');
        showMergeRecordsModal(recordIndexes);
      }
    });

    $('#reprocessBatchRecordsButton').on('click', function() {
        showReprocessAllBatchRecordsModal();
    });

    $('#reprocessIncompleteBatchRecordsButton').on('click', function() {
      showReprocessIncompleteBatchRecordsModal();
  });


    $('#regenerateBatchButton').on('click', function() {
        showRegenerateBatchModal();
    });
});

function showReprocessAllBatchRecordsModal() {
  swal({
    title: 'Reprocess All Records',
    text: 'Are you sure that you want to send all records to be reprocessed? Note that only records that are \'Pending Review\' or \'Processing Complete\' will be reprocessed.',
    type: 'question',
    showCancelButton: true,
    confirmButtonText: 'Reprocess All Records',
    showLoaderOnConfirm: true,
    allowOutsideClick: false,
    allowEscapeKey: false,
    confirmButtonClass: 'btn btn-info btn-fill btn-alert',
    cancelButtonClass: 'btn btn-default btn-fill btn-alert',
    preConfirm: function() {
        return new Promise(function(resolve, reject) {
          $('<form>', {
            "action": '/collector/batch/'+importBatchGuid+'/records/reprocess/all',
            "method": 'post'
          }).appendTo(document.body).submit();
        });
    },
  });
}

function showReprocessIncompleteBatchRecordsModal() {
  swal({
    title: 'Reprocess Incomplete Records',
    text: 'Are you sure that you want to send all incomplete records to be reprocessed? Note that only records that are \'Pending Review\', \'Pending Processing\' or \'Preparing to Process\' will be reprocessed.',
    type: 'question',
    showCancelButton: true,
    confirmButtonText: 'Reprocess Incomplete Records',
    showLoaderOnConfirm: true,
    allowOutsideClick: false,
    allowEscapeKey: false,
    confirmButtonClass: 'btn btn-info btn-fill btn-alert',
    cancelButtonClass: 'btn btn-default btn-fill btn-alert',
    preConfirm: function() {
        return new Promise(function(resolve, reject) {
          $('<form>', {
            "action": '/collector/batch/'+importBatchGuid+'/records/reprocess/incomplete',
            "method": 'post'
          }).appendTo(document.body).submit();
        });
    },
  });
}

function showProcessRecordsModal(recordIndexes) {
  swal({
    title: 'Reprocess Records',
    text: 'Are you sure that you want to send these records to be reprocessed?',
    type: 'question',
    showCancelButton: true,
    confirmButtonText: 'Reprocess',
    showLoaderOnConfirm: true,
    allowOutsideClick: false,
    allowEscapeKey: false,
    confirmButtonClass: 'btn btn-info btn-fill btn-alert',
    cancelButtonClass: 'btn btn-default btn-fill btn-alert',
    preConfirm: function() {
        return new Promise(function(resolve, reject) {
          $('<form>', {
            "html": '<input type="text" id="recordIndexes" name="recordIndexes" value="' + recordIndexes + '" />',
            "action": '/collector/batch/'+importBatchGuid+'/records/reprocess',
            "method": 'post'
          }).appendTo(document.body).submit();
        });
    },
  });
}

function showRegenerateBatchModal() {
  swal({
    title: 'Regenerate Batch Records',
    text: 'Are you sure that you want to regenerate batch records?',
    type: 'question',
    showCancelButton: true,
    confirmButtonText: 'Regenerate',
    showLoaderOnConfirm: true,
    allowOutsideClick: false,
    allowEscapeKey: false,
    confirmButtonClass: 'btn btn-info btn-fill btn-alert',
    cancelButtonClass: 'btn btn-default btn-fill btn-alert',
    preConfirm: function() {
        return new Promise(function(resolve, reject) {
          $('<form>', {
            "action": '/collector/batch/'+importBatchGuid+'/regenerate',
            "method": 'post'
          }).appendTo(document.body).submit();
        });
    },
  });
}

function showMergeRecordsModal(recordIndexes) {
  swal({
    title: 'Merge Records',
    text: 'Are you sure that you want to merge these records? This will discard the selected records and merge the PDF pages into a single record. And data entry data will need to be entered again.',
    type: 'question',
    showCancelButton: true,
    confirmButtonText: 'Merge',
    showLoaderOnConfirm: true,
    allowOutsideClick: false,
    allowEscapeKey: false,
    confirmButtonClass: 'btn btn-info btn-fill btn-alert',
    cancelButtonClass: 'btn btn-default btn-fill btn-alert',
    preConfirm: function() {
        return new Promise(function(resolve, reject) {
          $('<form>', {
            "html": '<input type="text" id="recordIndexes" name="recordIndexes" value="' + recordIndexes + '" />',
            "action": '/collector/batch/'+importBatchGuid+'/mergeRecords',
            "method": 'post'
          }).appendTo(document.body).submit();
        });
    },
  });
}