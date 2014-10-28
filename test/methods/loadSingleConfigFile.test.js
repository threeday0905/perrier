'use strict';

var support = require('../../../support/index');

var expect = require('chai').expect,
    sinon  = require('sinon'),
    path   = support.path;

describe('modules/config config.loadSingleConfig()', function() {
    /*jshint -W030 */

    var infoFactory = require('../../../../lib/modules/info'),
        cfgFactory  = require('../../../../lib/modules/config'),
        logger = require('../../../../lib/logger');

    var info, config;

    beforeEach(function() {
        process.env.NODE_ENV = 'local';

        info   = infoFactory.create();
        config = cfgFactory.create(info);

        sinon.stub(logger, 'warn');
        sinon.stub(logger, 'info');
    });

    afterEach(function() {
        support.reset();
        logger.warn.restore();
        logger.info.restore();
    });

    describe('deal with config object', function() {
        it('data will be itself', function() {
            var conf = { a: 1 },
                result = config._private.loadSingleConfig(conf);

            expect(result.data).to.deep.equal(conf);
            expect(result.available).to.equal(true);
        });

        it('path will be ROOT_PATH', function() {
            var conf = { a: 1 },
                result = config._private.loadSingleConfig(conf);

            expect(result.available).to.equal(true);
            expect(result.path).to.equal(info.getRootPath());
        });
    });

    describe('deal with meta config', function() {
        var defaultConf =
            path.resolve(__dirname, '../../../../meta/express-default.conf'),

            metaPath = path.dirname(defaultConf);

        it('can load default config from meta folder', function() {
            var result = config._private.loadSingleConfig(defaultConf);

            expect(result.available).to.equal(true);
            expect(result.data).to.exist;
            expect(result.path).to.equal(metaPath);
        });

        it('will not log info', function() {
            config._private.loadSingleConfig(defaultConf);
            expect(logger.info.called).to.equal(false);
        });
    });

    describe('deal with app config', function() {
        it('can load absolute file', function() {
            var confFile = path.resolve(__dirname, '../support/sample.conf'),
                result = config._private.loadSingleConfig(confFile);

            expect(result.available).to.equal(true);
            expect(result.data).to.deep.equal({
                foo: 1,
                bar: 2
            });

            expect(result.path).to.equal(
                path.dirname(confFile)
            );
        });

        it('can load relative file', function() {
            var confFile = '../support/sample.conf',
                result = config._private.loadSingleConfig(confFile);

            expect(result.available).to.equal(true);
            expect(result.data).to.deep.equal({
                foo: 1,
                bar: 2
            });

            expect(result.path).to.equal(
                path.dirname(path.resolve(__dirname, confFile))
            );
        });

        it('will log info once loaded', function() {
            config._private.loadSingleConfig('../support/sample.conf');
            expect(logger.info.called).to.equal(true);
        });
    });

    describe('deal with multi config extname', function() {
        it('can auto switch to ".conf"', function() {
            var confFile = path.resolve(__dirname, '../support/sample'),
                result = config._private.loadSingleConfig(confFile);

            expect(result.data).to.deep.equal({
                foo: 1,
                bar: 2
            });
        });
        xit('can auto switch to ".json"');
        xit('can auto switch to ".js"');
    });

    describe('other case', function() {
        it('will return empty info', function() {
            var result = config._private.loadSingleConfig(new Date());
            expect(result.data).to.equal(undefined);
            expect(result.path).to.equal(info.getRootPath());
            expect(result.available).to.equal(false);
        });

        it('will log warning', function() {
            config._private.loadSingleConfig(345);
            expect(logger.warn.called).to.equal(true);
        });
    });
});
