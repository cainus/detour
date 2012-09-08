var _ = require('underscore');
var events = require('events');
var DetourError = require('./DetourError').DetourError;
var FSRouteLoader = require('./SamFSRouteLoader').SamFSRouteLoader;
var url = require('url');
var querystring = require('querystring');
var serverSupportedMethods = ["GET", "POST", 
                              "PUT", "DELETE",
                              "HEAD", "OPTIONS"];
var RouteTree = require('./RouteTree').RouteTree;
var FreeRouteCollection = require('./FreeRouteCollection');


function Router(path){
  this.path = path || '/';
  this.path = urlJoin(this.path);
  this.shouldHandle404s = true;
  this.shouldThrowExceptions = false;
  this.routeTree = new RouteTree(path);
  this.freeRoutes = new FreeRouteCollection();
  this.routes = {};
  this.names = {};
  this.requestNamespace = 'detour';  // req.detour will have this object
  var that = this;
  this.connectMiddleware = function(req, res, next){
    that.dispatch(req, res, next);
  };

}

Router.prototype = Object.create(events.EventEmitter.prototype);

// cb simply takes an err object.  It is called when the directory is done loading.
Router.prototype.routeDirectory = function(dir, cb){
  this.loader = new FSRouteLoader(this, dir);
  this.loader.load(cb);
};

// given a url, return the handler object for it
Router.prototype.getHandler = function(url){
  var route;
  var newex;
  try {
    route = this.routeTree.get(url);
  } catch(ex){
      switch(ex){
        case "Not Found" :
          try { 
            route = this.freeRoutes.get(url);
          } catch (ex){
            if (ex === "Not Found"){
              throw new DetourError('404', 'Not Found', "" + url);
            } else {
              console.log(ex);
              throw newex;
            }
          }
          break;
        case "URI Too Long" :
          newex = new DetourError('414', 'Request-URI Too Long');
          throw newex;
        default :
          throw ex;
     }
  }
  return route.handler;
};

// get the variables pulled out of a star route
Router.prototype.pathVariables = function(url){
  var path = getPath(url);
  var route = this.routeTree.getUrlRoute(path);
  var varnames = pathVariableNames(route);
  var matches = path.match(route.regex);
  var retval = {};
  for (var i =0; i < varnames.length; i++){
    retval[varnames[i]] = querystring.unescape(matches[i + 1]);
  }
  return retval;
};


Router.prototype.onRequest = function(handler, req, res, cb){
  // do nothing by default
  // can be overridden though
  cb(null, handler);
};

Router.prototype.dispatch = function(req, res, next){
  req[this.requestNamespace] = this;
  var that = this;
  var handler;
  var route;
  try {
    route = this.routeTree.get(req.url);
  } catch (ex){
    if (this.shouldThrowExceptions){
      var newex;
      switch(ex){
        case "Not Found" :
          try { 
            route = this.freeRoutes.get(req.url);
          } catch (ex){
            if (ex === "Not Found"){
              throw new DetourError('404', 'Not Found', "" + url);
            } else {
              console.log(ex);
              throw newex;
            }
          }
          break;
        case "URI Too Long" :
          newex = new DetourError('414', 'Request-URI Too Long');
          throw newex;
        default :
          throw ex;
      }
    }
    // if we shouldn't throw exceptions...
    switch(ex){
      case "Not Found" :
        try { 
          route = this.freeRoutes.get(req.url);
        } catch (ex){
          if (ex === "Not Found"){
            if (this.shouldHandle404s){
              return this.handle404(req, res);
            } else {
              return next();
            }
          } else {
            console.log("unknown route error: ");
            console.log(ex);
            throw ex;
          }

        }
        break;
      case "URI Too Long" :
        return this.handle414(req, res);
      default :
        throw ex;
    }
  }
  handler = route.handler;

  var method = req.method;
  if (!_.include(serverSupportedMethods, method)){
    // node.js currently will disconnect clients requesting methods
    // that it doesn't recognize, so we can't properly 501 on those.
    // We can 501 on ones we don't support (that node does) that 
    // make it through though.
    if (this.shouldThrowExceptions){ 
      throw new DetourError('501', 'Not Implemented');
    } else {
      return this.handle501(req, res);
    }
  }
  if (!handler[method]){
    if (this.shouldThrowExceptions){ 
      throw new DetourError('405', 'Method Not Allowed');
    } else {
      return this.handle405(req, res);
    }
  }
  try {
    executeMiddleware(route.middlewares, req, res, function(err){
      if (err) throw err;
      return handle(that, handler, method, req, res);
    });
  } catch(ex){
    if (this.shouldThrowExceptions){ 
      throw new DetourError('500', 'Internal Server Error', ex);
    } else {
      this.handle500(req, res, ex);
    }
  }
};

