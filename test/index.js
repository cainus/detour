var should = require('should');
var http = require('http');
var Router = require('../index');
var verity = require('verity');
var request = require('request');
var assert = require('assert');

var PORT = 9999;

var getServer = function(router, cb){
  var server = http.createServer(function(req, res){
    router.middleware(req, res);
  }).listen(PORT, function(err){
      if (err) throw err;
      cb(null, server);
    });
};


describe("detour", function(){
  var server;
  var v;

  describe("getMethods", function(){
    it ("gets the implemented methods for a resource", function(done){
      var router = new Router();
      router.route('/test/:testid', {
        GET : function(req, res){
          req.pathVar.testid.should.equal('1234');
          res.end('worked: ' + JSON.stringify(req.pathVar));
        }
      });
      var route = router.getRoute("/test/1234");
      router.getMethods(route.resource)
        .should.eql(["GET", "HEAD", "OPTIONS"]);
      done();
    });
  });

  describe("in a server environment", function(){

    beforeEach(function(done){
      v = verity('http://localhost:9999', 'GET');
      v.expectBody('worked');
      v.expectStatus(200);
      done();
    });

    afterEach(function(done){
      if (server){
        server.close(function(){
          done();
          server = null;
        });
      } else {
        done();
      }
    });

    it ("200s for plain GET", function(done){
      var router = new Router();
      router.route('/', {
        GET : function(req, res){
          res.end('worked');
        }
      });
      getServer(router, function(err, serv){
        server = serv;
        v.test(done);
      });
    });
    it ("can be created without `new`", function(done){
      var router = Router();
      router.route('/', {
        GET : function(req, res){
          res.end('worked');
        }
      });
      getServer(router, function(err, serv){
        server = serv;
        v.test(done);
      });
    });
    it ("can route multiple times", function(done){
      var router = new Router();
      router.route('/', {
        GET : function(req, res){
          res.end('failed');
        }
      });
      router.route('/test', {
        GET : function(req, res){
          res.end('worked');
        }
      });
      router.route('/test/:id', {
        GET : function(req, res){
          res.end('failed');
        }
      });
      router.routes.length.should.equal(3);
      getServer(router, function(err, serv){
        server = serv;
        v.uri = v.uri.path("test");
        v.test(done);
      });
    });
    it ("200s for plain POST", function(done){
      var router = new Router();
      router.route('/', {
        POST : function(req, res){
          res.end('worked');
        }
      });
      getServer(router, function(err, serv){
        server = serv;
        v.method('POST');
        v.test(done);
      });
    });
    it ("in middleware a next callback is passed to a route", function(done){
      var getServer = function(router, cb){
        server = http.createServer(function(req, res){
          router.middleware(req, res, function(err){
            res.end(err.message);
          });
        }).listen(9999, function(err){
          if (err) throw err;
          cb(null, server);
        });
      };
      var router = new Router();
      router.route('/test', {
        GET: function(req, res, next){
          next({
            message: 'next works!'
          });
        }
      });
      getServer(router, function(err, server){
        v = verity('http://localhost:9999/test', 'GET');
        v.expectBody('next works!');
        v.test(done);
      });
    });
    describe("pathVar", function(){
      it ("sets pathVar with variables from the url", function(done){
        var router = new Router();
        router.route('/test/:testid', {
          GET : function(req, res){
            req.pathVar.testid.should.equal('1234');
            res.end('worked: ' + JSON.stringify(req.pathVar));
          }
        });
        getServer(router, function(err, serv){
          server = serv;
          v.uri = v.uri.path("test/1234");
          v.expectBody('worked: {"testid":"1234"}');
          v.test(done);
        });
      });
    });
    describe("use", function(){
      it("accepts connect-style middleware for later processing", function(done){
        var router = new Router();
        router.use(function(req, res, next){
          req.detourHandler.added.should.equal(true);
          req.whatever = "monkeypatched!";
          next();
        });
        router.route('/test', {
          added : true,
          GET : function(req, res){
            res.end(req.whatever);
          }
        });
        getServer(router, function(err, serv){
          server = serv;
          v.method('GET');
          v.uri = v.uri.path("test");
          v.expectBody('monkeypatched!');
          v.test(done);
        });
      });
    });
    describe("collection", function(){
      it("errors if it doesn't get a collection object", function(done){
        var router = new Router();
        try {
          router.collection('/test/:testid', {});
          should.fail("expected exception!");
        } catch(ex){
          ex.message.should.equal('route.collection() requires an object with a `collection` property.  Path was: /test/:testid');
          done();
        }
      });
      it("does not error if it doesn't get a member object", function(done){
        var router = new Router();
        router.collection('/test/:testid', { collection : { GET : function(req, res){res.end();}}});
        done();
      });
      it("routes the collection objects", function(done){
        var router = new Router();
        router.collection('/test/:testid', {
          collection : {
            GET : function(req, res){
              res.end('collection here!');
            }
          },
          member : {
            GET : function(req, res){
              req.pathVar.testid.should.equal('1234');
              res.end('member here! ' + JSON.stringify(req.pathVar));
            }
          }
        });
        getServer(router, function(err, serv){
          server = serv;
          v.uri = v.uri.path("test/");
          v.expectBody('collection here!');
          v.test(done);
        });
      });
      it("routes the member object", function(done){
        var router = new Router();
        router.collection('/test/:testid', {
          collection : {
            GET : function(req, res){
              res.end('collection here!');
            }
          },
          member : {
            GET : function(req, res){
              req.pathVar.testid.should.equal('1234');
              res.end('member here! ' + JSON.stringify(req.pathVar));
            }
          }
        });
        getServer(router, function(err, serv){
          server = serv;
          v.uri = v.uri.path("test/1234");
          v.expectBody('member here! {"testid":"1234"}');
          v.test(done);
        });
      });
    });
    describe("404", function(){
      it ("has a default 404 if none is specified the middleware is not given a next()",
        function(done){
        var router = new Router();
        getServer(router, function(err, serv){
          server = serv;
          v.uri = v.uri.child("doesNotExist");
          v.expectStatus(404);
          v.expectBody('Not found');
          v.test(function(e, r, b){
            done();
          });
        });
      });

      it ("has on(404) for registering a new 404 handler", function(done){
        var router = new Router();
        router.on(404, function(req, res){
          res.writeHead(400);
          res.write("bad request");
          res.end();
        });
        getServer(router, function(err, serv){
          server = serv;
          v.uri = v.uri.child("doesNotExist");
          v.expectStatus(400);
          v.expectBody('bad request');
          v.test(done);
        });
      });
      it ("uses middleware's next() param for 404s, if defined", function(done){
        var getServer = function(router, cb){
          var server = http.createServer(function(req, res){
            router.middleware(req, res, function(){
              res.end("next works!");
            });
          }).listen(9999, function(err){
              if (err) throw err;
              cb(null, server);
            });
        };
        var router = new Router();
        router.on(404, function(req, res){
          res.writeHead(400);
          res.write("bad request");
          res.end();
        });
        getServer(router, function(err, serv){
          server = serv;
          v.uri = v.uri.child("doesNotExist");
          v.expectStatus(200);
          v.expectBody('next works!');
          v.test(done);
        });
      });
    });
    describe("405", function(){
      it ("has a default 405 handler if none is specified",
        function(done){
        var router = new Router();
        router.route('/', {
          GET : function(req, res){
            res.end('worked');
          }
        });
        getServer(router, function(err, serv){
          server = serv;
          v.method("DELETE");
          v.expectHeader('allow', 'GET,HEAD,OPTIONS');
          v.expectStatus(405);
          v.expectBody('Not allowed');
          v.test(function(e, r, b){
            done();
          });
        });
      });
      it ("has on(405) for registering a new 405 handler", function(done){
        var router = new Router();
        router.route('/', {
          GET : function(req, res){
            res.end('worked');
          }
        });
        router.on(405, function(req, res){
          res.writeHead(400);
          res.write("bad request");
          res.end();
        });
        getServer(router, function(err, serv){
          server = serv;
          v.method('DELETE');
          v.expectStatus(400);
          v.expectBody('bad request');
          v.test(done);
        });
      });
    });

    describe("HEAD", function(){
      it ("routes to GET when HEAD is requested (and returns an empty body)", function(done){
        var router = new Router();
        router.route('/', {
          GET : function(req, res){
            res.end('worked');
          }
        });
        getServer(router, function(err, serv){
          server = serv;
          v.method('HEAD');
          v.expectStatus(200);
          v.expectBody('');
          v.test(done);
        });
      });

      it ("405s when HEAD is requested if GET is not defined", function(done){
        var router = new Router();
        router.route('/', {
          POST : function(req, res){
            res.end('worked');
          }
        });
        getServer(router, function(err, serv){
          server = serv;
          v.method('HEAD');
          v.expectStatus(405);
          v.expectBody('');
          v.test(done);
        });
      });
      it ("allows the resource to override the default HEAD", function(done){
        var router = new Router();
        router.route('/', {
          HEAD : function(req, res){
            res.writeHead(400);
            res.end('worked');
          }
        });
        getServer(router, function(err, serv){
          server = serv;
          v.method('HEAD');
          v.expectBody("");
          v.expectStatus(400);
          v.test(done);
        });
      });
      it ("has on('HEAD') for registering a new HEAD handler", function(done){
        var router = new Router();
        router.route('/', {
          GET : function(req, res){
            res.end('worked');
          }
        });
        router.on('HEAD', function(req, res){
          res.writeHead(400);
          res.write("bad request"); // this will get muted
          res.end();
        });
        getServer(router, function(err, serv){
          server = serv;
          v.method('HEAD');
          v.expectStatus(400);
          v.expectBody('');
          v.test(done);
        });
      });
    });
    describe("OPTIONS", function(){
      it ("200s for plain OPTIONS with a default OPTIONs handler", function(done){
        var router = new Router();
        router.route('/', {
          GET : function(req, res){
            res.end('worked');
          }
        });
        getServer(router, function(err, serv){
          v.method('OPTIONS');
          v.expectHeader('allow', 'GET,HEAD,OPTIONS');
          v.expectBody("Allow: GET,HEAD,OPTIONS");
          server = serv;
          v.test(done);
        });
      });
      it ("allows the resource to override the default OPTIONS", function(done){
        var router = new Router();
        router.route('/', {
          OPTIONS : function(req, res){
            res.end('worked');
          }
        });
        getServer(router, function(err, serv){
          server = serv;
          v.method('OPTIONS');
          v.expectBody("worked");
          v.test(done);
        });
      });
      it ("doesn't show HEAD if GET is not defined", function(done){
        var router = new Router();
        router.route('/', {
          POST : function(req, res){
            res.end('worked');
          }
        });
        getServer(router, function(err, serv){
          v.method('OPTIONS');
          v.expectBody("Allow: POST,OPTIONS");
          server = serv;
          v.test(done);
        });
      });
      it ("has on('OPTIONS') for registering a new OPTIONS handler", function(done){
        var router = new Router();
        router.route('/', {
          GET : function(req, res){
            res.end('worked');
          }
        });
        router.on('OPTIONS', function(req, res){
          res.writeHead(400);
          res.write("bad request");
          res.end();
        });
        getServer(router, function(err, serv){
          server = serv;
          v.method('OPTIONS');
          v.expectStatus(400);
          v.expectBody('bad request');
          v.test(done);
        });
      });
    });
    describe('failed parameter decoding', function(){
      it('surfaces the error properly', function(done) {
        var router = new Router();
        router.route('/x/:y', {
          GET: function(){}
        });
        var server = http.createServer(function(req, res){
          router.middleware(req, res, function (err) {
            res.writeHead(400);
            res.write(err.message);
            res.end();
          });
        }).listen(PORT, function(err){
          if (err) throw err;
          // NOTE - can't use verity here b/c it sanitizes this badly formed URL
          request('http://localhost:' + PORT + '/x/asdf%', function (err, resp) {
            assert.equal(resp.statusCode, 400);
            assert.equal(resp.body, "Failed to decode param 'asdf%'");
            done();
          });
        });

      });
    });
  });
});
