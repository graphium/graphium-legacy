
var es = require('../../util/esUtil');
var _ = require('lodash');
var moment = require('moment');
var orgModels = require('../../model/OrgModels.js');
var sequelize = require('sequelize');

function formatByDayResults(results, startDate, endDate) {
    var buckets = results.aggregations.byDay.buckets;
    var dates = _.map(buckets, function(item) { return moment.utc(item.key).format('YYYY-MM-DD'); });
    var counts = _.map(buckets, 'doc_count');

    var resultsByDay = [];
    var a = moment(startDate);
    var b = moment(endDate);
    for (var m = moment(a); m.diff(b, 'days') <= 0; m.add(1, 'days')) {
      var dateString = m.format('YYYY-MM-DD');
      var count = counts[dates.indexOf(dateString)];
      var result = {
        date: dateString,
        timestamp: m.valueOf(),
        count: count
      };
      resultsByDay.push(result);
    }

    return resultsByDay;
}

function getImportRecordUsageForFacility(orgInternalName, facilityId, startDate, endDate) {
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
                    "orgInternalName": {
                      "value": orgInternalName
                    }
                  }
                },
                {
                  "term": {
                    "facilityId": {
                      "value": facilityId
                    }
                  }
                }
              ], 
              "must_not": [
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
        "noTemplate": {
          "missing": {
            "field": "batchTemplateGuid"
          },
          "aggs": {
            "importBatchRecords": {
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
                    "forDateRange": {
                      "filter": {
                        "range": {
                          "createdAt": {
                            "gte": startDate,
                            "lte": endDate,
                            "time_zone": "America/Chicago"
                          }
                        }
                      },
                      "aggs": {
                        "byMonth": {
                          "date_histogram": {
                            "field": "createdAt",
                            "interval": "month",
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
        },
        "byTemplate": {
          "terms": {
            "field": "batchTemplateGuid",
            "size": 1000
          },
          "aggs": {
            "importBatchRecords": {
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
                    "forDateRange": {
                      "filter": {
                        "range": {
                          "createdAt": {
                            "gte": startDate,
                            "lte": endDate,
                            "time_zone": "America/Chicago"
                          }
                        }
                      },
                      "aggs": {
                        "byMonth": {
                          "date_histogram": {
                            "field": "createdAt",
                            "interval": "month",
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
      }
    }
  };

  var client = es.createCollectorClient();
  return client.search(searchParameters)
  .then(function(results) {
    
    var missingTemplateCount = results.aggregations.noTemplate.importBatchRecords.notDiscarded.forDateRange.doc_count;
    var byTemplateCount = _.map(results.aggregations.byTemplate.buckets, function(bucket) {
      return {
        importBatchTemplateGuid: bucket.key,
        count: bucket.importBatchRecords.notDiscarded.forDateRange.doc_count
      };
    });

    return Promise.resolve({
      missingTemplateCount: missingTemplateCount,
      byTemplateCount: byTemplateCount
    });
  })
}

function getDataEntryCounts(orgInternalName, startDate, endDate) {
  //console.log('Getting daily data entry counts: ' + [orgInternalName, startDate, endDate].join(', '));
  var searchParameters = 
  {
    index: "import_events_v1",
    body: {
      "size": 0,
      "aggs": {
        "byFacility": {
          "terms": {
            "field": "facilityId",
            "size": 10000
          }
        },
        "byDay": {
          "date_histogram": {
            "field": "eventTime",
            "interval": "1d",
            "time_zone": "-06:00",
            "min_doc_count": 0,
            "format": "yyyy-MM-dd"
          }
        },
        "byClerk": {
          "terms": {
            "field": "userName",
            "size": 100000
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
              "match": {
                "eventData.statusTo": {
                  "query": "pending_processing",
                  "type": "phrase"
                }
              }
            },
            {
              "range": {
                "eventTime": {
                  "gte": startDate,
                  "lte": endDate,
                  "time_zone": "America/Chicago"
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
    return Promise.resolve({byDay: resultsByDay, byClerk: results.aggregations.byClerk.buckets, byFacility: results.aggregations.byFacility.buckets });
  })
}


function getDataEntryCountsByMonth(orgInternalName, startDate, endDate) {

  var searchParameters = 
  {
    index: "import_events_v1",
    body: {
      "size": 0,
      "aggs": {
        "byFacility": {
          "terms": {
            "field": "facilityId",
            "size": 10000
          },
          "aggs": {
            "byMonth": {
              "date_histogram": {
                "field": "eventTime",
                "interval": "month",
                "time_zone": "America/Chicago",
                "min_doc_count": 0,
                "format": "yyyy-MM-dd"
              }
            }
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
              "match": {
                "eventData.statusTo": {
                  "query": "pending_processing",
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
    return Promise.resolve(results.aggregations.byFacility.buckets);
  })
}

module.exports = {
  getDataEntryCounts: getDataEntryCounts,
  getImportRecordUsageForFacility: getImportRecordUsageForFacility,
  getDataEntryCountsByMonth: getDataEntryCountsByMonth
}