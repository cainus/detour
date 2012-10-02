require('should');
var AutoPather = require('../index').AutoPather;
// simple in these tests means "non-collection".


describe("AutoPather", function(){

  describe("#path", function(){

    it ("can path a simple index.js", function(){
      var pather = new AutoPather(
      { '/index.js':
          { module: { handler: {} },
            fullpath: '/asdf/index.js',
            type: 'file' }}
      );
      pather.path('/index.js').should.equal('/');
    });

    it ("can path a collection index.js", function(){
      var pather = new AutoPather(
      { '/index.js':
          { module: { handler: {}, wildcard : {} },
            fullpath: '/asdf/index.js',
            type: 'file' }}
      );
      pather.path('/index.js').should.equal('/*root');
    });

    it ("can path a simple module under a simple index.js", function(){
      var pather = new AutoPather(
      { 
        '/index.js':
          { module: { handler: {} },
            fullpath: '/asdf/index.js',
            type: 'file' },
        '/song.js':
          { module: { handler: {} },
            fullpath: '/asdf/song.js',
            type: 'file' }
      }
      );
      pather.path('/song.js').should.equal('/song');
    });

    it ("can path a simple module under a collection index.js", function(){
      var pather = new AutoPather(
      { 
        
        '/index.js':
          { module: { handler: {}, wildcard : {} },
            fullpath: '/asdf/index.js',
            type: 'file' },
      
        '/song.js':
          { module: { handler: {} },
            fullpath: '/asdf/song.js',
            type: 'file' }
      }
      );
      pather.path('/song.js').should.equal('/*root/song');
    });
  
    it ("can path a collection under a collection index.js", function(){
      var pather = new AutoPather(
      { 
        
        '/index.js':
          { module: { handler: {}, wildcard : {} },
            fullpath: '/asdf/index.js',
            type: 'file' },
      
        '/song.js':
          { module: { handler: {}, wildcard : {} },
            fullpath: '/asdf/song.js',
            type: 'file' }
      }
      );
      pather.path('/song.js').should.equal('/*root/song/*song');
    });

    it ("can path a simple module under 2 collections", function(){
      var pather = new AutoPather(
      { 
        
        '/index.js':
          { module: { handler: {}, wildcard : {} },
            fullpath: '/asdf/index.js',
            type: 'file' },
      
        '/artist.js':
          { module: { handler: {}, wildcard : {} },
            fullpath: '/asdf/artist.js',
            type: 'file' },

        '/artist/song.js':
          { module: { handler: {} },
            fullpath: '/asdf/artist/song.js',
            type: 'file' }
      }
      );
      pather.path('/artist/song.js').should.equal('/*root/artist/*artist/song');
    });
  
    it ("can path a triple nested collection", function(){
      var pather = new AutoPather(
      { 
        
        '/index.js':
          { module: { handler: {}, wildcard : {} },
            fullpath: '/asdf/index.js',
            type: 'file' },
      
        '/artist.js':
          { module: { handler: {}, wildcard : {} },
            fullpath: '/asdf/artist.js',
            type: 'file' },

        '/artist/song.js':
          { module: { handler: {}, wildcard : {} },
            fullpath: '/asdf/artist/song.js',
            type: 'file' }
      }
      );
      pather.path('/artist/song.js').should.equal('/*root/artist/*artist/song/*song');
    });
    it ("can path triple nested simple module", function(){
      var pather = new AutoPather(
      { 
        
        '/index.js':
          { module: { handler: {} },
            fullpath: '/asdf/index.js',
            type: 'file' },
      
        '/artist.js':
          { module: { handler: {} },
            fullpath: '/asdf/artist.js',
            type: 'file' },

        '/artist/song.js':
          { module: { handler: {} },
            fullpath: '/asdf/artist/song.js',
            type: 'file' }
      }
      );
      pather.path('/artist/song.js').should.equal('/artist/song');
    });
  });


});
