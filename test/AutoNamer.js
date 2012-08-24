require('should');
var AutoNamer = require('../AutoNamer');
// simple in these tests means "non-collection".


describe("AutoNamer", function(){

  describe("#name", function(){

    it ("can name a simple index.js", function(){
      var namer = new AutoNamer(
      { '/index.js':
          { module: { handler: {} },
            fullpath: '/asdf/index.js',
            type: 'file' }}
      );
      namer.name('/index.js').should.equal('root');
    });

    it ("can name a collection index.js", function(){
      var namer = new AutoNamer(
      { '/index.js':
          { module: { handler: {}, member : {} },
            fullpath: '/asdf/index.js',
            type: 'file' }}
      );
      namer.name('/index.js').should.equal('root*');
    });

    it ("can name a simple module under a simple index.js", function(){
      var namer = new AutoNamer(
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
      namer.name('/song.js').should.equal('song');
    });

    it ("can name a simple module under a collection index.js", function(){
      var namer = new AutoNamer(
      { 
        
        '/index.js':
          { module: { handler: {}, member : {} },
            fullpath: '/asdf/index.js',
            type: 'file' },
      
        '/song.js':
          { module: { handler: {} },
            fullpath: '/asdf/song.js',
            type: 'file' }
      }
      );
      namer.name('/song.js').should.equal('root*song');
    });
  
    it ("can name a collection under a collection index.js", function(){
      var namer = new AutoNamer(
      { 
        
        '/index.js':
          { module: { handler: {}, member : {} },
            fullpath: '/asdf/index.js',
            type: 'file' },
      
        '/song.js':
          { module: { handler: {}, member : {} },
            fullpath: '/asdf/song.js',
            type: 'file' }
      }
      );
      namer.name('/song.js').should.equal('root*song*');
    });

    it ("can name a simple module under 2 collections", function(){
      var namer = new AutoNamer(
      { 
        
        '/index.js':
          { module: { handler: {}, member : {} },
            fullpath: '/asdf/index.js',
            type: 'file' },
      
        '/artist.js':
          { module: { handler: {}, member : {} },
            fullpath: '/asdf/artist.js',
            type: 'file' },

        '/artist/song.js':
          { module: { handler: {} },
            fullpath: '/asdf/artist/song.js',
            type: 'file' }
      }
      );
      namer.name('/artist/song.js').should.equal('root*artist*song');
    });
  
    it ("can name a triple nested collection", function(){
      var namer = new AutoNamer(
      { 
        
        '/index.js':
          { module: { handler: {}, member : {} },
            fullpath: '/asdf/index.js',
            type: 'file' },
      
        '/artist.js':
          { module: { handler: {}, member : {} },
            fullpath: '/asdf/artist.js',
            type: 'file' },

        '/artist/song.js':
          { module: { handler: {}, member : {} },
            fullpath: '/asdf/artist/song.js',
            type: 'file' }
      }
      );
      namer.name('/artist/song.js').should.equal('root*artist*song*');
    });
    it ("can name triple nested simple module", function(){
      var namer = new AutoNamer(
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
      namer.name('/artist/song.js').should.equal('artistSong');
    });
  });


});
