exports.handler = {

  GET : function($){
    $.res.end('{"member" : "http://localhost:9999/1234/"}');
  }


};



exports.wildcard = {

  GET : function($){
    console.log($.req.url);
    console.log("member");
    $.res.end('{"many" : "http://localhost:9999/1234/many"}');
  }
};
