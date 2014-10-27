'use strict';

var globalFieldFactory = require('../lib/global-field');

var expect = require('chai').expect,
    sinon  = require('sinon');

describe('modules/config [Global]', function() {
    /* jshint -W024, -W030 */
    var globalField, defaultValue;

    beforeEach(function() {
        defaultValue = {
            NODE_ENV:  'local',
            ROOT_PATH: __dirname
        };

        globalField = globalFieldFactory.create({
            readonlyFields: defaultValue
        });
    });

    describe('init()', function() {
        it('can create global without env fields', function() {
            var value = globalFieldFactory.create();
            expect(value).is.exists;
        });

        it('should create global config based on env fields', function() {
            expect(globalField).to.deep.equal(defaultValue);
        });

        it('should clone env fields', function() {
            expect(globalField.NODE_ENV).to.equal(defaultValue.NODE_ENV);
            defaultValue.NODE_ENV = 'another';

            expect(globalField.NODE_ENV).to.not.equal(defaultValue.NODE_ENV);
        });
    });

    describe('update(): ', function() {
        beforeEach(function() {
            sinon.stub(console, 'warn');
        });

        afterEach(function() {
            console.warn.restore();
        });

        it('should update itself', function() {
            globalField.update({
                a: 'foo',
                b: 'bar'
            });

            expect(globalField.a).to.equal('foo');
            expect(globalField.b).to.equal('bar');
        });

        it('should not modify readonly fields', function() {
            globalField.update({
                NODE_ENV: 'abc'
            });

            expect(console.warn.called).to.equal(true);
            expect(globalField.NODE_ENV).to.equal(defaultValue.NODE_ENV);
            expect(globalField.NODE_ENV).to.not.equal('abc');
        });

        it('should not warn, if contain readonly field with same value', function() {
            globalField.update({
                NODE_ENV: defaultValue.NODE_ENV
            });

            expect(console.warn.called).to.equal(false);
            expect(globalField.NODE_ENV).to.equal(defaultValue.NODE_ENV);
        });

        it('should break dynamic replacer, e.g. {{replace}}', function() {
            globalField.update({
                a: '{{foo}}'
            });

            expect(console.warn.called).to.equal(true);
            expect(globalField.a).to.equal('__foo__');
        });

        it('should not affect origin data', function() {
            var data = {
                NODE_ENV: 'abc',
                a: '{{foo}}'
            };
            globalField.update(data);

            expect(data).to.deep.equal({
                NODE_ENV: 'abc',
                a: '{{foo}}'
            });
        });

        it('should do nothing, if data is not a object', function() {
            globalField.update('abcd');
            expect(globalField).to.deep.equal(defaultValue);
        });

        it('should do nothing, if data is not a plain object', function() {
            globalField.update(new Date());
            expect(globalField).to.deep.equal(defaultValue);
        });
    });

    describe('pullout()', function() {
        it('will pullout global fields from in-arg', function() {
            var target = {
                global: {
                    foo: 1
                },
                bar: 2
            };

            globalField.pullout(target);

            expect(globalField.foo).to.equal(1);
            expect(target.global).to.not.exists;
        });

        it('should donothing, if target does contains global field', function() {
            var target = {
                foo: 1
            };

            globalField.pullout(target);
            expect(target).to.deep.equal({
                foo: 1
            });
        });

        it('can config pullout field name', function() {
            var field2 = globalFieldFactory.create({
                pulloutName: 'test'
            });

            var target = {
                test: {
                    foo: 1
                },
                global: {
                    foo: 2
                },
                bar: 2
            };

            field2.pullout(target);

            expect(field2.foo).to.equal(1);
            expect(target.test).to.not.exists;
            expect(target.global).to.exists;
        });
    });
});
