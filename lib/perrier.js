'use strict';

var _ = require('lodash'),
    expect = require('args-expect'),
    parser = require('obj-parser'),
    path   = require('path');

var GlobalField = require('./global-field'),
    confLoader  = require('./conf-loader');

function noop() {}

/**
 *  Perrier
 *  @constructor
 *  @param {Object} options.rootPath
 *  @param {Object} options.confFlag
 *  @param {Object} options.globalFields
 *  @param {Object} options.globalFieldName
 */
function Perrier(options) {
    var configHoster = this,
        confFlag, rootPath, globalField,
        monitor = noop;

    options = options || {};

    /* If any property start with this string, will load as an external file */
    confFlag = options.confFlag || 'conf:';

    /* All config paths will be resolved with this folder */
    rootPath = path.normalize(options.rootPath || process.cwd());

    globalField = new GlobalField({
        readonlyFields: options.globalFields,
        pulloutName:    options.globalFieldName
    });

    if (_.isFunction(options.monitor)) {
        monitor = options.monitor;
    }

    /* when merge method called, the following events will be run sequentially */

    /**
     * Step 1. load config object from string or specific object
     * @return {ConfInfo}
     */
    function loadConfig(source) {
        var confData, confName, confPath;

        if (parser.isPlainObject(source)) {
            confData = _.cloneDeep(source);
            confName = 'anonymous';
            confPath = rootPath;
        } else if (_.isString(source)) {
            confData = confLoader.load(source, rootPath);
            confName = confLoader.resolve(source, rootPath);
            confPath = path.dirname(confName);
        } else {
            var ex = 'non-supported type: ' + typeof source + ', value: ' + source;
            throw new Error(ex);
        }

        return {
            data: confData,
            name: confName,
            path: confPath
        };
    }

    /**
     * Step 2. every single config will call this function during loading.
     */
    function parseConfig(confData, confPath) {
        expect(confData).isObject();

        /* extract confData.global, and delete it from the object */
        globalField.pullout(confData);

        /* trans conf://path into a relatedConf object */
        return parser.replaceAllMatchProps(confData, function(prop) {
            /* if the field is starts from "conf:" */
            return _.isString(prop) && (prop.lastIndexOf(confFlag, 0) === 0);
        }, function(prop) {
            /* create `RelatedConf` obj to save some info temporary */
            return {
                _RelatedConf: true,
                realtedDir:   confPath || rootPath,
                relatedPath:  prop.substring(confFlag.length).trim(),
                otherFields:  {},
                originalDesc: prop
            };
        });
    }
    /**
     * shortcut to lookup `RelatedConf` obj, and replace it.
     */
    function lookupRelatedConfProp(data, callback) {
        /* if the prop is realted conf, then call the callback */
        parser.replaceAllMatchProps(data, function(prop) {
            return prop && prop._RelatedConf;
        }, callback);
    }

    /**
     * Step 3. merge single config object into config hoster
     */
    function mergeToHoster(configItem) {
        expect(configItem).isObject();

        /* if there are any exists `RelatedConf` obj on configHoster, and configItem
            has somepath with other value, then save it */
        lookupRelatedConfProp(configHoster, function(prop, propKey, propPath) {
            var samePathValue = parser.getPropByPath(configItem, propPath);
            if (samePathValue) {
                /** clear this value from configItem */
                parser.setPropByPath(configItem, propPath, undefined);

                /** if the value is an object, then merge directly */
                if (parser.isObject(samePathValue)) {
                    parser.extendAllProps(prop.otherFields, samePathValue);
                } else {
                    /** otherwise overite it */
                    return samePathValue; /* return new value to overwrite */
                }
            }
            return prop;
        });

        /* merge all singelConfObj into configHoster */
        parser.extendAllProps(configHoster, configItem);
    }

    /**
     * 4. once all config has been merged into config hoster, then call this method
     */
    function rebuildHoster() {
        /** inject confObj into confObj prop, if it has the replacer like {{xxx}} */
        parser.parseObject(configHoster, globalField);

        /** the special code for relatedConf object  */
        lookupRelatedConfProp(configHoster, function(prop) {
            var relatedPath, relatedConf;
            try {
                /** load external file from relatedConf obj */
                relatedPath = path.resolve(prop.realtedDir, prop.relatedPath);
                relatedConf = confLoader.load(relatedPath);
            } catch (ex) {
                relatedConf = {
                    _loadException: ex
                };
            }

            // error handling: if other fiels has another conf:// flag, rollback it
            lookupRelatedConfProp(prop.otherFields, function(prop) {
                return prop.originalDesc;
            });

            /** if there are any otehrFields form other config object, merge it */
            parser.extendAllProps(relatedConf, prop.otherFields);

            /** parse all fields with globalField */
            parser.parseObject(relatedConf, globalField);

            /** record original path */
            Object.defineProperty(relatedConf, '_originalPath', {
                value: relatedPath
            });

            return relatedConf;
        });
    }

    Object.defineProperties(this, {

        /**
         * load new config and merge to self
         */
        merge: {
            value: function() {
                var items = [].slice.call(arguments, 0);

                /* 1 ~ 3, create config item and merge to hoster */
                items.forEach(function(item, index) {
                    var confInfo, confData;
                    try {
                        confInfo = loadConfig(item);
                        confData = parseConfig(confInfo.data, confInfo.path);
                        mergeToHoster(confData);

                        monitor(null, confInfo.name, index);
                    } catch (ex) {
                        if (ex.force) {
                            throw ex;
                        }
                        monitor(ex, ex.path || item, index);
                    }
                });

                /* 4. rebuild hoster with merged configs */
                rebuildHoster();
            }
        },

        /**
         * get config field
         */
        getField: {
            value: function(fieldName) {
                if (fieldName === 'global' ) {
                    return this.getGlobal();
                } else {
                    return this[fieldName];
                }
            }
        },

        /**
         * get global filed
         */
        getGlobal: {
            value: function() {
                return _.clone(globalField);
            }
        }
    });

    if (options.test) {
        Object.defineProperties(this, {
            loadConfig: {
                value: loadConfig
            },
            parseConfig: {
                value: parseConfig
            },
            mergeToHoster: {
                value: mergeToHoster
            },
            rebuildHoster: {
                value: rebuildHoster
            }
        });
    }
}

Perrier.create = function createPerrier(options) {
    return new Perrier(options);
};

Perrier.load = confLoader.load;

module.exports = Perrier;
