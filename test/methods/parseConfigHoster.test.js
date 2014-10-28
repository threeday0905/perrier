'use strict';

var support = require('../../../support/index');

var expect = require('chai').expect,
    sinon  = require('sinon');

describe('modules/config config.mergeSingleConfig()', function() {
    /*jshint -W030 */

    var infoFactory = require('../../../../lib/modules/info'),
        cfgFactory  = require('../../../../lib/modules/config'),
        logger  = require('../../../../lib/logger');

    var info, config;

    var dirname = support.path.normalize(__dirname);

    beforeEach(function() {
        process.env.NODE_ENV = 'development';
        info   = infoFactory.create();
        config = cfgFactory.create(info);

        sinon.stub(logger, 'error');
    });

    afterEach(function() {
        support.reset();
        logger.error.restore();
    });

    describe('replace with global', function() {
        it('can replace NODE_ENV', function() {
            var configHoster = {
                foo: '{{NODE_ENV}}.world'
            };

            config._private.parseConfigHoster(configHoster);

            expect(configHoster).to.deep.equal({
                foo: 'development.world'
            });
        });

        it('can replace ROOT_PATH', function() {
            var configHoster = {
                foo: '{{NODE_ENV}}/{{ROOT_PATH}}'
            };

            config._private.parseConfigHoster(configHoster);
            expect(configHoster).to.deep.equal({
                foo: 'development/' + dirname
            });
        });

        it('can replace customize global', function() {
            // this method will pullout the global fields
            config._private.parseSingleConfig({
                global: {
                    FOO: 'foo',
                    BAR: 'bar'
                }
            });

            var configHoster = {
                name: '{{FOO}} {{BAR}}'
            };

            config._private.parseConfigHoster(configHoster);
            expect(configHoster).to.deep.equal({
                name: 'foo bar'
            });
        });
    });

    describe('"conf://" flag', function() {
        var configHoster = {};

        beforeEach(function() {
            configHoster = {
                abc: {
                    _isRelatedConf: true,
                    filePath:       '../support/sample.conf',
                    parentPath:     __dirname,
                    otherFields:    {}
                }
            };
        });

        it('can load external file', function() {
            config._private.parseConfigHoster(configHoster);
            expect(configHoster.abc).to.deep.equal({
                foo: 1,
                bar: 2
            });
        });

        it('can extend external file with otherFields', function() {
            configHoster.abc.otherFields = {
                baz: 3
            };

            config._private.parseConfigHoster(configHoster);
            expect(configHoster.abc).to.deep.equal({
                foo: 1,
                bar: 2,
                baz: 3
            });
        });

        it('can replace external file with global fields', function() {
            configHoster.abc.otherFields = {
                status: '{{NODE_ENV}}'
            };

            config._private.parseConfigHoster(configHoster);
            expect(configHoster.abc).to.deep.equal({
                foo: 1,
                bar: 2,
                status: 'development'
            });
        });

        it('will add "_originalPath" field to recored the original path', function() {
            config._private.parseConfigHoster(configHoster);
            expect(configHoster.abc).to.deep.equal({
                foo: 1,
                bar: 2
            });
            expect(configHoster.abc._originalPath).to.equal(
                support.path.resolve(__dirname, '../support/sample.conf')
            );
        });

        it('will return empty object if path is not exists', function() {
            configHoster = {
                abc: {
                    _isRelatedConf: true,
                    filePath:       '../support/not-exists.conf',
                    parentPath:     __dirname,
                    otherFields:    {}
                }
            };

            config._private.parseConfigHoster(configHoster);
            expect(configHoster.abc).is.exist;
            expect(configHoster.abc._loadFailed).to.equal(true);
        });

        it('will log error if path is not exists', function() {
            configHoster = {
                abc: {
                    _isRelatedConf: true,
                    filePath:       '../support/not-exists.conf',
                    parentPath:     __dirname,
                    otherFields:    {}
                }
            };

            config._private.parseConfigHoster(configHoster);
            expect(logger.error.called).to.equal(true);
        });
    });
});
