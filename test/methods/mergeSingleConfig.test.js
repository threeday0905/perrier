'use strict';

var support = require('../../../support/index');

var expect = require('chai').expect;

describe('modules/config config.mergeSingleConfig()', function() {
    /*jshint -W030 */

    var infoFactory = require('../../../../lib/modules/info'),
        cfgFactory  = require('../../../../lib/modules/config');

    var info, config;

    beforeEach(function() {
        info   = infoFactory.create();
        config = cfgFactory.create(info);
    });

    afterEach(support.reset);

    describe('"conf://" flag', function() {
        var configHoster;
        beforeEach(function() {
            configHoster = {
                foo: {
                    _isRelatedConf: true,
                    filePath:       '../support/sample.conf',
                    parentPath:     __dirname,
                    otherFields:    {}
                }
            };
        });

        it('will do nothing if target is not related', function() {
            var targetConfig = {
                bar: 1
            };

            config._private.mergeSingleConfig(configHoster, targetConfig);

            expect(configHoster.foo).to.deep.equal({
                _isRelatedConf: true,
                filePath:       '../support/sample.conf',
                parentPath:     __dirname,
                otherFields:    {}
            });
        });

        it('will pullout if target has same prop', function() {
            var targetConfig = {
                foo: {
                    bar: 1
                }
            };

            config._private.mergeSingleConfig(configHoster, targetConfig);

            expect(targetConfig.foo).to.equal(undefined);
        });

        it('target\'s same prop will be merged to otherField prop', function() {
            var targetConfig = {
                foo: {
                    bar: 1
                }
            };

            config._private.mergeSingleConfig(configHoster, targetConfig);
            expect(configHoster.foo.otherFields.bar).to.equal(1);
        });

        it('otherFields can be mixin multi times', function() {
            config._private.mergeSingleConfig(configHoster, {
                foo: {
                    bar: 1
                }
            });

            config._private.mergeSingleConfig(configHoster, {
                foo: {
                    baz: {
                        a: 1
                    }
                }
            });

            expect(configHoster.foo.otherFields.bar).to.equal(1);
            expect(configHoster.foo.otherFields)
                .to.deep.equal({
                    bar: 1,
                    baz: {
                        a: 1
                    }
                });
        });

        it('target`s same prop will overwrite, if it is not a object', function() {
            config._private.mergeSingleConfig(configHoster, {
                foo: 123
            });

            expect(configHoster.foo).to.equal(123);
        });
    });

    describe('merge other fields', function() {
        it('will do normal merge', function() {
            var configHoster = {
                foo: 1,
                baz: {
                    a: 1
                }
            };

            config._private.mergeSingleConfig(configHoster, {
                bar: 2,
                baz: {
                    b: 2
                }
            });

            expect(configHoster).to.deep.equal({
                foo: 1,
                bar: 2,
                baz: {
                    a: 1,
                    b: 2
                }
            });
        });

        it('will ignore the "conf://" flag', function() {
            var configHoster = {
                foo: {
                    _isRelatedConf: true,
                    filePath:       '../support/sample.conf',
                    parentPath:     __dirname,
                    otherFields:    {}
                }
            };

            config._private.mergeSingleConfig(configHoster, {
                foo: {
                    a: 1
                },
                bar: {
                    b: 2
                }
            });

            expect(configHoster).to.deep.equal({
                foo: {
                    _isRelatedConf: true,
                    filePath:       '../support/sample.conf',
                    parentPath:     __dirname,
                    otherFields:    {
                        a: 1
                    }
                },
                bar: {
                    b: 2
                }
            });
        });
    });
});
