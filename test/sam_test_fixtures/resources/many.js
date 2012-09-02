exports.handler = {

  GET : function($){
    $.res.end('{"items" : [{"hello" : "collectors", "links" : "http://localhost:9999/1234/many/4567"}]}');
  }

};

exports.member = {

  GET : function($){
    $.res.end("MANY MEMBER!!");
  }


};
