var http = require('http')
var detour = require('./detour').detour;
var d = new detour();
d.route('', {GET : function(req, res){res.end("test");}})
var server = http.createServer(function(req, res){
                                d.dispatch(req, res)
             });
server.listen(9999, function(){ 
  console.log("listening on 9999");
});

