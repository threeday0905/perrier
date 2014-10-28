'use strict';

var expect = require('chai').expect,
    sinon  = require('sinon'),
    path   = require('path');

describe('conf-loader.js', function() {
    /*jshint -W030, -W024 */

    var confLoader = require('../lib/conf-loader');

    var normalize = path.normalize,
        getSupportFile = function(name) {
            return path.join(__dirname, 'supports/conf-loader', name);
        };

    describe('resolve()', function() {
        var isWindows = /^win/.test(process.platform);

        var resolve = confLoader.resolve;

        describe('windows platform', function() {
            if (!isWindows) {
                return;
            }

            var cwdPath = 'C:\\home\\midway\\cwd',
                appPath = 'C:\\home\\midway';

            before(function() {
                sinon.stub(process, 'cwd').returns(cwdPath);
            });

            after(function() {
                process.cwd.restore();
            });

            it('should return directly, if file name is full', function() {
                var result = resolve('C:\\home\\midway\\config\\base.conf', appPath),
                    expectPath = normalize('C:\\home\\midway\\config\\base.conf');

                expect(result).to.equal(expectPath);
            });

            it('should resolve with rootPath, if file name is relative', function() {
                var result = resolve('./config/base.conf', appPath),
                    expectPath = normalize('C:\\home\\midway\\config\\base.conf');

                expect(result).to.equal(expectPath);
            });

            it('should add extname, if extname not provided', function() {
                var result = resolve('./config/base', appPath),
                    expectPath = normalize('C:\\home\\midway\\config\\base.conf');

                expect(result).to.equal(expectPath);
            });

            it('should keep extname, if extname is not ".conf"', function() {
                var result = resolve('./config/base.json', appPath),
                    expectPath = normalize('C:\\home\\midway\\config\\base.json');

                expect(result).to.equal(expectPath);
            });

            it('should resolve with cwd, if rootPath not provided', function() {
                var result = resolve('./config/base.conf'),
                    expectPath = normalize('C:\\home\\midway\\cwd\\config\\base.conf');

                expect(result).to.equal(expectPath);
            });
        });

        describe('unix like platform', function() {
            if (isWindows) {
                return;
            }

            var cwdPath = '/home/midway/cwd',
                appPath = '/home/midway';

            before(function() {
                sinon.stub(process, 'cwd').returns(cwdPath);
            });

            after(function() {
                process.cwd.restore();
            });

            it('should directly return, if file name is full', function() {
                var result = resolve('/home/midway/config/base.conf', appPath);
                expect(result).to.equal('/home/midway/config/base.conf');
            });

            it('should resolve with rootPath, if file name is relative', function() {
                var result = resolve('./config/base.conf', appPath);
                expect(result).to.equal('/home/midway/config/base.conf');
            });

            it('should add extname, if extname not provided', function() {
                var result = resolve('./config/base', appPath);
                expect(result).to.equal('/home/midway/config/base.conf');
            });

            it('should keep extname, if expect is not ".conf"', function() {
                var result = resolve('./config/base.json', appPath);
                expect(result).to.equal('/home/midway/config/base.json');
            });

            it('should resolve with cwd, if rootPath not provided', function() {
                var result = resolve('./config/base.conf');
                expect(result).to.equal('/home/midway/cwd/config/base.conf');
            });
        });
    });

    describe('loadXJSON()', function() {
        var loadXJSON = confLoader.loadXJSON;

        var confSample = {
                a: '1',
                b: 10,
                c: {
                    d: true
                }
            };

        it('can parse json file', function() {
            var result = loadXJSON(getSupportFile('sample.json'));
            expect(result).to.deep.equal(confSample);
        });

        it('can parse json-like conf file', function() {
            var result = loadXJSON(getSupportFile('sample.conf'));
            expect(result).to.deep.equal(confSample);
        });

        it('can parse json-with-comment conf file', function() {
            var result = loadXJSON(getSupportFile('json-with-comment.conf'));
            expect(result).to.deep.equal(confSample);
        });

        it('can parse json-with-jsexp conf file', function() {
            var result = loadXJSON(getSupportFile('json-with-jsexp.conf'));
            expect(result).to.deep.equal(confSample);
        });

        it('can parse conf with function', function() {
            var result = loadXJSON(getSupportFile('json-with-fn.conf'));
            expect(result.fn()).to.equal(1);
        });

        it('can throw MODULE_PARSE_FAILED error if file has error format', function() {
            var result, ex;
            try {
                result = loadXJSON(getSupportFile('syntax-error.conf'));
            } catch (e) {
                ex = e;
            }

            expect(result).to.not.exist;
            expect(ex).to.exist;
            expect(ex.code).to.equal('MODULE_PARSE_FAILED');
        });

        it('can throw MODULE_NOT_FOUND error, if file is not exists', function() {
            var result, ex;
            try {
                result = loadXJSON(getSupportFile('file-not-exists.conf'));
            } catch (e) {
                ex = e;
            }

            expect(result).to.equal(undefined);
            expect(ex).to.not.equal(undefined);
            expect(ex.code).to.equal('MODULE_NOT_FOUND');
        });

        it('can remove bom', function() {
            var result = loadXJSON(getSupportFile('utf8-bom.conf'));
            expect(result).to.exist;
        });
    });

    describe('load()', function() {
        var load   = confLoader.load;

        var confSample = {
                a: '1',
                b: 10,
                c: {
                    d: true
                }
            };

        describe('Normal Load: ', function() {
            it('should load ".js" file', function() {
                var result = load(getSupportFile('sample.js'));
                expect(result).to.deep.equal(confSample);
            });

            it('should load ".json" file', function() {
                var result = load(getSupportFile('sample.json'));
                expect(result).to.deep.equal(confSample);
            });

            it('should load ".conf" file', function() {
                var result = load(getSupportFile('json-with-jsexp.conf'));
                expect(result).to.deep.equal(confSample);
            });
        });

        describe('Error Handling: ', function() {
            function tryLoad(name) {
                try {
                    load( getSupportFile(name) );
                } catch (ex) {
                    return ex;
                }
            }

            it('should throw MODULE_NOT_FOUND ex, if ".conf" not exists', function() {
                var ex = tryLoad('not-exists.conf');
                expect(ex).to.exist;
                expect(ex.code).to.equal('MODULE_NOT_FOUND');
            });

            it('should throw MODULE_NOT_FOUND ex, if ".js" not exists', function() {
                var ex = tryLoad('not-exists.js');
                expect(ex.code).to.equal('MODULE_NOT_FOUND');
            });

            it('should throw MODULE_NOT_FOUND ex, if ".json" not exists', function() {
                var ex = tryLoad('not-exists.json');
                expect(ex.code).to.equal('MODULE_NOT_FOUND');
            });

            it('should throw MODULE_PARSE_FAILED ex, if conf parse fail', function() {
                var ex = tryLoad('syntax-error.conf');
                expect(ex.code).to.equal('MODULE_PARSE_FAILED');
            });

            it('should throw MODULE_PARSE_FAILED ex, if json parse fail', function() {
                var ex = tryLoad('syntax-error.json');
                expect(ex.code).to.equal('MODULE_PARSE_FAILED');
            });
        });

        describe('extname: ', function() {
            it('should throw error if extname is not supported', function() {
                expect(function() {
                    load(getSupportFile('sample.pdf'));
                }).to.throw();
            });

            it('should add ".conf" extname if extname is not provided', function() {
                var result1 = load(getSupportFile('sample')),
                    result2 = load(getSupportFile('sample.conf'));

                expect(result1).to.deep.equal(result2);
            });
        });

        describe('rootPath: ', function() {
            before(function() {
                sinon.stub(process, 'cwd').returns(__dirname);
            });

            after(function() {
                process.cwd.restore();
            });

            it('can load related conf file with rootPath', function() {
                var result1 = load(getSupportFile('json-with-jsexp.conf', __dirname)),
                    result2 = load(getSupportFile('sample.json', __dirname)),
                    result3 = load(getSupportFile('sample.js', __dirname));

                expect(result1).is.exist;
                expect(result2).is.exist;
                expect(result3).is.exist;
            });

            it('can resolve with process.cwd if root path not provided', function() {
                var result1 = load(getSupportFile('json-with-jsexp.conf')),
                    result2 = load(getSupportFile('sample.json')),
                    result3 = load(getSupportFile('sample.js'));

                expect(result1).is.exist;
                expect(result2).is.exist;
                expect(result3).is.exist;
            });
        });
    });
});
