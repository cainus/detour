var express = require('express');
var should = require('should');
var hottap = require('hottap').hottap;
var _ = require('underscore');
/*

CONSTRAINTS:
* the router should handle as many error scenarios as possible to keep the
work out of the resource
* http method should not really have anything to do with routing
* make fs-based routing awesome but not required
* we want collections and their members in the same file, so they 
can share code easily.
* sparse routes suck and are unnecessary
* routes should be easily settable/gettable by framework and resources
* router should add HEAD/OPTIONS/405 routes. may be overridden externally
* make this a new connect-compatible routing middleware to replace express' 
router
* ? how will restful file api add directories on the fly? (existance of dir
in static files can signal to the router that there's a route.  
programmatic routes then?)
* ? how to handle sub resources of member resources (sub dir matching 
collection name)?  almost certainly.
* ? how to handle sub resources of regular resources in the fs? (same as above?)
* ? how to do route-specific middleware like authorization?
* could we add a retrieve() method to modules that retrieves the "resource data" 
if possible and returns error if not?  that would allow dynamic 404s to be 
handled automatically.  Only necessary for dynamic routes.
* we want /asdf/1234/qwer/2345 to 404 if /asdf/1234 is a 404.

TODOS:
- d.parentUrl(some url or name)
- d.childUrls(some url or name)
- d.shouldAllowSparseRoutes = true; // default is false. true = throw exceptions
- d.resources.blank()  // GET only, 204, empty doc.
- d.resources.empty()  // 404
- getChildUrls(path) returns the urls of the kids of a given node
- preliminary examples in the docs
- implement fetch() we want /asdf/1234/qwer/2345 to 404 if /asdf/1234 is a 404.

=== refactor ===
- hide private methods entirely

=== test ===
- test with real app!
- does it work on plain express?
- test what happens if there's an exception in the handler.  500?

=== fs ===
- make route('/asdf', './somemodule') do a require('./somemodule') 
- d.fromFileSystem('./some dir') // https://github.com/coolaj86/node-walk#readme walkSync
- d.resources.file(filename) // GET only, 200, sendFile
- does it work with filesystem tree?

=== middleware ===
- ?? how to do route-specific middleware like authorization?
- add middleware to route()
- add middleware to dispatch()
- d.addMiddleware(paths_array, [middlewarez])
- d.addMiddlewareExcept(paths_array, [middlewarez])
- d.routes({'/this/is/the/path' : handler, '/this/is/the/path' : handler}, [middlewarezz])

=== star routes ===
- support sub resources of collections
x d.pathVariables('/this/is/the/path/1234/sub/') // returns {varname : 1234}
- getUrl should take an object / array of variables to interpolate
- make star routes set req.pathVariables
- make getUrl set path variables in starRoutes
- got to capture variables in the url and set params[]
- d.url('/this/is/the/path/*varname/sub', {varname : 1234})



x detour.router returns a function that calls dispatch:  app.use(d.router);
x d.requestNamespace = "detour" // req.detour will be the detour object
x d.name('/this/is/the/path', name)  // set
x HEAD
x handle all methods and 405s

three new recognized methods of a resource:
    beforeMethods : function(req, res, next){
      // useful for running code before all methods,
      // like authorization stuff
    }

    beforeChildren : function(req, res, next){
      // useful for doing stuff before child resources
      // are accessed.
    }

    // useful only for wildcard routes
    fetch : function(req, callback){
      callback(true);  // automatic 404 on GET, PUT, DELETE
      // or
      // callback(false, {}) 
      // sets req.fetched["obj"] to {} for later use
    },




VERSION 2:
- programmatic routes?  sub-routers?
- PATCH?
- get it to work on connect?
- redirects in the router
- conditional GET, e-tags, caching, 304
- cache recent urls / route combinations instead of requiring
regex lookup?  -- perfect for memoization
- use 'moved permanently' (301) for case sensitivity problems
in urls.  this is better for SEO
- unicode route support ( see https://github.com/ckknight/escort )
- server could note what's acceptable on all routes and check 406. have to do?
- don't allow status codes to be invalid ones.  does express do this for us?
=== named routes ===
- make named routes work -- route('/asdf', module).as('asdf')
- urls must start with /.  Names cannot contain /
- handle named routes
- d.url("some_name", {varname : 1234})

// NOTE: express 3.0 seems to be necessary for HEAD method support
*/

