var ResourceTree = require('./lib/ResourceTree').ResourceTree
var _ = require('underscore');
var url = require('url');

function detour(){
  this.shouldHandle404s = true;
  this.serverSupportedMethods = ["GET", "POST", 
                                  "PUT", "DELETE",
                                  "HEAD", "OPTIONS"]  
  // TODO: above list could be generated when the route table is.
  this.routes = {}
  this.starRoutes = []
  this.names = []
  this.requestNamespace = 'detour'  // req.detour will have this object

  var that = this;
  this.expressMiddleware = function(req, res, next){
    that.dispatch(req, res, next);
  }

}

detour.prototype._path = function(urlstr){
  return urlJoin(url.parse(urlstr).path)
}

detour.prototype.getHandler = function(url){
  var path = this._path(url)
  if (!!this.routes[path] && !!this.routes[path].handler){
    return this.routes[path].handler;
  }
  // check the starRoutes if it's not static...
  var route = _.find(this.starRoutes, function(route){
    return !!path.match(route.regex)
  })
  if (!!route && !!route.handler){
    return route.handler;
  }

  throw error('NotFound', 'That route is unknown.', "" + path)
}

detour.prototype._getInputPath = function(url){
  var path = this._path(url)
  if (!!this.routes[path] && !!this.routes[path].handler){
    return path;
  }
  // check the starRoutes if it's not static...
  var route = _.find(this.starRoutes, function(route){
    return !!path.match(route.regex)
  })
  if (!!route && !!route.handler){
    return route.path;
  }

  throw error('NotFound', 'That route is unknown.', "" + path)
}

detour.prototype._getUrlRoute = function(url){
  var path = this._path(url)
  if (!!this.routes[path] && !!this.routes[path].handler){
    return {path : path, handler : this.routes[path].handler};
  }
  // check the starRoutes if it's not static...
  var route = _.find(this.starRoutes, function(route){
    return !!path.match(route.regex)
  })
  if (!!route && !!route.handler){
    return route;
  }

  throw error('NotFound', 'That route is unknown.', "" + path)
}

detour.prototype.pathVariables = function(url){
  var path = this._path(url)
  var route = this._getUrlRoute(url);
  if (!route.regex) {
    return {};
  }
  var varnames = route.path.match(/\*([^/]+)/g)
  varnames = _.map(varnames, function(name){return name.substring(1)})
  var matches = path.match(route.regex)
  var retval = {}
  for (var i =0; i < varnames.length; i++){
    retval[varnames[i]] = matches[i + 1]
  }
  return retval;
}

detour.prototype.dispatch = function(req, res, next){
  req[this.requestNamespace] = this;

  if (req.url.length > 4096){
    return this.handle414(req, res)
  }
  try {
    var handler = this.getHandler(req.url)
  } catch (ex){
    if (ex.type == "NotFound"){
      if (this.shouldHandle404s){
        return this.handle404(req, res)
      } else {
        return next();
      }
    }
    throw ex;
  }

  var method = req.method
  if (!_.include(this.serverSupportedMethods, method)){
    return this.handle501(req, res)
  }
  if (!handler[method]){
    switch(method){
      case "OPTIONS" : return this.handleOPTIONS(req, res);
      case "HEAD" : return this.handleHEAD(req, res);
      default : return this.handle405(req, res)
    }
  }

  return handler[method](req, res)

}


error = function(type, message, detail){
  message = message || ''
  detail = detail || ''
  return {type : type, message : message, detail : detail}
}


detour.prototype._hasParent = function(url){
  var pieces = urlJoin(url).split("/")
  pieces = _.filter(pieces, function(piece){return piece != ''});
  pieces.pop()
  var parent = urlJoin(pieces)
  try {
    var route = this.getHandler(parent);
    return true;
  } catch (ex) {
    if (ex.type == "NotFound"){
      return false;
    }
    throw ex;
  }
}

detour.prototype._isRootPath = function(url){
  url = urlJoin(url);
  return url == "/";
};

detour.prototype._handlerHasHttpMethods = function(handler){
  var methods = this._getMethods(handler)
  return methods.length > 0;
}

detour.prototype._getMethods = function(handler){
  var moduleMethods = _.functions(handler);
  var retval = _.intersection(moduleMethods, this.serverSupportedMethods);
  return retval
}

detour.prototype._isStarPath = function(path){
  return path.indexOf("*") != -1
}

detour.prototype._addStarRoute = function(path, route){
  var escapeSlashes = function(str){
    return;
  };
  // change path to a regex
  var reStr = path.replace(/\//g, '\\/')
  // change *paths to a match non-slash
  var reStr = "^" + reStr.replace(/\*[^/]+/g, "([^/]+)") + "$"
  var re = new RegExp(reStr);
  route.regex = re;
  route.path = path
  this.starRoutes.push(route);
}

detour.prototype.route = function(path, handler, maybe_middleware){

  if (_.isNull(handler) || _.isUndefined(handler)){
      throw error('ArgumentError',
        "route() requires a handler argument.",
        '')
  }

  path = urlJoin(path)

  if (!this._isRootPath(path) && !this._hasParent(path)){
    throw error('ParentDoesNotExist',
      "The route you're trying to add does not have a parent route defined.", 
      '/asdf')
  }

  if (_.isFunction(handler)){
    var handler = {GET : handler}
  } else {
    if (!this._handlerHasHttpMethods(handler)){
      throw error(
           "HandlerHasNoHttpMethods", 
           "The handler you're trying to route to should implement HTTP methods.",
           ''
      )
    }
  }

  if (this._isStarPath(path)){
    this._addStarRoute(path, { handler : handler})
  } else {
    this.routes[path] = { handler : handler}
  }

}

detour.prototype.handle414 = function(req, res){
  res.writeHead(414)
  res.end()
}

detour.prototype.handle404 = function(req, res){
  res.writeHead(404)
  res.end()
}

detour.prototype.handle405 = function(req, res){
  res.writeHead(405)
  res.end()
}

detour.prototype.handle501 = function(req, res){
  res.writeHead(501)
  res.end()
}

detour.prototype.handleOPTIONS = function(req, res){
  var handler = this.getHandler(req.url);
  var methods = this._getMethods(handler)
  methods = _.union(["OPTIONS"], methods);
  res.setHeader('Allow', methods.join(","))
  res.writeHead(204)
  res.end()
}


detour.prototype.name = function(path, name){

  try {
    var path = this._getInputPath(path);
  } catch(ex) {
    if (ex.type == "NotFound"){
    throw error("PathDoesNotExist", 
                "Cannot name a path that doesn't exist",
               "/")
    }
    throw ex;
  }
  this.names[name] = path;
}

detour.prototype.handleHEAD = function(req, res){
  var handler = this.getHandler(req.url);
  res.origEnd = res.end;
  res.end = function(){
    res.origEnd()
  }
  if (!handler.GET){
    return this.handle405(req, res)
  }
  res.writeHead(204);
  handler.GET(req, res);
}

exports.detour = detour

function urlJoin(){
	// put a fwd-slash between all pieces and remove any redundant slashes
	// additionally remove the trailing slash
  var pieces = _.flatten(_.toArray(arguments))
  var joined = pieces.join('/').replace(/\/+/g, '/')  
	joined = joined.replace(/\/$/, '')
  if ((joined.length == 0) || (joined[0] != '/')){ joined = '/' + joined; }
  return joined;
}

