var url = require('url');
var DetourError = require('./DetourError');
var _ = require('underscore');

var FreeRouteCollection = function(){
  this.routes = [];
};

FreeRouteCollection.prototype.set = function(path, handler, sensitive, strict){
  var keys = [];
  var matcher = pathRegexp(path, keys, sensitive, strict);
  this.routes.push({ matcher : matcher, keys : keys, handler : handler, middlewares : [] });
};

// Given a url get the route object that matches it.
// A route object will either look like:
// {path : '/asdf', handler : {some object}}
//   OR
// {path : '/asdf/*asdf', handler : {some object}, regex : /asdf/[^/]}
// where the first case is a static route, and the second case is a
// star route.
FreeRouteCollection.prototype.get = function(inUrl){
  if (inUrl.length > 4096){
    throw "URI Too Long";
  }
  var path = getPath(inUrl);

  for(var i = 0; i < this.routes.length; i++){
    var route = this.routes[i];
    var matcher = '"' + path + '".match(' + route.matcher + ')';
    if (path.match(route.matcher)){
      return route;
    }
  }
  throw "Not Found";
};

module.exports = FreeRouteCollection;

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



// express style path regex from the express codebase.
// http://expressjs.com
/**
 * Normalize the given path string,
 * returning a regular expression.
 *
 * An empty array should be passed,
 * which will contain the placeholder
 * key names. For example "/user/:id" will
 * then contain ["id"].
 *
 * @param  {String|RegExp|Array} path
 * @param  {Array} keys
 * @param  {Boolean} sensitive
 * @param  {Boolean} strict
 * @return {RegExp}
 * @api private
 */
pathRegexp = function(path, keys, sensitive, strict) {
  if (path instanceof RegExp) { 
    return path; 
  }
  if (Array.isArray(path)){ 
    path = '(' + path.join('|') + ')';
  }
  path = path
    .concat(strict ? '' : '/?')
    .replace(/\/\(/g, '(?:/')
    .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, function(_, slash, format, key, capture, optional, star){
      keys.push({ name: key, optional: !! optional });
      slash = slash || '';
      return '' +
        (optional ? '' : slash) +
        '(?:' +
        (optional ? slash : '') +
        (format || '') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')' +
        (optional || '') +
        (star ? '(/*)?' : '');
    })
    .replace(/([\/.])/g, '\\$1')
    .replace(/\*/g, '(.*)');
  return new RegExp('^' + path + '$', sensitive ? '' : 'i');
};
