var elasticsearch = require('elasticsearch');

import { Client } from 'elasticsearch';
import { EnvironmentConfig } from '../config/EnvironmentConfig';

export function createCollectorClient():Client {
  return new Client({
    host: [
      {
        host: EnvironmentConfig.getProperty('collector-v1','ES_COLLECTOR_HOST'),
        auth: [EnvironmentConfig.getProperty('collector-v1','ES_COLLECTOR_USER'),EnvironmentConfig.getProperty('collector-v1','ES_COLLECTOR_PASS')].join(':'),
        protocol: EnvironmentConfig.getProperty('collector-v1','ES_COLLECTOR_PROTOCOL'),
        port: EnvironmentConfig.getProperty('collector-v1','ES_COLLECTOR_PORT')
      }
    ],
    //log: 'trace',
    requestTimeout: 60000
  });
}