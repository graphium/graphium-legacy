
var es = require('../util/esUtil');
var _ = require('lodash');
var moment = require('moment');
var orgModels = require('../model/OrgModels.js');
var FacilityDAO = require('../dao/org/FacilityDAO');
var sequelize = require('sequelize');

function formatByDayResults(results, startDate, endDate) {
    var buckets = results.aggregations.byDay.buckets;
    var dates = _.map(buckets, function(item) { return moment(item.key).format('YYYY-MM-DD'); });
    var counts = _.map(buckets, 'doc_count');

    var resultsByDay = [];
    var a = moment(startDate);
    var b = moment(endDate);
    for (var m = moment(a); m.diff(b, 'days') <= 0; m.add(1, 'days')) {
      var dateString = m.format('YYYY-MM-DD');
      resultsByDay.push({
        date: dateString,
        timestamp: m.valueOf(),
        count: dates.indexOf(dateString) ? counts[dates.indexOf(dateString)] || 0 : 0
      });
    }

    return resultsByDay;
}

function getDailyDataEntryCounts(orgInternalName, startDate, endDate) {
  var searchParameters = 
  {
    index: "import_events_v1",
    body: {
      "size": 0,
      "aggs": {
        "byDay": {
          "date_histogram": {
            "field": "eventTime",
            "interval": "1d",
            "time_zone": "America/Denver",
            "min_doc_count": 1
          }
        }
      },
      "query": {
        "bool": {
          "must": [
            {
              "query_string": {
                "query": "_type:import_event",
                "analyze_wildcard": true
              }
            },
            {
              "match": {
                "orgInternalName": {
                  "query": orgInternalName,
                  "type": "phrase"
                }
              }
            },
            {
              "match": {
                "eventType": {
                  "query": "record_status_update",
                  "type": "phrase"
                }
              }
            },
            {
              "match": {
                "eventData.statusFrom": {
                  "query": "pending_data_entry",
                  "type": "phrase"
                }
              }
            },
            {
              "range": {
                "eventTime": {
                  "gte": startDate,
                  "lte": endDate
                }
              }
            }
          ]
        }
      }
    }
  };

  var client = es.createCollectorClient();
  return client.search(searchParameters)
  .then(function(results) {
    var resultsByDay = formatByDayResults(results, startDate, endDate);
    return Promise.resolve(resultsByDay);
  })
}

function getDailyNewImportBatchRecordCounts(orgInternalName, startDate, endDate) {
  var searchParameters = {
    index: "import_events_v1",
    body: {
      "size": 0,
      "aggs": {
        "byDay": {
          "date_histogram": {
            "field": "createdAt",
            "interval": "1d",
            "time_zone": "America/Denver",
            "min_doc_count": 1
          }
        }
      },
      "query": {
        "bool": {
          "must": [
            {
              "query_string": {
                "query": "_type:import_batch_record",
                "analyze_wildcard": true
              }
            },
            {
              "match": {
                "orgInternalName": {
                  "query": orgInternalName,
                  "type": "phrase"
                }
              }
            },
            {
              "range": {
                "createdAt": {
                  "gte": startDate,
                  "lte": endDate
                }
              }
            }
          ]
        }
      }
    }
  };
  var client = es.createCollectorClient();
  return client.search(searchParameters)
  .then(function(results) {
    var resultsByDay = formatByDayResults(results, startDate, endDate);
    return Promise.resolve(resultsByDay);
  })
}


