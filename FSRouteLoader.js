var fs = require('fs');
var DirRequirer = require('./DirRequirer').DirRequirer;
var DetourError = require('./DetourError').DetourError;
var _ = require('underscore');

var FSRouteLoader = function(router, dir){
  this.router = router;  // requires a detour router for input;
  this.requirer = new DirRequirer(dir);
  this.dir = dir;
  this.paths = [];
};

FSRouteLoader.prototype.load = function(cb){
  var that = this;
  var requirer = this.requirer;
  requirer.require(function(err){
    if (err) {
      return cb(err);
    }
    that.paths = requirer.paths;
    if (!_.include(_.keys(requirer.paths), '/_index.js')){
      return cb(new DetourError('MissingIndexResource',
            'There was no _index.js at the given path.  This is the first necessary resource file.',
           that.dir));
    }
    var remainingPaths = _.keys(that.paths);
    var originalPaths = _.clone(remainingPaths);
    var path = bestPathsPop(remainingPaths);
    while (path){
      try {
        routePath(that, path, originalPaths);
      } catch (ex){
        return cb(ex);
      }
      path = bestPathsPop(remainingPaths);
    }
    return cb();
  });
};


var routePath = function(that, path, originalPaths){
  var obj = that.paths[path];
  if (obj.type === 'file'){
    if (hasDynamicSibling(path, originalPaths)){
      throw new DetourError('DynamicRouteWithSiblings',
        "If you have a dynamic path, you can't have other paths in the same directory.",
        '/song/_song.js is a dynamic path and so cannot share a directory with ' + path + '.'
      );
    }
    var name = that.autoName(path);
    var url = pathToUriPath(path);
    that.router.route(url, obj.module.handler).as(name);
    if (!!obj.module.member){
      var memberUrl = pathToStarChildRoute(url);
      name = name + '*';
      that.router.route(memberUrl, obj.module.member).as(name);
    }
  } else {
    // it's a dir
    if (!_.include(originalPaths, path + '.js')){
      var dirModuleName = that.autoName(path) + '.js';
      throw new DetourError('MissingDirectoryResource',
        'There was no directory resource for one of the directories.  All directories to be routed must have a directory resource.',
        'Found ' + path + ', but no "' + dirModuleName  + '" next to it.'
      );
    }
  }
};

FSRouteLoader.prototype.autoName = function(path){
  if (path == '/_index.js'){
    return 'root';
  } else {
    // TODO FIXME ugliest, dumbest thing ever (but it works)
    var name = path;
    name = name.replace(/\/_[^\/]+/g, '*');  // replace /*whatever with *
    name = name.replace(/\/_/g, '');         // remove leading underscores
    name = name.replace(/\//g, '_');         // change / to _
    name = name.replace(/\.js$/, '');        // remove .js extension
    if (name[0] == '_'){
      name = name.substring(1);
    }
    name = name.replace(/_\*[^_]+_/, '*');        // replace * routes with just *
    name = name.replace(/\*_/, '*');        // replace * routes with just *
    name = camelCase(name);
    return name;
  }
};

exports.FSRouteLoader = FSRouteLoader;

var arrayRemove = function(arr, val){

  var index = arr.indexOf(val);
  if (index != -1){
    arr.splice(index, 1);
    return val;
  }

};


var bestPathsPop = function(paths){
  var leastSlashes = -1;
  var shortestPaths = [];
  var root = arrayRemove(paths, '/_index.js');
  if (!!root) { return root;}

  _.each(paths, function(path){
    var slashCount = path.split('/').length;
    if ((leastSlashes === -1) || (leastSlashes > slashCount)){
      leastSlashes = slashCount;
      shortestPaths = [path];
      return;
    }
    if (slashCount === leastSlashes){
      shortestPaths.push(path);
    }
  });

  var path = arrayRemove(paths, shortestPaths[0]);
  return path;
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

// takes a path and returns the path of a starRoute under it.
var pathToStarChildRoute = function(path){
  path = path.replace(/\.js$/g, '');  // remove .js
  var pieces = path.split('/');
  var parent = pieces.pop();
  return urlJoin(pieces, parent, '*' + parent);
};

// checks to see if a given module is in the same dir as a dynamic path module.
var hasDynamicSibling = function(path, paths){
  var pieces = path.split('/');
  var filename = pieces.pop();  // remove the file name
  var parent = pieces.pop();
  var dynamicFileName = '_' + parent + '.js';
  if (filename === dynamicFileName){return false;}
  var dynamic = urlJoin(pieces, parent, dynamicFileName);
  return _.include(paths, dynamic);
};


function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

var pathToUriPath = function(path){
  if (path == '/_index.js'){
    return '/';
  } else {
    var pieces = path.split('/');
    pieces = _.map(pieces, function(piece){
      if (piece[0] === '_'){
        piece[0] = '*';
        return '*' + piece.substring(1);
      } else {
        return piece;
      }
    });
    path = urlJoin(pieces);
    return truncate(path, 3);
  }
};

var truncate = function(str, count){
  return str.substring(0, str.length - count);
};

var camelCase = function(str){
	return str.replace(/(_[a-z])/g, function($1){return $1.toUpperCase().replace('_','');});
};
