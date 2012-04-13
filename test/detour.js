var express = require('express');
var should = require('should');
var hottap = require('hottap').hottap;
var _ = require('underscore');
/*

CONSTRAINTS:
* http method should not really have anything to do with routing
* we want collections and their members in the same file, so they 
can share code easily.
* sparse routes suck and are unnecessary
* collections can be auto-detected by the existance of collection methods
* routes should be easily readable/writable by framework and resources
* make fs-based routing awesome but not required
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
* despite this being middleware, 404's won't fall through.  this is the 
end-of-the-line for bad routes.  this can be remedied later if it's a problem.

TODOS:
- might be better to rely on express' HEAD implementation.  the current one is 
a pain for passing on headers correctly.
- support sub resources of collections
- got to capture variables in the url and set params[]
- getUrl should take an options hash of variables to interpolate
- handleOPTIONS needs direct tests because it just barely covers what's necessary
- support OPTIONS
- test with real app!
- does it work on plain express?
- does it work with filesystem tree?
- preliminary documentation
- getChildUrls(node) returns the urls of the kids of a given node
- support adding routes on-the-fly
- custom handlers for 404, 405, 414 (request uri is too long) 
- programmatic routes?
- ?? how to do route-specific middleware like authorization?
- don't allow status codes to be invalid ones.  does express do this for us?
- is there a way for routes to use a return instead of res.send() ??
though?
x test what happens if there's an exception in the handler.  500?
x get rid of setRoutes?
x 503, 501 handlers (not doing 503 'service unavailable')
x getRoute(url) returns the route node for that url
x getURL(routenode) returns the url for a given routenode
x detour should have a method for applying routes, so that they're not
applied until the method is called.
x nodes will need a reference to their parent
x support collections
x have defaults for 404, 405, 414
x support TRACE (nope)
x what about the HEAD method?

VERSION 2:
- get it to work on connect?
- save getRouteTable() for dispatch()s repeated use
- redirects in the router
- conditional GET, e-tags, caching, 304
- cache recent urls / route combinations instead of requiring
regex lookup?
- routes that have no dynamic elements should be a simple
object key lookup (no regex)
- use 'moved permanently' (301) for case sensitivity problems
in urls.  this is better for SEO
- unicode route support ( see https://github.com/ckknight/escort )
- server could note what's acceptable on all routes and check 406
have to do?

// NOTE: express 3.0 seems to be necessary for HEAD method support
//
*/

var express = require('express');
var detour = require('../detour').detour;