var handle = function(router, handler, method, req, res){
  var handlerObj = _.clone(handler);
  router.onRequest(handlerObj, req, res, function(err, newHandlerObj){
    if (!err){
      handlerObj.req = req;
      handlerObj.res = res;
      return newHandlerObj[method](handlerObj);
    } else {
      this.handle500(req, res, err);
    }
  });
};

var getMatchingRoutePaths = function(that, urlStr, pathVars){
  var matchingPaths = [];
  var path = that.routeTree.getUrlRoute(urlStr).path;
  var urlObj = url.parse(urlStr);
  var starPath = that.routeTree.isStarPath(path);
  var paths = that.routeTree.getPaths(urlStr, pathVars);
  _.each(paths, function(pathStr){
    if (pathStr != path && startsWith(pathStr, path)){
      if ((removePrefix(pathStr, path).substring(1).indexOf("/")) === -1){
        var url;
        if (starPath){
          url = that.getUrl(pathStr, pathVars);
        } else {
          url = pathStr;
        }
        var kid;
        if (!!urlObj.protocol && !!urlObj.host){
          kid = urlObj.protocol + '/' + urlJoin(urlObj.host, url);
        } else {
          kid = urlJoin(url);
        }
        matchingPaths.push(pathStr);
      }
    }
  });
  return matchingPaths;
};

Router.prototype.getChildUrls = function(urlStr){
  var pathVars = this.pathVariables(urlStr);
  var that = this;
  var matchingPaths = getMatchingRoutePaths(that, urlStr, pathVars);
  var urlObj = {};
  _.each(matchingPaths, function(path){
    var pathonly = getPath(path);
    pathonly = that.getUrl(pathonly, pathVars);
    try {
      urlObj[pathonly] = pathToName(that, path);
    } catch(ex) {
      if (ex == 'NotFound'){
        urlObj[pathonly] = null;
      } else {
        throw ex;
      }
    }
  });
  return urlObj;
};

Router.prototype.getNamedChildUrls = function(urlStr){
  var urls = this.getChildUrls(urlStr);
  var namedurls = {};
  _.each(urls, function(v, k){ if (!!v){ namedurls[v] = k; }});
  return namedurls;
};

Router.prototype.getParentUrl = function(urlStr){
  var path = this.routeTree.getUrlRoute(urlStr).path;
  if (path == '/'){
    throw new DetourError('NoParentUrl', 'The given path has no parent path', '/');
  }
  var pieces = path.split('/');
  pieces.pop();
  return  urlJoin(pieces);
};

Router.prototype.getUrl = function(path, var_map){
  // if it's a name and not a path, get the path...
  path = pathIfName(this, path);

  var_map = var_map || {};
  var route = this.routeTree.getUrlRoute(path);
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
    var reStr = "\\*" + varname;
    var re = new RegExp(reStr);
    path = path.replace(re, value);
  });
  return path;
};


Router.prototype.before = function(paths, middlewares){
  if (!_.isArray(paths)){
    throw 'before() requires an array of paths as the first parameter';
  }
  if (!_.isArray(middlewares)){
    throw 'before() requires an array of functions as the second parameter';
  }
  var that = this;
  _.each(paths, function(path){
    // validate the path
    path = pathIfName(that, path);
    var route = that.routeTree.get(path);
    // push each middleware onto its middleware array
    _.each(middlewares, function(m){
      route.middlewares.push(m);
    });
  });
};

