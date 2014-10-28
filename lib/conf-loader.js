'use strict';

var fs = require('fs'),
    vm = require('vm');

var expect = require('args-expect'),
    path   = require('path-tools');

/**
 * parse filename to full config path
 * @param  {String} fileName - config file
 * @param  {String} rootPath - config folder (optional)
 * @return {String}
 */
function resolve(fileName, rootPath) {
    /* parse to absolute path, and add .conf extname if not proivde extname */
    return path.parseToFullPath(fileName, rootPath, '.conf');
}

/**
*   Load config file from a file
*   @param {string} filePath - should be absolute
*/
function loadXJSON(filePath) {
    var config, script, err;
    if (fs.existsSync(filePath)) {
        config = fs.readFileSync(filePath).toString();

        // Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
        // because the buffer-to-string conversion in `fs.readFileSync()`
        // translates it to FEFF, the UTF-16 BOM.
        if (config.charCodeAt(0) === 0xFEFF) {
            config = config.slice(1);
        }

        script = '(function(){ return ' + config + '; })()';
        try {
            return vm.runInThisContext(script, filePath);
        } catch (ex) {
            ex.code = 'MODULE_PARSE_FAILED';
            throw ex;
        }
    } else {
        err = new Error('module not found. path: ' + filePath);
        err.code = 'MODULE_NOT_FOUND'; // same as require fail.
        throw err;
    }
}

/**
*   An extend require method to load config file
*   @param {string} fileName
*   @param {string} rootPath - if fileName is not absolute, resolved with rootPath
*/
function load(fileName, rootPath) {
    expect(fileName).isString().notEmpty();

    /* parse to absolute path, and add .conf extname if not proivde extname */
    var filePath = resolve(fileName, rootPath),
        extname = path.extname(filePath);

    switch (extname) {
        case '.js':
            return require(filePath);
        case '.json':
        case '.conf':
        case '.xconf':
            return loadXJSON(filePath);

        /* TODO: supported ini, yml */
        default:
            throw new Error('extname "' + extname + '" is not available');
    }
}

module.exports = {
    resolve: resolve,
    loadXJSON: loadXJSON,
    load:      load
};
