'use strict';

var fs = require('fs'),
    vm = require('vm');

var utils  = require('@ali/midway-utils'),
    expect = require('args-expect'),
    logger = require('../logger'),
    path   = utils.path;

/**
*   Load config file from a file
*   @param {string} filePath - should be absolute
*/
exports.parseConfFileToObj = function(filePath) {
    var config, script, err;
    if (fs.existsSync(filePath)) {
        config = fs.readFileSync(filePath).toString();

        // Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
        // because the buffer-to-string conversion in `fs.readFileSync()`
        // translates it to FEFF, the UTF-16 BOM.
        if (config.charCodeAt(0) === 0xFEFF) {
            config = config.slice(1);
        }

        script = '(function(){ var conf = ' + config + '; return conf; })()';
        try {
            return vm.runInThisContext(script, filePath);
        } catch (ex) {
            ex.code = 'MODULE_PARSE_FAILED';
            throw ex;
        }
    } else {
        err = new Error('module not found.');
        err.code = 'MODULE_NOT_FOUND'; // same as require fail.
        throw err;
    }
};

/**
*   An extend require method to load config file
*   @param {string} fileName
*   @param {string} rootPath - if fileName is not absolute, resolved with rootPath
*   @param {boolean} optional - if set true, logger as debug
*/
exports.load = function(fileName, rootPath, optional) {
    expect(fileName).isString().notEmpty();
    optional = optional === true;

    /* parse to absolute path, and add .conf extname if not proivde extname */
    var filePath = exports.parsePath(fileName, rootPath),
        extname  = path.extname(filePath),
        confObj;

    try {
        /** supported three kind of extension names, such as .js, .json, conf */
        /** default extname is .conf */
        if (extname === '.js' || extname === '.json') {
            confObj = require(filePath);
        } else if (extname === '.conf') {
            confObj = exports.parseConfFileToObj(filePath);
        } else {
            logger.error('[config] the extname %s is not available', extname);
        }
    } catch (ex) {
        // if optional is true, then ignore not found error
        if (!optional || ex.code !== 'MODULE_NOT_FOUND') {
            ex.message = utils.format(
                '[config] failed to load: %s, %s', filePath, ex.message);

            logger.error(ex);
        }
    }

    /*
    if (confObj) {
        logger.info('[config] %s is loaded successfully.', filePath);
    }
    */

    return confObj;
};

exports.parsePath = function(fileName, rootPath) {
    /* parse to absolute path, and add .conf extname if not proivde extname */
    return path.parseToFullPath(fileName, rootPath, '.conf');
};
