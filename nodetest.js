var http = require('http')
var Router = require('./detour').Router;
var router = new Router();
var exampleResource = {GET : function(req, res){res.end("test");}}
router.route('', exampleResource)
var server = http.createServer(function(req, res){
                                 router.dispatch(req, res)
                               });
server.listen(9999, function(){
                       console.log("listening on 9999");
                    });
