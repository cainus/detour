var _ = require('underscore');

exports.handler = {

  GET : function($){
    console.log($.req.url);
    console.log("collection");
    $.res.end('{"member" : "http://localhost:9999/1234/"}');
  }


};



exports.member = {

  GET : function($){
    console.log($.req.detour.routeTree);
    console.log($.req.url);
    console.log("member");
    $.res.end('{"many" : "http://localhost:9999/1234/many"}');
  }
};