function getDailyDataEntryCounts(orgInternalName, startDate, endDate) {
  var searchParameters = 
  {
    index: "import_events_v1",
    body: {
      "size": 0,
      "aggs": {
        "byDay": {
          "date_histogram": {
            "field": "eventTime",
            "interval": "1d",
            "time_zone": "America/Denver",
            "min_doc_count": 1
          }
        }
      },
      "query": {
        "bool": {
          "must": [
            {
              "query_string": {
                "query": "_type:import_event",
                "analyze_wildcard": true
              }
            },
            {
              "match": {
                "orgInternalName": {
                  "query": orgInternalName,
                  "type": "phrase"
                }
              }
            },
            {
              "match": {
                "eventType": {
                  "query": "record_status_update",
                  "type": "phrase"
                }
              }
            },
            {
              "match": {
                "eventData.statusFrom": {
                  "query": "pending_data_entry",
                  "type": "phrase"
                }
              }
            },
            {
              "range": {
                "eventTime": {
                  "gte": startDate,
                  "lte": endDate
                }
              }
            }
          ]
        }
      }
    }
  };

  var client = es.createCollectorClient();
  return client.search(searchParameters)
  .then(function(results) {
    var resultsByDay = formatByDayResults(results, startDate, endDate);
    return Promise.resolve(resultsByDay);
  })
}


function getCaseCountWithDOSByFacilityAndMonth(orgInternalName) {
  var query = `SELECT f.fac_id,
       f.fac_nm,
       CAST(EXTRACT(YEAR FROM efs.proc_dt) AS SMALLINT) AS case_year,
       CAST(EXTRACT(MONTH FROM efs.proc_dt) AS SMALLINT) AS case_month,
       COUNT(*)
  FROM fac f
  JOIN enctr e
    ON e.fac_id = f.fac_id
  JOIN enctr_form ef
    ON ef.enctr_id = e.enctr_id
   AND ef.void_ind = FALSE
  JOIN enctr_form_surgery efs
    ON efs.enctr_form_id = ef.enctr_form_id
 GROUP BY 1,2,3,4
 ORDER BY 1,2,3,4`;

   var queryOptions = {
    type: sequelize.QueryTypes.SELECT,
    replacements: {
    }
  };

	if (!orgInternalName)
		throw new Error('Missing parameter orgInternalName.');
  
  var formattedResults = [];
	return orgModels.query(orgInternalName, query, queryOptions)
  .then(function(results) {
    _.forEach(results, function(result) {
      var existingFacilityCounts = _.find(formattedResults, {facilityId:result.fac_id});
      if(!existingFacilityCounts) {
        existingFacilityCounts = { facilityId: result.fac_id, counts:[] };
        formattedResults.push(existingFacilityCounts);
      }

      if(result.case_year == null || result.case_month == null)
        return;

      var monthYear = result.case_year.toString() + '-' + _.padStart(result.case_month.toString(),2,'0');
      existingFacilityCounts.counts.push({
        month: monthYear,
        count: parseInt(result.count)
      });
    })
    return Promise.resolve(formattedResults);
  })
}

function getCaseCountByFacilityAndMonth(orgInternalName) {
  var query = `SELECT f.fac_id,
                f.fac_nm,
                CAST(EXTRACT(YEAR FROM ef.ins_dttm AT time zone 'US/Central') AS SMALLINT) AS year_created,
                CAST(EXTRACT(MONTH FROM ef.ins_dttm AT time zone 'US/Central') AS SMALLINT) AS month_created,
                COUNT(*)
              FROM fac f
              JOIN enctr e
              ON e.fac_id = f.fac_id
              JOIN enctr_form ef
              ON ef.enctr_id = e.enctr_id
              AND ef.void_ind = FALSE
              JOIN form_defn fd
              ON fd.form_defn_id = ef.form_defn_id
              AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- do not count NULL or FALSE (i.e. forms not explicitly tagged as "cases")
              GROUP BY 1,2,3,4
              ORDER BY 1,2,3,4`;

   var queryOptions = {
    type: sequelize.QueryTypes.SELECT,
    replacements: {
    }
  };

	if (!orgInternalName)
		throw new Error('Missing parameter orgInternalName.');
  
  var formattedResults = [];
	return orgModels.queryReadOnly(orgInternalName, query, queryOptions)
  .then(function(results) {
    _.forEach(results, function(result) {
      var existingFacilityCounts = _.find(formattedResults, {facilityId:result.fac_id});
      if(!existingFacilityCounts) {
        existingFacilityCounts = { facilityId: result.fac_id, counts:[] };
        formattedResults.push(existingFacilityCounts);
      }

      var monthYear = result.year_created.toString() + '-' + _.padStart(result.month_created.toString(),2,'0');
      existingFacilityCounts.counts.push({
        month: monthYear,
        count: parseInt(result.count)
      });
    })
    return Promise.resolve(formattedResults);
  })
}

