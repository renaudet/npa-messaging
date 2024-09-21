const NODE_TYPE = 'PickupMessage';
const MESSAGING_CLIENT_PLUGIN_ID = 'apaf.messaging.client';

helper.palette.contribute = function(editor){
  var loader = new ImageLoader();
  loader.addImage('backgroundIcon','/resources/img/workflows/mediumNodeIcon.png');
  loader.addImage('paletteIcon','/messageClient/img/pickupMessageNode.png');
  loader.addImage('foregroundIcon','/uiTools/img/silk/email_open.png');
  loader.load();
  loader.onReadyState = function(){
    factory = new GraphicNodeFactory(NODE_TYPE,loader.getImage('paletteIcon'));
    factory.instanceCount = 0;
    factory.createNode = function(){
      var nodeId = NODE_TYPE+'_'+(this.instanceCount++);
      var node = new GraphicNode(nodeId,NODE_TYPE);
      node.backgroundIcon = loader.getImage('backgroundIcon');
      node.foregroundIcon = loader.getImage('foregroundIcon');
      var input01 = new GraphicNodeTerminal('input');
      var output01 = new GraphicNodeTerminal('onMessage');
      var output02 = new GraphicNodeTerminal('onEmptyQueue');
      var output03 = new GraphicNodeTerminal('error');
      node.addInputTerminal(input01);
      node.addOutputTerminal(output01);
      node.addOutputTerminal(output02);
      node.addOutputTerminal(output03);
      node.addProperty('host','Queue Manager Host','string',false,'localhost');
      node.addProperty('port','Queue Manager Port','int',false,8000);
      node.addProperty('secured','Use SSL','boolean',false,false);
      node.addProperty('token','Queue Manager Token','string',false,'');
      node.addProperty('queueName','Queue Name','string',false,'MY_QUEUE');
      node.addProperty('msgVariableName','Message variable','string',false,'message');
      node.addProperty('msgUuid','Message UUID','string',true,'');
      return node;
    }
    editor.getPalette().addFactory(factory);
    factory.close();
    editor.refresh();
  }
}

helper.engine.addCustomNode = function(engine){
	let nodeHandler = function(node,inputTerminalName,executionContext){
		if('input'==inputTerminalName){
			let messagingClient = executionContext._engine.getPlugin(MESSAGING_CLIENT_PLUGIN_ID);
			let qmConnectionContext = {
				"host": node.getProperty('host'),
				"port": node.getProperty('port'),
				"secured": node.getProperty('secured'),
				"token": node.getProperty('token'),
				"name": node.getProperty('queueName')
		    }
			messagingClient.getDestination(qmConnectionContext,function(err,queue){
				if(err){
					node.log('Exception caught getting Queue from remote Queue Manager: '+err);
					node.fire('error',executionContext);
				}else{
					node.log('Queue found: '+JSON.stringify(queue,null,'\t'));
					let msgContext = {
						"host": node.getProperty('host'),
						"port": node.getProperty('port'),
						"secured": node.getProperty('secured'),
						"destination": {
							"type": "queue",
							"name": node.getProperty('queueName'),
							"token": queue.token
						}
					};
					let uuid = node.getProperty('msgUuid');
					if(uuid && uuid.length>0){
						msgContext.uuid = uuid;
					}
					messagingClient.pickupMessage(msgContext,function(err,message){
						if(err){
							node.log('Exception caught getting message from Queue: '+err);
							node.fire('error',executionContext);
						}else{
							if(message!=null){
								node.log('Got message from Queue: '+JSON.stringify(message,null,'\t'));
								executionContext[node.getProperty('msgVariableName')] = message;
								node.fire('onMessage',executionContext);
							}else{
								node.log('Queue is empty');
								node.fire('onEmptyQueue',executionContext);
							}
						}
					});
				}
			});
		}else{
			node.error('Invalid input terminal "'+inputTerminalName+'" for '+NODE_TYPE+' node #'+node.id());
		}
	}
	engine.registerNodeType(NODE_TYPE,nodeHandler);
}