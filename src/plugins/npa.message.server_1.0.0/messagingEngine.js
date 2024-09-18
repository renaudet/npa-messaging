/*
 * messagingEngine.js - Messaging engine requests handlers
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
 
const CRYPTOGRAPHIC_SERVICE_NAME = 'cryptography';
const COUCH_DB_SERVICE_NAME =  'couchdb';
const ADMIN_DATABASE_REFERENCE = 'admindb';
const TIMESTAMP_FORMAT = 'YYYY/MM/DD HH:mm:ss';

class QueueManager{
	config = null;
	engine = null;
	queue = [];
	constructor(config,engine){
		this.config = config;
		this.engine = engine;
	}
	publish(message){
		//{"destination": {"type": "queue/topic","name": "abcd","token": "efgh"},"maxAge": 60,"expire": "AAAA/MM/DD HH:mm:ss","content": {}}
		if(this.queue.length<this.engine.maxQueueLength){
			let queueMsg = {"uuid": uuidv4(),"created": moment().format(TIMESTAMP_FORMAT),"maxAge": message.maxAge,"expire": message.expire,"content": message.content};
			this.queue.push(queueMsg);
			console.log('QueueManager #'+this.config.name+': queue length is '+this.queue.length);
			return {"status": "success","uuid": queueMsg.uuid,"created": queueMsg.created};
		}else{
			return {"status": "failure","reason": "maximum queue length reached"}
		}
	}
	pickup(messageId=null){
		if(messageId==null){
			if(this.queue.length>0){
				let message = this.queue.shift();
				console.log('QueueManager #'+this.config.name+': queue length is now '+this.queue.length);
				return message;
			}else{
				return null;
			}
		}else{
			let message = null;
			let newQueue = [];
			for(var i=0;i<this.queue.length;i++){
				let queueMsg = this.queue[i];
				if(queueMsg.uuid==messageId){
					message = queueMsg;
				}else{
					newQueue.push(queueMsg);
				}
			}
			this.queue = newQueue;
			console.log('QueueManager #'+this.config.name+': queue length is now '+this.queue.length);
			return message;
		}
	}
}
 
class MessagingEngine {
	plugin = null;
	adminServer = null;
	queueManagers = {};
	maxQueueLength = 1000;
	constructor(plugin,adminServer){
		this.plugin = plugin;
		this.adminServer = adminServer;
		this.maxQueueLength = this.plugin.getConfigValue('server.queueManager.maxLength',type='integer');
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
	checkMessageStructure(msg){
		let valide = true;
		if(typeof msg=='undefined'){
			valide = false;
		}
		if(valide && typeof msg.destination=='undefined'){
			valide = false;
		}
		if(valide && (typeof msg.destination.type=='undefined' || typeof msg.destination.name=='undefined'|| typeof msg.destination.token=='undefined')){
			valide = false;
		}
		if(valide && ((typeof msg.maxAge!='undefined' || typeof msg.expire!='undefined') && typeof msg.content=='undefined')){
			valide = false;
		}
		return valide;
	}
	checkSecurity(message){
		let crypto = this.plugin.getService(CRYPTOGRAPHIC_SERVICE_NAME);
		let token = crypto.encrypt(message.destination.name,this.plugin.cryptographicKey);
		if(token==message.destination.token){
			return true;
		}
		return false;
	}
	getQueueManager(messageQueue){
		let manager = this.queueManagers[messageQueue.name];
		if(typeof manager=='undefined'){
			console.log('creating new QueueManager #'+messageQueue.name);
			manager = new QueueManager(messageQueue,this);
			this.queueManagers[messageQueue.name] = manager;
		}
		return manager;
	}
	handlePublishingRequest(req,res){
		this.trace('->handlePublishingRequest()');
		var message = req.body;
		if(this.checkMessageStructure(message)){
			if(this.checkSecurity(message)){
				if('queue'==message.destination.type){
					this.trace('<-handlePublishingRequest()');
					this.handleQueuePublishingRequest(message,res);
				}
			}else{
				this.trace('<-handlePublishingRequest()');
				res.json({"status": 401,"message": "Not Authorized","data": "invalid security token"});
			}
		}else{
			this.trace('<-handlePublishingRequest()');
			res.json({"status": 400,"message": "Bad Request","data": "invalid message structure"});
		}
	}
	handleQueuePublishingRequest(message,res){
		this.trace('->handleQueuePublishingRequest()');
		let server = this;
		this.adminServer.queryDb({"selector": {"$and": [{"type": {"$eq":"queue"}},{"name": {"$eq":message.destination.name}}]}},function(err,data){
			if(err){
				server.trace('<-handleQueuePublishingRequest()');
				res.json({"status": 500,"message": "Internal Server Error","data": "unable to query the catalog"});
			}else{
				if(data && data.length==1){
					let queue = data[0];
					server.debug('processing message publishing for queue "'+message.destination.name+'"');
					server.debug('message: '+JSON.stringify(message));
					server.debug('queue: '+JSON.stringify(queue));
					let queueManager = server.getQueueManager(queue);
					let receipt = queueManager.publish(message);
					server.trace('<-handleQueuePublishingRequest()');
					res.json({"status": 200,"message": "Ok","data": receipt});
				}else{
					server.trace('<-handleQueuePublishingRequest()');
					res.json({"status": 406,"message": "Not Acceptable","data": "Unknown queue name"});
				}
			}
		});
		
	}
	handleReadingRequest(req,res){
		this.trace('->handleReadingRequest()');
		let server = this;
		var messageRequest = req.body;
		if(this.checkMessageStructure(messageRequest) && 'queue'==messageRequest.destination.type){
			this.adminServer.queryDb({"selector": {"$and": [{"type": {"$eq":"queue"}},{"name": {"$eq":messageRequest.destination.name}}]}},function(err,data){
				if(err){
					server.trace('<-handleReadingRequest()');
					res.json({"status": 500,"message": "Internal Server Error","data": "unable to query the catalog"});
				}else{
					if(data && data.length==1){
						let queue = data[0];
						server.debug('processing message pick-up request on queue "'+messageRequest.destination.name+'"');
						server.debug('message request: '+JSON.stringify(messageRequest));
						server.debug('queue: '+JSON.stringify(queue));
						let queueManager = server.getQueueManager(queue);
						let message = queueManager.pickup(messageRequest.uuid?messageRequest.uuid:null);
						if(typeof message!='undefined' && message!=null){
							server.trace('<-handleReadingRequest()');
							res.json({"status": 200,"message": "Ok","data": message});
						}else{
							server.trace('<-handleReadingRequest()');
							res.json({"status": 404,"message": "Not Found","data": "No message found"});
						}
					}else{
						server.trace('<-handleReadingRequest()');
						res.json({"status": 406,"message": "Not Acceptable","data": "Unknown queue name"});
					}
				}
			});
		}else{
			this.trace('<-handleReadingRequest()');
			res.json({"status": 400,"message": "Bad Request","data": "invalid message structure"});
		}
		
	}
}

module.exports = MessagingEngine;