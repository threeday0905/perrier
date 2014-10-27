'use strict';

var utils  = require('lodash'),
    expect = require('args-expect'),
    parser = require('obj-parser'),
    path   = require('path'),
    logger = require('../logger');

var configUtil = require('../utils/config-util');

/**
 *  If any property start with this string, will load external file
 *  @constant
 */
var CONF_START = 'conf:';

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
        return parser.replaceAllMatchProps(singleConfObj, function(prop) {
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
        parser.replaceAllMatchProps(configHoster, function(prop) {
            return prop && prop._isRelatedConf;
        }, callback);
    }
    function mergeSingleConfig(configHoster, singleConfObj) {
        /** the special code for relatedConf object  */
        replaceRelatedConfModule(configHoster, function(prop, propKey, propPath) {
            var samePathValue = parser.getPropByPath(singleConfObj, propPath);
            /** if singleConfObj has the same path value then merge it */
            if (samePathValue) {
                /** clear this value from singleConfObj */
                parser.setPropByPath(singleConfObj, propPath, undefined);

                /** if the value is an object, then merge into otherField */
                if (utils.isObject(samePathValue)) {
                    parser.extendAllProps(prop.otherFields, samePathValue);
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
        parser.extendAllProps(configHoster, singleConfObj);
    }

    /** 4. once all config has been merged into config hoster, then call this method */
    function parseConfigHoster(configHoster) {
        expect(configHoster).isObject();

        /** inject confObj into confObj prop, if it has the replacer like {{xxx}} */
        parser.parseObject(configHoster, global);

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
            parser.extendAllProps(relatedConf, prop.otherFields);

            /** parse all fields with global, if it is contains dynamic replacer */
            parser.parseObject(relatedConf, global);

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
