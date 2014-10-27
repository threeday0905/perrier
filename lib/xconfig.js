'use strict';

var _  = require('lodash'),
    expect = require('args-expect'),
    parser = require('obj-parser'),
    path   = require('path'),
    logger = require('../logger');

var globalFieldFactory = require('./global-field'),
    configUtil = require('../utils/config-util');

function debug(method) {
    var noop = function() {};
    method = method || {};
    return {
        ok:  _.isFunction(method.info) ? method.info: noop,
        err: _.isFunction(method.error) ? method.error: noop
    }
}

function XconfParser(options) {
    expect(options).isObject().has({
        globalField: Object
    });

    var confFlag = options.confFlag || 'conf:',
        rootPath = options.rootPath || process.cwd()

    var globalField = options.globalField;

    /* Step 1. load config object from string or specific object */
    function loadSingleConfig(source, rootPath) {
        var confObj, confPath;

        if (_.isPlainObject(source)) {
            confObj  = source;
            confPath = rootPath;
        } else if (_.isString(source) && source.length) {
            confObj  = confLoader.load(source, rootPath);
            confPath = path.dirname( confLoader.resolve(confData, rootPath) );
        } else if (source) {
            throw new Error('non-supported config type: ' +
                typeof source + ', value: ' + source);
        }

        return {
            data: confObj,
            path: confPath
        };
    }

    /* Step 2. every single config will call this function during loading. */
    function parseSingleConfig(confObj, confPath) {
        /* extract confObj.global, and delete it from the object */
        globalField.pullout(confObj);

        /* trans conf://path into a relatedConf object */
        return parser.replaceAllMatchProps(confObj, function(prop) {
            /* if the field is starts from "conf:" */
            return utils.isString(prop) && (prop.lastIndexOf(confFlag, 0) === 0);
        }, function(prop) {
            /* replace with "temp related conf object" */
            return {
                _isRelatedConf: true,
                filePath:       prop.substring(confFlag.length).trim(),
                parentPath:     confPath || rootPath,
                otherFields:    {},
                originalDesc:   prop
            };
        });
    }

    /* 3 & 4. shourtcut tool for step 3 & step 4 */
    function replaceRelatedConfModule(configHoster, callback) {
        /* if the prop is realted conf, then call the callback */
        parser.replaceAllMatchProps(configHoster, function(prop) {
            return prop && prop._isRelatedConf;
        }, callback);
    }

    /* 3. merge single config object into config hoster */
    function mergeSingleConfig(configHoster, singleConfig) {
        /* check the config hoster */
        replaceRelatedConfModule(configHoster, function(prop, propKey, propPath) {
            /* if there are any exists "temp related conf object" on config hoster,
                and the single config contains same path with other value,
                then save value to otherFields, which will be mixin on final step */

            var samePathValue = parser.getPropByPath(singleConfig, propPath);
            if (samePathValue) {
                /** clear this value from singleConfig */
                parser.setPropByPath(singleConfig, propPath, undefined);

                /** if the value is an object, then merge directly */
                if (_.isObject(samePathValue)) {
                    _.assign(prop.otherFields, samePathValue);
                } else {
                    /** otherwise assign to a temp array */
                    if (!prop.otherFields._lost_) {
                        prop.otherFields._lost_ = [];
                    }
                    prop.otherFields._lost_.push(samePathValue);
                }
            }
            return prop;
        });

        /* merge all singelConfObj into configHoster */
        _.assign(configHoster, singleConfObj);
    }

    /** 4. once all config has been merged into config hoster, then call this method */
    function parseConfigHoster(configHoster) {
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
}



/**
 *  XConfig
 *  @constructor
 *  @param {Object} options.globalFields
 *  @param {Object} options.confPrefix
 *  @param {Object} options.globalFieldName
 */
function XConfig(options) {
    var confFlag, rootPath, globalField, debug;

    options = options || {};

    /* If any property start with this string, will load as an external file */
    confFlag = options.confFlag || 'conf:';

    /* All config paths will be resolved with this folder */
    rootPath = options.rootPath || process.cwd();

    globalField = globalFieldFactory.create({
        readonlyFields: options.globalFields,
        pulloutName:    options.globalFieldName
    });

    /* create debug method */
    debug = debug(options.debug);

    /** when merge method is called, the following events will be run sequentially */
    /** if the prop starts with conf://, it will be replaced with other file */












    Object.defineProperties(this, {
        load: {  /* enumerable, writeable, configurable: false */
            value: function() {
                var self = this;

                function printOk(source) {
                    /* only print success msg on file loading */
                    if (_.isString(source)) {
                        debug.ok('[xconf] %s is loaded successfully', source);
                    }
                }

                function printErr(source, e) {
                    debug.err('[xonf] failed to load %s, stack: %s', source, e.stack);
                }

                function dealSingleItem(source) {
                    var info = loadSingleConfig(source),  /* 1. load as conf info */
                        config = parseSingleConfig(info); /* 2. parse to conf obj */

                    mergeSingleConfig(self, parsedConfig); /* 3. merge to self  */
                }

                _.each(arguments, function(source) {
                    try {
                        dealSingleConf(source);
                        printOk(source);
                    } catch (ex) {
                        printErr(source, ex.stack);
                    }
                });

                /* 4. deal with xconfig hoster once all single config merged */
                parseConfigHoster();
            }
        },
        merge: { /* enumerable, writeable, configurable: false */
            value: this.load
        },

        getField: {  /* enumerable, writeable, configurable: false */
            value: function(fieldName) {
                if (fieldName === 'global' ) {
                    return this.getGlobal();
                } else {
                    return this[fieldName];
                }
            }
        },
        /** get global */
        getGlobal: {  /* enumerable, writeable, configurable: false */
            value: function() {
                return _.clone(global);
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
