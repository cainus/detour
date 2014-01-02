/**
 * Expose `Route`.
 */

module.exports = Route;

/**
 * Initialize `Route` with the given HTTP `path`, `resource`,
 *  and `options`.
 *
 * Options:
 *
 *   - `sensitive`    enable case-sensitive routes
 *   - `strict`       enable strict matching for trailing slashes
 *
 * @param {String} path
 * @param {Object} resource
 * @param {Object} options
 * @api private
 */

function Route(path, resource, options) {
  options = options || {};
  this.path = path;
  this.resource = resource;
  this.regexp = pathRegexp(path,
                                 this.keys = [],
                                 options.sensitive,
                                 options.strict);
}

/**
 * Check if this route matches `path`, if so
 * populate `.params`.
 *
 * @param {String} path
 * @return {Boolean}
 * @api private
 */

Route.prototype.match = function(path){
  var keys = this.keys;
  var params = this.params = [];
  var m = this.regexp.exec(path);
  var val;

  if (!m) return false;

  for (var i = 1, len = m.length; i < len; ++i) {
    var key = keys[i - 1];

    try {
      val = 'string' == typeof m[i] ? decodeURIComponent(m[i]) : m[i];
    } catch(e) {
      var err = new Error("Failed to decode param '" + m[i] + "'");
      err.status = 400;
      throw err;
    }

    if (key) {
      params[key.name] = val;
    } else {
      params.push(val);
    }
  }

  return true;
};




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

var pathRegexp = function(path, keys, sensitive, strict) {
  if (toString.call(path) == '[object RegExp]') return path;
  if (Array.isArray(path)) path = '(' + path.join('|') + ')';
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

/**
 * toString ref.
 */
 
var toString = {}.toString;
