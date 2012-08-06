var should = require('should');
var hottap = require('hottap').hottap;
var _ = require('underscore');
var Router = require('../Router').Router;
var FSRouteLoader = require('../FSRouteLoader').FSRouteLoader;

var getSimpleModule = function(fullpath){
  return { module : { handler : {GET : function(req, res){res.end(fullpath);} } },
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


  describe("#autoName", function(){
    it ("names a root path properly", function(){
      this.loader.autoName('/_index.js').should.equal('root');
    });
    it ("names a root child path properly", function(){
      this.loader.autoName('/artist.js').should.equal('artist');
    });
    it ("names a double star path properly", function(){
      this.loader.autoName('/artist/_artist/song/_song.js').should.equal('artist*song*');
    });
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

    it ("complains if there's no /_index.js", function(done){
      // fake out require
      this.loader.requirer.require = function(cb){
        this.paths = {};
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        err.name.should.equal("MissingIndexResource");
        err.message.should.equal("There was no _index.js at the given path.  This is the first necessary resource file.");
        err.detail.should.equal(that.dir);
        done();
      });
    });

    it ("sets / if there's a /_index.js", function(done){
      // fake out require
      this.loader.requirer.require = function(cb){
        this.paths = {'/_index.js' : getSimpleModule('/asdf/_index.js') };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('root').should.equal('/');
        done();
      });
    });

    it ("routes root-dir files", function(done){
      this.loader.requirer.require = function(cb){
        this.paths = {'/_index.js' : getSimpleModule('/asdf/_index.js'),
                      '/song.js' : getSimpleModule('/asdf/song.js'),
                      '/band.js' : getSimpleModule('/asdf/band.js')
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('root').should.equal('/');
        that.router.getUrl('song').should.equal('/song');
        that.router.getUrl('band').should.equal('/band');
        done();
      });
    });
   

    it ("returns an error if there's a dir with no module for it", function(done){
      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/_index.js' : getSimpleModule('/asdf/_index.js'),
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
                      '/_index.js' : getSimpleModule('/asdf/_index.js'),
                      '/song' : {'type' : 'dir', fullpath : '/asdf/song'},
                      '/song.js' : getSimpleModule('/asdf/song.js')
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('root').should.equal('/');
        that.router.getUrl('song').should.equal('/song');
        done();
      });
    });

    it ("routes resources in sub-directories", function(done){
      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/_index.js' : getSimpleModule('/asdf/_index.js'),
                      '/song.js' : getSimpleModule('/asdf/song.js'),
                      '/song' : {'type' : 'dir', fullpath : '/asdf/song'},
                      '/song/artist.js' : getSimpleModule('/asdf/song/artist.js')
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('root').should.equal('/');
        that.router.getUrl('song').should.equal('/song');
        that.router.getUrl('songArtist').should.equal('/song/artist');
        that.router.getUrl('/song/artist').should.equal('/song/artist');
        done();
      });
    });

    /*
          A collection module is a js file starting with an underscore that is
          meant to be routed to a dynamic path.

          This test ensures that when a collection module exists, it does not
          have any siblings.  This is because a collection module matches everything,
          and siblings would not be route-able.
    */
    it ("returns an error if a dir with a collection has siblings", function(done){

      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/_index.js' : getSimpleModule('/asdf/_index.js'),
                      '/song.js' : getSimpleModule('/asdf/song.js'),
                      '/song' : {'type' : 'dir', fullpath : '/asdf/song'},
                      '/song/_song.js' : getSimpleModule('/asdf/song.js'),
                      '/song/artist.js' : getSimpleModule('/asdf/song/artist.js')
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.exist(err);
        err.name.should.equal("DynamicRouteWithSiblings");
        err.message.should.equal("If you have a dynamic path, you can't have other paths in the same directory.");
        err.detail.should.equal('/song/_song.js is a dynamic path and so cannot share a directory with /song/artist.js.');
        done();
      });
    });

    it ("can route dynamic routes", function(done){

      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/_index.js' : getSimpleModule('/asdf/_index.js'),
                      '/song.js' : getSimpleModule('/asdf/song.js'),
                      '/song' : {'type' : 'dir', fullpath : '/asdf/song'},
                      '/song/_song.js' : getSimpleModule('/asdf/song.js')
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('root').should.equal('/');
        that.router.getUrl('song').should.equal('/song');
        that.router.getUrl('/song/*song', {song : 1234}).should.equal('/song/1234');
        that.router.getUrl('song*', {song : 1234}).should.equal('/song/1234');
        done();
      });
    });

    it ("can route double dynamic routes", function(done){

      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/_index.js' : getSimpleModule('/asdf/_index.js'),
                      '/artist.js' : getSimpleModule('/asdf/artist.js'),
                      '/artist' : {'type' : 'dir', fullpath : '/asdf/artist'},
                      '/artist/_artist.js' :
                                     getSimpleModule('/asdf/artist/_artist.js'),
                      '/artist/_artist' : { type : 'dir', 
                                            fullpath : '/asdf/artist/_artist'},
                      '/artist/_artist/song.js' : 
                                     getSimpleModule('/asdf/artist/_artist/song.js'),
                      '/artist/_artist/song' : { type : 'dir', 
                                            fullpath : '/asdf/artist/_artist/song'},
                      '/artist/_artist/song/_song.js' : 
                                     getSimpleModule('/asdf/artist/_artist/song/_song.js')
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('root').should.equal('/');
        that.router.getUrl('artist').should.equal('/artist');
        that.router.getUrl('/artist/*artist', {artist : 1234}).should.equal('/artist/1234');
        that.router.getUrl('artist*', {artist : 1234}).should.equal('/artist/1234');
        that.router.getUrl('/artist/*artist/song', {artist : 1234})
                            .should.equal('/artist/1234/song');
        that.router.getUrl('artist*song', {artist : 1234})
                            .should.equal('/artist/1234/song');
        that.router.getUrl('/artist/*artist/song/*song', {artist : 1234, song : 5678})
                            .should.equal('/artist/1234/song/5678');
        that.router.getUrl('artist*song*', {artist : 1234, song : 5678})
                            .should.equal('/artist/1234/song/5678');
        done();
      });
    });


    it ("can route collection modules into two routes", function(done){

      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/_index.js' : getSimpleModule('/asdf/_index.js'),
                      '/song.js' :
                        {module : { 
                            handler : 
                                {GET : function(req, res){
                                          res.end('collection');
                                       }
                                },
                            member :
                                {GET : function(req, res){
                                          res.end('member');
                                       }
                                }
                          },
                          type : 'file',
                          fullpath : '/asdf/song.js'
                      }
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('root').should.equal('/');
        that.router.getUrl('song').should.equal('/song');
        that.router.getUrl('/song/*song', {song : 1234}).should.equal('/song/1234');
        that.router.getUrl('song*', {song : 1234}).should.equal('/song/1234');
        done();
      });
    });

    it ("can route a collection module from the root", function(done){

      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/_index.js' :  {module : {
                                                    handler :
                                                        {GET : function(req, res){
                                                                  res.end('collection');
                                                               }
                                                        },
                                                    member :
                                                        {GET : function(req, res){
                                                                  res.end('member');
                                                               }
                                                        }
                                                  },
                                                  type : 'file',
                                                  fullpath : '/asdf/song.js'
                                              }
                                            };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('root').should.equal('/');
        that.router.getUrl('/*root', {root : 1234}).should.equal('/1234');
        done();
      });
    });

    it ("can nest collection modules", function(done){
      this.router = new Router("/sub");  // set the router's path.  this is key.
      this.dir = __dirname + '/test_fixtures/resources';
      this.loader = new FSRouteLoader(this.router, this.dir);

      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/_index.js' : getSimpleModule('/asdf/_index.js'),
                      '/artist.js' :
                        {module : { 
                            handler : 
                                {GET : function(req, res){
                                          res.end('collection');
                                       }
                                },
                            member :
                                {GET : function(req, res){
                                          res.end('member');
                                       }
                                }
                          },
                          type : 'file',
                          fullpath : '/asdf/artist.js'
                      },
                      '/artist/*artist/song.js' :
                        {module : { 
                            handler : 
                                {GET : function(req, res){
                                          res.end('collection');
                                       }
                                },
                            member :
                                {GET : function(req, res){
                                          res.end('member');
                                       }
                                }
                          },
                          type : 'file',
                          fullpath : '/asdf/artist/_artist/song.js'
                      }
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('root').should.equal('/sub');
        that.router.getUrl('artist').should.equal('/sub/artist');
        that.router.getUrl('/sub/artist/*artist', {artist : 1234}).should.equal('/sub/artist/1234');
        that.router.getUrl('artist*', {artist : 1234}).should.equal('/sub/artist/1234');
        that.router.getUrl('/sub/artist/*artist/song', {artist : 1234})
                            .should.equal('/sub/artist/1234/song');
        that.router.getUrl('artist*song', {artist : 1234})
                            .should.equal('/sub/artist/1234/song');
        that.router.getUrl('/sub/artist/*artist/song/*song', {artist : 1234, song : 5678})
                            .should.equal('/sub/artist/1234/song/5678');
        that.router.getUrl('artist*song*', {artist : 1234, song : 5678})
                            .should.equal('/sub/artist/1234/song/5678');
        done();
      });
    });
    it ("can route a module below a root collection module", function(done){
      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/_index.js' :  {module : {
                                                    handler :
                                                        {GET : function(req, res){
                                                                  res.end('collection');
                                                               }
                                                        },
                                                    member :
                                                        {GET : function(req, res){
                                                                  res.end('member');
                                                               }
                                                        }
                                                  },
                                                  type : 'file',
                                                  fullpath : '/asdf/_index.js'
                                              },
                      '/*root/artist.js' :
                        {module : { 
                            handler : 
                                {GET : function(req, res){
                                          res.end('artist collection');
                                       }
                                },
                            member :
                                {GET : function(req, res){
                                          res.end('artist member');
                                       }
                                }
                          },
                          type : 'file',
                          fullpath : '/asdf/_index/artist.js'
                      }
                    };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('root').should.equal('/');
        that.router.getUrl('/*root', {root : 1234}).should.equal('/1234');
        that.router.getUrl('/*root/artist', {root : 1234}).should.equal('/1234/artist');
        that.router.getUrl('/*root/artist/*artist', {root : 1234, artist : 5678}).should.equal('/1234/artist/5678');
        should.exist(that.router.getHandler('/'));
        should.exist(that.router.getHandler('/1234/artist'));
        should.exist(that.router.getHandler('/1234/artist/9876'));
        should.exist(that.router.getHandler('/thisIsATest'));
        done();
      });
    });

    it ("can route a root collection when the router's path is set", function(done){
      this.router = new Router("/sub");  // set the router's path.  this is key.
      this.dir = __dirname + '/test_fixtures/resources';
      this.loader = new FSRouteLoader(this.router, this.dir);
      this.loader.requirer.require = function(cb){
        this.paths = {
                      '/_index.js' :  
                        {
                          module : {
                              handler : {
                                GET : function(req, res){
                                  res.end('collection');
                                }
                              },
                              member : {
                                GET : function(req, res){
                                  res.end('member');
                                }
                              }
                              },
                          type : 'file',
                          fullpath : '/asdf/_index.js'
                        }
                      };
        cb();
      };
      var that = this;
      this.loader.load(function(err){
        should.not.exist(err);
        that.router.getUrl('root').should.equal('/sub');
        that.router.getUrl('/sub/*root', {root : 1234}).should.equal('/sub/1234');
        should.exist(that.router.getHandler('/sub'));
        should.exist(that.router.getHandler('/sub/1234/'));
        should.exist(that.router.getHandler('/sub/thisIsATest'));
        done();
      });
    });
  });


});
