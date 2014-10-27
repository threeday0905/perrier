'use strict';

var _ = require('lodash'),
    parser = require('obj-parser');

/**
 *  Global Field
 *  @constructor
 *  @param {object} options.readonlyFields
 *  @param {object} options.pulloutName
 */
function Global(options) {
    options = options || {};

    var protectFields = [],
        pulloutName = 'global';

    /* those fields will be readonly fields */
    if (_.isPlainObject(options.readonlyFields)) {
        protectFields = Object.keys(options.readonlyFields);
        _.assign(this, options.readonlyFields);
    }

    /* use to pullout */
    if (options.pulloutName) {
        pulloutName = String(options.pulloutName);
    }

    Object.defineProperties(this, {

        /**
         * update self fields from source
         * @param {Object} source
         */
        update: { /* enumerable, writeable, configurable: false */
            value: function(source) {
                if (!_.isPlainObject(source)) {
                    return;
                }

                var data = _.cloneDeep(source);

                /** should not overwrite protect fields */
                if (protectFields.length) {
                    _.each(protectFields, function(protectPropName) {
                        var targetField = data[protectPropName];
                        if (targetField && targetField !== this[protectPropName]) {
                            delete data[protectPropName];
                            console.warn(
                                '[xconf] should not overwrite global field: %s' +
                                ', ignore global update process', protectPropName);
                        }
                    }, this);
                }

                /** should not add dynamic replacer into global */
                parser.replaceAllStrProps(data, function(prop) {
                    return parser.parseString(prop, function(match, name) {
                        var breakValue = '__' + name + '__';
                        console.warn(
                            '[xconf] global fields not allow dynamic replacer: %s' +
                            ', break to: %s', match, breakValue);
                        return breakValue;
                    });
                });

                /** mixin data on this */
                _.assign(this, data);
                return this;
            }
        },

        /**
         * extract the target field into self, and delete it from source
         * @param {Object} source
         */
        pullout: { /* enumerable, writeable, configurable: false */
            value: function(source) {
                var targetField = source && source[pulloutName];
                if (_.isPlainObject(targetField)) {
                    this.update(targetField);
                    delete source[pulloutName];
                }
            }
        }
    });
}

Global.create = function createGlobalField(fields) {
    return new Global(fields);
};

module.exports = Global;
