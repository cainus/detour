var dir = './lib/';
if (process.env.COVERAGE){
	var dir = './lib-cov/';
}
exports.Router = require(dir + 'Router');
exports.AutoPather = require(dir + 'AutoPather');
exports.FSRouteLoader = require(dir + 'FSRouteLoader');
exports.DirRequirer = require(dir + 'DirRequirer');
exports.DetourError = require(dir + 'DetourError');
exports.RouteCollection = require(dir + 'RouteCollection');
