const express = require('express');
const Router = require('./lib/Router').Router;

var app = express.createServer();

var port = process.env.PORT || 3000;
var portStr = ':' + port + '';
if (port == 80){portstr = '';}
var apiUrl = 'http://localhost' + portStr + '/api'
app.set('base_path', apiUrl);


var router = new Router(app, __dirname + '/test/test_fixtures/resources', '/api/');
app.listen(port, function(){
  console.log("Application started!");
  console.log("API being served from: " + apiUrl);
});
