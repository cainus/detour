# detour
[![Build Status](https://secure.travis-ci.org/cainus/detour.png?branch=master)](http://travis-ci.org/cainus/detour)

Detour is a router for node.js applications.  It should be useful for any sort of web application, 
but it's got additional features to make great HTTP APIs easy.

This project is entirely experimental, and I'm still working out whether the experiment has 
been a success.

## Features:
* Named routes, easy URL generation.
* Correctly handles 500, 501, 415, 404, 405 responses for you (if you want).
* Correctly handles OPTIONS, HEAD for you (if you want).
* Easy look-up of parent and child URLs (in case you want to put links to related resources).
* Allows route-by-route assignment of Connect-compatible middleware
* Helper function to get variables from the URL of a dynamic route.
* Can be used with a plain node.js http server, or as an express middleware (or in your own project)

## Some unusual parts:
These constraints are by-design for simpler routes, nicer url hierarchy, and better error-handling.
* No regex in route definition.  Dynamic URLs can still be defined though eg:  /user/*userid
* No orphan routes.  You can't route /this/long/path if /this/long hasn't already been routed.
* Routes go to an object (that should have GET,POST,etc methods on it), not to a function.  We'll 
call that object a 'resource'.
* All media-type (json? xml?) stuff is left up to the 'resource'.
* Server-side only.  This router is specifically designed for server use, and there's very little that
would apply on the client-side.

## Simple Example:
```javascript
var http = require('http')
var detour = require('./detour').detour;
var d = new detour();
var exampleResource = {GET : function(req, res){res.end("test");}}
d.route('', exampleResource)
var server = http.createServer(function(req, res){
                                 d.dispatch(req, res)
                               });
server.listen(9999, function(){
                       console.log("listening on 9999");
                    });
```


The tests are currently the best set of more advanced examples that I have time to document at the moment.

## Automated Tests:
npm test
