exports.handler = {

  GET : function(q, s){
    s.end('{"items" : [{"hello" : "collectors", "links" : "http://localhost:9999/1234/many/4567"}]}');
  }

};

exports.member = {

  GET : function(q, s){
    s.end("MANY MEMBER!!");
  }


};