describe('detour', function(){
	beforeEach(function(){
    this.app = {}
		//this.app = express.createServer();
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
  
  describe("constructor", function(){
    // mount path is the url prefix that will be used for all routes
    // the resource tree is the tree of 'resources' that will be mounted
    it ("can set mount path and root module",
       function(){
          var d = new detour('api', this.simpleModule)
          d.mountPath.should.equal('/api');
          should.exist(d.rootResource);
       }
    );
    it ("throws an exception if params are invalid", function(){
      try {
        var d = new detour();
        should.fail("an expected exception was not raised")
      } catch (ex) {
        ex.should.equal("detour must be instantiated with a url path to route from and a module to handle response.")
      }
    })
  });


	describe('#getRouteTable', function(){
    it ("should have a single route after first instantiation",
      function(){
        var d = new detour('api', this.simpleModule)
        var routes = d.getRouteTable()
        routes.length.should.equal(1);
        routes[0].url.should.equal("/api")
      }
    )
    it ("has two routes for a simple parent/child relationship", function(){
      var d = new detour('api', this.simpleModule)
			d.rootResource.addChild('other', 
															{GET : function(req, res){res.send("OK 2 !")}});
      var routes = d.getRouteTable()
      routes.length.should.equal(2);
      routes[0].url.should.equal("/api")
      routes[1].url.should.equal("/api/other")
    })
    it ("can route collections", function(){
			var d = new detour('api', {collectionGET : function(req, res){res.send("OK!")}});
      var routes = d.getRouteTable()
      routes.length.should.equal(1);
      routes[0].url.should.equal("/api")
    })
    it ("can route root collection members", function(){
			var d = new detour('api', this.simpleModule)
			d.rootResource.module.collectionGET = function(req, res){res.send("OK!")};
      var routes = d.getRouteTable()
      routes.length.should.equal(2);
      routes[0].url.should.equal("/api")
      routes[1].url.should.equal("/api/:_id")
    })
    it ("can route sub-root collection members", function(){
			var d = new detour('api', this.simpleModule)
			d.rootResource.addChild('other', 
        { collectionGET : function(req, res){res.send("OK!")},
          GET : function(req, res){res.send("member OK!")}
        }
      );
      var routes = d.getRouteTable()
      routes.length.should.equal(3);
      routes[0].url.should.equal("/api")
      routes[1].url.should.equal("/api/other")
      routes[2].url.should.equal("/api/other/:other_id")
    })
  });

  describe('#addRoute', function(){
    it ("throws an exception if the parent of the path doesn't exist", function(){
			var d = new detour('api', this.simpleModule)
      try {
        d.addRoute('/api/x/y', this.simpleModule)
        should.fail("expected exception was not thrown")
      } catch (ex) {
        ex.should.equal("Cannot add resource to a parent path that does not exist.")
      }
    })
    it ("throws an exception if the module doesn't implement any methods", function(){
			var d = new detour('api', this.simpleModule)
      try {
        d.addRoute('/api/x', {})
        should.fail("expected exception was not thrown");
      } catch (ex ){
        ex.should.equal('The handler you tried to add for path /api/x has no valid HTTP methods.')
      }
    });
    it ("can add a route to the root path", function(){
			var d = new detour('api', this.simpleModule)
      d.addRoute('/api/x', this.simpleModule)
      d.getRouteTable().length.should.equal(2)
    });
    it ("can add a route if the parent of the path exists", function(){
			var d = new detour('api', this.simpleModule)
      d.addRoute('/api/x', this.simpleModule)
      d.addRoute('/api/x/y', this.simpleModule)
      d.getRouteTable().length.should.equal(3)
    });
    it ("can add a sub resource of a collection", function(){
			var d = new detour('api', this.simpleModule)
      d.addRoute('/api/x', {GET : function(req, res){res.send("OK")},
                            collectionGET : function(req, res){res.send("OK2")}})
      d.addRoute('/api/x/:x_id/y', this.simpleModule)
      d.getRouteTable().length.should.equal(4)
    });
  });

	describe('#getUrl', function(){
    // TODO needs to handle urls with variables!
    it ("returns the url for a root node with an empty mountPath as /", function(){
			var d = new detour('', this.simpleModule)
      d.getUrl(d.rootResource).should.equal("/");
    });
    it ("returns the url for a root node with a non empty mountPath", function(){
			var d = new detour('api', this.simpleModule)
      d.getUrl(d.rootResource).should.equal("/api");
    });
    it ("returns the url for a child node", function(){
			var d = new detour('api', this.simpleModule)
			d.rootResource.addChild('other', 
															{GET : function(req, res){res.send("OK 2 !")}});
      d.getUrl(d.rootResource.children[0]).should.equal("/api/other");
    });

  })

	describe('#getRoute', function(){
    // takes a url and returns the matching route node
    it ("takes a mountPath and returns the root node", function(){
			var d = new detour('api', this.simpleModule)
      var node = d.getRoute('/api/')
      should.not.exist(node.parentNode)
      node.path.should.equal('/')
    });
    it ("takes an empty mountPath and returns the root node", function(){
			var d = new detour('api', this.simpleModule)
      var node = d.getRoute('/')
      should.not.exist(node.parentNode)
      node.path.should.equal('/')
    });
    it ("takes a simple child path and returns that node", function(){
			var d = new detour('api', this.simpleModule)
			d.rootResource.addChild('other', this.simpleModule);
      var node = d.getRoute('/api/other')
      should.exist(node.parentNode)
      node.parentNode.path.should.equal('/')
      node.path.should.equal('other')
    });
    it ("takes a collection path and returns that node", function(){
			var d = new detour('api', this.simpleModule)
			d.rootResource.addChild('other', this.simpleCollectionModule);
      var node = d.getRoute('/api/other')
      should.exist(node.parentNode)
      node.parentNode.path.should.equal('/')
      node.path.should.equal('other')
    });
    it ("takes a collection member path and returns that node", function(){
			var d = new detour('api', this.simpleModule)
			d.rootResource.addChild('other', this.simpleCollectionModule);
      var node = d.getRoute('/api/other/1234')
      should.exist(node.parentNode)
      node.parentNode.path.should.equal('/')
      node.path.should.equal('other')
    });
    it ("throws an exception if no route exists", function(){
			var d = new detour('api', this.simpleModule)
      try {
        var node = d.getRoute('/doesNotExist')
        should.fail("an expected exception was not thrown!")
      } catch(ex){
        ex.should.equal("That route does not exist: /doesNotExist.")
      }
    })
  });

  describe('#requestUrlToRoute', function(){
    it ("takes a root path and returns that node", function(){
			var d = new detour('api', this.simpleModule)
      var route = d.requestUrlToRoute('/api/')
      route.url.should.equal('/api')
    });
    it ("takes a simple child path and returns that node", function(){
			var d = new detour('api', this.simpleModule)
			d.rootResource.addChild('other', 
															{GET : function(req, res){res.send("OK 2 !")}});
      var route = d.requestUrlToRoute('/api/other/')
      route.url.should.equal('/api/other')
    });
    it ("takes a collection member path and returns that node", function(){
			var d = new detour('api', this.simpleModule)
      d.rootResource.addChild('other', 
															{GET : function(req, res){
                                        res.send("OK 2 !")
                                     },
                               collectionGET : function(req, res){
                                                  res.send("coll GET!")
                                               }
                              });
      var route = d.requestUrlToRoute('/api/other/4lph4num3r1c')
      route.url.should.equal('/api/other/:other_id')
    });
    it ("throws an exception if no match is found", function(){
			var d = new detour('', this.simpleModule)
      try {
        var route = d.requestUrlToRoute('/api/')
        should.fail("expected exception was not thrown!")
      } catch (ex) {
        ex.should.equal("No matching route found.")
      }
    });
  });


  describe('#dispatch', function(){

/*

    // exception in handler leads to a 500
    it ("responds with 500 if the handler throws an exception", function(){
      var d = new detour('api', this.simpleModule);
      // TODO this should be an express/hottap test
    })
*/
    // HEAD is the same as GET, but without a response body
    // It should call resource's GET or collectionGET, strip the body, and
    // return the rest.  this may require redefining res.send() for GET and
    // collectionGET methods
    it ("HEAD on simple resources calls GET, but does not have a body",
        function(){
            var d = new detour('api', this.simpleModule);
            var status = '';
            var req = { method : "HEAD", url : "http://localhost:9999/api"}
            var res = {send : function(code, body){ status = code;
                                body.should.equal('')
                              }
                      }
            d.dispatch(req, res);
            status.should.equal(204)
    })
    it ("HEAD calls GET with a status code, but does not have a body",
        function(){
            var module = {
              GET : function(req, res){
                res.send(200, "cool");
              }
            }
            var d = new detour('api', module);
            var status = '';
            var req = { method : "HEAD", url : "http://localhost:9999/api"}
            var res = {send : function(code, body){ status = code;
                                body.should.equal('')
                              }
                      }
            d.dispatch(req, res);
            status.should.equal(204)
    })

    it ("HEAD on collections calls collectionGET, but has no body", function(){
      var d = new detour('api', this.simpleCollectionModule);
      var status = '';
      var req = { method : "HEAD", url : "http://localhost:9999/api"}
      var res = {send : function(code, body){ status = code;
                              body.should.equal('')
                        }
                }
      d.dispatch(req, res);
      status.should.equal(204)
    })


    it ("HEAD on invalid paths 404s", function(){
      var d = new detour('api', this.simpleModule);
      var status = '';
      var req = { method : "HEAD", url : "http://localhost:9999/api/x/y/z"}
      var res = {send : function(code, body){ status = code;
      should.not.exist(body)}}
      d.dispatch(req, res);
      status.should.equal(404)
    })


    // 501 not implemented -- when the server does not support the http
    // method requested on ANY resources
    it ("responds with 501 if the server doesn't support the method at all", 
        function(){
          var d = new detour('api', this.simpleModule);
          var status = '';
          var req = { method : "WTH", url : "http://localhost:9999/api"}
          var res = {send : function(code, body){ 
                                status = code; ;
                                should.not.exist(body); }}
          d.dispatch(req, res);
          status.should.equal(501)
    })

    // TRACE disabled by default due to security concerns
    // http://en.wikipedia.org/wiki/Cross-site_tracing
    it ("responds with 501 if the method is TRACE", function(){
      var d = new detour('api', this.simpleModule);
      var status = '';
      var req = { method : "TRACE", url : "http://localhost:9999/api"}
      var res = {send : function(code, body){ 
                          status = code;
                          should.not.exist(body)
                        }
                }
      d.dispatch(req, res);
      status.should.equal(501)
    })

    it ("finds and runs a GET handler at the root path", function(){
			var d = new detour('', this.simpleModule)
      var response = "";
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
      var res = {send : function(str){ response = str;}}
      var req = { method : "GET", url : 'http://localhost:9999/'}
      d.dispatch(req, res) 
      response.should.equal("OK!")
    });
    it ("finds and runs a POST handler at the root path", function(){
			var d = new detour('', this.simpleModule)
      var response = "";
			d.rootResource.module = {POST : function(req, res){res.send("OK!")}}
      var res = {send : function(str){ response = str;}}
      var req = { method : "POST", url : 'http://localhost:9999/'}
      d.dispatch(req, res) 
      response.should.equal("OK!")
    });
    it ("runs a default OPTIONS handler at the root path when one doesn't exist", function(){
			var d = new detour('', this.simpleModule)
      var response = "";
      var headerkey = '';
      var headervalue = '';
			d.rootResource.module = {POST : function(req, res){res.send("OK!")}}
      var res = { send : function(str){ response = str;},
                  header : function(k, v){headerkey = k; headervalue = v;}}
      var req = { method : "OPTIONS", url : 'http://localhost:9999/'}
      d.dispatch(req, res)
      response.should.equal(204)
      headerkey.should.equal('Allow')
      headervalue.should.equal('OPTIONS,POST')
    });
    it ("runs a default OPTIONS handler at a sub path when one doesn't exist", function(){
			var d = new detour('', this.simpleModule)
      var response = "NOT THIS";
      var headerkey = "unset";
      var headervalue = "unset";
			d.addRoute('subby', {POST : function(req, res){res.send("OK!")}})
      var res = {
                 send : function(str){ response = str;}, 
                 header : function(k,v){ headerkey = k;  headervalue = v;}}
      var req = { method : "OPTIONS", url : 'http://localhost:9999/subby'}
      d.dispatch(req, res)
      response.should.equal(204)
      headerkey.should.equal('Allow')
      headervalue.should.equal('OPTIONS,POST')
    });
    it ("finds and runs a GET handler at a sub path", function(){
			var d = new detour('', this.simpleModule)
      var response = "";
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
			d.rootResource.addChild('other', 
															{GET : function(req, res){res.send("OK 2 !")}});
      var res = {send : function(str){ response = str;}}
      var req = { method : "GET", 
                  url : 'http://localhost:9999/other'}
      d.dispatch(req, res) 
      response.should.equal("OK 2 !")

    });
    it ("finds and runs a GET handler on a collection itself", function(){
			var d = new detour('', this.simpleModule)
      var response = "";
			d.rootResource.addChild('other', 
															{GET : function(req, res){res.send("OK 2 !")},
                               collectionGET : function(req, res){res.send("collection OK!")}}
                             );
      var res = {send : function(str){ response = str;}}
      var req = { method : "GET", url : 'http://localhost:9999/other/'}
      d.dispatch(req, res) 
      response.should.equal('collection OK!')
    });

    // TODO
    it ("finds and runs a GET handler on a collection member");

    // TODO
    it ("finds and runs a GET handler on a collection member sub resource");

    it ("500s when the handler throws an exception", function(done){
      var d = new detour('api', {GET : function(req, res){throw "wthizzle";}})
      var app = this.app = express.createServer();
      app.use(function(req, res){ d.dispatch(req, res);} );
      var url = "http://localhost:9999/api/"
      app.listen(9999, function(){
        hottap(url).request("GET", function(err, result){
          result.status.should.equal(500);
          result.body.should.equal("wthizzle")
          done();
        });
      });
    })

    it ("works with express for simple root route", function(done){
      var d = new detour('api', this.simpleModule)
      var app = this.app = express.createServer();
      app.use(function(req, res){ d.dispatch(req, res);} );
      var url = "http://localhost:9999/api/"
      app.listen(9999, function(){
        hottap(url).request("GET", function(err, result){
          result.status.should.equal(200);
          result.body.should.equal("OK")
          done();
        });
      });
    })

    it ("works with express for simple sub route", function(done){
      var d = new detour('api', this.simpleModule)
			d.addRoute('/api/other',
															{GET : function(req, res){res.send("OK 2 !")}});
      var app = this.app = express.createServer();
      app.use(function(req, res){ d.dispatch(req, res);} );
      var url = "http://localhost:9999/api/"
      app.listen(9999, function(){
        var url = "http://localhost:9999/api/other"
        hottap(url).request("GET", function(err, result){
          result.status.should.equal(200)
          result.body.should.equal("OK 2 !")
          done();
        });
      });
    })

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
      var app = this.app = express.createServer();
      //app.use(function(req, res){ d.dispatch(req, res);} );
      app.get('/', function(req, res){res.send("TEST");})
      app.listen(9999, function(){
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
    // TODO
    it ("sends OPTIONS,POST,PUT when those methods are defined")
  });

	describe('#getParentUrl', function(){
    it ("throws an exception when getting the parent url of a root node", function(){
			var d = new detour('', this.simpleModule)
      try {
        console.log(d.getParentUrl(d.rootResource))
        d.getParentUrl(d.rootResource).should.equal("/");
        should.fail("unexpected exception was thrown")
      } catch (ex) {
        ex.should.equal("Cannot get parent url of a node with no parent.")
      }
    });
    it ("returns the parent url for a child path correctly", function(){
			var d = new detour('api', this.simpleModule)
			d.rootResource.addChild('other', 
															{GET : function(req, res){res.send("OK 2 !")}});
      d.getParentUrl(d.rootResource.children[0]).should.equal("/api");
    });

  })

});
