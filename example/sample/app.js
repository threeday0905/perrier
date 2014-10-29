var Perrier = require('../../index');

/* load config for production server */
var prodConfig = new Perrier({
    rootPath: __dirname + '/config'
});

prodConfig.merge(
    'base.json',
    'production.json'
);
console.log('if app is running on production server, config will looks like below');
console.log(JSON.stringify(prodConfig, undefined, 4));


/* load config for development server */
var devConfig = new Perrier({
    rootPath: __dirname + '/config'
});

devConfig.merge(
    'base.json',
    'development.json'
);
console.log('if app is running on development server, config will looks like below');
console.log(JSON.stringify(devConfig, undefined, 4));