var express = require('express');
var detour = require('../detour').detour;

describe('detour', function(){

  var expectException = function(f, extype, exmessage, exdetail){
    try {
      f();
    } catch(ex){
      ex.type.should.equal(extype)
      ex.message.should.equal(exmessage)
      ex.detail.should.equal(exdetail)
      return;
    }
    should.fail("Expected exception '" + extype + "' was not thrown.");
  }

  var FakeRes = function(){
    this.body = '';
    this.headers = {};
    this.status = 0;
    this.end =function(data){ this.body = data || ''; }
    this.writeHead = function(code){this.status = code;}
    this.setHeader = function(name, value){this.headers[name] = value;}
    this.expectHeader = function(name, value){
      if (!this.headers[name]){
        should.fail("header " + name + " was not set.")
      }
      if (this.headers[name] != value){
        should.fail("header " + name + 
                    " was supposed to be " + value + 
                    " but was " + this.headers[name] + ".")
      }
    }
    this.expectStatus = function(status){
      this.status.should.equal(status);
    }
    this.expectEnd = function() { 
      var args = _.toArray(arguments);
      var diff = _.difference(this.sendArgs, args)
      if (diff.length != 0){ 
        should.fail("Expected send(" + 
                    args.join(", ") + 
                    ") but got send(" + 
                    this.sendArgs.join(", ") + ")")
      }
    }
  }

	beforeEach(function(){
    this.res = new FakeRes()
		this.app = {} //express.createServer();
    this.simpleModule = {GET : function(req, res){res.send("OK");}}
    this.simpleCollectionModule = {  
                                    GET : function(req, res){res.send("OK");},
                                    collectionGET : function(req, res){res.send("OK");}
                                  }
	})
	afterEach(function(){
    try {
      this.app.close();
    } catch (ex){
      // do nothing. assumed already closed.
    }
	})

  describe('#name', function(){
    it ("as a setter, it throws an exception if the path doesn't exist", function(){
        var d = new detour()
        expectException(function(){
          d.name('/', 'root')
        }, "PathDoesNotExist", "Cannot name a path that doesn't exist", "/")
    })
    it ("as a setter, it allows a path to be set if it exists", function(){
        var d = new detour()
        d.route('/', function(req, res){ res.send("hello world");});
        d.name('/', 'root')
    })
  })

  describe('#pathVariables', function(){
    it ('returns an empty hash for a static route', function(){
      // d.pathVariables('/this/is/the/path/1234/sub/') // returns {varname : 1234}
      var d = new detour()
      d.route('/', function(req, res){ res.send("hello world");});
      _.keys(d.pathVariables('http://asdf.com/')).length.should.equal(0)
    })
    it ("throws an exception when the url doesn't route", function(){
      var d = new detour()
      expectException(function(){
        d.pathVariables('http://asdf.com/')
      }, "NotFound", 'That route is unknown.', '/')
    })
    it ('returns a hash of vars for a star route', function(){
      // d.pathVariables('/this/is/the/path/1234/sub/') // returns {varname : 1234}
      var d = new detour()
      d.route('/', function(req, res){ res.send("hello world");});
      d.route('/*onetwothreefour', function(req, res){ res.send("hello world");});
      d.route('/*onetwothreefour/asdf', function(req, res){ res.send("hello world");});
      d.route('/*onetwothreefour/asdf/*fourfivesixseven', function(req, res){ res.send("hello world");});
      var vars = d.pathVariables('http://asdf.com/1234/asdf/4567')
      _.keys(vars).length.should.equal(2)
      vars['onetwothreefour'].should.equal('1234')
      vars['fourfivesixseven'].should.equal('4567')
    })
  });


	describe('#getHandler', function(){
    it ("when accessing an undefined url, throws an exception",
      function(){
        var d = new detour()
        expectException(function(){
          d.getHandler('/')
        }, "NotFound", "That route is unknown.", "/")
      }
    )
    it ("when accessing a defined url, returns a handler",
      function(){
        var d = new detour()
        d.route('/', function(req, res){ res.send("hello world");});
        var handler = d.getHandler('/')
        should.exist(handler.GET);
      }
    )
  });

	describe('#route', function(){
    it ("can route a function as a GET", function(){
        var d = new detour()
        d.route('/', function(req, res){return "hello world";});
        var req = { url : "http://asdf.com/", method : "GET"}
        d.dispatch(req, this.res)
        this.res.expectEnd("hello world")

    })

    it ("can route an object with a GET", function(){
        var d = new detour()
        d.route('/', { GET : function(req, res){return "hello world";}});
        var req = { url : "http://asdf.com/", method : "GET"}
        d.dispatch(req, this.res)
        this.res.expectEnd("hello world")
    })

    it ("can route a module that it requires")

    it ("throws an exception if you try to mount a url without a parent", function(){
        var d = new detour()
        var simpleModule = this.simpleModule;
        expectException(
           function(){
             d.route('/asdf', simpleModule)
           },
           "ParentDoesNotExist", 
           "The route you're trying to add does not have a parent route defined.", 
           '/asdf'
        )
    })

    it ("can add a route if the parent of the path exists", function(){
        var d = new detour()
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule)
        d.route('/hello', { GET : function(req, res){res.end("hello world");}});
        var req = { url : "http://asdf.com/hello", method : "GET"}
        d.dispatch(req, this.res)
        this.res.expectEnd("hello world")
    });

    it ("can add a route to a non-root path that exists", function(){
        var d = new detour()
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule)
        d.route('/hello/', { GET : function(req, res){res.send("hello world");}});
        d.route('/hello/somenum', { GET : function(req, res){res.end("hello world 2");}});
        var req = { url : "http://asdf.com/hello/somenum", method : "GET"}
        d.dispatch(req, this.res)
        this.res.expectEnd("hello world 2")
    });

    it ("can add a wildcard route", function(){
        var d = new detour()
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule)
        d.route('/hello/', { GET : function(req, res){res.send("hello world");}});
        d.route('/hello/*somenum', { GET : function(req, res){res.end("hello world 2");}});
        var req = { url : "http://asdf.com/hello/1234", method : "GET"}
        d.dispatch(req, this.res)
        this.res.expectEnd("hello world 2")
    });

    it ("throws an exception if the module doesn't implement any methods", function(){
        var d = new detour()
        expectException(
           function(){
             d.route('/', {})
           },
           "HandlerHasNoHttpMethods", 
           "The handler you're trying to route to should implement HTTP methods.",
           ''
        )
    });
  });

	describe('#getUrl', function(){

    it ("returns the url for a root node with an empty mountPath as /", function(){
    });
    it ("returns the url for a root node with a non empty mountPath", function(){
    });
    it ("returns the url for a child node", function(){
    });

    it ("returns the url for a collection", function(){
    })
    it ("returns the url for a collection member", function(){
    })
    it ("returns the url for a collection subresource", function(){
    })

  })


  describe('#expressRoute', function(){
    it ("is function that plugs this into express in as middleware", function(){
      var d = new detour()
      var called = false;
      d.dispatch = function(req, res, next){ called = true; }
      d.expressMiddleware({}, {}, function(){});
      called.should.equal(true);
    
    })
  
  });

  describe('#dispatch', function(){

    it ("decorates every request object with the detour object as req.detour by default", 
        function(){
          var d = new detour()
          d.route('/', { POST : function(req, res){return "POST";}});
          var req = { url : "http://asdf.com/", method : "POST"}
          d.dispatch(req, this.res)
          should.exist(req.detour)
        }
    );
    it ("decorates req with the detour object as req[d.requestNamespace]",
        function(){
          var d = new detour()
          d.requestNamespace = "router"
          d.route('/', { POST : function(req, res){return "POST";}});
          var req = { url : "http://asdf.com/", method : "POST"}
          d.dispatch(req, this.res)
          should.exist(req.router)
        }
    );

    it ("404s when it doesn't find a matching route and shouldHandle404s is true", function(){
      var d = new detour()
      var req = {url : "http://asdf.com/", method : 'GET'}
      d.dispatch(req, this.res)
      this.res.status.should.equal(404)
      this.res.body.should.equal('')
    })
    it ("calls next() when it doesn't find a matching route and shouldHandle404s is false", function(){
      var d = new detour()
      d.shouldHandle404s = false;
      var req = {url : "http://asdf.com/", method : 'GET'}
      var success = false;
      function next(){success = true;}
      d.dispatch(req, this.res, next)
      this.res.body.should.equal('')
      success.should.equal(true);
    })

    it ("414s if the url is too long", function(){
      var d = new detour()
      var simpleModule = this.simpleModule;
      var bigurl = "1"
      _.times(4097, function(){bigurl += '1';})
      d.route('/', simpleModule)
      d.route('/hello', { GET : function(req, res){res.send("hello world");}});
      var req = { url : bigurl, method : "PUT"}
      d.dispatch(req, this.res)
      this.res.expectStatus(414)
    })

    it ("405s on a resource-unsupported method", function(){
      var d = new detour()
      var simpleModule = this.simpleModule;
      d.route('/', simpleModule)
      d.route('/hello', { GET : function(req, res){res.send("hello world");}});
      var req = { url : "http://asdf.com/hello", method : "PUT"}
      d.dispatch(req, this.res)
      this.res.expectStatus(405)
    })

    it ("501s on a server-unsupported method", function(){
      var d = new detour()
      var simpleModule = this.simpleModule;
      d.route('/', simpleModule)
      d.route('/hello', { GET : function(req, res){res.send("hello world");}});
      var req = { url : "http://asdf.com/hello", method : "TRACE"}
      d.dispatch(req, this.res)
      this.res.expectStatus(501)
    })
    it ("can route an object with a POST", function(){
        var d = new detour()
        d.route('/', { POST : function(req, res){return "POST";}});
        var req = { url : "http://asdf.com/", method : "POST"}
        d.dispatch(req, this.res)
        this.res.expectEnd("POST")
    })

/*

    // exception in handler leads to a 500
    it ("responds with 500 if the handler throws an exception", function(){
      var d = new detour('api', this.simpleModule);
      // TODO this should be an express/hottap test
    })
*/

    describe("when the method is HEAD", function(){
      // HEAD is the same as GET, but without a response body
      // It should call resource's GET or collectionGET, strip the body, and
      // return the rest.
      it ("404s if the resource doesn't exist", function(){
          var d = new detour()
          var req = { url : "http://asdf.com/asdf", method : "OPTIONS"}
          d.dispatch(req, this.res)
          this.res.expectStatus(404)
      });
      it ("405s if the resource has no GET", function(){
          var d = new detour()
          d.route('/', { POST : function(req, res){return "POST";}});
          var req = { url : "http://asdf.com/", method : "HEAD"}
          d.dispatch(req, this.res)
          this.res.expectStatus(405)
      })
      it ("204s (no body) if the resource has a GET", function(){
          var d = new detour()
          d.route('/', { GET : function(req, res){
                              res.setHeader("Content-Type", 'application/wth');
                              res.end("GET output");
                        }});
          var req = { url : "http://asdf.com/", method : "HEAD"}
          d.dispatch(req, this.res)
          this.res.expectStatus(204)
          this.res.expectHeader("Content-Type", 'application/wth')
      })
    });

    describe ("when the method is OPTIONS", function(){
      it ("404s if the resource doesn't exist", function(){
          var d = new detour()
          var req = { url : "http://asdf.com/asdf", method : "OPTIONS"}
          d.dispatch(req, this.res)
          this.res.expectStatus(404)
      });
      it ("sets the proper headers for OPTIONS if the resource exists", function(){
          var d = new detour()
          d.route('/', { GET : function(req, res){
                              res.send("GET output");
                        }});
          var req = { url : "http://asdf.com/", method : "OPTIONS"}
          d.dispatch(req, this.res)
          this.res.expectStatus(204)
          this.res.expectHeader('Allow', 'OPTIONS,GET')
      })
    });
    it ("finds and runs a GET handler at a sub path", function(){
    });
    it ("finds and runs a GET handler on a collection itself", function(){
    });

    // TODO
    it ("finds and runs a GET handler on a collection member");

    // TODO
    it ("finds and runs a GET handler on a collection member sub resource");

    it ("500s when the handler throws an exception")/*, function(done){
      var d = new detour('api', {GET : function(req, res){throw "wthizzle";}})
      this.app.use(function(req, res){ d.dispatch(req, res);} );
      var url = "http://localhost:9999/api/"
      this.app.listen(9999, function(){
        hottap(url).request("GET", function(err, result){
          result.status.should.equal(500);
          result.body.should.equal("wthizzle")
          done();
        });
      });
    })*/

    it ("works with express for simple root route")/*, function(done){
      var d = new detour('api', this.simpleModule)
      this.app.use(function(req, res){ d.dispatch(req, res);} );
      var url = "http://localhost:9999/api/"
      this.app.listen(9999, function(){
        hottap(url).request("GET", function(err, result){
          result.status.should.equal(200);
          result.body.should.equal("OK")
          done();
        });
      });
    })*/

    it ("works with express for simple sub route")/*, function(done){
      var d = new detour('api', this.simpleModule)
			d.addRoute('/api/other',
															{GET : function(req, res){res.send("OK 2 !")}});
      this.app.use(function(req, res){ d.dispatch(req, res);} );
      var url = "http://localhost:9999/api/"
      this.app.listen(9999, function(){
        var url = "http://localhost:9999/api/other"
        hottap(url).request("GET", function(err, result){
          result.status.should.equal(200)
          result.body.should.equal("OK 2 !")
          done();
        });
      });
    })*/

    // TODO
    it ("works with express for simple child route");

    // TODO
    it ("works with express for collection route");

    // TODO
    it ("works with express for collection member route");

    // TODO
    it ("works with express for collection sub resource route");

    // express doesn't seem to route bad methods to middleware,
    // so I can't check for 501 scenarios and handle them.
    // I'm leaving this commented for now.
    /*
    it ("express returns 501 for bad method", function(done){
      var d = new detour('', this.simpleModule)
      this.app = express.createServer();
      //this.app.use(function(req, res){ d.dispatch(req, res);} );
      this.app.get('/', function(req, res){res.send("TEST");})
      this.app.listen(9999, function(){
        var url = "http://localhost:9999/"
        hottap(url).request("WTF", function(err, result){
          console.log(err)
          console.log(result);
          //result.status.should.equal(200)
          //result.body.should.equal("OK 2 !")
          done();
        });
      });
    })
    */

  });

  describe('#handleOPTIONS', function(){
    it ("sends OPTIONS,POST,PUT when those methods are defined", function(){
      var d = new detour()
      d.route('/', {
                              POST : function(req, res){}, 
                              PUT : function(req, res){}
                             }
                        );
      var req = { method : "OPTIONS", url : 'http://localhost:9999/'}
      d.dispatch(req, this.res)
      this.res.expectStatus(204)
      this.res.expectHeader('Allow', 'OPTIONS,POST,PUT')
    })
  });

	describe('#getParentUrl', function(){
    it ("throws an exception when getting the parent url of a root node", function(){
    });
    it ("returns the parent url for a child path correctly", function(){
    });

  })

});
