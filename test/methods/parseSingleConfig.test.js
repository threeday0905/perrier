'use strict';

var support = require('../../../support/index');

var expect = require('chai').expect;

describe('modules/config config.parseSingleConfig()', function() {
    /*jshint -W030 */

    var infoFactory = require('../../../../lib/modules/info'),
        cfgFactory  = require('../../../../lib/modules/config');

    var info, config;

    beforeEach(function() {
        info   = infoFactory.create();
        config = cfgFactory.create(info);
    });

    afterEach(support.reset);

    it('the global fields will be pullout', function() {
        var source, result, global;

        source = {
            global: {
                foo: 1
            },
            bar: 2
        };

        result = config._private.parseSingleConfig(source, __dirname);
        global = config.getGlobal();

        expect(source).to.deep.equal({
            bar: 2
        });
        expect(global.foo).to.equal(1);
    });

    describe('"conf://" flag', function() {
        it('will be replaced with hook', function() {
            var source, result;
            source = {
                foo: 'conf:../support/sample.conf'
            };

            result = config._private.parseSingleConfig(source, __dirname);

            expect(source.foo).to.deep.equal({
                _isRelatedConf: true,
                filePath: '../support/sample.conf',
                parentPath: __dirname,
                otherFields: {},
                originalDesc: 'conf:../support/sample.conf'
            });
        });

        it('file path will be trim', function() {
            var source, result;
            source = {
                foo: 'conf:  ../support/sample.conf  '
            };

            result = config._private.parseSingleConfig(source, __dirname);
            expect(result.foo.filePath).to.equal('../support/sample.conf');
        });

        it('parent path default to rootPath', function() {
            var source, result;
            source = {
                foo: 'conf:../support/sample.conf'
            };
            result = config._private.parseSingleConfig(source);

            expect(result.foo.parentPath).to.equal(info.getRootPath());
        });
    });
});
