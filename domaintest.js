var _ = require('underscore');
var Router = require('./lib/Router');
var should = require('should');

  var FakeRes = function(){
    this.body = '';
    this.endWasCalled = false;
    this.headers = {};
    this.statusCode = 0;
    this.end = function(data){ 
      this.endArgs = _.toArray(arguments);
      this.body = data || ''; 
      this.endWasCalled = true;
      console.log("ended: ", data);
    };
    this.writeHead = function(code){
      this.statusCode = code;
      console.log("wrote head: ", this.statusCode);
    };
    this.setHeader = function(name, value){this.headers[name] = value;};
    this.expectHeader = function(name, value){
      if (!this.headers[name]){
        should.fail("header " + name + " was not set.");
      }
      if (this.headers[name] != value){
        should.fail("header " + name + 
                    " was supposed to be " + value + 
                    " but was " + this.headers[name] + ".");
      }
    };
    this.expectStatus = function(status){
      this.statusCode.should.equal(status);
    };
    this.expectEnd = function() { 
      if (!this.endWasCalled){
        should.fail("end() was not called.");
      }
      var args = _.toArray(arguments);
      var diff = (_.difference(this.endArgs, args)).concat(_.difference(args, this.endArgs));
      if (diff.length !== 0){
        should.fail("Expected end(" + 
                    args.join(", ") + 
                    ") but got end(" + 
                    this.endArgs.join(", ") + ")");
      }
    };
  };

this.d = new Router();
this.d.route('/', { GET : function(context){ throw 'wthizzle';}});
this.d.handle500 = function($, ex){
  console.log(ex);
  ex.should.equal('wthizzle');
  console.log("success!  domains work!");
};
this.req = { url : "http://asdf.com/", method : "GET"};
this.res = new FakeRes();

this.d.dispatch({req : this.req, res : this.res});


