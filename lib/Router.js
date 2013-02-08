var _ = require('underscore');
var fs = require('fs');
var DetourError = require('./DetourError');
var FSRouteLoader = require('./FSRouteLoader');
var url = require('url');
var querystring = require('querystring');
var serverSupportedMethods = ["GET", "POST", 
                              "PUT", "DELETE",
                              "HEAD", "OPTIONS"];
var RouteCollection = require('./RouteCollection');
var staticMiddleware = require('./staticMiddleware');
var domain = require('domain');

function Router(){
  this.routes = new RouteCollection();
  this.staticDir = null;
  this.requestNamespace = 'detour';  // req.detour will have this object
  var that = this;
  this.resourceDecorator = function(handler){ return handler; };

}

_.each([414, 404, 405, 501, 500, 'OPTIONS'], function(type){
  Router.prototype['on' + type] = function(handler){  
    this['handle' + type] = function(context, err){
      handler(context, err);
    };
  } ;
});

// cb simply takes an err object.  It is called when the directory is done loading.
Router.prototype.routeDirectory = function(dir, path, cb){
  if (!cb){
    return cb(new DetourError("Missing Callback", "Directory routing requires a callback as the third parameter."  ));
  }
  if (!path || !_.isString(path)){
    return cb(new DetourError("Missing or non-string path", "Directory routing requires a path string as the second parameter."  ));
  }
  this.loader = new FSRouteLoader(this, dir, path);
  this.loader.load(cb);
};

// given a url, return the handler object for it
Router.prototype.getHandler = function(url){
  var route;
  var newex;
  try { 
    route = this.routes.get(url);
  } catch (ex){
    switch(ex){
      case "Not Found":
        throw new DetourError('404', 'Not Found', "" + url);
      case "URI Too Long":
        throw new DetourError('414', 'Request-URI Too Long', "");
      default:
        console.log(ex);
        throw ex;
    }
  }
  return route.handler;
};

// get the variables pulled out of a star route
Router.prototype.pathVariables = function(url){
  var path = getPath(url);
  var route;
  try {
    route = this.routes.get(path);
  } catch(ex){
    if (ex === "Not Found"){
      throw new DetourError('NotFound', 'That route is unknown.', path);
    } else {
      throw ex;
    }
  }
  var varnames = pathVariableNames(route);
  var matches = path.match(route.matcher);
  var retval = {};
  for (var i =0; i < varnames.length; i++){
    retval[varnames[i]] = querystring.unescape(matches[i + 1]);
  }
  return retval;
};

// takes a function called 'decorator'
// decorator should be a function itself.
// decorator's input should be a resource
// decorator should return a resource
Router.prototype.setResourceDecorator = function(decorator){
  this.resourceDecorator = decorator;
};


Router.prototype.dispatch = function(context){
  var that = this;
  if (!!this.staticDir){
    staticMiddleware(this.staticDir)(context.req, context.res, function(){
      that.dynamicDispatch(context);
    });
  } else {
    that.dynamicDispatch(context);
  }
};


Router.prototype.dynamicDispatch = function(context){
  // "context" is any object with req and res properties 
  // on them representing an HTTP request and response.
  var url = context.req.url;
  var that = this;
  var handler;
  var route;
  try { 
    route = this.routes.get(url);
  } catch (ex){
    switch(ex){
      case "Not Found":
        return this.handle404(context);
      case "URI Too Long":
        return this.handle414(context);
      default:
        console.log("unknown route error: ");
        console.log(ex);
        throw ex;
    }
  }

  handler = route.handler;

  var method = context.req.method;
  if (!_.include(serverSupportedMethods, method)){
    // node.js currently will disconnect clients requesting methods
    // that it doesn't recognize, so we can't properly 501 on those.
    // We can 501 on ones we don't support (that node does) that 
    // make it through though.
    return this.handle501(context);
  }
  if (!handler[method]){
    return this.handle405(context);
  }

  var requestDomain = domain.create();
  requestDomain.on('error', function(err) {
    that.handle500(context, err);
    requestDomain.dispose();
  });
  requestDomain.run(function(){
    return handle(that, handler, context, method);
  });

};

var handle = function(router, handler, context, methodOverride){
  // 'methodOverride' may be an override
  // for what's already on context.req.method.  
  // For example, HEAD requests will be treated 
  // as GET.
  var method = methodOverride || context.req.method;

  // Clone the handler, and mix-in the context properties
  // (req, res)
  var handlerObj = _.clone(handler);
  router.onRequest(handlerObj, context, function(err, newContext){
    if (!err){
      return callHandlerMethod(handlerObj, method, newContext);
      //return handlerObj[method](newContext);
    } else {
      router.handle500(newContext, err); // TODO: get under test
    }
  });
};


var callHandlerMethod = function(handler, methodName, context){
  switch(handler[methodName].length){
    case 1:
      return handler[methodName](context);
    case 2:
      return handler[methodName](context.req, context.res);
    default:  // 3 params+, where additional ones are ignored.
      return handler[methodName](context.req, context.res, context);
  }
};


Router.prototype.getParentUrl = function(urlStr){
    var urlObj = url.parse(urlStr);
    urlStr = urlObj.pathname;
    if (urlStr === '/'){
      throw new DetourError('NoParentUrl', 'The given path has no parent path', '/');
    }
    var pieces = urlStr.split('/');
    pieces = _.filter(pieces, function(piece){
                                  return piece !== '';
                              });
    pieces.pop();
    var outUrl = urlJoin(pieces);
    // TODO check with routes.get() to see if the parent exists and error if not.
    return outUrl;  
};

