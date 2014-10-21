'use strict';

var utils = require('@ali/midway-utils'),
    expect = require('args-expect'),
    logger = require('../logger');

/**
*   go throgh all props, and replace the value if it is match condition
*   @param {string} obj
*   @param {function} matchFn - check the prop, if return true, then replace it
*   @param {function} replaceFn - use this function to replace the matched prop
*   @param {object} hoster - the hoster of replacefn
*   @param {string} _propPath - cache prop path during recursive, callback on replace
*/
exports.replaceAllMatchProps = function(obj, matchFn, replaceFn, hoster, _propPath) {
    if (!utils.isObject(obj)) {
        return obj;
    }

    expect.all(matchFn, replaceFn).isFunction();

    _propPath = _propPath || '';

    Object.keys(obj).forEach(function(key) {
        var prop = obj[key],
            fullPath = _propPath ? _propPath + '.' + key : key;

        if (matchFn(prop)) {
            obj[key] = replaceFn.call(hoster, prop, key, fullPath);
        } else if (utils.isObject(prop)) {
            exports.replaceAllMatchProps(
                prop, matchFn, replaceFn, hoster, fullPath);
        }
    });

    return obj;
};

/**
*   go throgh all props, and replace the value if it is string
*   @param {string} obj
*   @param {function} replaceFn - use this function to replace the string prop
*   @param {object} hoster - the hoster of replacefn
*/
exports.replaceAllStrProps = function(obj, replaceFn, hoster) {
    return exports.replaceAllMatchProps(obj, function(prop) {
        return utils.isString(prop);
    }, replaceFn, hoster);
};

/**
*   Merge the contents of two or more objects together into the first object.
*/
exports.extendAllProps = function() {
    var receiver = arguments[0],
        suppliers = Array.prototype.slice.call(arguments, 1);

    if (utils.isObject(receiver)) {
        suppliers.forEach(function(supplier) {
            if (utils.isObject(supplier) && supplier !== null) {
                Object.keys(supplier).forEach(function(key) {
                    var src = receiver[key],
                        copy = supplier[key], descriptor;

                    if (src === copy) {
                        return;
                    }

                    if (utils.isPlainObject(copy)) {
                        receiver[key] = exports.extendAllProps(
                            utils.isObject(src) ? src : {},
                            copy
                        );
                    } else if (utils.isArray(copy)) {
                        receiver[key] = exports.extendAllProps(
                            utils.isArray(src) ? src : [],
                            copy
                        );
                    } else if (copy !== undefined) {
                        descriptor = Object.getOwnPropertyDescriptor(supplier, key);
                        Object.defineProperty(receiver, key, descriptor);
                    }
                });
            }
        });
    }
    return receiver;
};

/**
*   Regex. it will match the value like {{xxx}}
*   @constant
*/
var PARSER_REG = /\{\{([^{}]+)\}\}/g;

/**
*   Get prop value from map object with prop path
*   @param {object} map
*   @param {string} path - like 'from.to'
*/
exports.getPropByPath = function(map, path) {
    expect(path).isString();
    expect(map).isObject();

    var prop, paths;

    if (path.lastIndexOf('.') === -1) {
        prop = map[path];
    } else {
        paths = path.split('.');
        prop = map[paths[0]];
        for (var i = 1, len = paths.length; i < len; i += 1) {
            if (utils.isObject(prop)) {
                prop = prop[paths[i]];
            } else {
                prop = undefined;
                break;
            }
        }
    }
    return prop;
};

/**
*   Set prop value from map object with prop path
*   @param {object} map
*   @param {string} path - like 'from.to'
*/
exports.setPropByPath = function(map, path, value) {
    expect(path).isString();
    expect(map).isObject();

    var prop, paths, nextPhase;

    if (path.lastIndexOf('.') === -1) {
        map[path] = value;
    } else {
        paths = path.split('.');
        prop = map[paths[0]];
        for (var i = 1, len = paths.length; i < len; i += 1) {
            nextPhase = paths[i];

            if (i === len - 1) { //last call
                if (prop) {
                    prop[nextPhase] = value;
                }
            } else {
                if (utils.isObject(prop)) {
                    prop = prop[nextPhase];
                } else {
                    break;
                }
            }
        }
    }

    return map;
};

/**
*   Parse string, replace {{xxx}} with map object or callback function
*   @param {string} str
*   @param {object} map
*   @param {function} callback
*/
exports.parseString = function(str, map, callback) {
    expect(str).isString();

    if (utils.isFunction(map)) {
        callback = map;
        map = {};
    } else if (!map) {
        map = {};
    }

    return str.replace(PARSER_REG, callback || function(match, name) {
        var value = exports.getPropByPath(map, name);
        if (value === undefined) {
            logger.warn('replacer: %s has not been defined, parsed failed', name);
            return match;
        } else {
            return value;
        }
    });
};

/**
*   Replace all string prop with map object
*   @param {object} source
*   @param {object} map
*/
exports.parseObject = function(source, map) {
    expect(source, 'object source').isObject();
    return exports.replaceAllStrProps(source, function(prop) {
        return exports.parseString(prop, map);
    });
};

/**
*   make array
*/
exports.makeArray = function(obj) {
    if (obj === null) {
        return [];
    } else if (utils.isArguments(obj)) {
        return Array.prototype.slice.call(obj, 0);
    } else if (utils.isArray(obj)) {
        return obj;
    } else {
        return [ obj ];
    }
};
