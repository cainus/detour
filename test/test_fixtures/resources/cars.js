var resource = {

  collectionPOST : function(req, res){ 
    var doc = req.jsonBody;
    res.send({}, 200)
  }

}

exports.handler = resource;
