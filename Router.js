var _ = require('underscore');
var events = require('events');
var DetourError = require('./DetourError').DetourError;
var FSRouteLoader = require('./FSRouteLoader').FSRouteLoader;
var url = require('url');
var serverSupportedMethods = ["GET", "POST", 
                              "PUT", "DELETE",
                              "HEAD", "OPTIONS"];


function Router(path){
  this.path = path || '/';
  this.path = urlJoin(this.path);
  this.shouldHandle404s = true;
  this.shouldThrowExceptions = false;
  this.routes = {};
  this.starRoutes = [];
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
  var route = this.getRoute(url);
  if (!!route.handler){
    return route.handler;
  }
  throw new DetourError('404', 'Not Found', "" + url);
};

Router.prototype.getRoute = function(url){
  if (url.length > 4096){
    throw new DetourError('414', 'Request-URI Too Long');
  }
  var path = getPath(url);
  if (!!this.routes[path] && !!this.routes[path].handler){
    return this.routes[path];
  }
  // check the starRoutes if it's not static...
  try {
    return findStarRoute(this, path);
  } catch (ex) {
    if (!!ex.name && ex.name == 'NotFound'){
      throw new DetourError('404', 'Not Found', "" + url);
    } else {
      throw ex;
    }
  }
};

// get the variables pulled out of a star route
Router.prototype.pathVariables = function(url){
  var path = getPath(url);
  var route = getUrlRoute(this, path);
  var varnames = pathVariableNames(route);
  var matches = path.match(route.regex);
  var retval = {};
  for (var i =0; i < varnames.length; i++){
    retval[varnames[i]] = matches[i + 1];
  }
  return retval;
};


Router.prototype.onRequest = function(handler, req, res){
  // do nothing by default
  // can be overridden though
};

Router.prototype.dispatch = function(req, res, next){
  req[this.requestNamespace] = this;
  var that = this;
  var handler, route;
  try {
    route = this.getRoute(req.url);
  } catch (ex){
    if (this.shouldThrowExceptions){
      throw ex;
    }
    switch(ex.name){
      case "404" :
        if (this.shouldHandle404s){
          return this.handle404(req, res);
        } else {
          return next();
        }
        break;
      case "414" :
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
  try {
  router.onRequest(handlerObj, req, res);
  } catch(ex){
    console.log(ex);
  }
  return handlerObj[method](req, res);
};

var getMatchingRoutePaths = function(that, urlStr, pathVars){
  var matchingPaths = [];
  var path = getInputPath(that, urlStr);
  var urlObj = url.parse(urlStr);
  var starPath = isStarPath(path);
  var paths;
  if (starPath){
    paths = _.pluck(that.starRoutes, "path");
  } else {
    paths = _.keys(that.routes);
  }
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
  var path = getInputPath(this, urlStr);
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
  var route = getUrlRoute(this, path);
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
    var route = that.getRoute(path);
    // push each middleware onto its middleware array
    _.each(middlewares, function(m){
      route.middlewares.push(m);
    });
  });
};

Router.prototype.route = function(path, handler){

  if (_.isNull(handler) || _.isUndefined(handler)){
      throw new DetourError('ArgumentError',
        "route() requires a handler argument.",
        '');
  }

  path = urlJoin(this.path, path);

  if (!this.isRootPath(path) && !hasParent(this, path)){
    throw new DetourError('ParentDoesNotExist',
      "The route you're trying to add does not have a parent route defined.", 
      path);
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
    handler.HEAD = function(req, res){ that.handleHEAD(req, res); };
  }
  // add handler for OPTIONS if it doesn't exist
  if (!handler.OPTIONS){
    handler.OPTIONS = function(req, res){ that.handleOPTIONS(req, res); };
  }

  this.emit("route", handler);
  if (isStarPath(path)){
    addStarRoute(this, path, { handler : handler, middlewares : []});
  } else {
    this.routes[path] = { handler : handler, middlewares : []};
  }

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
    path = getInputPath(this, path);
  } catch(ex) {
    if (ex.name == "NotFound"){
    throw new DetourError("PathDoesNotExist", 
                "Cannot name a path that doesn't exist",
               "/");
    }
    throw ex;
  }
  this.names[name] = path;
};

Router.prototype.isRootPath = function(url){
  url = urlJoin(url);
  return url == this.path;
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

var getInputPath = function(d, url){
  var path = getPath(url);
  if (!!d.routes[path] && !!d.routes[path].handler){
    return path;
  }
  // check the starRoutes if it's not static...
  return findStarRoute(d, path).path;
};

// Given a url get the route object that matches it.
// A route object will either look like:
// {path : '/asdf', handler : {some object}}
//   OR
// {path : '/asdf/*asdf', handler : {some object}, regex : /asdf/[^/]}
// where the first case is a static route, and the second case is a
// star route.
var getUrlRoute = function(d, url){
  var path = getPath(url);
  if (!!d.routes[path] && !!d.routes[path].handler){
    return {path : path, handler : d.routes[path].handler};
  }
  // check the starRoutes if it's not static...
  return findStarRoute(d, path);
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

var isStarPath = function(path){
  return !!~path.indexOf("/*");
};

var findStarRoute = function(d, path){
  var route = _.find(d.starRoutes, function(route){
    return !!path.match(route.regex);
  });
  if (!!route && !!route.handler){
    return route;
  }
  throw DetourError('NotFound', 'That route is unknown.', "" + path);
};

var addStarRoute = function(d, path, route){
  var escapeSlashes = function(str){
    return;
  };
  // change path to a regex
  var reStr = path.replace(/\//g, '\\/');
  // change *paths to match a non-slash
  reStr = "^" + reStr.replace(/\*[^\/]+/g, "([^/]+)") + "$";
  var re = new RegExp(reStr);
  route.regex = re;
  route.path = path;
  d.starRoutes.push(route);
};





var hasParent = function(d, url){
  var pieces = urlJoin(url).split("/");
  pieces = _.filter(pieces, function(piece){return piece !== '';});
  pieces.pop();
  var parent = urlJoin(pieces);
  try {
    var route = d.getHandler(parent);
    return true;
  } catch (ex) {
    if (ex.name == "404"){
      return false;
    }
    throw ex;
  }
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
