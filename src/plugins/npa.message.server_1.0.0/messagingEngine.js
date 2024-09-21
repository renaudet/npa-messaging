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
const REST_PLUGIN_ID = 'npa.rest';

class InMemoryQueueManager{
	config = null;
	engine = null;
	queue = [];
	constructor(config,engine){
		this.config = config;
		this.engine = engine;
	}
	publish(message){
		//{"destination": {"type": "queue/topic","name": "abcd","token": "efgh"},"maxAge": 60,"expire": "AAAA/MM/DD HH:mm:ss","content": {}}
		this.engine.trace('QueueManager #'+this.config.name+' ->publish()');
		if(this.queue.length<this.engine.maxQueueLength){
			let queueMsg = {"uuid": uuidv4(),"created": moment().format(TIMESTAMP_FORMAT),"maxAge": message.maxAge,"expire": message.expire,"content": message.content};
			this.queue.push(queueMsg);
			this.engine.info('QueueManager #'+this.config.name+': queue length is '+this.queue.length);
			this.engine.trace('QueueManager #'+this.config.name+' <-publish()');
			return {"status": "success","uuid": queueMsg.uuid,"created": queueMsg.created};
		}else{
			this.engine.trace('QueueManager #'+this.config.name+' <-publish()');
			return {"status": "failure","reason": "maximum queue length reached"}
		}
	}
	pickup(messageId=null){
		this.engine.trace('QueueManager #'+this.config.name+' ->pickup()');
		if(messageId==null){
			this.engine.debug('messageId is null');
			if(this.queue.length>0){
				let message = this.queue.shift();
				this.engine.info('QueueManager #'+this.config.name+': queue length is now '+this.queue.length);
				this.engine.trace('QueueManager #'+this.config.name+' <-pickup() - returning message #ID: '+message.uuid);
				return message;
			}else{
				this.engine.trace('QueueManager #'+this.config.name+' <-pickup() - returning null');
				return null;
			}
		}else{
			this.engine.debug('messageId: '+messageId);
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
			this.engine.info('QueueManager #'+this.config.name+': queue length is now '+this.queue.length);
			this.engine.trace('QueueManager #'+this.config.name+' <-pickup() - '+(message==null?'returning null':('returning message #ID: '+message.uuid)));
			return message;
		}
	}
	async checkForEviction(){
		this.engine.trace('QueueManager #'+this.config.name+' ->checkForEviction()');
		let now = moment();
		this.engine.debug('time: '+now.format(TIMESTAMP_FORMAT));
		let newQueue = [];
		for(var i=0;i<this.queue.length;i++){
			let msg = this.queue[i];
			this.engine.debug('message #ID: '+msg.uuid);
			let markForEviction = false;
			if(typeof msg.maxAge!='undefined'){
				this.engine.debug('maxAge: '+(msg.maxAge*1000));
				let msgAge = now.diff(moment(msg.created,TIMESTAMP_FORMAT));
				this.engine.debug('current age: '+msgAge);
				if(msgAge>(msg.maxAge*1000)){
					markForEviction = true;
				}
			}
			if(typeof msg.expire!='undefined'){
				this.engine.debug('expire: '+msg.expire);
				this.engine.debug('delta to now: '+now.diff(moment(msg.expire,TIMESTAMP_FORMAT)));
				if(now.diff(moment(msg.expire,TIMESTAMP_FORMAT))>=0){
					markForEviction = true;
				}
			}
			if(markForEviction){
				this.engine.info('Evicting Message ID#'+msg.uuid+' due to maxAge or expire rule');
			}else{
				newQueue.push(msg);
			}
		}
		this.queue = newQueue;
		this.engine.trace('QueueManager #'+this.config.name+' <-checkForEviction()');
	}
}

class PersistentQueueManager{
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
	checkForEviction(){
		
	}
}

