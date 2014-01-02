# detour
[![Build Status](https://secure.travis-ci.org/cainus/detour.png?branch=master)](http://travis-ci.org/cainus/detour)
[![Coverage Status](https://coveralls.io/repos/cainus/detour/badge.png?branch=master)](https://coveralls.io/r/cainus/detour?branch=master)
[![NPM version](https://badge.fury.io/js/percolator.png)](http://badge.fury.io/js/percolator)

Detour is router for node.js web applications.

Detour is different from sinatra-style routers (like [express's router](http://expressjs.com/api.html#app.VERB)) because you **route urls to objects** (that have http methods) instead of to http methods.

If you have multiple http methods implemented for a given url (like a lot of APIs do), this style of routing will be much more natural and will vastly improve your code organization and re-use.

It works for node.js' standard HTTP server, as well as express and connect applications.



