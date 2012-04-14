# detour
[![Build Status](https://secure.travis-ci.org/cainus/detour.png?branch=master)](http://travis-ci.org/cainus/detour)

This project is entirely experimental, and I'm still working out whether the experiment has 
been a success.

## Values:
* Get HTTP as right as possible so that application developers don't have to.
* Make creation of simple, compact URI hierarchies easy and avoid arbitrary orphan routes.
* Make it easy to read routes and make it easy to generate URIs.
* Make URIs point to resources that supply all the HTTP method handlers for that URI (we'll call that a resource).
* Make dynamic routes easy.

## Why not just use existing routers?

Hypothesis:  Existing Sinatra-style routers get a few things wrong:

* HTTP nerdiness alert:  For a number of reasons, it's not technically correct for 
routing to take the HTTP method into consideration.  For example, a 404 should be thrown only 
if the URI doesn't exist, and not just if the particular method is unsupported (that's a 405 
by the way).  The router should get the details right so that the application developer doesn't 
have to think about it.

* Orphan routes, where a URI like /some/deep/path might exist, but the parent paths 
(/some and /some/deep) don't, makes for a confusing and arbitrary website/api.  These are still 
possible, but they're certainly not the default.

* The full power of regular expressions in dynamic routes is not really necessary and just 
overcomplicates things.

* URL generation, especially that of parent and child paths should be easy.


## Automated Tests:
npm test
