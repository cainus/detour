# detour
[![Build Status](https://secure.travis-ci.org/cainus/detour.png?branch=master)](http://travis-ci.org/cainus/detour)

This project is entirely experimental, and I'm still working out whether the experiment has 
been a success.

## Values:
* Get HTTP as right as possible so that application developers don't have to.
* Make creation of simple, compact URI hierarchies easy and avoid arbitrary orphan routes.
* Make it easy to set and get routes and make it easy to generate URIs.
* Make URIs point to resources that supply all the HTTP method handlers for that URI (we'll call that a resource).
* Handle routing-related error-scenarios so that the resource doesn't have to.
* Content-Type and Accept-Type should be handled by the resource, not the router.  The resource defines what media 
types it will support.
* HEAD and OPTIONS handlers should be included to save resources from having to implement them.  Technically they 
 are the probably the resource's responsibility, but they should be handled the same everywhere anyway.

## Why not just use existing routers?

Hypothesis:  Existing Sinatra-style routers get a few things wrong:

* Routing based partially on the HTTP method is a bad fit for resource-oriented architectures and often leads to 
the wrong HTTP response codes (like 404s when a method is not supported instead of the proper 405).  The router 
should get the details right so that the application developer doesn't have to think about it, and so people 
using the API get the right messages, so they can understand the API better. 

* Orphan routes, where a URI like /some/deep/path might exist, but the parent paths 
(/some and /some/deep) don't, make for a confusing and arbitrary website/api.  These are still 
possible, but they're certainly not the default.

* The full power of regular expressions in dynamic routes is not really necessary and just 
overcomplicates things.

* URL generation, especially that of parent and child paths should be easy.


## Automated Tests:
npm test
