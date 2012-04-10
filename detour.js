var ResourceTree = require('./lib/ResourceTree').ResourceTree
var _ = require('underscore');
var url = require('url');

function detour(mountPath){
	this.mountPath = urlJoin('/', mountPath);
  this.rootResource = new ResourceTree('/', {})	
}

detour.prototype.isCollection = function(node){
    return this._implementsMethods(node, ['collectionGET',
                                      'collectionPOST',
                                      'collectionPUT',
                                      'collectionDELETE'])
}

detour.prototype._implementsMethods = function(node, methods){
    return _.any(methods, function(method){
                            return !!node.module[method]
                          });
  }

detour.prototype.getRoutes = function(app){
  var routes = []
  var that = this;
	var standardMethods = [ "GET", "POST", "DELETE", "PUT"]

	var getNodeRoutes = function(parentPath, node){
		var path = urlJoin(parentPath, node.path) 
    if (that.isCollection(node)){
        routes.push({ url : path, resource : node})
        var id_name = ':' + node.path.replace(/\//, '') + '_id'
        path = urlJoin(path, id_name)
    }
    if (that._implementsMethods(node, standardMethods)){
      routes.push({ url : path, resource : node})
      _.each(node.children, function(node){
        getNodeRoutes(path, node);
      })
    }
  }
  getNodeRoutes(this.mountPath, this.rootResource)
  return routes;
}

detour.prototype.setRoutes = function(app){
	var setNodeRoutes = function(parentPath, node){
		var path = urlJoin(parentPath, node.path) 
		var methods = { "GET" : 'get',
										"POST" : 'post',
										"DELETE" : 'del',
										"OPTIONS" : 'options',
										"PUT" : 'put'}
		_.each(methods, function(expressMethod, httpMethod){
			if (!!node.module[httpMethod]){
				app[expressMethod](path, node.module[httpMethod]);
				app[expressMethod](path + '/', node.module[httpMethod]);
			}
		});
    _.each(node.children, function(node){
      setNodeRoutes(path, node);
    })
  }
  setNodeRoutes(this.mountPath, this.rootResource)
}

detour.prototype.dispatch = function(req, res){
  var method = req.method
  if (req.url.length > 4096){
    return this.handle415(req, res)
  }
  try {
    var route = this.matchRoute(req.url)
    var resource = route.resource;
  } catch (ex) {
    if (ex == "No matching route found."){
      return this.handle404(req, res)
    } else {
      throw ex;
    }
  }
  if (!resource.module[method]){
    return this.handle405(req, res)
  }
  resource.module[method](req, res)
}

detour.prototype.handle415 = function(req, res){
  res.send(414)
}

detour.prototype.handle404 = function(req, res){
  res.send(404)
}

detour.prototype.handle405 = function(req, res){
  res.send(405)
}

detour.prototype.getUrl = function(node){
  var getAncestry = function(node){
    if (!node.parentNode){
      return [];
    }
    return [getAncestry(node.parentNode), node.path]
  }
  var pieces = _.flatten(getAncestry(node));
  var url = urlJoin(this.mountPath, pieces);
  return url;
}

detour.prototype.matchRoute = function(urlstr){
  // go through all the getRoutes() urls and find the first match
  var path = urlJoin(url.parse(urlstr).path)
  var route =_.find(this.getRoutes(), function(routeObj){
    // swap out wildcard path pieces...
    var matcher = routeObj.url.replace(/:[^/]+/, "[^/]+")
    // escape slashes and mark beginning/end
    matcher = "^" + matcher.replace(/\//g, '\\/') + "$"
    var re = new RegExp(matcher)
    var matches = path.match(new RegExp(matcher))
    if (path.match(new RegExp(matcher))){
      return true
    }
    return false;
  });
  if (!route){
    throw "No matching route found."
  }
  return route;
}

detour.prototype.getRoute = function(urlstr){
  var path = url.parse(urlstr).path
  var pieces = path.split('/');
  pieces = _.filter(pieces, function(piece){ 
      return ((piece != '/') && (piece != ''))
  });
  if (urlJoin('/', pieces[0]) == this.mountPath){
    pieces = _.rest(pieces);
  }
  var getKidByPath = function(node, path){
    var kid = _.find(node.children, function(kid){
      return kid.path == path;
    });
    if (!kid){
      throw "The given node does not have a child matching the given path."
    }
    return kid;
  }
  var traverse = function(node, paths){
    if (paths.length == 0){
      return node;
    }
    var path = paths[0];
    paths = _.rest(paths);
    try {
      node = getKidByPath(node, path);
    } catch(ex) {
      if (ex == "The given node does not have a child matching the given path."){
        throw "Unknown path"
      } else {
        throw ex;
      }
    }
    return traverse(node, paths)
  }
  try {
    return traverse(this.rootResource, pieces);
  } catch (ex ){
      if (ex == "Unknown path"){
        throw "That route does not exist: " + urlstr + "."
      } else {
        throw ex;
      }

  }
}

detour.prototype.getParentUrl = function(node){
  if (!node.parentNode){
    throw "Cannot get parent url of a node with no parent.";
  }
  return this.getUrl(node.parentNode);
}

exports.detour = detour

function urlJoin(){
	// put a fwd-slash between all pieces and remove any redundant slashes
	// additionally remove the trailing slash
  var pieces = _.flatten(_.toArray(arguments))
  var joined = pieces.join('/').replace(/\/+/g, '/')  
	joined = joined.replace(/\/$/, '')
  if (joined == ''){ joined = '/'; }
  return joined;
}

