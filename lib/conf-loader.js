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
 * throw error if file is not exist
 * @param  {String} filePath
 */
function throwIfNonExist(filePath) {
    if (!fs.existsSync(filePath)) {
        var err = new Error('module not found. path: ' + filePath);
        err.code = 'MODULE_NOT_FOUND'; // same as require fail.
        err.path = filePath;
        throw err;
    }
}

/**
 * Load file and remove bom
 * @param  {String} filePath
 */
function loadFile(filePath) {
    throwIfNonExist(filePath);

    var content = fs.readFileSync(filePath).toString();

    /*
    * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
    * because the buffer-to-string conversion in `fs.readFileSync()`
    * translates it to FEFF, the UTF-16 BOM.
    */
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }
    return content;
}

/**
*   Load config file from a file
*   @param {string} filePath - should be absolute
*/
function loadXJSON(filePath) {
    throwIfNonExist(filePath);

    var content = loadFile(filePath),
        script = '(function(){ return ' + content + '; })()';

    try {
        return vm.runInThisContext(script, filePath);
    } catch (ex) {
        ex.code = 'MODULE_PARSE_FAILED';
        throw ex;
    }
}

function loadYAML(filePath) {
    var yaml, content;
    try {
        yaml = require('js-yaml');
    } catch (ex) {
        var err = new Error('failed to require "js-yaml", please install manually');
        err.force = true;
        throw err;
    }

    content = loadFile(filePath);
    try {
        return yaml.safeLoad(content);
    } catch (ex) {
        ex.code = 'MODULE_PARSE_FAILED';
        throw ex;
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
        extname  = path.extname(filePath);

    switch (extname) {
        case '.js':
            return require(filePath);

        case '.json':
        case '.conf':
            return loadXJSON(filePath);

        case '.yaml':
        case '.yml':
            return loadYAML(filePath);

        default:
            throw new Error('extname "' + extname + '" is not available');
    }
}

module.exports = {
    resolve:   resolve,
    loadXJSON: loadXJSON,
    loadYAML:  loadYAML,
    load:      load
};
