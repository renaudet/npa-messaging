const NODE_TYPE = 'PostMessage';
const MESSAGING_CLIENT_PLUGIN_ID = 'apaf.messaging.client';

helper.palette.contribute = function(editor){
  var loader = new ImageLoader();
  loader.addImage('backgroundIcon','/resources/img/workflows/mediumNodeIcon.png');
  loader.addImage('paletteIcon','/messageClient/img/postMessageNode.png');
  loader.addImage('foregroundIcon','/uiTools/img/silk/email_go.png');
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
      var output01 = new GraphicNodeTerminal('output');
      var output02 = new GraphicNodeTerminal('error');
      node.addInputTerminal(input01);
      node.addOutputTerminal(output01);
      node.addOutputTerminal(output02);
      node.addProperty('host','Queue Manager Host','string',false,'localhost');
      node.addProperty('port','Queue Manager Port','int',false,8000);
      node.addProperty('secured','Use SSL','boolean',false,false);
      node.addProperty('token','Queue Manager Token','string',false,'');
      node.addProperty('destination','Destination Name','string',false,'MY_QUEUE');
      node.addProperty('msgVariableName','Message content variable','string',false,'messageContent');
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
				"name": node.getProperty('destination')
		    }
			messagingClient.getDestination(qmConnectionContext,function(err,managedObject){
				if(err){
					node.log('Exception caught getting destination from remote Queue Manager: '+err);
					node.fire('error',executionContext);
				}else{
					node.log('Destination found: '+JSON.stringify(managedObject,null,'\t'));
					let msgContent = '';
					if(typeof executionContext[node.getProperty('msgVariableName')]!='undefined'){
						msgContent = executionContext[node.getProperty('msgVariableName')];
					}
					let msgContext = {
						"host": node.getProperty('host'),
						"port": node.getProperty('port'),
						"secured": node.getProperty('secured'),
						"destination": {
							"type": managedObject.type,
							"name": node.getProperty('destination'),
							"token": managedObject.token
						},
						"content": msgContent
					};
					messagingClient.publishMessage(msgContext,function(err,receipt){
						if(err){
							node.log('Exception caught publishing message: '+err);
							node.fire('error',executionContext);
						}else{
							node.log('Message sent successfully: '+JSON.stringify(receipt,null,'\t'));
							node.fire('output',executionContext);
						}
					});
				}
			});
			//node.log('Value: '+executionContext['propertyName']);
			//node.fire('output',executionContext);
		}else{
			node.error('Invalid input terminal "'+inputTerminalName+'" for '+NODE_TYPE+' node #'+node.id());
		}
	}
	engine.registerNodeType(NODE_TYPE,nodeHandler);
}