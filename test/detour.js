var express = require('express');
var should = require('should');
var hottap = require('hottap').hottap;
var _ = require('underscore');
/*

CONSTRAINTS:
* routes shouldn't really have anything to do with methods
* we want collections and their members in the same file, so they 
can share code easily.
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
collection name)?
* ? how to handle sub resources of regular resources in the fs? (same as above?)
* ? how to do route-specific middleware like authorization?
* despite this being middleware, 404's won't fall through.  this is the 
end-of-the-line for bad routes.  this can be remedied later if it's a problem.

TODOS:
- support sub resources of collections
- support OPTIONS
- test with real app!
- does it work on plain express?
- does it work on plain connect?
- does it work with filesystem tree?
- save getRoutes() for dispatch()s repeated use
- get rid of setRoutes?
- preliminary documentation
- getChildUrls(node) returns the urls of the kids of a given node
- support adding routes on-the-fly
- custom handlers for 404, 405, 414 (request uri is too long) 
- what about the HEAD method?
- programmatic routes?
- ?? how to do route-specific middleware like authorization?
x getRoute(url) returns the route node for that url
x getURL(routenode) returns the url for a given routenode
x detour should have a method for applying routes, so that they're not
applied until the method is called.
x nodes will need a reference to their parent
x support collections
x have defaults for 404, 405, 414

// NOTE: express 3.0 seems to be necessary for HEAD method support

*/

var express = require('express');
var detour = require('../detour').detour;


