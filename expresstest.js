var express = require('express')
var detour = require('./detour').detour;
var app = express.createServer();
var d = new detour();
d.route('', {GET : function(req, res){
                          console.log("in detour")
                          res.end("test");}}
                  );
app.use(function(req, res){d.dispatch(req, res)})
app.all('/', function(req, res){res.send("TEST");})
app.listen(9999, function(){ 
  console.log("listening on 9999");
});

