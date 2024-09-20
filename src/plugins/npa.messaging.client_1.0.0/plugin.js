/*
 * plugin.js - MQ Manager Client provider plugin for APAF
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const MessagingPlugin = require('../../npaUtil.js');
const SECURITY_SERVICE_NAME = 'apaf-security';
const REST_PLUGIN_ID = 'npa.rest';

var plugin = new MessagingPlugin();

plugin.getCatalogHandler = function(req,res){
	plugin.debug('->getCatalogHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.messaging.client.query.catalog.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-getCatalogHandler() - authentication');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let queueManagerContext = req.body;
			if(queueManagerContext 
			   && typeof queueManagerContext.host!='undefined'
			   && typeof queueManagerContext.port!='undefined'
			   && typeof queueManagerContext.secured!='undefined'
			   && typeof queueManagerContext.token!='undefined'){
				let restPlugin = plugin.runtime.getPlugin(REST_PLUGIN_ID);
				let restContext = {
					"host": queueManagerContext.host,
					"port": queueManagerContext.port,
					"secured": queueManagerContext.secured,
					"uri": "/mq/admin/getQueues",
					"method": "POST",
					"payload": {"token": queueManagerContext.token}
				};
				restPlugin.performRestApiCall(restContext,function(err,response){
					if(err){
						plugin.debug('<-getCatalogHandler() - rest invocation failure');
						res.json({"status": 500,"message": "Remote Queue Manager invocation failed!","data": []});
					}else{
						let qmResponse = response.data;
						if(qmResponse.status==200){
							plugin.info('managedObjects: '+JSON.stringify(qmResponse.data));
							let managedObjects = qmResponse.data;
							restContext.uri = '/mq/admin/getTopics';
							restPlugin.performRestApiCall(restContext,function(err,response){
								if(err){
									plugin.debug('<-getCatalogHandler() - second rest invocation failure');
									res.json({"status": 500,"message": "Remote Queue Manager invocation failed!","data": []});
								}else{
									qmResponse = response.data;
									if(qmResponse.status==200){
										plugin.debug('<-getCatalogHandler() - success');
										let data = managedObjects.concat(qmResponse.data);
										res.json({"status": 200,"message": "ok","data": data});
									}else{
										plugin.debug('<-getCatalogHandler() - rest invocation failure 3');
										res.json({"status": 500,"message": "Remote Queue Manager invocation failed!","data": qmResponse.message});
									}
								}
							});
						}else{
							plugin.debug('<-getCatalogHandler() - rest invocation failure 2');
							res.json({"status": 500,"message": "Remote Queue Manager invocation failed!","data": qmResponse.message});
						}
					}
				});
			}else{
				plugin.debug('<-getCatalogHandler() - invalid context');
				res.json({"status": 400,"message": "Bad Request","data": "invalid Queue Manager connection context"});
			}
		}
	});
}

plugin.createQueueHandler = function(req,res){
	plugin.debug('->createQueueHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.messaging.client.create.queue.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createQueueHandler() - authentication');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let queueManagerContext = req.body;
			let queueConfig = queueManagerContext.queue;
			if(queueManagerContext 
			   && typeof queueManagerContext.host!='undefined'
			   && typeof queueManagerContext.port!='undefined'
			   && typeof queueManagerContext.secured!='undefined'
			   && typeof queueManagerContext.token!='undefined'
			   && typeof queueConfig!='undefined'){
				let restPlugin = plugin.runtime.getPlugin(REST_PLUGIN_ID);
				let restContext = {
					"host": queueManagerContext.host,
					"port": queueManagerContext.port,
					"secured": queueManagerContext.secured,
					"uri": "/mq/admin/createQueue",
					"method": "POST",
					"payload": {"token": queueManagerContext.token,"name": queueConfig.name,"persistent": queueConfig.persistent}
				};
				restPlugin.performRestApiCall(restContext,function(err,response){
					if(err){
						plugin.debug('<-createQueueHandler() - rest invocation failure');
						res.json({"status": 500,"message": "Remote Queue Manager invocation failed!","data": []});
					}else{
						plugin.debug('<-createQueueHandler() - success');
						res.json({"status": 200,"message": "ok","data": response.data});
					}
				});
			}else{
				plugin.debug('<-createQueueHandler() - invalid context');
				res.json({"status": 400,"message": "Bad Request","data": "invalid request structure"});
			}
		}
	});
}

plugin.createTopicHandler = function(req,res){
	plugin.debug('->createTopicHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.messaging.client.create.topic.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-createTopicHandler() - authentication');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let queueManagerContext = req.body;
			let topicConfig = queueManagerContext.topic;
			if(queueManagerContext 
			   && typeof queueManagerContext.host!='undefined'
			   && typeof queueManagerContext.port!='undefined'
			   && typeof queueManagerContext.secured!='undefined'
			   && typeof queueManagerContext.token!='undefined'
			   && typeof topicConfig!='undefined'){
				let restPlugin = plugin.runtime.getPlugin(REST_PLUGIN_ID);
				let restContext = {
					"host": queueManagerContext.host,
					"port": queueManagerContext.port,
					"secured": queueManagerContext.secured,
					"uri": "/mq/admin/createTopic",
					"method": "POST",
					"payload": {"token": queueManagerContext.token,"name": topicConfig.name}
				};
				restPlugin.performRestApiCall(restContext,function(err,response){
					if(err){
						plugin.debug('<-createTopicHandler() - rest invocation failure');
						res.json({"status": 500,"message": "Remote Queue Manager invocation failed!","data": []});
					}else{
						plugin.debug('<-createTopicHandler() - success');
						res.json({"status": 200,"message": "ok","data": response.data});
					}
				});
			}else{
				plugin.debug('<-createTopicHandler() - invalid context');
				res.json({"status": 400,"message": "Bad Request","data": "invalid request structure"});
			}
		}
	});
}

plugin.deleteQueueOrTopicHandler = function(req,res){
	plugin.debug('->deleteQueueOrTopicHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.messaging.client.delete.object.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-deleteQueueOrTopicHandler() - authentication');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let queueManagerContext = req.body;
			let destinationConfig = queueManagerContext.destination;
			if(queueManagerContext 
			   && typeof queueManagerContext.host!='undefined'
			   && typeof queueManagerContext.port!='undefined'
			   && typeof queueManagerContext.secured!='undefined'
			   && typeof queueManagerContext.token!='undefined'
			   && typeof destinationConfig!='undefined'){
				let restPlugin = plugin.runtime.getPlugin(REST_PLUGIN_ID);
				let uri = '/mq/admin';
				if('queue'==destinationConfig.type){
					uri = '/mq/admin/deleteQueue';
				}
				if('topic'==destinationConfig.type){
					uri = '/mq/admin/deleteTopic';
				}
				let restContext = {
					"host": queueManagerContext.host,
					"port": queueManagerContext.port,
					"secured": queueManagerContext.secured,
					"uri": uri,
					"method": "POST",
					"payload": {"token": queueManagerContext.token,"name": destinationConfig.name}
				};
				restPlugin.performRestApiCall(restContext,function(err,response){
					if(err){
						plugin.debug('<-deleteQueueOrTopicHandler() - rest invocation failure');
						res.json({"status": 500,"message": "Remote Queue Manager invocation failed!","data": []});
					}else{
						plugin.debug('<-deleteQueueOrTopicHandler() - success');
						res.json({"status": 200,"message": "ok","data": "Deleted!"});
					}
				});
			}else{
				plugin.debug('<-deleteQueueOrTopicHandler() - invalid context');
				res.json({"status": 400,"message": "Bad Request","data": "invalid request structure"});
			}
		}
	});
}

plugin.publishMessageHandler = function(req,res){
	plugin.debug('->publishMessageHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.messaging.client.publish.message.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-publishMessageHandler() - authentication');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let queueManagerContext = req.body;
			let destinationConfig = queueManagerContext.destination;
			if(queueManagerContext 
			   && typeof queueManagerContext.host!='undefined'
			   && typeof queueManagerContext.port!='undefined'
			   && typeof queueManagerContext.secured!='undefined'
			   && typeof queueManagerContext.content!='undefined'
			   && typeof destinationConfig!='undefined'){
				let restPlugin = plugin.runtime.getPlugin(REST_PLUGIN_ID);
				let payload = {"destination": destinationConfig,"content": queueManagerContext.content};
				if(typeof queueManagerContext.maxAge!='undefined'){
					payload.maxAge = queueManagerContext.maxAge;
				}
				if(typeof queueManagerContext.expire!='undefined'){
					payload.expire = queueManagerContext.expire;
				}
				let restContext = {
					"host": queueManagerContext.host,
					"port": queueManagerContext.port,
					"secured": queueManagerContext.secured,
					"uri": "/mq/message/publish",
					"method": "POST",
					"payload": payload
				};
				restPlugin.performRestApiCall(restContext,function(err,response){
					if(err){
						plugin.debug('<-publishMessageHandler() - rest invocation failure');
						res.json({"status": 500,"message": "Remote Queue Manager invocation failed!","data": []});
					}else{
						let qmResponse = response.data;
						if(qmResponse.status==200){
							plugin.debug('<-publishMessageHandler() - success');
							res.json({"status": 200,"message": "ok","data": qmResponse.data});
						}else{
							plugin.debug('<-publishMessageHandler() - QM failure');
							res.json({"status": 500,"message": "Remote Queue Manager invocation failed!","data": qmResponse.message});
						}
					}
				});
			}else{
				plugin.debug('<-publishMessageHandler() - invalid context');
				res.json({"status": 400,"message": "Bad Request","data": "invalid request structure"});
			}
		}
	});
}

plugin.pickupMessageHandler = function(req,res){
	plugin.debug('->pickupMessageHandler()');
	res.set('Content-Type','application/json');
	let requiredRole = plugin.getRequiredSecurityRole('apaf.messaging.client.pickup.message.handler');
	let securityEngine = plugin.getService(SECURITY_SERVICE_NAME);
	securityEngine.checkUserAccess(req,requiredRole,function(err,user){
		if(err){
			plugin.debug('<-pickupMessageHandler() - authentication');
			res.json({"status": 500,"message": err,"data": []});
		}else{
			let queueManagerContext = req.body;
			let destinationConfig = queueManagerContext.destination;
			if(queueManagerContext 
			   && typeof queueManagerContext.host!='undefined'
			   && typeof queueManagerContext.port!='undefined'
			   && typeof queueManagerContext.secured!='undefined'
			   && typeof destinationConfig!='undefined'
			   && 'queue'==destinationConfig.type){
				let restPlugin = plugin.runtime.getPlugin(REST_PLUGIN_ID);
				let payload = {"destination": destinationConfig};
				if(typeof queueManagerContext.uuid!='undefined'){
					payload.uuid = queueManagerContext.uuid;
				}
				let restContext = {
					"host": queueManagerContext.host,
					"port": queueManagerContext.port,
					"secured": queueManagerContext.secured,
					"uri": "/mq/message/query",
					"method": "POST",
					"payload": payload
				};
				restPlugin.performRestApiCall(restContext,function(err,response){
					if(err){
						plugin.debug('<-pickupMessageHandler() - rest invocation failure');
						res.json({"status": 500,"message": "Remote Queue Manager invocation failed!","data": []});
					}else{
						let qmResponse = response.data;
						if(qmResponse.status==200){
							plugin.debug('<-pickupMessageHandler() - success');
							res.json({"status": 200,"message": "ok","data": qmResponse.data});
						}else
						if(qmResponse.status==404){
							plugin.debug('<-pickupMessageHandler() - success');
							res.json({"status": 404,"message": "Not Found","data": []});
						}else{
							plugin.debug('<-pickupMessageHandler() - QM failure');
							res.json({"status": 500,"message": "Remote Queue Manager invocation failed!","data": qmResponse.message});
						}
					}
				});
			}else{
				plugin.debug('<-pickupMessageHandler() - invalid context');
				res.json({"status": 400,"message": "Bad Request","data": "invalid request structure"});
			}
		}
	});
}

module.exports = plugin;