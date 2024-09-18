/*
 * plugin.js - Messaging engine for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../npaUtil.js');
const AdministrationServer = require('./administrationServer.js');
const MessagingEngine = require('./messagingEngine.js');
const ENV_NAME = 'APPLICATION_NAME';
const HTTP_SERVCE_NAME = 'http';
const COUCH_DB_SERVICE_NAME =  'couchdb';
const ADMIN_DATABASE_REFERENCE = 'admindb';

var plugin = new Plugin();
plugin.adminHandler = null;
plugin.engine = null;
plugin.cryptographicKey = '';
plugin.administrativeToken = '';

plugin.start = function(){
	this.name = process.env[ENV_NAME];
	this.info('Application "'+this.name+'" starting...');
	this.cryptographicKey = this.getConfigValue('security.key',type='string');
	this.administrativeToken = this.getConfigValue('security.token',type='string');
	this.info('Security Token is: >'+this.administrativeToken+'<');
	this.adminHandler = new AdministrationServer(this);
	this.engine = new MessagingEngine(this,this.adminHandler);
	let httpServer = plugin.getService(HTTP_SERVCE_NAME);
	let couchService = plugin.getService(COUCH_DB_SERVICE_NAME);
	couchService.checkDatabase(ADMIN_DATABASE_REFERENCE,function(err,exists){
		if(err){
			plugin.error('Error checking for CouchDB database '+ADMIN_DATABASE_REFERENCE);
			plugin.error(JSON.stringify(err));
		}else{
			if(exists){
				httpServer.startListener();
			}else{
				plugin.info('creating Messaging Engine administrative database (catalog)');
				couchService.createDatabase(ADMIN_DATABASE_REFERENCE,function(err,created){
					if(err){
						plugin.error('Error creating CouchDB database '+ADMIN_DATABASE_REFERENCE);
						plugin.error(JSON.stringify(err));
					}else{
						httpServer.startListener();
					}
				});
			}
		}
	});
}

plugin.administrativeRequestHandler = function(req,res){
	plugin.debug('->administrativeRequestHandler');
	plugin.adminHandler.handleAdminRequest(req,res);
}

plugin.queueManagerPublishRequestHandler = function(req,res){
	plugin.debug('->queueManagerRequestHandler');
	plugin.engine.handlePublishingRequest(req,res);
}

plugin.queueManagerReadRequestHandler = function(req,res){
	plugin.debug('->queueManagerReadRequestHandler');
	plugin.engine.handleReadingRequest(req,res);
}

module.exports = plugin;