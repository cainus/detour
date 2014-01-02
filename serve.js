var Router = require('./index');
var http = require('http');
var router = new Router();
router.route('/', { 
  GET : function(req, res){ 
    res.end('worked'); 
  }
});
router.route('/postonly', { 
  POST : function(req, res){ 
    res.end('worked'); 
  }
});


var server = http.createServer(router.middleware)
.listen(8888, function(err){
  if (err) throw err;

});

