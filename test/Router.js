var should = require('should');
var hottap = require('hottap').hottap;
var _ = require('underscore');
var Router = require('../Router').Router;

describe('Router', function(){

  var expectException = function(f, extype, exmessage, exdetail){
    try {
      f();
    } catch(ex){
      ex.name.should.equal(extype);
      ex.message.should.equal(exmessage);
      if (!_.isString(ex.detail)){
        ex.detail = JSON.stringify(ex.detail);
        exdetail = JSON.stringify(exdetail);
      }
      ex.detail.should.equal(exdetail);
      return;
    }
    should.fail("Expected exception '" + extype + "' was not thrown.");
  };

  var FakeRes = function(){
    this.body = '';
    this.endWasCalled = false;
    this.headers = {};
    this.statusCode = 0;
    this.end = function(data){ 
      this.endArgs = _.toArray(arguments);
      this.body = data || ''; 
      this.endWasCalled = true;
    };
    this.writeHead = function(code){this.statusCode = code;};
    this.setHeader = function(name, value){this.headers[name] = value;};
    this.expectHeader = function(name, value){
      if (!this.headers[name]){
        should.fail("header " + name + " was not set.");
      }
      if (this.headers[name] != value){
        should.fail("header " + name + 
                    " was supposed to be " + value + 
                    " but was " + this.headers[name] + ".");
      }
    };
    this.expectStatus = function(status){
      this.statusCode.should.equal(status);
    };
    this.expectEnd = function() { 
      if (!this.endWasCalled){
        should.fail("end() was not called.");
      }
      var args = _.toArray(arguments);
      var diff = (_.difference(this.endArgs, args)).concat(_.difference(args, this.endArgs));
      if (diff.length !== 0){
        should.fail("Expected end(" + 
                    args.join(", ") + 
                    ") but got end(" + 
                    this.endArgs.join(", ") + ")");
      }
    };
  };

	beforeEach(function(){
    this.res = new FakeRes();
    this.simpleModule = {GET : function(context){context.res.end("OK");}};
	});

  describe('#onRequest', function(){
    it ("can be overridden to decorate the resource object", function(){
        var d = new Router('/api');
        d.onRequest = function(resource, req, res, cb){
          resource.url = req.url;
          cb(null, resource);
        };
        d.route('/', {GET : function($){$.res.end("hello world: " + this.url);}});
        var req = { url : "http://asdf.com/api", method : "GET"};
        d.dispatch(req, this.res);
        this.res.expectEnd("hello world: http://asdf.com/api");
    });
  });

  describe('#name', function(){
    it ("throws an exception if the path doesn't exist", function(){
        var d = new Router();
        expectException(function(){
          d.name('/', 'root');
        }, "PathDoesNotExist", 
            "Cannot name a path that doesn't exist", 
            {"path":"/", "name":"root"});
    });
    it ("throws an exception if name starts with '/'", function(){
        var d = new Router();
        expectException(function(){
          d.name('/', '/root');
        }, "InvalidName",
            "Cannot name a path with a name that starts with '/'.",
            {});
    });
    it ("allows a path to be set if it exists", function(){
        var d = new Router();
        d.route('/', function($){ $.res.send("hello world");});
        d.name('/', 'root');
    });
  });

  describe('#as', function(){
    it ('names the given route', function(){
        var d = new Router();
        d.route('/', function($){ $.res.end("hello world");}).as("root");
        var url = d.getUrl("root");
        url.should.equal('/');
    });
  });

  describe('#pathVariables', function(){
    it ('returns an empty hash for a static route', function(){
      // d.pathVariables('/this/is/the/path/1234/sub/') // returns {varname : 1234}
      var d = new Router();
      d.route('/', function($){ $.res.send("hello world");});
      _.keys(d.pathVariables('http://asdf.com/')).length.should.equal(0);
    });
    it ("throws an exception when the url doesn't route", function(){
      var d = new Router();
      expectException(function(){
        d.pathVariables('http://asdf.com/');
      }, "NotFound", 'That route is unknown.', '/');
    });
    it ('returns a hash of vars for a star route', function(){
      var d = new Router();
      d.route('/', function($){ $.res.send("hello world");});
      d.route('/*onetwothreefour', function($){ $.res.send("hello world");});
      d.route('/*onetwothreefour/asdf', function($){ $.res.send("hello world");});
      d.route('/*onetwothreefour/asdf/*fourfivesixseven', function($){ $.res.send("hello world");});
      var vars = d.pathVariables('http://asdf.com/%201234%20/asdf/4567');
      _.keys(vars).length.should.equal(2);
      vars.onetwothreefour.should.equal(' 1234 ');
      vars.fourfivesixseven.should.equal('4567');
    });
  });

	describe('#getHandler', function(){
    it ("when accessing an undefined url, throws an exception",
      function(){
        var d = new Router();
        expectException(function(){
          d.getHandler('/');
        }, "404", "Not Found", "/");
      }
    );
    it ("when accessing a too-long url, throws an exception", function(){
      var d = new Router();
      var simpleModule = this.simpleModule;
      var bigurl = "1";
      _.times(4097, function(){bigurl += '1';});
      expectException(function(){
        d.getHandler(bigurl);
      }, "414", "Request-URI Too Long", {});
    });
    it ("when accessing a defined url, returns a handler",
      function(){
        var d = new Router();
        d.route('/', function(req, res){ res.send("hello world");});
        var handler = d.getHandler('/');
        should.exist(handler.GET);
      }
    );
    it ("when accessing a defined url with a querystring, returns a handler", function(){
        var d = new Router();
        d.route('/', function(req, res){ res.send("hello world");});
        var handler = d.getHandler('/?asdf=1234');
        should.exist(handler.GET);
    });
  });

	describe('#freeRoute', function(){

    it ("emits an event on every routed object", function(done){
      var d = new Router();
      d.on("route", function(resource){
        should.exist(resource.GET);
        _.isFunction(resource.GET).should.equal(true);
        done();
      });
      d.freeRoute('/asdf/:asdf_id', function($){ $.res.end("hello world");});
    });

    it ("can route a function as a GET", function(done){
        var d = new Router('/api');
        d.freeRoute('/asdf/:asdf_id', function($){ 
          done();
        });
        var req = { url : "http://asdf.com/asdf/1234", method : "GET"};
        d.dispatch(req, this.res);
    });

    it ("can route an object with a GET", function(){
        var d = new Router('/api');
        d.freeRoute('/asdf/:asdf_id', { GET : function($){$.res.end("hello world");}});
        var req = { url : "http://asdf.com/asdf/1234", method : "GET"};
        d.dispatch(req, this.res);
        this.res.expectEnd("hello world");
    });
    
    it ("throws an exception if the module doesn't implement any methods", function(){
        var d = new Router();
        expectException(
           function(){
             d.freeRoute('/', {});
           },
           "HandlerHasNoHttpMethods", 
           "The handler you're trying to route to should implement HTTP methods.",
           {}
        );
    });

  });
	describe('#route', function(){
    it ("emits an event on every routed object", function(done){
      var d = new Router();
      d.on("route", function(resource){
        should.exist(resource.GET);
        _.isFunction(resource.GET).should.equal(true);
        done();
      });
      d.route('/', function(req, res){return "hello world";});
    });

    it ("can route a function as a GET", function(){
        var d = new Router('/api');
        d.route('/', function($){$.res.end("hello world");});
        var req = { url : "http://asdf.com/api", method : "GET"};
        d.dispatch(req, this.res);
        this.res.expectEnd("hello world");
    });

    it ("can route an object with a GET", function(){
        var d = new Router('/api');
        d.route('/', { GET : function($){$.res.end("hello world");}});
        var req = { url : "http://asdf.com/api", method : "GET"};
        d.dispatch(req, this.res);
        this.res.expectEnd("hello world");
    });

    it ("throws an exception if you try to mount a url without a parent", function(){
        var d = new Router();
        var simpleModule = this.simpleModule;
        expectException(
           function(){
             d.route('/asdf', simpleModule);
           },
           "ParentDoesNotExist", 
           "The route you're trying to add does not have a parent route defined.", 
           '/asdf'
        );
    });

    it ("can add a route if the parent of the path exists", function(){
        var d = new Router('/api');
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule);
        d.route('/hello', { GET : function($){$.res.end("hello world");}});
        var req = { url : "http://asdf.com/api/hello", method : "GET"};
        d.dispatch(req, this.res);
        this.res.expectEnd("hello world");
    });

    it ("can add a route to a non-root path that exists", function(){
        var d = new Router('/api');
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule);
        d.route('/hello/', { GET : function($){$.res.send("hello world");}});
        d.route('/hello/somenum', { GET : function($){$.res.end("hello world 2");}});
        var req = { url : "http://asdf.com/api/hello/somenum", method : "GET"};
        d.dispatch(req, this.res);
        this.res.expectEnd("hello world 2");
    });

    it ("can add a wildcard route", function(){
        var d = new Router('/api');
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule);
        d.route('/hello/', { GET : function($){$.res.send("hello world");}});
        d.route('/hello/*somenum', { GET : function($){$.res.end("hello world 2");}});
        var req = { url : "http://asdf.com/api/hello/1234", method : "GET"};
        d.dispatch(req, this.res);
        this.res.expectEnd("hello world 2");
    });

    it ("throws an exception if the module doesn't implement any methods", function(){
        var d = new Router();
        expectException(
           function(){
             d.route('/', {});
           },
           "HandlerHasNoHttpMethods", 
           "The handler you're trying to route to should implement HTTP methods.",
           {}
        );
    });
  });

	describe('#getUrl', function(){

    it ("throws an error when the path doesn't exist", function(){
        var d = new Router();
        expectException(function(){
          d.getUrl('/');
        }, 'NotFound', 'That route is unknown.', '/');
    });
    it ("throws an error when the name doesn't exist", function(){
        var d = new Router();
        expectException(function(){
          d.getUrl('some_name');
        }, 'NotFound', 'That route name is unknown.', 'some_name');
    });
    it ("returns the url for static path as that static path", function(){
        var d = new Router();
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule);
        var url = d.getUrl('/');
        url.should.equal('/');
    });
    it ("throws an error when the given var names are irrelevant", function(){
        var d = new Router();
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule);
        expectException(function(){
          var url = d.getUrl('/', {asdf : "asdf"});
        }, 'UnknownVariableName', 
            "One of the provided variable names was unknown.",
            "asdf");
    });
    it ("throws an error when the given var names are insufficient", function(){
        var d = new Router();
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule);
        d.route('/*asdf', simpleModule);
        expectException(function(){
          var url = d.getUrl('/*asdf');
        }, 'MissingVariable', 
            "One of the necessary variables was not provided.",
            "asdf");
    });
    it ("returns the url for a star path with variables injected", function(){
        var d = new Router();
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule);
        d.route('/*asdf', simpleModule);
        var url = d.getUrl('/*asdf', {asdf : 1234});
        url.should.equal('/1234');
    });
    it ("returns the url for a double star path with variables injected", function(){
        var d = new Router();
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule);
        d.route('/*asdf', simpleModule);
        d.route('/*asdf/sub', simpleModule);
        d.route('/*asdf/sub/*sub_id', simpleModule);
        var url = d.getUrl('/*asdf/sub/*sub_id', {asdf : 1234, sub_id : 4567});
        url.should.equal('/1234/sub/4567');
    });
    it ("returns the url for a NAMED double star path with variables injected", function(){
        var d = new Router();
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule);
        d.route('/*asdf', simpleModule);
        d.route('/*asdf/sub', simpleModule);
        d.route('/*asdf/sub/*sub_id', simpleModule);
        d.name('/*asdf/sub/*sub_id', 'subby');
        var url = d.getUrl('subby', {asdf : 1234, sub_id : 4567});
        url.should.equal('/1234/sub/4567');
    });
  });

  describe('#dispatch', function(){

    it ("decorates every request object with the Router object as req.detour by default", 
        function(){
          var d = new Router();
          d.route('/', { POST : function(req, res){return "POST";}});
          var req = { url : "http://asdf.com/", method : "POST"};
          d.dispatch(req, this.res);
          should.exist(req.detour);
        }
    );
    it ("decorates req with the Router object as req[d.requestNamespace]",
        function(){
          var d = new Router();
          d.requestNamespace = "router";
          d.route('/', { POST : function(req, res){return "POST";}});
          var req = { url : "http://asdf.com/", method : "POST"};
          d.dispatch(req, this.res);
          should.exist(req.router);
        }
    );

    context("there's no matching route", function(){
      beforeEach(function(){
        this.d = new Router();
        this.req = {url : "http://asdf.com/", method : 'GET'};
      });
      it ("calls the default 404 handler ", function(){
        this.d.dispatch(this.req, this.res);
        this.res.statusCode.should.equal(404);
        this.res.body.should.equal('');
      });
      it ("calls the on404 handler if it's set", function(done){
        this.d.on404(function(req, res){
          done();
        });
        this.d.dispatch(this.req, this.res);
      });
    });

    context("the url is too long", function(){
      beforeEach(function(){
        this.d = new Router();
        var simpleModule = this.simpleModule;
        var bigurl = "1";
        _.times(4097, function(){bigurl += '1';});
        this.d.route('/', simpleModule);
        this.req = { url : bigurl, method : "PUT"};
      });
      it ("calls the default 414 handler", function(){
        this.d.dispatch(this.req, this.res);
        this.res.expectStatus(414);
      });

      it ("calls the on414 handler if it's set", function(done){
        this.d.on414(function(req, res){ done(); });
        this.d.dispatch(this.req, this.res);
      });

    });

    context("the resource doesn't support the http method", function(){
      beforeEach(function(){
        this.d = new Router();
        var simpleModule = this.simpleModule;
        this.d.route('/', simpleModule);
        this.d.route('/hello', { GET : function(req, res){res.send("hello world");}});
        this.req = { url : "http://asdf.com/hello", method : "PUT"};

      });
      it ("calls the default 405 handler", function(){
        this.d.dispatch(this.req, this.res);
        this.res.expectStatus(405);
        this.res.expectHeader('Allow', 'OPTIONS,GET,HEAD');
      });
      it ("calls the on405 handler if it's set", function(done){
        this.d.on405(function(req, res){ done(); });
        this.d.dispatch(this.req, this.res);
      });

    });
    context("an exception is thrown", function(){
      beforeEach(function(){
        this.d = new Router();
        var simpleModule = this.simpleModule;
        this.d.route('/', simpleModule);
        this.d.route('/fail', { GET : function(req, res){ throw 'wthizzle';}});
        this.req = { url : "http://asdf.com/fail", method : "GET"};
      });
      it ("calls the default 500 handler", function(){
        this.d.dispatch(this.req, this.res);
        this.res.expectStatus(500);
      });
      it ("calls the on500 handler if it's set", function(done){
        this.d.on500(function(req, res){ done(); });
        this.d.dispatch(this.req, this.res);
      });
    });

    context("the server doesn't support the http method", function(){
      beforeEach(function(){
        this.d = new Router();
        var simpleModule = this.simpleModule;
        this.d.route('/', simpleModule);
        this.d.route('/hello', { GET : function(req, res){res.send("hello world");}});
        this.req = { url : "http://asdf.com/hello", method : "TRACE"};
      });
      it ("calls the default 501 handler", function(){
        this.d.dispatch(this.req, this.res);
        this.res.expectStatus(501);
      });
      it ("calls the on501 handler if it's set", function(done){
        this.d.on501(function(req, res){ done(); });
        this.d.dispatch(this.req, this.res);
      });
    });
    it ("can route an object with a POST", function(){
        var d = new Router();
        d.route('/', { POST : function($){$.res.end("POST");}});
        var req = { url : "http://asdf.com/", method : "POST"};
        d.dispatch(req, this.res);
        this.res.expectEnd("POST");
    });
    it ("can dispatch a url with a querystring", function(){
        var d = new Router();
        d.route('/', { GET : function($){$.res.end("GET");}});
        var req = { url : "http://asdf.com/?asdf=1234", method : "GET"};
        d.dispatch(req, this.res);
        this.res.expectEnd("GET");
    });

    describe("when the method is HEAD", function(){
      // HEAD is the same as GET, but without a response body
      it ("404s if the resource doesn't exist", function(){
          var d = new Router();
          var req = { url : "http://asdf.com/asdf", method : "OPTIONS"};
          d.dispatch(req, this.res);
          this.res.expectStatus(404);
      });
      it ("405s if the resource has no GET", function(){
          var d = new Router();
          d.route('/', { POST : function(context){return "POST";}});
          var req = { url : "http://asdf.com/", method : "HEAD"};
          d.dispatch(req, this.res);
          this.res.expectStatus(405);
      });
      it ("204s (no body) if the resource has a GET", function(){
          var d = new Router();
          d.route('/', { GET : function(context){
                              context.res.setHeader("Content-Type", 'application/wth');
                              context.res.end("GET output");
                        }});
          var req = { url : "http://asdf.com/", method : "HEAD"};
          try {
            d.handle500 = function(req, res, ex){
              console.log(ex);
            };
            d.dispatch(req, this.res);
          } catch (ex){
            console.log(ex);
          }
          this.res.expectStatus(204);
          this.res.expectHeader("Content-Type", 'application/wth');
      });
    });

    describe ("when the method is OPTIONS", function(){
      it ("404s if the resource doesn't exist", function(){
          var d = new Router();
          var req = { url : "http://asdf.com/asdf", method : "OPTIONS"};
          d.dispatch(req, this.res);
          this.res.expectStatus(404);
      });
      context("when the resource exists", function(){
        beforeEach(function(){
          this.d = new Router();
          this.d.route('/', { GET : function(context){
                                context.res.end("GET output");
                          }});
          this.req = { url : "http://asdf.com/", method : "OPTIONS"};
        
        });
        it ("sets the proper headers for OPTIONS", function(){
            this.d.dispatch(this.req, this.res);
            this.res.expectStatus(204);
            this.res.expectHeader('Allow', 'OPTIONS,GET,HEAD');
        });
        it ("calls the onOPTIONS handler if it was set.", function(done){
          this.d.onOPTIONS(function(req, res){
            done();
          });
          this.d.dispatch(this.req, this.res);
        });
      });
    });
    it ("finds and runs a GET handler at a sub path", function(){
          var d = new Router();
          d.route('/', { GET : function(context){
                              context.res.end("GET output");
                        }});
          d.route('/subpath', { 
                              GET : function(context){
                                context.res.end("GET output 2");
                              },
                              DELETE : function(req, res){
                                context.res.end("delete");
                              }
                            });
          var req = { url : "http://asdf.com/subpath", method : "OPTIONS"};
          d.dispatch(req, this.res);
          this.res.expectStatus(204);
          this.res.expectHeader('Allow', 'OPTIONS,DELETE,GET,HEAD');
    });

  });



	describe('#getChildUrls', function(){
    it ("throws an exception when given url doesn't exist", function(){
          var d = new Router();
          expectException(function(){
            d.getChildUrls('http://asdf.com');
          }, 'NotFound', 'That route is unknown.', '/');

    });
    it ("gets child urls for a parent path correctly", function(){
          var d = new Router();
          d.route('/', { GET : function(req, res){
                              res.end("GET output");
                        }});
          d.route('/asdf', { GET : function(req, res){
                              res.end("GET output");
                        }});
          var urls = d.getChildUrls('http://asdf.com');
          var keys = _.keys(urls);
          keys.length.should.equal(1);
          keys[0].should.equal('/asdf');
          should.not.exist(urls['/asdf']);
    });
    it ("gets child urls for a parent path correctly when given just the path", function(){
          var d = new Router();
          d.route('/', { GET : function(req, res){
                              res.end("GET output");
                        }});
          d.route('/asdf', { GET : function(req, res){
                              res.end("GET output");
                        }});
          var urls = d.getChildUrls('/');
          var keys = _.keys(urls);
          keys.length.should.equal(1);
          keys[0].should.equal('/asdf');
          should.not.exist(urls['/asdf']);
    });
    it ("gets multiple child urls for a parent path", function(){
          var d = new Router();
          d.route('/', { GET : function(req, res){
                              res.end("GET output");
                        }});
          d.route('/asdf', { GET : function(req, res){
                              res.end("GET output");
                        }});
          d.route('/other', { GET : function(req, res){
                              res.end("GET output");
                        }});
          var urls = d.getChildUrls('http://asdf.com');
          var keys = _.keys(urls);
          keys.length.should.equal(2);
          keys[0].should.equal('/asdf');
          keys[1].should.equal('/other');
          should.not.exist(urls['/asdf']);
          should.not.exist(urls['/other']);
    });
    it ("doesn't get grandkids", function(){
          var d = new Router();
          d.route('/', { GET : function(req, res){
                              res.end("GET output");
                        }});
          d.route('/asdf', { GET : function(req, res){
                              res.end("GET output");
                        }});
          d.route('/asdf/grankid', { GET : function(req, res){
                              res.end("GET output");
                        }});

          var urls = d.getChildUrls('http://asdf.com');
          var keys = _.keys(urls);
          keys.length.should.equal(1);
          keys[0].should.equal('/asdf');
          should.not.exist(urls['/asdf']);
    });
    it ("doesn't get starRoutes", function(){
          var d = new Router();
          d.route('/', { GET : function(req, res){
                              res.end("GET output");
                        }});
          d.route('/*asdf', { GET : function(req, res){
                              res.end("GET output");
                        }});
          var urls = d.getChildUrls('http://asdf.com');
          var keys = _.keys(urls);
          keys.length.should.equal(0);
    }); 

    it ("can get children of starRoutes", function(){
          var d = new Router();
          d.route('/', { GET : function(req, res){
                              res.end("GET output");
                        }}).as('root');
          d.route('/*asdf', { GET : function(req, res){
                              res.end("GET output");
                        }}).as('asdf*');
          d.route('/*asdf/grandkid', { GET : function(req, res){
                              res.end("GET output");
                        }}).as('grandkid');
          var urls = d.getChildUrls('http://asdf.com/1234');
          var keys = _.keys(urls);
          keys.length.should.equal(1);
          keys[0].should.equal('/1234/grandkid');
    });

    it ("can get children of starRoutes when the root path is not /", function(){
          var d = new Router('/somepath');
          d.route('/', { GET : function(req, res){
                              res.end("GET output");
                        }}).as('root');
          d.route('/*asdf', { GET : function(req, res){
                              res.end("GET output");
                        }}).as('asdf*');
          d.route('/*asdf/grandkid', { GET : function(req, res){
                              res.end("GET output");
                        }}).as('grandkid');
          var urls = d.getChildUrls('http://asdf.com/somepath/1234');
          var keys = _.keys(urls);
          keys.length.should.equal(1);
          keys[0].should.equal('/somepath/1234/grandkid');
    });

    it ("populates the names of child routes where possible", function(){
          var d = new Router();
          d.route('/', { GET : function(req, res){
                              res.end("GET output");
                        }}).as('root');
          d.route('/asdf', { GET : function(req, res){
                              res.end("GET output");
                        }}).as('asdf*');
          d.route('/asdf/grandkid', { GET : function(req, res){
                              res.end("GET output");
                        }}).as('grandkid');
          var urls = d.getChildUrls('http://asdf.com/asdf');
          var keys = _.keys(urls);
          keys.length.should.equal(1);
          keys[0].should.equal('/asdf/grandkid');
          urls['/asdf/grandkid'].should.equal('grandkid');
    });

    it ("populates the names of child routes of starRoutes where possible", function(){
          var d = new Router();
          d.route('/', { GET : function(req, res){
                              res.end("GET output");
                        }}).as('root');
          d.route('/*asdf', { GET : function(req, res){
                              res.end("GET output");
                        }}).as('asdf*');
          d.route('/*asdf/grandkid', { GET : function(req, res){
                              res.end("GET output");
                        }}).as('grandkid');
          var urls = d.getChildUrls('http://asdf.com/1234');
          var keys = _.keys(urls);
          keys.length.should.equal(1);
          keys[0].should.equal('/1234/grandkid');
          urls['/1234/grandkid'].should.equal('grandkid');
    });

  });

  describe('#getNamedChildUrls', function(){
    var d = new Router();
    d.route('/', { GET : function(req, res){
                        res.end("GET output");
                  }}).as('root');
    d.route('/asdf', { GET : function(req, res){
                        res.end("GET output");
                  }}).as('asdf');
    d.route('/qwerty', { GET : function(req, res){
                        res.end("GET output");
                  }});  // this one is not named
    var urls = d.getNamedChildUrls('http://asdf.com/');
    var keys = _.keys(urls);
    keys.length.should.equal(1);
    keys[0].should.equal('asdf');
    urls.asdf.should.equal('/asdf');
  });


	describe('#getParentUrl', function(){
    it ("throws an exception when getting the parent url of a root node", function(){
          var d = new Router();
          d.route('/', { GET : function(req, res){
                              res.end("GET output");
                        }});
          expectException(function(){
              d.getParentUrl('http://asdf.com');
          }, 'NoParentUrl', 'The given path has no parent path', '/');
    });
    it ("returns the parent url for a child path correctly", function(){
          var d = new Router();
          d.route('/', { GET : function(req, res){
                              res.end("GET output");
                        }});
          d.route('/asdf', { GET : function(req, res){
                              res.end("GET output");
                        }});
          var url = d.getParentUrl('http://asdf.com/asdf');
          url.should.equal('/');
    });
    it ("returns the parent url for a child path correctly with just a path", function(){
          var d = new Router();
          d.route('/', { GET : function(req, res){
                              res.end("GET output");
                        }});
          d.route('/asdf', { GET : function(req, res){
                              res.end("GET output");
                        }});
          var url = d.getParentUrl('/asdf');
          url.should.equal('/');
    });
    it ("returns the parent url for a grandchild path correctly", function(){
          var d = new Router();
          d.route('/', { GET : function(req, res){
                              res.end("GET output");
                        }});
          d.route('/asdf', { GET : function(req, res){
                              res.end("GET output");
                        }});
          d.route('/asdf/grandkid', { GET : function(req, res){
                              res.end("GET output");
                        }});
          var url = d.getParentUrl('http://asdf.com/asdf/grandkid');
          url.should.equal('/asdf');
    });

  });

});