Router.prototype.freeRoute = function(path, handler){
  this.route(path, handler, true);
};

Router.prototype.route = function(inPath, handler, free){
  free = free || false;

  if (_.isNull(handler) || _.isUndefined(handler)){
      throw new DetourError('ArgumentError',
        "route() requires a handler argument.",
        '');
  }

  var path = urlJoin(this.path, inPath);

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
      that.handleHEAD(context.req, context.res); 
    };
  }
  // add handler for OPTIONS if it doesn't exist
  if (!handler.OPTIONS){
    handler.OPTIONS = function(context){ that.handleOPTIONS(context.req, context.res); };
  }

  if (free){
    this.freeRoutes.set(inPath, handler);
  } else {
    this.routeTree.set(path, handler);
  }

  this.emit("route", handler);

  // A call to route() will return an object with a function 'as' for
  // naming the route. eg: d.route('/', handler).as('index')
  var chainObject = {as : function(name){ that.name(path, name); }};
  return chainObject;
};

Router.prototype.handle414 = function(req, res){
  res.writeHead(414);
  res.end();
};

Router.prototype.handle404 = function(req, res){
  res.writeHead(404);
  res.end();
};

Router.prototype.handle405 = function(req, res){
  res.writeHead(405);
  this.setAllowHeader(req, res);
  res.end();
};

Router.prototype.setAllowHeader = function(req, res){
  res.setHeader('Allow', allowHeader(this, req.url));
};

Router.prototype.handle501 = function(req, res){
  res.writeHead(501);
  res.end();
};

Router.prototype.handle500 = function(req, res, ex){
  res.writeHead(500);
  res.end();
};

Router.prototype.handleOPTIONS = function(req, res){
  res.writeHead(204);
  this.setAllowHeader(req, res);
  res.end();
};

Router.prototype.handleHEAD = function(req, res){
  var handler = this.getHandler(req.url);
  res.origEnd = res.end;
  res.end = function(){
    res.origEnd();
  };
  if (!handler.GET){
    return this.handle405(req, res);
  }
  res.writeHead(204);
  handle(this, handler, 'GET', req, res);
};


Router.prototype.name = function(path, name){
  if (name[0] == '/'){
    throw new DetourError("InvalidName", 
                "Cannot name a path with a name that starts with '/'.",
               "");
  }
  try {
    path = this.routeTree.getUrlRoute(path).path;
  } catch(ex) {
    if (ex.name == "NotFound"){
      throw new DetourError("PathDoesNotExist", 
                "Cannot name a path that doesn't exist",
                {path : path, name : name});
    }
    throw ex;
  }
  this.names[name] = path;
};

exports.Router = Router;

var executeMiddleware = function(middlewares, req, res, done){
  var middlewareIndex = -1;
  var next = function(err){
    middlewareIndex++;
    if (err){
      return done(err);
    } else {
      var m = middlewares[middlewareIndex];
      if (!!m){
        return m(req, res, next);
      } else {
        return done();
      }
    }
  };
  next();
};


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


var pathToName = function(d, inpath){
    var outname = null;
    inpath = getPath(inpath);
    _.any(d.names, function(path, name){
      if (path == inpath){
        outname = name;
        return true;
      }
    });
    if (outname === null){ throw "NotFound"; }
    return outname;
};

var pathIfName = function(d, path){
    if (path[0] != '/') {
      var origPath = path;
      path = d.names[path];
      if (!path){
        throw new DetourError("NotFound", "That route name is unknown.", origPath);
      }
    }
    return path;
};

var pathVariableNames = function(route){
  if (!route.regex) {
    return [];
  }
  var varnames = route.path.match(/\*([^\/]+)/g);
  varnames = _.map(varnames, function(name){return name.substring(1);});
  if (route.path === '/*'){
    varnames.push('root');
  }
  return varnames;
};

var startsWith = function(str, prefix){
  return (str.indexOf(prefix) === 0);
};

var removePrefix = function(str, prefix){
  if (startsWith(str, prefix)){
    return str.substring(prefix.length);
  }
};