class TopicManager{
	config = null;
	engine = null;
	constructor(config,engine){
		this.config = config;
		this.engine = engine;
	}
	extractConnectionData(endpointUrl){
		let ctx = {"host": "localhost","port": 80,"secured": false,"uri": "/"};
		if(endpointUrl.startsWith('https://')){
			ctx.secured = true;
			ctx.acceptCertificate = true;
			ctx.port = 443;
		}
		let hostStartIndex = endpointUrl.indexOf('://')+3;
		let portDelimiterIndex = endpointUrl.indexOf(':',hostStartIndex); 
		let hostEndIndex = portDelimiterIndex>0?portDelimiterIndex:endpointUrl.indexOf('/',hostStartIndex);
		ctx.host = endpointUrl.substring(hostStartIndex,hostEndIndex);
		if(portDelimiterIndex>0){
			let portStartIndex = portDelimiterIndex+1;
			let portEndIndex = endpointUrl.indexOf('/',hostStartIndex);
			ctx.port = parseInt(endpointUrl.substring(portStartIndex,portEndIndex));
		}
		ctx.uri = endpointUrl.substring(endpointUrl.indexOf('/',hostStartIndex));
		console.log(ctx);
		return ctx;
	}
	async postMessage(from,to,msgCtx){
		let restService = this.engine.plugin.runtime.getPlugin(REST_PLUGIN_ID);
		let engine = this.engine;
		restService.performRestApiCall(msgCtx,function(err,response){
			if(err){
				engine.error('TopicManager #'+from+': could not deliver message #'+msgCtx.payload.uuid+' to '+to);
				engine.error(err);
			}else{
				engine.debug('TopicManager #'+from+': successfully delivered message #'+msgCtx.payload.uuid+' to '+to);
			}
		});
	}
	publish(message){
		let topicMsg = {"uuid": uuidv4(),"created": moment().format(TIMESTAMP_FORMAT),"content": message.content};
		for(var i=0;i<this.config.subscribers.length;i++){
			let subscriber = this.config.subscribers[i];
			let connectionContext = this.extractConnectionData(subscriber.endpoint);
			connectionContext.method = 'POST';
			connectionContext.payload = topicMsg;
			this.postMessage(this.config.name,subscriber.name,connectionContext);
		}
		return {"status": "success","uuid": topicMsg.uuid,"created": topicMsg.created};
	}
}
 
class MessagingEngine {
	plugin = null;
	adminServer = null;
	queueManagers = {};
	topicManagers = {};
	maxQueueLength = 1000;
	checkInterval = 60000;
	defaultExpirationTimeout = 300;
	constructor(plugin,adminServer){
		this.plugin = plugin;
		this.adminServer = adminServer;
		this.maxQueueLength = this.plugin.getConfigValue('server.queueManager.maxLength',type='integer');
		this.checkInterval = this.plugin.getConfigValue('server.queueManager.checkInterval',type='integer')*1000;
		this.defaultExpirationTimeout = this.plugin.getConfigValue('server.queueManager.defaultExpirationTimeout',type='integer');
		let engine = this;
		setTimeout(function(){ engine.reaperLoop(); },this.checkInterval);
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
			if(messageQueue.persistent){
				manager = new PersistentQueueManager(messageQueue,this);
				this.queueManagers[messageQueue.name] = manager;
			}else{
				manager = new InMemoryQueueManager(messageQueue,this);
				this.queueManagers[messageQueue.name] = manager;
			}
		}
		return manager;
	}
	getTopicManager(topic){
		let manager = this.topicManagers[topic.name];
		if(typeof manager=='undefined'){
			console.log('creating new TopicManager #'+topic.name);
			manager = new TopicManager(topic,this);
			this.topicManagers[topic.name] = manager;
		}
		return manager;
	}
	handlePublishingRequest(req,res){
		this.trace('->handlePublishingRequest()');
		var message = req.body;
		if(this.checkMessageStructure(message)){
			if(this.checkSecurity(message)){
				if('queue'==message.destination.type){
					this.trace('<-handlePublishingRequest() - publish to Queue');
					this.handleQueuePublishingRequest(message,res);
				}
				if('topic'==message.destination.type){
					this.trace('<-handlePublishingRequest() - publish to Topic');
					this.handleTopicPublishingRequest(message,res);
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
					if(typeof message.maxAge=='undefined' && typeof message.expire=='undefined'){
						message.maxAge = server.defaultExpirationTimeout;
					}
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
	handleTopicPublishingRequest(message,res){
		this.trace('->handleTopicPublishingRequest()');
		let server = this;
		this.adminServer.queryDb({"selector": {"$and": [{"type": {"$eq":"topic"}},{"name": {"$eq":message.destination.name}}]}},function(err,data){
			if(err){
				server.trace('<-handleQueuePublishingRequest()');
				res.json({"status": 500,"message": "Internal Server Error","data": "unable to query the catalog"});
			}else{
				if(data && data.length==1){
					let topic = data[0];
					server.debug('processing message publishing for topic "'+topic.name+'"');
					server.debug('message: '+JSON.stringify(message));
					server.debug('topic: '+JSON.stringify(topic));
					let topicManager = server.getTopicManager(topic);
					let receipt = topicManager.publish(message);
					server.trace('<-handleTopicPublishingRequest()');
					res.json({"status": 200,"message": "Ok","data": receipt});
				}else{
					server.trace('<-handleTopicPublishingRequest()');
					res.json({"status": 406,"message": "Not Acceptable","data": "Unknown topic name"});
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
	reaperLoop(){
		this.trace('->reaperLoop()');
		let engine = this;
		for(var name in this.queueManagers){
			let queueManager = this.queueManagers[name];
			queueManager.checkForEviction();
		}
		setTimeout(function(){ engine.reaperLoop(); },this.checkInterval);
		this.trace('<-reaperLoop()');
	}
}

module.exports = MessagingEngine;