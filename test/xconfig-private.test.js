'use strict';

var expect = require('chai').expect,
    path   = require('path');

describe('perrier.js / private methods', function() {
    /* jshint -W024, -W030 */

    var Perrier = require('../index'),
        getSupportFile = function(name) {
            return path.join(__dirname, 'supports/config', name);
        };

    var config;

    beforeEach(function() {
        config = new Perrier({
            test: true, /* special config to export private methos */
            rootPath: __dirname,
            globalFields: {
                NODE_ENV: 'local'
            }
        });
    });

    describe('step 1. loadConfig() ', function() {
        var loadConfig;

        beforeEach(function() {
            loadConfig = config.loadConfig;
        });

        describe('deal with config object', function() {
            it('will asign object to data field', function() {
                var conf = { a: 1 },
                    result = loadConfig(conf);

                expect(result.data).to.deep.equal(conf);
            });

            it('will assign rootPath to path field', function() {
                var conf = { a: 1 },
                    result = loadConfig(conf);

                expect(result.path).to.equal(__dirname);
            });
        });

        describe('deal with meta config', function() {
            var confPath = getSupportFile('sample.conf'),
                confDir = path.dirname(confPath);

            it('can load default config from meta folder', function() {
                var result = loadConfig(confPath);

                expect(result.data).to.exist;
                expect(result.path).to.equal(confDir);
            });
        });

        describe('deal with app config', function() {
            it('can load absolute file', function() {
                var confPath = getSupportFile('sample.conf'),
                    result = loadConfig(confPath);

                expect(result.data).to.deep.equal({
                    foo: 1,
                    bar: 2
                });

                expect(result.path).to.equal(
                    path.dirname(confPath)
                );
            });

            it('can load relative file', function() {
                var confPath = './supports/config/sample.conf',
                    result = loadConfig(confPath);

                expect(result.data).to.deep.equal({
                    foo: 1,
                    bar: 2
                });

                expect(result.path).to.equal(
                    path.dirname(path.resolve(__dirname, confPath))
                );
            });
        });

        describe('deal with multi config extname', function() {
            it('can auto switch to ".conf"', function() {
                var confPath = getSupportFile('sample'),
                    result = loadConfig(confPath);

                expect(result.data).to.deep.equal({
                    foo: 1,
                    bar: 2
                });
            });
        });

        describe('error handling', function() {
            it('can only deal with plain object', function() {
                expect(function() {
                    loadConfig(new Date());
                }).to.throw(/non-supported type/);

                expect(function() {
                    loadConfig(12345);
                }).to.throw(/non-supported type/);
            });
        });
    });

    describe('step 2. parseConfig() ', function() {
        var parseConfig;

        beforeEach(function() {
            parseConfig = config.parseConfig;
        });

        it('the global fields will be pullout', function() {
            var source, result, global;

            source = {
                global: {
                    foo: 1
                },
                bar: 2
            };

            result = parseConfig(source, __dirname);
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

                result = parseConfig(source, __dirname);

                expect(source.foo).to.deep.equal({
                    _RelatedConf: true,
                    relatedPath:  '../support/sample.conf',
                    realtedDir:   __dirname,
                    otherFields:  {},
                    originalDesc: 'conf:../support/sample.conf'
                });
            });

            it('file path will be trim', function() {
                var source, result;
                source = {
                    foo: 'conf:  ../support/sample.conf  '
                };

                result = parseConfig(source, __dirname);
                expect(result.foo.relatedPath).to.equal('../support/sample.conf');
            });

            it('parent path default to rootPath', function() {
                var source, result;
                source = {
                    foo: 'conf:../support/sample.conf'
                };
                result = parseConfig(source);

                expect(result.foo.realtedDir).to.equal(__dirname);
            });
        });
    });

    describe('step 3. mergeToHoster() ', function() {
        describe('"conf://" flag', function() {
            beforeEach(function() {
                config.foo = {
                    _RelatedConf: true,
                    realtedDir:   __dirname,
                    relatedPath:  '../support/sample.conf',
                    otherFields:  {}
                };
            });

            it('will do nothing if target is not related', function() {
                var targetConfig = {
                    bar: 1
                };

                config.mergeToHoster(targetConfig);

                expect(config.bar).to.equal(1);
                expect(config.foo).to.deep.equal({
                    _RelatedConf: true,
                    realtedDir:   __dirname,
                    relatedPath:  '../support/sample.conf',
                    otherFields:  {}
                });
            });

            it('will merge to otherField prop and remove from target', function() {
                var targetConfig = {
                    foo: {
                        bar: 1
                    }
                };

                config.mergeToHoster(targetConfig);

                expect(config.foo.otherFields.bar).to.equal(1);
                expect(targetConfig.foo).to.equal(undefined);
            });

            it('can mixin multi times', function() {
                config.mergeToHoster({
                    foo: {
                        bar: 1
                    }
                });

                config.mergeToHoster({
                    foo: {
                        baz: {
                            a: 1
                        }
                    }
                });

                expect(config.foo.otherFields)
                    .to.deep.equal({
                        bar: 1,
                        baz: {
                            a: 1
                        }
                    });
            });

            it('will overwirte, if target contain non-obj value', function() {
                config.mergeToHoster({
                    foo: 123
                });

                expect(config.foo).to.equal(123);
            });
        });

        describe('merge other fields', function() {
            it('will do normal merge', function() {
                config.foo = 1;
                config.baz = {
                    a: 1
                };

                config.mergeToHoster({
                    bar: 2,
                    baz: {
                        b: 2
                    }
                });

                expect(config).to.deep.equal({
                    foo: 1,
                    bar: 2,
                    baz: {
                        a: 1,
                        b: 2
                    }
                });
            });

            it('will ignore the "conf://" flag', function() {
                config.foo = {
                    _RelatedConf: true,
                    realtedDir:   __dirname,
                    relatedPath:  './supports/config/sample.conf',
                    otherFields:  {}
                };

                config.mergeToHoster({
                    foo: {
                        a: 1
                    },
                    bar: {
                        b: 2
                    }
                });

                expect(config).to.deep.equal({
                    foo: {
                        _RelatedConf: true,
                        realtedDir:   __dirname,
                        relatedPath:  './supports/config/sample.conf',
                        otherFields:  {
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

    describe('step 4. rebuildHoster() ', function() {
        describe('replace with global', function() {
            it('can replace NODE_ENV', function() {
                config.foo = {
                    bar: '{{NODE_ENV}}.world'
                };

                config.rebuildHoster();

                expect(config.foo).to.deep.equal({
                    bar: 'local.world'
                });
            });

            it('can replace customize global', function() {
                // this method will pullout the global fields
                config.parseConfig({
                    global: {
                        FOO: 'foo',
                        BAR: 'bar'
                    }
                });

                config.name = '{{FOO}} {{BAR}}';

                config.rebuildHoster();
                expect(config).to.deep.equal({
                    name: 'foo bar'
                });
            });
        });

        describe('"conf://" flag', function() {
            beforeEach(function() {
                config.foo = {
                    _RelatedConf: true,
                    realtedDir:   __dirname,
                    relatedPath:  './supports/config/sample.conf',
                    otherFields:  {}
                };
            });

            it('can load external file', function() {
                config.rebuildHoster();
                expect(config.foo).to.deep.equal({
                    foo: 1,
                    bar: 2
                });
            });

            it('can extend external file with otherFields', function() {
                config.foo.otherFields = {
                    baz: 3
                };

                config.rebuildHoster();
                expect(config.foo).to.deep.equal({
                    foo: 1,
                    bar: 2,
                    baz: 3
                });
            });

            it('can replace external file with global fields', function() {
                config.foo.otherFields = {
                    baz: '{{NODE_ENV}}'
                };

                config.rebuildHoster();
                expect(config.foo).to.deep.equal({
                    foo: 1,
                    bar: 2,
                    baz: 'local'
                });
            });

            it('will add "_originalPath" field', function() {
                config.rebuildHoster();

                expect(config.foo._originalPath).to.equal(
                    path.resolve(__dirname, './supports/config/sample.conf')
                );
            });

            it('will return empty object if path is not exists', function() {
                config.bar = {
                    _RelatedConf: true,
                    realtedDir:   __dirname,
                    relatedPath:  './supports/config/non-exist.conf',
                    otherFields:  {}
                };

                config.rebuildHoster();
                expect(config.bar).is.exist;
                expect(config.bar._loadException).is.exist;
                expect(config.bar._loadException.code).to.equal('MODULE_NOT_FOUND');
            });
        });
    });
});
