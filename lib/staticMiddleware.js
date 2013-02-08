/*!
 * Connect - static
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var send = require('send');
var url = require('url');

/**
 * Escape the given string of `html`.
 *
 * @param {String} html
 * @return {String}
 * @api private
 */
var htmlEscape = function(html){
  return String(html)
    .replace(/&(?!\w+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

/**
 * Parse the `req` url with memoization.
 *
 * @param {ServerRequest} req
 * @return {Object}
 * @api private
 */
var parse = function(req){
  var parsed = req._parsedUrl;
  if (parsed && parsed.href == req.url) {
    return parsed;
  } else {
    return req._parsedUrl = url.parse(req.url);
  }
};


/**
 * Static:
 *
 *   Static file server with the given `root` path.
 *
 * Examples:
 *
 *     var oneDay = 86400000;
 *
 *     connect()
 *       .use(connect.static(__dirname + '/public'))
 *
 *     connect()
 *       .use(connect.static(__dirname + '/public', { maxAge: oneDay }))
 *
 * Options:
 *
 *    - `maxAge`     Browser cache maxAge in milliseconds. defaults to 0
 *    - `hidden`     Allow transfer of hidden files. defaults to false
 *    - `redirect`   Redirect to trailing "/" when the pathname is a dir. defaults to true
 *
 * @param {String} root
 * @param {Object} options
 * @return {Function}
 * @api public
 */

exports = module.exports = function staticMiddleware(root, options){
  options = options || {};

  // root required
  if (!root) throw new Error('static() root path required');

  // default redirect
  var redirect = false === options.redirect ? false : true;

  return function staticMiddleware(req, res, next) {
    if ('GET' != req.method && 'HEAD' != req.method) return next();
    var path = parse(req).pathname;

    function directory() {
      if (!redirect) return next();
      var pathname = url.parse(req.originalUrl || req.url).pathname;
      res.statusCode = 301;
      res.setHeader('Location', pathname + '/');
      res.end('Redirecting to ' + htmlEscape(pathname) + '/');
    }

    function error(err) {
      if (404 == err.status) return next();
      next(err);
    }

    send(req, path)
      .maxage(options.maxAge || 0)
      .root(root)
      .hidden(options.hidden)
      .on('error', error)
      .on('directory', directory)
      .pipe(res);
  };
};

/**
 * Expose mime module.
 * 
 * If you wish to extend the mime table use this
 * reference to the "mime" module in the npm registry.
 */

exports.mime = send.mime;
