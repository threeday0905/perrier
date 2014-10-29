'use strict';

var Perrier = require('../../index');

var config = new Perrier({
    rootPath: __dirname + '/../sample/config',
    monitor: function monitor(err, file, idx) {
        if (err) {
            var code = err.code;
            console.error('%s. load "%s" fail, caused by: %s', idx, file, code);
        } else {
            console.log('%s. load "%s" success', idx, file);
        }
        console.log();
    }
});

console.log('you can use monitor fn to see the merge process\n');

config.merge(
    'base.json',
    'production.json',
    'non-exist.json'
);
