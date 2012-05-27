
var resource = require('../../../lib/resource').resource;

console.log(resource);

exports.handler = new resource({

  GET : function(req, res){
    console.log("HERE!!!!!!!!!!!!!!!");
    console.log("pre end");
    res.end('this worked');
    console.log("post end");
  }


});
