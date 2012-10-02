DetourError = function(name, message, detail){
  var err = Error.call(this, name, message);
  err.name = name;
  err.message = message;
  err.detail = detail || {};
  return err;
};
DetourError.prototype = Object.create(Error.prototype, { 
  constructor: { value: DetourError }
});


module.exports = DetourError;
