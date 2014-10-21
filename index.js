'use strict';

var utils  = require('@ali/midway-utils'),
    expect = require('args-expect'),
    logger = require('../logger'),
    path   = utils.path;

var configUtil = require('../utils/config-util'),
    commonUtil = require('../utils/common-util');

/**
 *  If any property start with this string, will load external file
 *  @constant
 */
var CONF_START = 'conf:';

/**
 *  Global Config
 *  @constructor
 *  @param {object} fields - base fields
 */
function Global(fields) {
    fields = fields || {};

    var protectFields = Object.keys(fields);
    utils.extend(this, utils.clone(fields));

    Object.defineProperties(this, {
        update: {
            enumerable:   false,
            writable:     false,
            configurable: false,

            value: function(data) {
                data = utils.isPlainObject(data) ? utils.clone(data) : {};

                /** should not overwrite init fields */
                utils.each(protectFields, function(protectPropName) {
                    if (data[protectPropName]) {
                        delete data[protectPropName];
                        logger.warn(
                            '[config] should not overwrite global field: %s' +
                            ', ignore global update process', protectPropName);
                    }
                });

                /** should not add dynamic replacer into global */
                commonUtil.replaceAllStrProps(data, function(prop) {
                    return commonUtil.parseString(prop, function(match, name) {
                        var breakValue = '__' + name + '__';
                        logger.warn(
                            '[config] global fields not allow dynamic replacer: %s' +
                            ', break to: %s', match, breakValue);
                        return breakValue;
                    });
                });

                /** mixin data on this */
                commonUtil.extendAllProps(this, data);
                return this;
            }
        },
        pullout: {
            enumerable:   false,
            writable:     false,
            configurable: false,
            value: function(data) {
                if (data && data.global) {
                    this.update(data.global);
                    delete data.global;
                }
            }
        }
    });
}

/**
 *  Config
 *  @constructor
 *  @param {Info} info - base info
 */
