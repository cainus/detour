
exports.handler = {

  GET : function(req, res){
    console.log("HERE!!!!!!!!!!!!!!!");
    console.log("pre end");
    res.end('this worked');
    console.log("post end");
  }


};
