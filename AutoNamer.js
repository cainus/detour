_ = require('underscore');

var AutoNamer = function(files){
  this.files = files;
};

AutoNamer.prototype._isCollection = function(path){
  return !!this.files[path].module.member;
};

AutoNamer.prototype._pieceIsCollection = function(pieces, index){
  var orig = pieces;
  pieces = pieces.slice(0, index + 1);
  var last = pieces[pieces.length - 1];
  var path = '/' + pieces.join('/');
  if (!this._endsWith(path, '.js')){
    path += '.js';
  }
  var isCollection = this._isCollection(path);
  return isCollection;
};

AutoNamer.prototype._endsWith = function(str, suffix) {
  if (str === '') return false;
  return str.indexOf(suffix, str.length - suffix.length) !== -1;
};

AutoNamer.prototype._camelCase = function(str){
	return str.replace(/(_[a-z])/g, function($1){return $1.toUpperCase().replace('_','');});
};

AutoNamer.prototype.name = function(path){
  var rootCollection = this._isCollection('/index.js');
  if (path === '/index.js'){
    return rootCollection ? 'root*' : 'root';
  }
  var prefix = rootCollection ? 'root*' : '';
  var pieces = path.split("/");
  if (pieces[0] === ''){ pieces = pieces.slice(1);}
  var newPieces = [];
  for(var i = 0; i < pieces.length; i++){
    var piece = pieces[i];
    var isCollection = this._pieceIsCollection(pieces, i);
    piece = piece.replace(/\.js$/, ''); // remove .js
    newPieces.push( isCollection ? piece + '*' : piece );
  }
  path = newPieces.join("/");
  var name = prefix + path;
  name = name.replace(/^\//, '');   // remove leading slash
  name = name.replace(/\//g, '_');   // slash to underscore
  name = name.replace(/\*_/g, '*');   // slash to underscore
  name = name.replace(/\.js$/, ''); // remove .js
  name = this._camelCase(name);     // camelCase
  name = name[0].toLowerCase() + name.substring(1);
                                    // lowercase first letter
  return name;
};

module.exports = AutoNamer;
