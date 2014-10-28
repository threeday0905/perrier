'use strict';

var expect = require('chai').expect,
    sinon  = require('sinon'),
    path   = require('path');

describe('xconfig.js', function() {
    /* jshint -W024, -W030 */

    var XConfig = require('../index'),
        getSupportFile = function(name) {
            return path.join(__dirname, 'supports/xconfig', name);
        };

    var config;

    describe('init()', function() {
        it('has two way to init', function() {
            var conf1 = new XConfig(),
                conf2 = XConfig.create();

            conf1.merge({ foo: 1 });
            conf2.merge({ foo: 1 });

            expect(conf1).to.deep.equal(conf2);
        });
    });

    describe('getFields()', function() {
        beforeEach(function() {
            config = new XConfig();
        });

        it('should get undefined, if field is not exist', function() {
            var notExist = config.getField('not-exists');
            expect(notExist).to.equal(undefined);
        });

        it('can get exist field', function() {
            config.merge({
                a: 1
            });
            expect(config.getField('a')).to.equal(1);
        });
    });

    describe('getGlobal()', function() {
        beforeEach(function() {
            config = new XConfig({
                globalFields: {
                    NODE_ENV: 'production'
                }
            });
        });

        it('can get global', function() {
            var global = config.getGlobal();
            expect(global).to.deep.equal({
                NODE_ENV: 'production'
            });
        });

        it('can get global by getField', function() {
            var global = config.getField('global');
            expect(global).to.deep.equal(config.getGlobal());
        });
    });

    describe('merge()', function() {
        beforeEach(function() {
            config = new XConfig({
                rootPath: __dirname,
                globalFields: {
                    NODE_ENV: 'production'
                }
            });
        });

        it('can do a complex merge', function() {
            config.merge(
                getSupportFile('merge-first.conf'),
                getSupportFile('merge-second.conf'),
                {
                    second: {
                        baz: 3
                    },
                    external: {
                        type: 'male'
                    },
                    third: 3
                }
            );

            expect(config).to.deep.equal({
                first: 1, //from merge-first.conf
                second: {
                    foo: 2, // from merge-second.conf
                    bar: 1, // from merge-first.conf
                    baz: 3  // from runtime config
                },

                // defined on merge-first.conf, loaded from external-withglobal.conf
                external: {
                    name: 'herman lee',   //defined on external-withglobal.conf
                    status: 'production', //replaced with global fields
                    phone: 12345, //mixin from merge-second.conf
                    type: 'male'  //mixin from runtime config
                },
                third: 3 // from runtime config
            });
        });

        it('can do multi times merge', function() {
            config.merge(
                getSupportFile('merge-first.conf'),
                getSupportFile('merge-second.conf'),
                {
                    second: {
                        baz: 3
                    },
                    external: {
                        type: 'male'
                    },
                    third: 3
                }
            );

            config.merge({
                first:    'updated',
                second:   'updated',
                external: 'updated',
                third:    'updated'
            });

            expect(config).to.deep.equal({
                first:    'updated',
                second:   'updated',
                external: 'updated',
                third:    'updated'
            });
        });

        it('can parser replacer non-sequential on one merge', function() {
            config.merge(
                // 1. this arg require global fields
                getSupportFile('case-related-other.conf'),
                {
                    global: { //2. defined global fields on second args
                        FIRST_NAME: 'foo',
                        LAST_NAME:  'bar'
                    }
                }
            );

            expect(config).to.deep.equal({
                foo: {
                    name:   'foo bar',
                    status: 'production'
                }
            });
        });

        it('can parser replacer non-sequential on two merge', function() {
            config.merge(
                // 1. this arg require global fields
                getSupportFile('case-related-other.conf')
            );

            config.merge({
                global: { //2. defined global fields on second args
                    FIRST_NAME: 'foo',
                    LAST_NAME:  'bar'
                }
            });

            expect(config).to.deep.equal({
                foo: {
                    name:   'foo bar',
                    status: 'production'
                }
            });
        });

        it('can use monitor method to observe load process (1)', function() {
            var monitor = sinon.stub();

            var firstPath = getSupportFile('merge-first.conf'),
                secondPath = getSupportFile('merge-second.conf');

            config.merge(
                firstPath, secondPath,
                monitor /* latest arg can be a monitor method*/
            );

            var firstCall = monitor.firstCall,
                secondCall = monitor.secondCall;

            expect(firstCall.calledWith(  null, 0, firstPath)).to.be.true;
            expect(secondCall.calledWith( null, 1, secondPath)).to.be.true;
        });

        it('can use monitor method to observe load process (2)', function() {
            var monitor = sinon.stub();

            var firstPath = getSupportFile('merge-first.conf'),
                secondPath = getSupportFile('merge-second.conf');

            config.merge(
                getSupportFile('merge-first'), /* ignore extname */
                './supports/xconfig/merge-second.conf', /* relative path*/
                {
                    third: 3 /* annonymous object */
                },
                monitor /* latest arg can be a monitor method*/
            );

            var firstCall  = monitor.firstCall,
                secondCall = monitor.secondCall,
                thirdCall  = monitor.thirdCall;

            expect(firstCall.calledWith(  null, 0, firstPath)).to.be.true;
            expect(secondCall.calledWith( null, 1, secondPath)).to.be.true;
            expect(thirdCall.calledWith(  null, 2, 'anonymous')).to.be.true;
        });

        it('can use monitor method to observe load process (3)', function() {
            var monitor = sinon.stub();

            config.merge(
                getSupportFile('merge-first.conf'),
                getSupportFile('non-exist.conf'),
                monitor /* latest arg can be a monitor method*/
            );

            var err = monitor.secondCall.args[0];
            expect(err).to.be.instanceof(Error);
            expect(err.code).to.equal('MODULE_NOT_FOUND');
            expect(err.message).to.contain('non-exist');
        });

        it('can use monitor method to observe load process (4)', function() {
            var monitor = sinon.stub();

            config.merge(123, monitor);

            var err = monitor.firstCall.args[0];
            expect(err).to.be.instanceof(Error);
            expect(err.message).to.contain('non-supported type');
        });
    });

    describe('load external file, ', function() {
        beforeEach(function() {
            config = new XConfig({
                confFlag: 'conf:',
                rootPath: __dirname,
                globalFields: {
                    NODE_ENV: 'production',
                    ROOT_PATH: __dirname
                }
            });
        });

        describe('from config file, ', function() {
            it('supports absolute path', function() {
                config.merge(
                    getSupportFile('load-foo-abs-path.conf')
                );

                expect(config).to.deep.equal({
                    data: {
                        foo: 1,
                        bar: 2
                    }
                });
            });

            it('supports relative path', function() {
                config.merge(
                    getSupportFile('load-foo-rel-path.conf')
                );

                expect(config).to.deep.equal({
                    data: {
                        foo: 1,
                        bar: 2
                    }
                });
            });
        });

        describe('from config object', function() {
            it('supports absolute path', function() {
                config.merge({
                    data: 'conf:' + getSupportFile('sample.conf')
                });

                expect(config).to.deep.equal({
                    data: {
                        foo: 1,
                        bar: 2
                    }
                });
            });

            it('supports relative path', function() {
                config.merge({
                    data: 'conf:./supports/xconfig/sample.conf'
                });

                expect(config).to.deep.equal({
                    data: {
                        foo: 1,
                        bar: 2
                    }
                });
            });
        });
    });

    describe('error handling', function() {
        beforeEach(function() {
            config = new XConfig({
                rootPath: __dirname
            });
        });

        it('can handle related file overwritten', function() {
            config.merge(
                getSupportFile('merge-first.conf'),
                {
                    external: 'overwrite'
                }
            );

            expect(config.external).to.equal('overwrite');
        });

        it('can handle global-not-exists error', function() {
            config.merge(
                getSupportFile('case-withglobal.conf')
            );

            expect(config).to.deep.equal({
                name: '{{FIRST_NAME}} {{LAST_NAME}}',
                status: '{{NODE_ENV}}'
            });
        });

        describe('deal with recursive "conf:" flag', function() {
            it(' defined on related file', function() {
                config.merge({
                    data: 'conf: ./supports/xconfig/case-related-other.conf'
                });

                expect(config).to.deep.equal({
                    data: {
                        foo: 'conf: ./case-withglobal.conf'
                    }
                });
            });

            it(' defined on oteher fields', function() {
                config.merge(
                {
                    data: 'conf: ./supports/xconfig/sample.conf'
                },
                {
                    data: {
                        baz: 'conf: ./supports/xconfig/sample.conf'
                    }
                });

                expect(config).to.deep.equal({
                    data: {
                        foo: 1,
                        bar: 2,
                        baz: 'conf: ./supports/xconfig/sample.conf'
                    }
                });
            });
        });
    });
});
