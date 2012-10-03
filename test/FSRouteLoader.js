var should = require('should');
var hottap = require('hottap').hottap;
var _ = require('underscore');
var Router = require('../index').Router;
var FSRouteLoader = require('../index').FSRouteLoader;

var getSimpleModule = function(fullpath){
  return { module : { handler : {GET : function(req, res){res.end(fullpath);} } },
           fullpath: fullpath,
           type : 'file'
         };
};

var getCollectionModule = function(fullpath){
  return { module : { 
              handler : {GET : function(req, res){res.end(fullpath);} },
              wildcard : {GET : function(req, res){res.end("WILDCARD " + fullpath);} }
           },
           fullpath: fullpath,
           type : 'file'
         };
};

describe('FSRouteLoader', function(){
	beforeEach(function(){
    this.router = new Router();
    this.dir = __dirname + '/test_fixtures/resources';
    this.loader = new FSRouteLoader(this.router, this.dir);
	});
	afterEach(function(){
	});


  describe("#route", function(){

    it ("returns an error when the resource directory doesn't exist", function(done){
      var loader = new FSRouteLoader(this.router, 'NOEXISTtest_fixtures');
      loader.load(function(err){
        should.exist(err);
        err.name.should.equal('InvalidDirectory');
        done();
      });
    });

    it ("complains if there's no /index.js", function(done){
      // fake out require
      this.loader.requirer.require = function(cb){
        this.paths = {};
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        err.name.should.equal("MissingIndexResource");
        err.message.should.equal("There was no index.js at the given path.  This is the first necessary resource file.");
        err.detail.should.equal(that.dir);
        done();
      });
    });

    it ("sets / if there's a /index.js", function(done){
      // fake out require
      this.loader.requirer.require = function(cb){
        this.paths = {'/index.js' : getSimpleModule('/asdf/index.js') };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('/').should.equal('/');
        done();
      });
    });

    it ("routes root-dir files", function(done){
      this.loader.requirer.require = function(cb){
        this.paths = {'/index.js' : getSimpleModule('/asdf/index.js'),
                      '/song.js' : getSimpleModule('/asdf/song.js'),
                      '/band.js' : getSimpleModule('/asdf/band.js')
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('/').should.equal('/');
        that.router.getUrl('/song').should.equal('/song');
        that.router.getUrl('/band').should.equal('/band');
        done();
      });
    });

    it ("returns an error if there's a dir with no module for it", function(done){
      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/index.js' : getSimpleModule('/asdf/index.js'),
                      '/song' : {'type' : 'dir'}
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        err.name.should.equal("MissingDirectoryResource");
        err.message.should.equal("There was no directory resource for one of the directories.  All directories to be routed must have a directory resource.");
        err.detail.should.equal('Found /song, but no "song.js" next to it.');
        done();
      });
    });

    it ("routes directory resources", function(done){
      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/index.js' : getSimpleModule('/asdf/index.js'),
                      '/song' : {'type' : 'dir', fullpath : '/asdf/song'},
                      '/song.js' : getSimpleModule('/asdf/song.js')
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('/').should.equal('/');
        that.router.getUrl('/song').should.equal('/song');
        done();
      });
    });

    it ("routes resources in sub-directories", function(done){
      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/index.js' : getSimpleModule('/asdf/index.js'),
                      '/song.js' : getSimpleModule('/asdf/song.js'),
                      '/song' : {'type' : 'dir', fullpath : '/asdf/song'},
                      '/song/artist.js' : getSimpleModule('/asdf/song/artist.js')
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('/').should.equal('/');
        that.router.getUrl('/song').should.equal('/song');
        that.router.getUrl('/song/artist').should.equal('/song/artist');
        done();
      });
    });

    it ("can route dynamic routes", function(done){
      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/index.js' : getSimpleModule('/asdf/index.js'),
                      '/song.js' : getCollectionModule('/asdf/song.js')
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('/').should.equal('/');
        that.router.getUrl('/song').should.equal('/song');
        that.router.getUrl('/song/:song', {song : 1234}).should.equal('/song/1234');
        done();
      });
    });

    it ("can route double dynamic routes", function(done){
      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/index.js' : getCollectionModule('/asdf/index.js'),
                      '/artist.js' : getCollectionModule('/asdf/artist.js')
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('/').should.equal('/');
        that.router.getUrl('/:root', {root : 4567});
        that.router.getUrl('/:root', {root : 4567}).should.equal('/4567');
        that.router.getUrl('/:root/artist', {root : 1234}).should.equal('/1234/artist');
        that.router.getUrl('/:root/artist/:artist', {root : 5678, artist : 1234}).should.equal('/5678/artist/1234');
        done();
      });
    });

    it ("can route a collection module from the root", function(done){

      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/index.js' : getCollectionModule('/asdf/index.js')
                      };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('/').should.equal('/');
        that.router.getUrl('/:root', {root : 1234}).should.equal('/1234');
        done();
      });
    });

    it ("can nest collection modules", function(done){
      this.router = new Router();
      this.dir = __dirname + '/test_fixtures/resources';
      this.loader = new FSRouteLoader(this.router, this.dir, "/sub");

      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/index.js' : getSimpleModule('/asdf/index.js'),
                      '/artist.js' : getCollectionModule('/asdf/artist.js'),
                      '/artist/song.js' : getCollectionModule('/asdf/artist/:artist/song.js')
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('/sub').should.equal('/sub');
        that.router.getUrl('/sub/artist').should.equal('/sub/artist');
        that.router.getUrl('/sub/artist/:artist', {artist : 1234}).should.equal('/sub/artist/1234');
        that.router.getUrl('/sub/artist/:artist/song', {artist : 1234})
                            .should.equal('/sub/artist/1234/song');
        that.router.getUrl('/sub/artist/:artist/song/:song', {artist : 1234, song : 5678})
                            .should.equal('/sub/artist/1234/song/5678');
        done();
      });
    });
    it ("can route a module below a root collection module", function(done){
      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/index.js' :  getCollectionModule('/asdf/index.js'),
                      '/artist.js' : getCollectionModule('/asdf/*root/artist.js')
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('/').should.equal('/');
        that.router.getUrl('/:root', {root : 1234}).should.equal('/1234');
        that.router.getUrl('/:root/artist', {root : 1234}).should.equal('/1234/artist');
        that.router.getUrl('/:root/artist/:artist', {root : 1234, artist : 5678}).should.equal('/1234/artist/5678');
        should.exist(that.router.getHandler('/'));
        should.exist(that.router.getHandler('/1234/artist'));
        should.exist(that.router.getHandler('/1234/artist/9876'));
        should.exist(that.router.getHandler('/thisIsATest'));
        done();
      });
    });

    it ("can route a root collection when the router's path is set", function(done){
      this.router = new Router(); 
      this.dir = __dirname + '/test_fixtures/resources';
      this.loader = new FSRouteLoader(this.router, this.dir, "/sub");
      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/index.js' : getCollectionModule('/asdf/index.js')
                      };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('/sub').should.equal('/sub');
        that.router.getUrl('/sub/:root', {root : 1234}).should.equal('/sub/1234');
        should.exist(that.router.getHandler('/sub'));
        should.exist(that.router.getHandler('/sub/1234/'));
        should.exist(that.router.getHandler('/sub/thisIsATest'));
        done();
      });
    });
  });


});
