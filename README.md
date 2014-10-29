Perrier
=============
`Perrier` is a powerful JSON loader, which can use to load multi external JSON files, and merge to one JS object for large Node.js application uses.


---
### Quick Example

**config/foo.json**

    {
        foo: 1
    }

**config/bar.json**
    
    {
        bar: 2
    }

**app.js**

    var config = require('perrier').create();
    config.merge({
        './config/foo.json',
        './config/bar.json', 
        {
            baz: 3
        }
    });

    console.log(config); 

**OUTPUT**

    { 
        foo: 1, 
        bar: 2, 
        baz: 3 
    }

---
### Why We Need This Tool


#### Manage Config Easily
- decompose large config file into multi config files
- combine different config files in different situations
- merge multi config file in one shot

#### Powerful JSON Format
- you can leave **comment** on JSON file
- you can add **template** string on JSON file, and replace automatically
- you can link other config file on JSON field, and load automatically

#### New Feature (added on v0.3.0)
- supported **yaml** format

---
### Usage

#### 1. Powerful JSON

**config/sample.json**

    {
        event: "archive",
        rule: /warn/,
        interval: 1000 * 60 * 10 // do it every 10 min
    }
    
**app.js**

    var config = require('perrier').create();
    config.merge( './config/sample.json' );
    
    console.log( config ) );
    
**OUTPUT**

    { 
        event: 'archive', 
        rule: /warn/, 
        interval: 60000
    }
    
Supported **comment** / **expression** on JSON file.

---
#### 2. Template Replace

**config/production.json**

    {
        // global is reserved CONFIG field, which will use to render template field on future merge
        global: {
            NODE_ENV: 'production',
            LOG_LEVEL: 'info'
        }
    }
    
**config/logger.json**

    {
        logger: {
            logPath: '/home/logs/{{NODE_ENV}}.log
            logLevel: '{{LOG_LEVEL}}+error'
        }
    }
    
**app.js**

    var config = require('perrier').create();
    config.merge(
        './config/production.json',
        './config/logger.json'
    );
    console.log( config ) );
    
**OUTPUT**
    
    { 
        logger: {  
            logPath: '/home/logs/production.log', 
            logLevel: 'info+error' 
        }
    }
    
The **global** field will be template source, if any other field contains *{{key}}*, it will be replaced with corresponding content.

So that you can change the first arg in different environment, but keep same log config file.

---
#### 3. Link to Other Config

**config/main.json**

    {
        fooApp: 'conf: ./foo.json ', //link to external file
        barApp: {
            bar: true
        }
    }
    
**config/foo.json**

    {
        foo: true // which will be combined into main.json
    }
    
**app.js**

    var config = require('perrier').create();
    config.merge( './config/main.json' );
    
    console.log( config ) );
    
**OUTPUT**
    
    { 
        fooApp: { 
            foo: true 
        }, 
        barApp: { 
            bar: true 
        } 
    }
    
If any fields start with **conf:**, then the engine will try to load an external file and replace here.

So that you can decompose large files into multi config files, and do the flexible combinations.

This feature also supports template render, you can add *{{key}}* in anywhere.
    
---
#### 4. Runtime Config

**config/main.json**

    {
        type: 'http',
        maxSocks: 5
    }
    
**app.js**

    var config = require('perrier').create();
    config.merge(
        './config/main.json', 
        {
            maxSocks: 10
        }
    );
    console.log( config ) );
    
**OUTPUT**
    
    { 
        type: 'http', 
        maxSocks: 10 
    }
    
You can load a static file, and overwrite with runtime config if you need. 

Loader supports file path / plain object, all of those will be merged in sequentially.

---
#### 5. Monitor Method

**app.js**

    function monitor(err, index, fileName) {
        console.log(arguments);
    }

    var config = require('perrier').create({
        monitor: monitor
    });
    
    config.merge({
        './config/a.json', 
        './config/b.json',
        monitor // latest arg can be monitor function
    });
    
Engine will load config silently, but you can add a monitor function, it will be called once every config merged.

#### 6. Supported YAML

**All feature supported on yaml format, see [example](https://github.com/threeday0905/perrier/tree/master/example/yaml)**

( must install "js-yaml" manually )

---
### APIs

#### perrier.create( options )

- options.rootPath {String} - all config file will be resolved with root path. (default: process.cwd() )
- options.globalFields {Object} - default template source (optional)
- options.monitor {Function} - this fn will be called once every config merged
    
Example

    // config/base.json
    {
        server: '{{NODE_ENV}}
    }

    // app.js
    var perrier = require('perrier');

    var config = perrier.create({
        rootPath: path.join(__dirname, 'config'),
        globalFields: {
            NODE_ENV: process.env.NODE_ENV || 'development'
        }
    });
    
    config.merge('base.json'); // base.json will be converted to "__dirame/config/base.json""
    console.log(config); // { server: 'development' }
    
init method, you can also call ` var Perrier = require('perrier'); new Perrier();`
    
#### merge( source1, [, source2, ..., sourceN ])

See above usage, or [example](https://github.com/threeday0905/perrier/tree/master/example/sample)


#### getField( filedName )

return config.filedName or undefined

Example
    
    config.getField('logger');
    
#### getGlobal()

return global fields ( the template source )

Example

    config.getGlobal();


---
### Questions?

If you have any questions, feel free to create a new issue.
