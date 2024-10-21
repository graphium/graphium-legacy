var elasticsearch = require('elasticsearch');

import { Client } from 'elasticsearch';

export function createCollectorClient():Client {
  return new Client({
    host: [
      {
        host: process.env.ES_COLLECTOR_HOST,
        auth: [process.env.ES_COLLECTOR_USER,process.env.ES_COLLECTOR_PASS].join(':'),
        protocol: process.env.ES_COLLECTOR_PROTOCOL,
        port: process.env.ES_COLLECTOR_PORT
      }
    ],
    //log: 'trace',
    requestTimeout: 60000
  });
}