/**
 * Module dependencies.
 */

var Route = require('./route');
var methods = require('methods');
var debug = require('debug')('router');
var urlgrey = require('urlgrey');

/**
 * Expose `Router` constructor.
 */

exports = module.exports = Router;

/**
 * Initialize a new `Router` with the given `options`.
 *
 * @param {Object} options
 * @api private
 */

function Router(options) {
  if ( !(this instanceof Router) ) {
    return new Router(options);
  }
  options = options || {};
  var self = this;
  this.routes = [];
  this.caseSensitive = options.caseSensitive;
  this.strict = options.strict;
  this.middleware = function (req, res, next){
    dispatch(self, req, res, next);
  };
  this.eventHandlers = {
    404 : function(req, res){
      res.writeHead(404);
      res.end('Not found');
    },
    405 : function(req, res, resource){
      res.setHeader('Allow', allowHeader(self, resource));
      res.writeHead(405);
      res.end('Not allowed');
    },
    'HEAD' : function(req, res, resource){
      if (!resource.GET){
        return self.eventHandlers[405](req, res, resource);
      }
      // node server suppresses the response output
      // on a HEAD response so we don't need to mute it like this:
      /*

      var origResWrite = res.write;
      var origResEnd = res.end;

      res.write = function(){
        origResWrite.apply(res, ['']);
      };
      res.end = function(){
        console.log("in muted end()");
        origResEnd.apply(res, ['']);
      };
      */
      return resource.GET(req, res);
    },
    'OPTIONS' : function(req, res, resource){
      var header = allowHeader(self, resource);
      res.setHeader('Allow', header);
      res.writeHead(200);
      res.end('Allow: ' + header);
    }
  };
  // we never tackle 501, because the node server just drops requests
  // with invalid methods
}


Router.prototype.getRoute = function(url){
  var path = urlgrey(url).path();
  var routes = this.routes;
  var route;

  // matching routes
  for (var i = 0; i < routes.length; ++i) {
    route = routes[i];
    if (route.match(path)) {
      return route;
    }
  }

};

Router.prototype.route = function(path, resource){
  // ensure resource was given
  if (!resource) throw new Error('Router#' + path + '() requires a resource');

  // create the route
  debug('defined %s ', path);
  var route = new Route(path, resource, {
    sensitive: this.caseSensitive,
    strict: this.strict
  });

  // add it
  this.routes.push(route);
  return this;
};

Router.prototype.on = function(event, handler){
  var eventWhiteList = [
    404, 405, 'HEAD', 'OPTIONS'
  ];
  if (eventWhiteList.indexOf(event) == -1){
    var msg = "Invalid event type: " + event + ". Choose from: " + eventWhiteList.join(", ");
    throw new Error(msg);
  }
  this.eventHandlers[event] = handler;
};

Router.prototype.getMethods = function(resource){
  var supportedMethods = [];
  for (var method in resource){
    if (methods.indexOf(method.toLowerCase()) !== -1){
      supportedMethods.push(method);
    }
  }
  if (resource.GET){
    supportedMethods.push("HEAD");
  }
  if (supportedMethods.length > 0){
    supportedMethods.push("OPTIONS");
  }
  return supportedMethods;
};

var allowHeader = function(router, resource){
  var allowedMethods = router.getMethods(resource);
  return allowedMethods.join(",");
};


var dispatch = function(router, req, res, next){
  var route;

  debug('dispatching %s %s', req.method, req.url);

  req.route = route = router.getRoute(req.url);
  if (!route){
    if (next){
      return next();
    }
    return router.eventHandlers[404](req, res);
  }
  req.pathVar = {};
  for (var pvar in route.params){
    req.pathVar[pvar] = route.params[pvar];
  }
  var resource = route.resource;
  var resourceMethod = req.method.toUpperCase();
  if (!resource[resourceMethod]){
    if (resourceMethod == 'HEAD'){
      return router.eventHandlers.HEAD(req, res, resource);
    }
    if (resourceMethod == 'OPTIONS'){
      return router.eventHandlers.OPTIONS(req, res, resource);
    }
    return router.eventHandlers[405](req, res, resource);
  }
  resource[resourceMethod](req, res, next);

};