describe('detour', function(){
	beforeEach(function(){
		//this.app = express.createServer();
	})
	afterEach(function(){
    try {
      //this.app.close();
    } catch (ex){
      // do nothing. assumed already closed.
    }
	})
  
	// mount path is the url prefix that will be used for all routes
	// the resource tree is the tree of 'resources' that will be mounted
	it ("has a ctor for setting mount path and initializing resource tree",
		 function(){
				var d = new detour('api')
				d.mountPath.should.equal('/api');
				should.exist(d.rootResource);
		 }
  );

	describe('#getRoutes', function(){
    it ("should be an empty list when there's an empty resource tree and a mount path",
      function(){
        var d = new detour('api')
        d.getRoutes().length.should.equal(0);
      }
    )
    it ("should be an empty list when there's an empty resource tree and no mount path",
      function(){
			  var d = new detour('')
        d.getRoutes().length.should.equal(0);
      }
    )
    it ("has a simple route when one exists in the resource tree", function(){
			var d = new detour('api')
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
      var routes = d.getRoutes()
      routes.length.should.equal(1);
      routes[0].url.should.equal("/api")
    })
    it ("has two routes for a simple parent/child relationship", function(){
			var d = new detour('api')
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
			d.rootResource.addChild('other', 
															{GET : function(req, res){res.send("OK 2 !")}});
      var routes = d.getRoutes()
      routes.length.should.equal(2);
      routes[0].url.should.equal("/api")
      routes[1].url.should.equal("/api/other")
    })
    it ("can route collections", function(){
			var d = new detour('api')
			d.rootResource.module = {collectionGET : function(req, res){res.send("OK!")}}
      var routes = d.getRoutes()
      routes.length.should.equal(1);
      routes[0].url.should.equal("/api")
    })
    it ("can route root collection members", function(){
			var d = new detour('api')
			d.rootResource.module = { collectionGET : function(req, res){res.send("OK!")},
                                GET : function(req, res){res.send("member OK!")}
      }
      var routes = d.getRoutes()
      routes.length.should.equal(2);
      routes[0].url.should.equal("/api")
      routes[1].url.should.equal("/api/:_id")
    })
    it ("can route sub-root collection members", function(){
			var d = new detour('api')
			d.rootResource.module = { GET : function(req, res){res.send("root");} }
			d.rootResource.addChild('other', 
        { collectionGET : function(req, res){res.send("OK!")},
          GET : function(req, res){res.send("member OK!")}
        }
      );
      var routes = d.getRoutes()
      routes.length.should.equal(3);
      routes[0].url.should.equal("/api")
      routes[1].url.should.equal("/api/other")
      routes[2].url.should.equal("/api/other/:other_id")
    })
  });

	describe('#setRoutes', function(){
		it ("doesn't set anything with the default resource tree", function(){
			var d = new detour('api')
			var app = express.createServer();
			d.setRoutes(app)
			var routes = app.lookup.all('/api')
			should.not.exist(routes['0']) 
		})
		it ("sets a simple GET route when one exists in the resource tree", function(){
			var d = new detour('api')
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
			var app = express.createServer();
			d.setRoutes(app)
			var routes = app.lookup.all('/api/')
			should.exist(routes['0']) 
			routes = app.lookup.all('/api')
			should.exist(routes['0']) 
			routes['0'].method.should.equal("get")
		})
		it ("sets a simple POST route when one exists in the resource tree", function(){
			var d = new detour('api')
			d.rootResource.module = {POST : function(req, res){res.send("OK!")}}
			var app = express.createServer();
			d.setRoutes(app)
			var routes = app.lookup.all('/api/')
			should.exist(routes['0']) 
			routes = app.lookup.all('/api')
			should.exist(routes['0']) 
			routes['0'].method.should.equal("post")
		})
		it ("sets a simple DELETE route when one exists in the resource tree", function(){
			var d = new detour('api')
			d.rootResource.module = {DELETE : function(req, res){res.send("OK!")}}
			var app = express.createServer();
			d.setRoutes(app)
			var routes = app.lookup.all('/api/')
			should.exist(routes['0']) 
			routes['0'].method.should.equal("delete")
		})
		it ("sets a simple OPTIONS route when one exists in the resource tree", function(){
			var d = new detour('api')
			d.rootResource.module = {OPTIONS : function(req, res){res.send("OK!")}}
			var app = express.createServer();
			d.setRoutes(app)
			var routes = app.lookup.all('/api/')
			should.exist(routes['0']) 
			routes['0'].method.should.equal("options")
		})
		it ("sets a simple PUT route when one exists in the resource tree", function(){
			var d = new detour('api')
			d.rootResource.module = {PUT : function(req, res){res.send("OK!")}}
			var app = express.createServer();
			d.setRoutes(app)
			var routes = app.lookup.all('/api/')
			should.exist(routes['0']) 
			routes['0'].method.should.equal("put")
		})
		it ("sets can set paths for simple non-root resources", function(done){
			var d = new detour('api')
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
			d.rootResource.addChild('other', 
															{GET : function(req, res){res.send("OK 2 !")}});
      var app = this.app = express.createServer();
			d.setRoutes(app)
			var routes = app.lookup.all('/api/')
			should.exist(routes['0'])
			routes['0'].method.should.equal("get")
			var routes = app.lookup.all('/api/other')
			should.exist(routes['0']) 
			routes['0'].method.should.equal("get")
      var url = "http://localhost:9999/api/"
      app.listen(9999, function(){
        hottap(url).request("GET", function(err, result){
          result.status.should.equal(200);
          var url = "http://localhost:9999/api/other"
          hottap(url).request("GET", function(err, result){
            result.status.should.equal(200)
            done();
          });
        });
      });

		});
  });


	describe('#getUrl', function(){
    it ("returns the url for a root node with an empty mountPath as /", function(){
			var d = new detour('')
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
      d.getUrl(d.rootResource).should.equal("/");
    });
    it ("returns the url for a root node with a non empty mountPath", function(){
			var d = new detour('api')
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
      d.getUrl(d.rootResource).should.equal("/api");
    });
    it ("returns the url for a child node", function(){
			var d = new detour('api')
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
			d.rootResource.addChild('other', 
															{GET : function(req, res){res.send("OK 2 !")}});
      d.getUrl(d.rootResource.children[0]).should.equal("/api/other");
    });

  })

	describe('#getRoute', function(){
    // takes a url and returns the matching route node
    it ("takes a mountPath and returns the root node", function(){
			var d = new detour('api')
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
      var node = d.getRoute('/api/')
      should.not.exist(node.parentNode)
      node.path.should.equal('/')
    });
    it ("takes an empty mountPath and returns the root node", function(){
			var d = new detour('')
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
      var node = d.getRoute('/')
      should.not.exist(node.parentNode)
      node.path.should.equal('/')
    });
    it ("takes a simple child path and returns that node", function(){
			var d = new detour('api')
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
			d.rootResource.addChild('other', 
															{GET : function(req, res){res.send("OK 2 !")}});
      var node = d.getRoute('/api/other')
      should.exist(node.parentNode)
      node.parentNode.path.should.equal('/')
      node.path.should.equal('other')
    });
    it ("throws an exception if no routes exist", function(){
			var d = new detour('api')
      try {
        var node = d.getRoute('/api/other')
        should.fail("an expected exception was not thrown!")
      } catch(ex){
        ex.should.equal("That route does not exist: /api/other.")
      }
    })
    it ("throws an exception if no route exists", function(){
			var d = new detour('')
      try {
        var node = d.getRoute('/doesNotExist')
        should.fail("an expected exception was not thrown!")
      } catch(ex){
        ex.should.equal("That route does not exist: /doesNotExist.")
      }
    })
  });

  describe('#matchRoute', function(){
    it ("takes a root path and returns that node", function(){
			var d = new detour('api')
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
      var route = d.matchRoute('/api/')
      route.url.should.equal('/api')
    });
    it ("takes a simple child path and returns that node", function(){
			var d = new detour('api')
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
			d.rootResource.addChild('other', 
															{GET : function(req, res){res.send("OK 2 !")}});
      var route = d.matchRoute('/api/other/')
      route.url.should.equal('/api/other')
    });
    it ("takes a collection member path and returns that node", function(){
			var d = new detour('api')
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
			d.rootResource.addChild('other', 
															{GET : function(req, res){
                                        res.send("OK 2 !")
                                     },
                               collectionGET : function(req, res){
                                                  res.send("coll GET!")
                                               }
                              });
      var route = d.matchRoute('/api/other/4lph4num3r1c')
      route.url.should.equal('/api/other/:other_id')
    });
    it ("throws an exception if no match is found", function(){
			var d = new detour('api')
      try {
        var route = d.matchRoute('/api/')
        should.fail("expected exception was not thrown!")
      } catch (ex) {
        ex.should.equal("No matching route found.")
      }
    });
  });


  describe('#dispatch', function(){
    
    it ("finds and runs a GET handler at the root path", function(){
			var d = new detour('')
      var response = "";
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
      var res = {send : function(str){ response = str;}}
      var req = { method : "GET", url : 'http://localhost:9999/'}
      d.dispatch(req, res) 
      response.should.equal("OK!")
    });
    it ("finds and runs a POST handler at the root path", function(){
			var d = new detour('')
      var response = "";
			d.rootResource.module = {POST : function(req, res){res.send("OK!")}}
      var res = {send : function(str){ response = str;}}
      var req = { method : "POST", url : 'http://localhost:9999/'}
      d.dispatch(req, res) 
      response.should.equal("OK!")
    });
    it ("finds and runs a GET handler at a sub path", function(){
			var d = new detour('')
      var response = "";
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
			d.rootResource.addChild('other', 
															{GET : function(req, res){res.send("OK 2 !")}});
      var res = {send : function(str){ response = str;}}
      var req = { method : "GET", url : 'http://localhost:9999/other'}
      d.dispatch(req, res) 
      response.should.equal("OK 2 !")

    });
    it ("404s when it's passed a bad path", function(){
			var d = new detour('')
      var response = "NOT OK";
      var status = 200
      var req = { method : "GET", url : 'http://localhost:9999/doesNotExist'}
      var res = {send : function(code, body){ response = body; status = code;}}
      d.dispatch(req, res)
      should.not.exist(response)
      status.should.equal(404)
    });
    it ("405s when the method doesn't exist", function(){
			var d = new detour('')
      var response = "NOT OK";
      var status = 200
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
      var req = { method : "PUT", url : 'http://localhost:9999/'}
      var res = {send : function(code, body){ response = body; status = code;}}
      d.dispatch(req, res)
      should.not.exist(response)
      status.should.equal(405)
    });
    it('414s when uri is too long', function(){
      var url = 'http://localhost:9999/';
      for(var i = 0; i < 500; i++){
        url += '1234567890';
      }
			var d = new detour('')
      var response = "NOT OK";
      var status = 200
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
      var req = { method : "GET", url : url}
      var res = {send : function(code, body){ response = body; status = code;}}
      d.dispatch(req, res)
      should.not.exist(response)
      status.should.equal(414)
    });
    it ("finds and runs a GET handler on a member of a collection", function(){
			var d = new detour('')
      var response = "";
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
			d.rootResource.addChild('other', 
															{GET : function(req, res){res.send("OK 2 !")},
                               collectionGET : function(req, res){res.send("collection OK!")}}
                             );
      var res = {send : function(str){ response = str;}}
      var req = { method : "GET", url : 'http://localhost:9999/other/1234'}
      d.dispatch(req, res) 
      response.should.equal('OK 2 !')
    });
  });

	describe('#getParentUrl', function(){
    it ("throws an exception when getting the parent url of a root node", function(){
			var d = new detour('')
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
      try {
        d.getParentUrl(d.rootResource).should.equal("/");
        should.fail("unexpected exception was thrown")
      } catch (ex) {
        ex.should.equal("Cannot get parent url of a node with no parent.")
      }
    });
    it ("returns the parent url for a child path correctly", function(){
			var d = new detour('api')
			d.rootResource.module = {GET : function(req, res){res.send("OK!")}}
			d.rootResource.addChild('other', 
															{GET : function(req, res){res.send("OK 2 !")}});
      d.getParentUrl(d.rootResource.children[0]).should.equal("/api");
    });

  })

});
