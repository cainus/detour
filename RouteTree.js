var _ = require('underscore');
var url = require('url');

var DetourError = require('./DetourError').DetourError;
var serverSupportedMethods = ["GET", "POST", 
                              "PUT", "DELETE",
                              "HEAD", "OPTIONS"];

/* 
 While this is called RouteTree, it's not really a tree data
  structure.  It does however enforce a tree-like hierarchy in
  routes (ie All paths other than the root path have a "parent" path.
*/

// All routes will have the root path on them for the sake of simplicity,
// despite the redundancy.

// responsibilities: store/find handler objects for handling different uris.

var RouteTree = function(rootPath){
  this.path = rootPath || '/'; // this is the path that all routes start at.
  this.path = urlJoin(this.path);
  this.routes = {};
  this.starRoutes = [];
};

RouteTree.prototype.isRootPath = function(url){
  url = urlJoin(url);
  return url == this.path;
};

RouteTree.prototype.set = function(path, handler){

  if (_.isNull(handler) || _.isUndefined(handler)){
      throw new DetourError('ArgumentError',
        "route() requires a handler argument.",
        '');
  }

  if (!this.isRootPath(path) && !this.hasParent(path)){
    throw new DetourError('ParentDoesNotExist',
      "The route you're trying to add does not have a parent route defined.", 
      path);
  }

  var that = this;

  if (this.isStarPath(path)){
    addStarRoute(this, path, { handler : handler, middlewares : []});
  } else {
    this.routes[path] = { path : path, handler : handler, middlewares : []};
  }

  return true;

};

// Given a url get the route object that matches it.
// A route object will either look like:
// {path : '/asdf', handler : {some object}}
//   OR
// {path : '/asdf/*asdf', handler : {some object}, regex : /asdf/[^/]}
// where the first case is a static route, and the second case is a
// star route.
RouteTree.prototype.get = function(url){
  if (url.length > 4096){
    throw 'URI Too Long';
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
      throw "Not Found";
    } else {
      throw ex;
    }
  }
};


// TODO how is this different from this.get()?
RouteTree.prototype.getUrlRoute = function(url){
  // TODO get rid of this, by first making the part below work
  //return this.get(url);
  var path = getPath(url);
  if (!!this.routes[path] && !!this.routes[path].handler){
    return {path : path, handler : this.routes[path].handler};
  }
  // check the starRoutes if it's not static...
  return findStarRoute(this, path);
};

RouteTree.prototype.isStarPath = function(path){
  return !!~path.indexOf("/*");
};


RouteTree.prototype.getPaths = function(urlStr, pathVars){
  var path = this.getUrlRoute(urlStr).path;
  var starPath = this.isStarPath(path);
  var paths;
  var that = this;
  if (starPath){
    paths = _.pluck(this.starRoutes, "path");
  } else {
    paths = _.keys(this.routes);
  }
  return paths;
};


RouteTree.prototype.hasParent = function(url){
  var pieces = urlJoin(url).split("/");
  pieces = _.filter(pieces, function(piece){return piece !== '';});
  pieces.pop();
  var parent = urlJoin(pieces);
  try {
    var route = this.get(parent);
    return true;
  } catch (ex) {
    if (ex === "Not Found"){
      return false;
    }
    throw ex;
  }
};


exports.RouteTree = RouteTree;


var urlJoin = function(){
	// put a fwd-slash between all pieces and remove any redundant slashes
	// additionally remove the trailing slash
  var pieces = _.flatten(_.toArray(arguments));
  var joined = pieces.join('/').replace(/\/+/g, '/');
	joined = joined.replace(/\/$/, '');
  if ((joined.length === 0) || (joined[0] != '/')){ joined = '/' + joined; }
  return joined;
};

var findStarRoute = function(d, path){
  var route = _.find(d.starRoutes, function(route){
    return !!path.match(route.regex);
  });
  // special case for collections at the root
  if (!!route && !!route.handler){
    return route;
  }
  throw DetourError('NotFound', 'That route is unknown.', "" + path);
};

var addStarRoute = function(d, path, route){
  if (path === urlJoin(d.path, '/*')){
    path = urlJoin(d.path, '*root');
  }
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



var getPath = function(urlstr){
  var path = url.parse(urlstr).pathname;
  return urlJoin(url.parse(urlstr).pathname);
};
