'use strict';

const winston = require('winston');
const os = require('os');
const containerized = require('containerized');

const isLinux = (os.platform() === 'linux');
const isContainerized = isLinux && containerized();

let logLevel = 'info';
if (process.env.LOG_LEVEL) {
    logLevel = process.env.LOG_LEVEL;
} else {
    // We'll set level debug if we're not containerized
    if (!isContainerized)
        logLevel = 'debug';
}

let consoleLogger;
let makeLog;

let useJsonLogging = true;
let remarkPlainLogging = false;
if (process.env.LOG_PLAIN && process.env.LOG_PLAIN !== 'false') {
    useJsonLogging = false;
} else if (!process.env.LOG_PLAIN) {
    // Perhaps we'll default to plain logging anyway
    if (!isContainerized) {
        remarkPlainLogging = true;
        useJsonLogging = false;
    }
}

const logDateKeeper = {
    debug: {
        logTime: new Date().getTime
    },
    info: {
        logTime: new Date().getTime
    },
    warn: {
        logTime: new Date().getTime
    },
    error: {
        logTime: new Date().getTime
    },
};

function chooseLogDateKeeper(level) {
    switch (level) {
        case 'error':
            switch (logLevel) {
                case 'error':
                    return logDateKeeper.error;
                case 'warn':
                    return logDateKeeper.warn;
                case 'info':
                    return logDateKeeper.info;
                default: return logDateKeeper.debug;
            }
            break;
        case 'warn':
            switch (logLevel) {
                case 'error':
                case 'warn':
                    return logDateKeeper.warn;
                case 'info':
                    return logDateKeeper.info;
                default:
                    return logDateKeeper.debug;
            }
            break;

        case 'info':
            switch (logLevel) {
                case 'error':
                case 'warn':
                case 'info':
                    return logDateKeeper.info;
                default:
                    return logDateKeeper.debug;
            }
            break;

        default:
            return logDateKeeper.debug;
    }
}

if (useJsonLogging) {
    makeLog = makeLogJson;
    consoleLogger = winston.createLogger({
        level: logLevel,
        format: winston.format.json(),
        transports: [new winston.transports.Console()]
    });
} else {
    makeLog = makeLogPlain;
    consoleLogger = winston.createLogger({
        level: logLevel,
        format: winston.format.simple(),
        transports: [new winston.transports.Console()]
    });
}

if (remarkPlainLogging) {
    consoleLogger.info(makeLog('portal-env:logger', 'Using plain logging format on non-containerized OS; override with LOG_PLAIN=false'));
}
consoleLogger.info(makeLog('portal-env:logger', `Setting up logging with log level "${logLevel}" (override with LOG_LEVEL)`));

const logger = (moduleName) => {
    return {
        debug: (log) => {
            consoleLogger.debug(makeLog(moduleName, log, chooseLogDateKeeper('debug')));
        },

        info: (log) => {
            consoleLogger.info(makeLog(moduleName, log, chooseLogDateKeeper('info')));
        },

        warn: (log) => {
            consoleLogger.warn(makeLog(moduleName, log, chooseLogDateKeeper('warn')));
        },

        error: (log) => {
            consoleLogger.error(makeLog(moduleName, log, chooseLogDateKeeper('error')));
        }
    };
};

// Log formatters

// makeLogPlain makes debugging unit tests a lot easier
function makeLogPlain(moduleName, log, logDateKeeper) {
    let s = log;
    if (log && typeof (log) !== 'string')
        s = JSON.stringify(log);
    if (log === undefined)
        s = '(undefined)';
    else if (log === null)
        s = '(null)';
    // Special case for logging Error instances
    if (log && log.stack) {
        console.error(log);
    }
    let delta = '--';
    if (logDateKeeper) {
        const now = new Date().getTime();
        delta = (now - logDateKeeper.logTime);
        logDateKeeper.logTime = now;
    }
    return `[+${('' + delta).padStart(4)}ms] ${moduleName.padEnd(30)} ${s}`;
}

// This is the standard logger which always outputs a structured JSON
// log.
function makeLogJson(moduleName, log, logDateKeeper) {
    // level is not used here
    let delta = 0;
    if (logDateKeeper) {
        const now = new Date().getTime();
        delta = (now - logDateKeeper.logTime);
        logDateKeeper.logTime = now;
    }
    const logEntry = {
        date: new Date().toISOString(),
        module: moduleName,
        message: log,
        delta: delta
    };
    return logEntry;
}

module.exports = logger;
