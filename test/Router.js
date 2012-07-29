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
    this.status = 0;
    this.end = function(data){ 
      this.endArgs = _.toArray(arguments);
      this.body = data || ''; 
      this.endWasCalled = true;
    };
    this.writeHead = function(code){this.status = code;};
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
      this.status.should.equal(status);
    };
    this.expectEnd = function() { 
      if (!this.endWasCalled){
        should.fail("end() was not called.");
      }
      var args = _.toArray(arguments);
      var diff = _.difference(this.endArgs, args);
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
    this.simpleModule = {GET : function(req, res){res.send("OK");}};
    this.simpleCollectionModule = {  
                                    GET : function(req, res){res.send("OK");},
                                    collectionGET : function(req, res){res.send("OK");}
                                  };
	});

  describe('#onRequest', function(){
    it ("can be overridden to decorate the resource object", function(){
        var d = new Router('/api');
        d.onRequest = function(resource, req, res){
          resource.url = req.url;
        };
        d.route('/', {GET : function(req, res){res.end("hello world: " + this.url);}});
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
        }, "PathDoesNotExist", "Cannot name a path that doesn't exist", "/");
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
        d.route('/', function(req, res){ res.send("hello world");});
        d.name('/', 'root');
    });
  });

  describe('#as', function(){
    it ('names the given route', function(){
        var d = new Router();
        d.route('/', function(req, res){ res.send("hello world");}).as("root");
        var url = d.getUrl("root");
        url.should.equal('/');
    });
  });

  describe('#pathVariables', function(){
    it ('returns an empty hash for a static route', function(){
      // d.pathVariables('/this/is/the/path/1234/sub/') // returns {varname : 1234}
      var d = new Router();
      d.route('/', function(req, res){ res.send("hello world");});
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
      d.route('/', function(req, res){ res.send("hello world");});
      d.route('/*onetwothreefour', function(req, res){ res.send("hello world");});
      d.route('/*onetwothreefour/asdf', function(req, res){ res.send("hello world");});
      d.route('/*onetwothreefour/asdf/*fourfivesixseven', function(req, res){ res.send("hello world");});
      var vars = d.pathVariables('http://asdf.com/1234/asdf/4567');
      _.keys(vars).length.should.equal(2);
      vars.onetwothreefour.should.equal('1234');
      vars.fourfivesixseven.should.equal('4567');
    });
  });

  describe('#shouldThrowExceptions', function(){
    describe('when set to true', function(){
      it ('throws an exception when the uri is too long', function(){
        var d = new Router();
        d.shouldThrowExceptions = true;
        var simpleModule = this.simpleModule;
        var bigurl = "1";
        _.times(4097, function(){bigurl += '1';});
        d.route('/', simpleModule);
        var req = { url : bigurl, method : "PUT"};
        try {
          d.dispatch(req, this.res);
          should.fail('expected exception was not raised');
        } catch(ex){
          ex.name.should.equal('414');
          ex.message.should.equal('Request-URI Too Long');
        }
      });
      it ('throws an exception when the URI is not found', function(){
        var d = new Router();
        d.shouldThrowExceptions = true;
        var req = {url : "http://asdf.com/", method : 'GET'};
        try {
          d.dispatch(req, this.res);
          should.fail('expected exception was not raised');
        } catch(ex){
          ex.name.should.equal('404');
          ex.message.should.equal('Not Found');
        }
      });
      it ("throws an exception on 405s", function(){
        var d = new Router();
        d.shouldThrowExceptions = true;
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule);
        d.route('/hello', { GET : function(req, res){res.send("hello world");}});
        var req = { url : "http://asdf.com/hello", method : "PUT"};
        try {
          d.dispatch(req, this.res);
          should.fail('expected exception was not raised');
        } catch(ex){
          ex.name.should.equal('405');
          ex.message.should.equal('Method Not Allowed');
        }
      });
      it ("throws an exception on 500", function(){
        var d = new Router('/api');
        d.shouldThrowExceptions = true;
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule);
        d.route('/fail', { GET : function(req, res){ throw 'wthizzle';}});
        var req = { url : "http://asdf.com/api/fail", method : "GET"};
        try {
          d.dispatch(req, this.res);
          should.fail('expected exception was not raised');
        } catch(ex){
          ex.name.should.equal('500');
          ex.message.should.equal('Internal Server Error');
          ex.detail.should.equal('wthizzle');
        }
      });

      it ("throws an exception on 501s", function(){
        var d = new Router();
        d.shouldThrowExceptions = true;
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule);
        d.route('/hello', { GET : function(req, res){res.send("hello world");}});
        var req = { url : "http://asdf.com/hello", method : "TRACE"};
        try {
          d.dispatch(req, this.res);
          should.fail('expected exception was not raised');
        } catch(ex){
          ex.name.should.equal('501');
          ex.message.should.equal('Not Implemented');
        }
      });
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

	describe('#route', function(){
    it ("emits an event on every routed object", function(){
      var d = new Router();
      d.on("route", function(resource){
        should.exist(resource.GET);
        _.isFunction(resource.GET).should.equal(true);
      });
      d.route('/', function(req, res){return "hello world";});
    });

    it ("can route a function as a GET", function(){
        var d = new Router('/api');
        d.route('/', function(req, res){res.end("hello world");});
        var req = { url : "http://asdf.com/api", method : "GET"};
        d.dispatch(req, this.res);
        this.res.expectEnd("hello world");
    });

    it ("can route an object with a GET", function(){
        var d = new Router('/api');
        d.route('/', { GET : function(req, res){res.end("hello world");}});
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
        d.route('/hello', { GET : function(req, res){res.end("hello world");}});
        var req = { url : "http://asdf.com/api/hello", method : "GET"};
        d.dispatch(req, this.res);
        this.res.expectEnd("hello world");
    });

    it ("can add a route to a non-root path that exists", function(){
        var d = new Router('/api');
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule);
        d.route('/hello/', { GET : function(req, res){res.send("hello world");}});
        d.route('/hello/somenum', { GET : function(req, res){res.end("hello world 2");}});
        var req = { url : "http://asdf.com/api/hello/somenum", method : "GET"};
        d.dispatch(req, this.res);
        this.res.expectEnd("hello world 2");
    });

    it ("can add a wildcard route", function(){
        var d = new Router('/api');
        var simpleModule = this.simpleModule;
        d.route('/', simpleModule);
        d.route('/hello/', { GET : function(req, res){res.send("hello world");}});
        d.route('/hello/*somenum', { GET : function(req, res){res.end("hello world 2");}});
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

  describe('#connectMiddleware', function(){
    it ("is a function that plugs this into express in as middleware", function(){
      var d = new Router();
      var called = false;
      d.dispatch = function(req, res, next){ called = true; };
      d.connectMiddleware({}, {}, function(){});
      called.should.equal(true);
    });
  });

  describe('#before', function(){
    it ('allows middleware to be added to various paths', function(){
      var d = new Router();
      d.route('/', { GET : function(req, res){res.end("GET");}}).as("index");
      d.route('/*sub', { GET : function(req, res){res.end("subGET");}});
      d.before(['/', '/*sub'], [function(req, res, next){
                                  res.end("early out");
                                }]);
      var req = { url : "http://asdf.com/", method : "GET"};
      d.dispatch(req, this.res);
      this.res.body.should.equal("early out");
      req = { url : "http://asdf.com/1234", method : "GET"};
      d.dispatch(req, this.res);
      this.res.body.should.equal("early out");
    });
    it ('allows middleware to be added to various paths and still routes', function(){
      var d = new Router();
      var urls = [];
      d.route('/', { GET : function(req, res){res.end("GET");}}).as("index");
      d.route('/*sub', { GET : function(req, res){res.end("subGET");}});
      d.before(['index', '/*sub'], [function(req, res, next){
                                  urls.push(req.url);
                                  next();
                                }]);
      var req = { url : "http://asdf.com/", method : "GET"};
      d.dispatch(req, this.res);
      this.res.body.should.equal("GET");
      req = { url : "http://asdf.com/1234", method : "GET"};
      d.dispatch(req, this.res);
      this.res.body.should.equal("subGET");
      urls.length.should.equal(2);
      urls[0].should.equal('http://asdf.com/');
      urls[1].should.equal('http://asdf.com/1234');
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

    it ("404s when it doesn't find a matching route and shouldHandle404s is true", function(){
      var d = new Router();
      var req = {url : "http://asdf.com/", method : 'GET'};
      d.dispatch(req, this.res);
      this.res.status.should.equal(404);
      this.res.body.should.equal('');
    });
    it ("calls next() when it doesn't find a matching route and shouldHandle404s is false", function(){
      var d = new Router();
      d.shouldHandle404s = false;
      var req = {url : "http://asdf.com/", method : 'GET'};
      var success = false;
      function next(){success = true;}
      d.dispatch(req, this.res, next);
      this.res.body.should.equal('');
      success.should.equal(true);
    });

    it ("414s if the url is too long", function(){
      var d = new Router();
      var simpleModule = this.simpleModule;
      var bigurl = "1";
      _.times(4097, function(){bigurl += '1';});
      d.route('/', simpleModule);
      var req = { url : bigurl, method : "PUT"};
      d.dispatch(req, this.res);
      this.res.expectStatus(414);
    });

    it ("405s on a resource-unsupported method", function(){
      var d = new Router();
      var simpleModule = this.simpleModule;
      d.route('/', simpleModule);
      d.route('/hello', { GET : function(req, res){res.send("hello world");}});
      var req = { url : "http://asdf.com/hello", method : "PUT"};
      d.dispatch(req, this.res);
      this.res.expectStatus(405);
      this.res.expectHeader('Allow', 'OPTIONS,GET,HEAD');
    });
    it ("500s on a directly thrown exception", function(){
      var d = new Router();
      var simpleModule = this.simpleModule;
      d.route('/', simpleModule);
      d.route('/fail', { GET : function(req, res){ throw 'wthizzle';}});
      var req = { url : "http://asdf.com/fail", method : "GET"};
      d.dispatch(req, this.res);
      this.res.expectStatus(500);
    });

    it ("501s on a server-unsupported method", function(){
      var d = new Router();
      var simpleModule = this.simpleModule;
      d.route('/', simpleModule);
      d.route('/hello', { GET : function(req, res){res.send("hello world");}});
      var req = { url : "http://asdf.com/hello", method : "TRACE"};
      d.dispatch(req, this.res);
      this.res.expectStatus(501);
    });
    it ("can route an object with a POST", function(){
        var d = new Router();
        d.route('/', { POST : function(req, res){res.end("POST");}});
        var req = { url : "http://asdf.com/", method : "POST"};
        d.dispatch(req, this.res);
        this.res.expectEnd("POST");
    });
    it ("can dispatch a url with a querystring", function(){
        var d = new Router();
        d.route('/', { GET : function(req, res){res.end("GET");}});
        var req = { url : "http://asdf.com/?asdf=1234", method : "GET"};
        d.dispatch(req, this.res);
        this.res.expectEnd("GET");
    });

    describe("when the method is HEAD", function(){
      // HEAD is the same as GET, but without a response body
      // It should call resource's GET or collectionGET, strip the body, and
      // return the rest.
      it ("404s if the resource doesn't exist", function(){
          var d = new Router();
          var req = { url : "http://asdf.com/asdf", method : "OPTIONS"};
          d.dispatch(req, this.res);
          this.res.expectStatus(404);
      });
      it ("405s if the resource has no GET", function(){
          var d = new Router();
          d.route('/', { POST : function(req, res){return "POST";}});
          var req = { url : "http://asdf.com/", method : "HEAD"};
          d.dispatch(req, this.res);
          this.res.expectStatus(405);
      });
      it ("204s (no body) if the resource has a GET", function(){
          var d = new Router();
          d.route('/', { GET : function(req, res){
                              res.setHeader("Content-Type", 'application/wth');
                              res.end("GET output");
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
      it ("sets the proper headers for OPTIONS if the resource exists", function(){
          var d = new Router();
          d.route('/', { GET : function(req, res){
                              res.end("GET output");
                        }});
          var req = { url : "http://asdf.com/", method : "OPTIONS"};
          d.dispatch(req, this.res);
          this.res.expectStatus(204);
          this.res.expectHeader('Allow', 'OPTIONS,GET,HEAD');
      });
    });
    it ("finds and runs a GET handler at a sub path", function(){
          var d = new Router();
          d.route('/', { GET : function(req, res){
                              res.end("GET output");
                        }});
          d.route('/subpath', { 
                              GET : function(req, res){
                                res.end("GET output 2");
                              },
                              DELETE : function(req, res){
                                res.end("delete");
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
