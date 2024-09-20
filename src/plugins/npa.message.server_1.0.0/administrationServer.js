/*
 * administrationServer.js - Messaging engine administrative requests handlers
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
const { exit } = require('node:process');
const CRYPTOGRAPHIC_SERVICE_NAME = 'cryptography';
const COUCH_DB_SERVICE_NAME =  'couchdb';
const ADMIN_DATABASE_REFERENCE = 'admindb';
 
class AdministrationServer {
	plugin = null;
	constructor(plugin){
		this.plugin = plugin;
	}
	info(msg){
		this.plugin.info(msg);
	}
	debug(msg){
		this.plugin.debug(msg);
	}
	trace(msg){
		this.plugin.trace(msg);
	}
	error(msg){
		this.plugin.error(msg);
	}
	getSecurityToken(req){
		let token = req.body.token;
		if(typeof token!='undefined'){
			let crypto = this.plugin.getService(CRYPTOGRAPHIC_SERVICE_NAME);
			return crypto.encrypt(token,this.plugin.cryptographicKey);
		}else{
			return null;
		}
	}
	checkSecurity(req){
		if(this.plugin.administrativeToken==this.getSecurityToken(req)){
			return true;
		}else{
			return false;
		}
	}
	queryDb(query,then){
		let couchService = this.plugin.getService(COUCH_DB_SERVICE_NAME);
		couchService.query(ADMIN_DATABASE_REFERENCE,query,then);
	}
	insertInDb(doc,then){
		let couchService = this.plugin.getService(COUCH_DB_SERVICE_NAME);
		couchService.createRecord(ADMIN_DATABASE_REFERENCE,doc,then);
	}
	updateInDb(doc,then){
		let couchService = this.plugin.getService(COUCH_DB_SERVICE_NAME);
		couchService.updateRecord(ADMIN_DATABASE_REFERENCE,doc,then);
	}
	deleteFromDb(doc,then){
		let couchService = this.plugin.getService(COUCH_DB_SERVICE_NAME);
		couchService.deleteRecord(ADMIN_DATABASE_REFERENCE,doc,then);
	}
	handleAdminRequest(req,res){
		let actionId = req.params.actionId;
		let registeredAction = false;
		this.debug('handleAdminRequest('+actionId+')');
		if('shutdown'==actionId){
			registeredAction = true;
			this.handleShutdownRequest(req,res);
		}
		if('generateToken'==actionId){
			registeredAction = true;
			this.handleGenerateTokenRequest(req,res);
		}
		if('createQueue'==actionId){
			registeredAction = true;
			this.createMessageQueue(req,res);
		}
		if('getQueues'==actionId){
			registeredAction = true;
			this.getMessageQueues(req,res);
		}
		if('deleteQueue'==actionId){
			registeredAction = true;
			this.deleteMessageQueue(req,res);
		}
		if('createTopic'==actionId){
			registeredAction = true;
			this.createTopic(req,res);
		}
		if('getTopics'==actionId){
			registeredAction = true;
			this.getTopics(req,res);
		}
		if('deleteTopic'==actionId){
			registeredAction = true;
			this.deleteTopic(req,res);
		}
		if(!registeredAction){
			this.info('received invalid request for unknown action "'+actionId+'"');
			res.json({"status": 400,"message": "Bad Request","data": "Action code not supported!"});
		}
	}
	handleShutdownRequest(req,res){
		this.debug('handleShutdownRequest()');
		if(this.checkSecurity(req)){
			setTimeout(function(){ exit(0);},1000);
			res.json({"status": 200,"message": "ok","data": "Server shutdown initiated!"});
		}else{
			res.json({"status": 401,"message": "Unauthorized","data": "Invalid security token"});
		}
	}
	handleGenerateTokenRequest(req,res){
		this.debug('handleGenerateTokenRequest()');
		let passPhrase = req.body.passPhrase;
		this.debug('passPhrase: '+passPhrase);
		if(typeof passPhrase!='undefined'){
			let crypto = this.plugin.getService(CRYPTOGRAPHIC_SERVICE_NAME);
			let encryptedToken = crypto.encrypt(passPhrase,this.plugin.cryptographicKey);
			res.json({"status": 200,"message": "ok","data": encryptedToken});
		}else{
			res.json({"status": 400,"message": "Bad request","data": "Request body should contain a passPhrase attribute"});
		}
	}
	createMessageQueue(req,res){
		this.debug('createMessageQueue()');
		if(this.checkSecurity(req)){
			let queueName = req.body.name;
			this.debug('queueName: '+queueName);
			let persistent = req.body.persistent;
			this.debug('persistent: '+persistent);
			let server = this;
			this.queryDb({"selector": {"$and": [{"type": {"$eq": "queue"}},{"name": {"$eq": queueName}}]}},function(err,data){
				if(err){
					res.json({"status": 500,"message": "Internal server error","data": "Unable to query existing Message Queues"});
				}else{
					if(!data || data.length==0){
						let crypto = server.plugin.getService(CRYPTOGRAPHIC_SERVICE_NAME);
						let token = crypto.encrypt(queueName,server.plugin.cryptographicKey);
						let doc = {"type": "queue","name": queueName,"persistent": persistent,"token": token};
						server.insertInDb(doc,function(err,data){
							if(err){
								res.json({"status": 500,"message": "Internal server error","data": "Unable to create the Message Queue"});
							}else{
								res.json({"status": 200,"message": "ok","data": data});
							}
						});
					}else{
						res.json({"status": 400,"message": "Bad request","data": "Queue name already exists"});
					}
				}
			});
		}else{
			res.json({"status": 401,"message": "Unauthorized","data": "Invalid security token"});
		}
	}
	getMessageQueues(req,res){
		this.debug('getMessageQueues()');
		if(this.checkSecurity(req)){
			this.queryDb({"selector": {"type": {"$eq": "queue"}}},function(err,data){
				if(err){
					res.json({"status": 500,"message": "Internal server error","data": "Unable to query existing Message Queues"});
				}else{
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}else{
			res.json({"status": 401,"message": "Unauthorized","data": "Invalid security token"});
		}
	}
	deleteMessageQueue(req,res){
		this.debug('deleteMessageQueue()');
		if(this.checkSecurity(req)){
			let queueName = req.body.name;
			this.debug('queueName: '+queueName);
			let server = this;
			this.queryDb({"selector": {"$and": [{"type": {"$eq": "queue"}},{"name": {"$eq": queueName}}]}},function(err,data){
				if(err){
					res.json({"status": 500,"message": "Internal server error","data": "Unable to query existing Message Queues"});
				}else{
					if(data && data.length==1){
						server.deleteFromDb(data[0],function(err,data){
							if(err){
								res.json({"status": 500,"message": "Internal server error","data": "Unable to delete the Message Queue"});
							}else{
								res.json({"status": 200,"message": "ok","data": "deleted"});
							}
						});
					}else{
						res.json({"status": 404,"message": "Not Found","data": "Queue name was not found in catalog"});
					}
				}
			});
		}else{
			res.json({"status": 401,"message": "Unauthorized","data": "Invalid security token"});
		}
	}
	createTopic(req,res){
		this.debug('createTopic()');
		if(this.checkSecurity(req)){
			let topicName = req.body.name;
			this.debug('topicName: '+topicName);
			let server = this;
			this.queryDb({"selector": {"$and": [{"type": {"$eq": "topic"}},{"name": {"$eq": topicName}}]}},function(err,data){
				if(err){
					res.json({"status": 500,"message": "Internal server error","data": "Unable to query existing Topics"});
				}else{
					if(!data || data.length==0){
						let crypto = server.plugin.getService(CRYPTOGRAPHIC_SERVICE_NAME);
						let token = crypto.encrypt(topicName,server.plugin.cryptographicKey);
						let doc = {"type": "topic","name": topicName,"token": token,"subscribers": []};
						server.insertInDb(doc,function(err,data){
							if(err){
								res.json({"status": 500,"message": "Internal server error","data": "Unable to create the Topic"});
							}else{
								res.json({"status": 200,"message": "ok","data": data.id});
							}
						});
					}else{
						res.json({"status": 400,"message": "Bad request","data": "Topic name already exists"});
					}
				}
			});
		}else{
			res.json({"status": 401,"message": "Unauthorized","data": "Invalid security token"});
		}
	}
	getTopics(req,res){
		this.debug('getTopics()');
		if(this.checkSecurity(req)){
			this.queryDb({"selector": {"type": {"$eq": "topic"}}},function(err,data){
				if(err){
					res.json({"status": 500,"message": "Internal server error","data": "Unable to query existing Topics"});
				}else{
					res.json({"status": 200,"message": "ok","data": data});
				}
			});
		}else{
			res.json({"status": 401,"message": "Unauthorized","data": "Invalid security token"});
		}
	}
	deleteTopic(req,res){
		this.debug('deleteTopic()');
		if(this.checkSecurity(req)){
			let topicName = req.body.name;
			this.debug('topicName: '+topicName);
			let server = this;
			this.queryDb({"selector": {"$and": [{"type": {"$eq": "topic"}},{"name": {"$eq": topicName}}]}},function(err,data){
				if(err){
					res.json({"status": 500,"message": "Internal server error","data": "Unable to query existing Topics"});
				}else{
					if(data && data.length==1){
						server.deleteFromDb(data[0],function(err,data){
							if(err){
								res.json({"status": 500,"message": "Internal server error","data": "Unable to delete the Topic"});
							}else{
								res.json({"status": 200,"message": "ok","data": "deleted"});
							}
						});
					}else{
						res.json({"status": 404,"message": "Not Found","data": "Topic name was not found in catalog"});
					}
				}
			});
		}else{
			res.json({"status": 401,"message": "Unauthorized","data": "Invalid security token"});
		}
	}
} 

module.exports = AdministrationServer;