function Config(info) {
    expect(info, 'info').notNull();

    var global = new Global(info.getEnvFields()),
        rootPath = info.getRootPath();

    /** when merge method is called, the following events will be run sequentially */
    /** if the prop starts with conf://, it will be replaced with other file */

    /** 1. load config object from string or specific object */

    function pringLoadedMsg(confExists, confFile) {
        var metaPath = path.resolve(__dirname, '../../meta');

        // ignore default configs
        if (confExists && confFile.lastIndexOf(metaPath, 0) === -1 ) {
            logger.info('[config] %s is loaded successfully', confFile);
        }
    }

    function loadSingleConfig(confData) {
        var confObj, confPath, confFile;

        if (utils.isPlainObject(confData)) {
            confObj  = confData;
            confPath = rootPath;
        } else if (utils.isString(confData) && confData.length) {
            confObj  = configUtil.load(confData, rootPath, true);
            confFile = configUtil.parsePath(confData, rootPath);
            confPath = path.dirname(confFile);

            pringLoadedMsg(!!confObj, confFile);
        } else if (confData) {
            logger.warn(
                '[config] config: {%s} %s is not allow', typeof confData, confData);

            confData = undefined;
            confPath = rootPath;
        }

        return {
            data:      confObj,
            path:      confPath,
            available: !!confObj
        };
    }

    /** 2. every single config will call this function during loading. */
    function parseSingleConfig(singleConfObj, parentPath) {
        /** extract confObj.global, and delete it from the object */
        global.pullout(singleConfObj);

        /** trans conf://path into a relatedConf object */
        return commonUtil.replaceAllMatchProps(singleConfObj, function(prop) {
            return utils.isString(prop) && (prop.lastIndexOf(CONF_START, 0) === 0);
        }, function(prop) {
            return {
                _isRelatedConf: true,
                filePath:       prop.substring(CONF_START.length).trim(),
                parentPath:     parentPath || rootPath,
                otherFields:    {},
                originalDesc:   prop
            };
        });
    }

    /** 3. merge single config object into config hoster */
    function replaceRelatedConfModule(configHoster, callback) {
        commonUtil.replaceAllMatchProps(configHoster, function(prop) {
            return prop && prop._isRelatedConf;
        }, callback);
    }
    function mergeSingleConfig(configHoster, singleConfObj) {
        /** the special code for relatedConf object  */
        replaceRelatedConfModule(configHoster, function(prop, propKey, propPath) {
            var samePathValue = commonUtil.getPropByPath(singleConfObj, propPath);
            /** if singleConfObj has the same path value then merge it */
            if (samePathValue) {
                /** clear this value from singleConfObj */
                commonUtil.setPropByPath(singleConfObj, propPath, undefined);

                /** if the value is an object, then merge into otherField */
                if (utils.isObject(samePathValue)) {
                    commonUtil.extendAllProps(prop.otherFields, samePathValue);
                } else {
                /** if the value is not object, then replace relatedConfObj */

                    logger.warn(
                        '[config] related config flag: %s has been overwritten ' +
                        'by %s.', prop.filePath, samePathValue, propPath);

                    return samePathValue;
                }
            }
            return prop;
        });

        /** merge all singelConfObj into configHoster */
        commonUtil.extendAllProps(configHoster, singleConfObj);
    }

    /** 4. once all config has been merged into config hoster, then call this method */
    function parseConfigHoster(configHoster) {
        expect(configHoster).isObject();

        /** inject confObj into confObj prop, if it has the replacer like {{xxx}} */
        commonUtil.parseObject(configHoster, global);

        /** the special code for relatedConf object  */
        replaceRelatedConfModule(configHoster, function(prop) {
            /** load external file from relatedConf obj */
            var realtedPath = path.resolve(prop.parentPath, prop.filePath),
                relatedConf = configUtil.load(realtedPath);

            // error handling: if config is not exists
            if (!relatedConf) {
                relatedConf = {};
                Object.defineProperty(relatedConf, '_loadFailed', {
                    enumerable: false,
                    value: true
                });
            }

            // error handling: if other fiels has another conf:// flag, rollback it
            replaceRelatedConfModule(prop.otherFields, function(prop) {
                return prop.originalDesc;
            });

            /** if there are any otehrFields form other config object, merge it */
            commonUtil.extendAllProps(relatedConf, prop.otherFields);

            /** parse all fields with global, if it is contains dynamic replacer */
            commonUtil.parseObject(relatedConf, global);

            /** record original path, it has been used by model-dataproxy */
            Object.defineProperty(relatedConf, '_originalPath', {
                enumerable: false,
                value: realtedPath
            });

            return relatedConf;
        });

        return configHoster;
    }

    Object.defineProperties(this, {
        /** merge arguments into self sequentially */
        merge: {
            enumerable:   false,
            writable:     false,
            configurable: false,
            value: function() {
                var self = this;

                utils.each(arguments, function(source) {
                    var configInfo, config;

                    configInfo = loadSingleConfig(source);

                    if (configInfo.available) {
                        config = parseSingleConfig(configInfo.data, configInfo.path);
                        mergeSingleConfig(self, config);
                    }
                });

                parseConfigHoster(self);
            }
        },
        /** get field by key */
        getField: {
            enumerable:   false,
            writable:     false,
            configurable: false,
            value: function(fieldName) {
                var field;
                if (fieldName === 'global' ) {
                    field = this.getGlobal();
                } else {
                    field = this[fieldName];
                }

                /*
                if (field === undefined) {
                    field = {};
                }
                */

                return field;
            }
        },
        /** get global */
        getGlobal: {
            enumerable:   false,
            writable:     false,
            configurable: false,
            value: function() {
                return utils.clone(global);
            }
        }
    });

    // export private method for testing
    utils.test.runIfActive(function(helper) {
        helper.createSpace(this, '_private')
            .withMethods({
                loadSingleConfig:  loadSingleConfig,
                parseSingleConfig: parseSingleConfig,
                mergeSingleConfig: mergeSingleConfig,
                parseConfigHoster: parseConfigHoster
            });
    }, this);
}

exports.create = function createConfig(info) {
    return new Config(info);
};

// export private class for testing
utils.test.runIfActive(function(helper) {
    helper.createSpace(exports, '_private')
        .withMethods({
            createGlobal: function(fields) {
                return new Global(fields);
            }
        });
});