function getUnassignedImportRecordCountsByMonth(orgInternalName) {
  var searchParameters = {
    index: "import_events_v1",
    body: {
      "size": 0,
      "query": {
          "bool": {
              "must": [
                {
                  "term": {
                    "_type": {
                      "value": "import_batch"
                    }
                  }
                },
                {
                  "term": {
                    "orgInternalName": orgInternalName
                  }
                }
              ], 
              "must_not": [
                  {
                    "exists": {
                      "field": "facilityId"
                    }
                  },
                  {
                    "term": {
                      "batchStatus": {
                        "value": "discarded"
                      }
                    }
                  }
              ]
          }
      },
      "aggs": {
        "importRecords": {
          "children": {
            "type": "import_batch_record"
          },
          "aggs": {
            "byMonth": {
              "date_histogram": {
                "field": "createdAt",
                "interval": "month",
                "format": "yyyy-MM",
                "time_zone": "America/Chicago"
              }
            }
          }
        }
      }
    }
  };

  var client = es.createCollectorClient();
  return client.search(searchParameters)
  .then(function(results) {
    var byMonthCounts = _.map(results.aggregations.importRecords.byMonth.buckets, function(byMonthBucket) {
      return {
        month: byMonthBucket.key_as_string,
        count: byMonthBucket.doc_count
      }
    });
    return Promise.resolve(byMonthCounts);
  })
}

