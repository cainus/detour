exports.handler = {

  GET : function(req, res){ 
    console.log(req.url);
    console.log('detour', req.detour.getChildUrls('/')); //('root'));
    var json = JSON.stringify({
      output : req.detour.getChildUrls(req.url),
      links: {
        self: "/api/",
        cars: "/api/cars",
        happy: "/api/happy",
        many: "/api/many",
        city: "/api/city",
        empty: "/api/empty",
        artist: "/api/artist"
      }
    });
    res.end(json);
  }
}
