var fs = require('fs');
var DirRequirer = require('./DirRequirer');
var DetourError = require('./DetourError');
var _ = require('underscore');
var AutoPather = require('./AutoPather');

var FSRouteLoader = function(router, dir, rootPath){
  this.router = router;  // requires a detour router for input;
  this.requirer = new DirRequirer(dir);
  this.dir = dir;
  this.paths = [];
  this.rootPath = rootPath;
};

FSRouteLoader.prototype.load = function(cb){
  var that = this;
  var requirer = this.requirer;
  requirer.require(function(err){
    if (err) {
      return cb(err);
    }
    that.paths = requirer.paths;
    if (!_.include(_.keys(requirer.paths), '/index.js')){
      return cb(new DetourError('MissingIndexResource',
            'There was no index.js at the given path.  This is the first necessary resource file.',
           that.dir));
    }
    var remainingPaths = _.keys(that.paths);
    var originalPaths = _.clone(remainingPaths);
    for (var i = 0; i < remainingPaths.length; i++){
      try {
        routePath(that, remainingPaths[i], originalPaths);
      } catch (ex){
        return cb(ex);
      }
    } 
    return cb();
  });
};


var routePath = function(that, path, originalPaths){
  var obj = that.paths[path];
  if (obj.type === 'file'){
    var url = new AutoPather(that.paths).path(path);  // take a file path and make a url
    url = urlJoin(that.rootPath, url);
    var nonMemberUrl = url.replace(/\/\*[^\/]+$/, '');  // strip any dynamic part off the end
    nonMemberUrl = nonMemberUrl.replace(/\*/g, ':');
    that.router.route(nonMemberUrl,obj.module.handler);
    if (!!obj.module.wildcard){
      url = url.replace(/\*/g, ':');
      that.router.route(url, obj.module.wildcard);
    }
  } else {
    // it's a dir
    if (!_.include(originalPaths, path + '.js')){
      throw new DetourError('MissingDirectoryResource',
        'There was no directory resource for one of the directories.  All directories to be routed must have a directory resource.',
        'Found ' + path + ', but no "' + path.replace(/\//, '') + '.js" next to it.'
      );
    }
  }
};

module.exports = FSRouteLoader;

var arrayRemove = function(arr, val){

  var index = arr.indexOf(val);
  if (index != -1){
    arr.splice(index, 1);
    return val;
  }

};

var bestPathsPop = function(paths){
  //var root = arrayRemove(paths, '/index.js');
  //if (!!root) { return root;}
  return paths.shift();
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