function getImportBatchRecordsByFacilityAndMonth(orgInternalName) {
  var searchParameters = {
    index: "import_events_v1",
    body: {
      "size": 0,
      "query": {
        "query_string": {
          "query": "_type:import_batch AND orgInternalName:" + encodeURIComponent(orgInternalName) + 
                " AND batchStatus:(pending_generation OR generating OR generation_error OR triage OR complete OR processing OR pending_review)"
        }
      },
      "aggs": {
        "byFacility": {
          "terms": {
            "size": 100000, 
            "field": "facilityId"
          },
          "aggs": {
            "importRecords": {
              "children": {
                "type": "import_batch_record"
              },
              "aggs": {
                "notDiscarded": {
                  "filter": {
                    "bool": {
                      "must_not": {
                        "term": {
                          "recordStatus": "discarded"
                        }
                      }
                    }
                  },
                  "aggs": {
                    "byMonth": {
                      "date_histogram": {
                        "field": "createdAt",
                        "interval": "month",
                        "format": "yyyy-MM",
                        "time_zone": "America/Chicago"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  var client = es.createCollectorClient();
  var facilities; 
  
  return FacilityDAO.getFacilities(orgInternalName)
  .then(function(facilitiesResult) {
    facilities = facilitiesResult;
    return client.search(searchParameters);
  })
  .then(function(results) {
    var byFacilityBuckets = results.aggregations.byFacility.buckets;
    var formattedResults = _.map(results.aggregations.byFacility.buckets, function(byFacilityBucket) {

      var byMonthCounts = _.map(byFacilityBucket.importRecords.notDiscarded.byMonth.buckets, function(byMonthBucket) {
        return {
          month: byMonthBucket.key_as_string,
          count: byMonthBucket.doc_count
        }
      });
      
      var facility = facilities.find((f) => f.facilityId == byFacilityBucket.key);
      return {
        facilityId: byFacilityBucket.key,
        facilityName: facility ? facility.facilityName : '',
        totalNotDiscardedRecords: byFacilityBucket.importRecords.notDiscarded.doc_count, 
        totalBatches: byFacilityBucket.doc_count,
        counts: byMonthCounts
      };
    });
    return Promise.resolve(formattedResults);
  })
}


function getCurrentBatchStatusCounts(orgInternalName) {
  var searchParameters = {
    index: "import_events_v1",
    body: {
      "size": 0,
      "aggs": {
        "byBatchStatus": {
          "terms": {
            "field": "batchStatus",
            "order": {
              "_count": "desc"
            }
          }
        }
      },
      "query": {
        "bool": {
          "must": [
            {
              "query_string": {
                "query": "_type:import_batch",
                "analyze_wildcard": true
              }
            },
            {
              "match": {
                "orgInternalName": {
                  "query": orgInternalName,
                  "type": "phrase"
                }
              }
            }
          ]
        }
      }
  }
  };

  var client = es.createCollectorClient();
  return client.search(searchParameters)
  .then(function(results) {
    var buckets = results.aggregations.byBatchStatus.buckets;
    return Promise.resolve(buckets);
  })
}

function getCurrentRecordStatusCounts(orgInternalName) {
  var searchParameters = {
    index: "import_events_v1",
    body: {
      "size": 0,
      "aggs": {
        "byBatchStatus": {
          "terms": {
            "field": "recordStatus",
            "order": {
              "_count": "desc"
            }
          }
        }
      },
      "query": {
        "bool": {
          "must": [
            {
              "query_string": {
                "query": "_type:import_batch_record",
                "analyze_wildcard": true
              }
            },
            {
              "match": {
                "orgInternalName": {
                  "query": orgInternalName,
                  "type": "phrase"
                }
              }
            }
          ]
        }
      }
  }
  };

  var client = es.createCollectorClient();
  return client.search(searchParameters)
  .then(function(results) {
    var buckets = results.aggregations.byBatchStatus.buckets;
    return Promise.resolve(buckets);
  })
}

function getRecordStatusCountsByFacility(orgInternalName) {
  var searchParameters = {
    index: "import_events_v1",
    body: {
      "size": 0,
      "query": {
        "query_string": {
          "query": "_type:import_batch AND orgInternalName:" + encodeURIComponent(orgInternalName) + " AND batchStatus:(triage OR pending_review OR processing OR complete)"
        }
      }, 
      "aggs": {
        "byFacility": {
          "terms": {
            "size": 1000,
            "field": "facilityId"
          },
          "aggs": {
            "importBatchRecords": {
              "children": {
                "type": "import_batch_record"
              },
              "aggs": {
                "byStatus": {
                  "terms": {
                    "size": 1000,
                    "field": "recordStatus"
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  var client = es.createCollectorClient();
  return client.search(searchParameters)
  .then(function(results) {
    
    var byFacilityResults = _.map(results.aggregations.byFacility.buckets, function(byFacilityResult) {

      var facilityResult = {
        facilityId: byFacilityResult.key,
        totalCount: byFacilityResult.doc_count,
        byStatus: {}
      };

      _.forEach(byFacilityResult.importBatchRecords.byStatus.buckets, function(byStatusResult) {
        facilityResult.byStatus[byStatusResult.key] = byStatusResult.doc_count;
      });

      return facilityResult;
    });
    return Promise.resolve(byFacilityResults);
  })
}


/*
*/

module.exports = {
  getDailyDataEntryCounts: getDailyDataEntryCounts,
  getDailyNewImportBatchRecordCounts: getDailyNewImportBatchRecordCounts,
  getCurrentBatchStatusCounts: getCurrentBatchStatusCounts,
  getCurrentRecordStatusCounts: getCurrentRecordStatusCounts,
  getRecordStatusCountsByFacility: getRecordStatusCountsByFacility,
  getImportBatchRecordsByFacilityAndMonth: getImportBatchRecordsByFacilityAndMonth,
  getCaseCountByFacilityAndMonth: getCaseCountByFacilityAndMonth,
  getCaseCountWithDOSByFacilityAndMonth: getCaseCountWithDOSByFacilityAndMonth,
  getUnassignedImportRecordCountsByMonth: getUnassignedImportRecordCountsByMonth
}