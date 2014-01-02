# detour
[![Build Status](https://secure.travis-ci.org/cainus/detour.png?branch=master)](http://travis-ci.org/cainus/detour)
[![Coverage Status](https://coveralls.io/repos/cainus/detour/badge.png?branch=master)](https://coveralls.io/r/cainus/detour?branch=master)
[![NPM version](https://badge.fury.io/js/detour.png)](http://badge.fury.io/js/detour)

Detour is a router for node.js web applications.

Detour is different from sinatra-style routers (like [express's router](http://expressjs.com/api.html#app.VERB)) because you **route urls to objects** (that have http methods) instead of to http methods.

Rationale:  If you have multiple http methods implemented for a given url (like a lot of APIs do), this style of routing will be much more natural and will vastly improve your code organization and re-use.  With object routing, it's much simpler to keep the related handlers together, but seperated from unrelated handlers (often even in another file/module).

It works for node.js' standard HTTP server, as well as [express](http://expressjs.com) and [connect](http://www.senchalabs.org/connect/) applications.


## Examples:

### Using it in a plain node.js web app: 

```javascript
  var detour = require('detour');
  var router = detour();
  router.route('/', {
    GET : function(req, res){
      res.end("GET works!");
    },
    POST : function(req, res){
      res.end("POST works too!");
    }
  });
  http.createServer(function(req, res){
    router.middleware(req, res);
  }).listen(9999);
  

```

### Using it in an express app:
```javascript
  var detour = require('detour');
  var express = require('express');
  var app = express();
  var router = detour();
  app.use(router.middleware);
  
  router.route('/', {
    GET : function(req, res){
      res.end("GET works!");
    },
    POST : function(req, res){
      res.end("POST works too!");
    }
  });

```
### Path Variables:
A simple example:

```javascript
  router.route('/test/:test_id', {
    GET : function(req, res){
      res.end("GET works: " + req.pathVar.test_id);
      // a request to /test/1234 will have output like this:
      //   GET works: 1234
      
      // req.pathVar is a hash of all name value pairs pull from the
      // request url
    },
  });

```
In the example above, you can see that the path string sent to the router (`/test/:test_id`) uses the [same format as express](http://expressjs.com/api.html#app.VERB).  Regular expressions are also allowed.


You can also see from the example  that within a route handler, `req.pathVar` will have all the variables collected from your route.


### Method defaults and overrides:

#### OPTIONS handling:
There is a default OPTIONS response for any route but you can over-ride it like this: 
```javascript
router.on('OPTIONS', function(req, res, resource){
  // resource is the object you routed.  You can loop through the methods on it here if you want!
  res.writeHead(200);
  res.end("options, options, options!");
});
```

#### HEAD handling:
There is a default HEAD response for any route with a GET, but you can over-ride it like this:
```javascript
router.on('HEAD', function(req, res, resource){
  // resource is the object you routed.  You can call resource.GET() from here if you want!
  res.writeHead(200);
  res.end("doesn't matter what I type here.  node will not send output on a HEAD request")
});
```

### Error defaults and overrides:

#### 405 handling:
The correct http response for a method that an existing url doesn't support is a 405.  You can over-ride the default like this: 
```javascript
router.on(405, function(req, res, resource){
  // resource is the object you routed.  You can loop through the methods on it here if you want!
  res.writeHead(405);
  res.end("this resource doesn't support that method! ");
});
```

#### 404 handling:
There is a default 404 response for any route that doesn't match, but you can over-ride it like this:
```javascript
router.on(404, function(req, res){
  res.writeHead(404);
  res.end("nope. couldn't find that!")
});
```
(NOTE: this only works if the middleware doesn't get a third parameter -- typically called `next()` -- passed to it, 
otherwise `next()` is used for 404s as you'd expect from a middleware.)










