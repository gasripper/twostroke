'use strict';

import { default as winston } from 'winston';

// Loglevel
const PM8S_LOG_LEVEL: string = process.env.PM8S_LOG_LEVEL || 'debug';

// Setup logging
export const log: winston.Logger = winston.createLogger({
  level: PM8S_LOG_LEVEL,
  defaultMeta: {},
  transports: [new winston.transports.Console({
    format: winston.format.simple(),
  })],
});

