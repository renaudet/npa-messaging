/*
 * plugin.js - Messaging engine for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../npaUtil.js');

var plugin = new Plugin();

plugin.start = function(){
	this.name = process.env[ENV_NAME];
	this.info('Application '+this.name+' starting...');
	var httpServer = plugin.getService('http');
	httpServer.startListener();
}

plugin.administrativeRequestHandler = function(req,res){
	plugin.debug('->administrativeRequestHandler');
	//res.set('Content-Type','application/json');
	let actionId = req.params.actionId;
	res.json({"status": 200,"message": "ok","data": actionId});
}

module.exports = plugin;