Router.prototype.getUrl = function(path, var_map){

  var_map = var_map || {};
  var route;
  try {
    route = this.routes.get(path);
  } catch(ex) {
    if (ex === "Not Found"){
      throw new DetourError("NotFound", 
                            'That route is unknown.',
                            path);
    } else {
      throw ex;
    }
  }

  var varnames = pathVariableNames(route);
  for(var varname in var_map){
    if (!_.include(varnames, varname)){
      throw new DetourError("UnknownVariableName",
                  "One of the provided variable names was unknown.",
                  varname);
    }
  }
  var value;
  _.each(varnames, function(varname){
    value = var_map[varname];
    if (!value){
      throw new DetourError("MissingVariable",
                  "One of the necessary variables was not provided.",
                  varname);
    }
    var reStr = "\\:" + varname;
    var re = new RegExp(reStr);
    path = path.replace(re, value);
  });
  return path;
};

Router.prototype.onRequest = function(handler, context, cb){
  // do nothing by default
  // can be overridden though
  cb(null, context);
};


Router.prototype.staticRoute = function(path, cb){
  var that = this;
  dirExists(path, function(exists){
    if (exists){
      that.staticDir = path;
      cb();
    } else {
      cb("static directory does not exist: ", path);
    }
  });
};

Router.prototype.route = function(path, handler){

  if (_.isNull(handler) || _.isUndefined(handler)){
      throw new DetourError('ArgumentError',
        "route() requires a handler argument.",
        '');
  }

  if (_.isFunction(handler)){
    // if it's a function, assume it's for GET
    handler = {GET : handler};
  } else {
    if (!handlerHasHttpMethods(handler)){
      throw new DetourError(
           "HandlerHasNoHttpMethods", 
           "The handler you're trying to route to should implement HTTP methods.",
           ''
      );
    }
  }

  var that = this;

  // add handler for HEAD if it doesn't exist
  if (!handler.HEAD && !!handler.GET){
    handler.HEAD = function(context){
      that.handleHEAD(context); 
    };
  }
  // add handler for OPTIONS if it doesn't exist
  if (!handler.OPTIONS){
    handler.OPTIONS = function(context){ that.handleOPTIONS(context); };
  }

  var newHandler = this.resourceDecorator(handler);

  this.routes.set(path, newHandler);

  return true;
};

Router.prototype.handle414 = function(context){
  context.res.writeHead(414);
  context.res.end();
};

Router.prototype.handle404 = function(context){
  context.res.writeHead(404);
  context.res.end();
};

Router.prototype.handle405 = function(context){
  context.res.writeHead(405);
  this.setAllowHeader(context);
  context.res.end();
};

Router.prototype.setAllowHeader = function(context){
  context.res.setHeader('Allow', allowHeader(this, context.req.url));
};

Router.prototype.handle501 = function(context){
  context.res.writeHead(501);
  context.res.end();
};

Router.prototype.handle500 = function(context, ex){
  context.res.writeHead(500);
  context.res.end();
};

Router.prototype.handleOPTIONS = function(context){
  context.res.writeHead(204);
  this.setAllowHeader(context);
  context.res.end();
};

Router.prototype.handleHEAD = function(context){
  var res = context.res;
  var handler = this.getHandler(context.req.url);
  if (!handler.GET){
    return this.handle405(context);
  }
  res.origEnd = res.end;
  res.end = function(){
    res.origEnd();
  };
  res.origWrite = res.write;
  res.write = function(){ };
  res.origWriteHead = res.writeHead;
  res.writeHead = function(code){
    if (code === 200){
      res.origWriteHead(204);
    } else {
      res.origWriteHead(code);
    }
  };
  res.statusCode = 204;
  handle(this, handler, context, 'GET');
};

module.exports = Router;


// unexposed helpers ---------
var allowHeader = function(d, url){
  var handler = d.getHandler(url);
  var methods = getMethods(handler);
  methods = _.union(["OPTIONS"], methods);
  return methods.join(",");
};

var urlJoin = function(){
	// put a fwd-slash between all pieces and remove any redundant slashes
	// additionally remove the trailing slash
  var pieces = _.flatten(_.toArray(arguments));
  var joined = pieces.join('/').replace(/\/+/g, '/');
	joined = joined.replace(/\/$/, '');
  if ((joined.length === 0) || (joined[0] != '/')){ joined = '/' + joined; }
  return joined;
};

var getPath = function(urlstr){
  var path = url.parse(urlstr).pathname;
  return urlJoin(url.parse(urlstr).pathname);
};

var handlerHasHttpMethods = function(handler){
  var methods = getMethods(handler);
  return methods.length > 0;
};

var getMethods = function(handler){
  var moduleMethods = _.functions(handler);
  var retval = _.intersection(moduleMethods, serverSupportedMethods);
  return retval;
};


var pathVariableNames = function(route){
  return _.map(route.keys, function(key){
    return key.name;
  });
};

var startsWith = function(str, prefix){
  return (str.indexOf(prefix) === 0);
};

var removePrefix = function(str, prefix){
  if (startsWith(str, prefix)){
    return str.substring(prefix.length);
  }
};

var dirExists = function(d, cb) {
  fs.stat(d, function (er, s) { cb(!er && s.isDirectory()); });
};
