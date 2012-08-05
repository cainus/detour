var _ = require('underscore');

exports.handler = {

  GET : function(req, res){
    console.log(req.url);
    console.log("collection");
    res.end("collection");
  }


};



exports.member = {

  GET : function(req, res){
    console.log(req.detour.routeTree);
    console.log(req.url);
    console.log("member");
    res.end("member");
  }
};
