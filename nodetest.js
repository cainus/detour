var http = require('http');
var Router = require('./index').Router;
var router = new Router();
//var exampleResource = {GET : function(req, res){res.end("test");}};

router.route('/cross/:fingers_id', function($){ $.res.end("it worked!"); });
router.staticRoute(__dirname + '/test/test_fixtures/static', function(){

  router.routeDirectory(__dirname + '/test/test_fixtures/resources', function(err){
    console.log("routed!!");
    console.log(router.routes);
    var server = http.createServer(function(req, res){
                                     router.dispatch({req : req, res : res});
                                   });
    server.listen(9999, function(){
                           console.log("listening on 9999");
                        });

  });
});
