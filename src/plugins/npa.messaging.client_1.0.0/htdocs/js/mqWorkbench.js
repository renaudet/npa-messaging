/*
 * mqWorkbench.js - main javascript resource for the Message Queue Workbench for APAF Page
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
const GLOBAL_CONFIGURATION_FILE = '/messageClient/json/mqWorkbenchConfig.json';
const CONNECT_ACTION_ID = 'connect';
const ADD_QUEUE_ACTION_ID = 'addQueue';
const ADD_TOPIC_ACTION_ID = 'addTopic';
const DELETE_QUEUE_ACTION_ID = 'deleteQueue';
const DELETE_TOPIC_ACTION_ID = 'deleteTopic';
const TOOLBAR_ID = 'actionToolbar';
const DIALOG_ID = 'modalDialog';
const CARD_ID = 'mqWorkbenchCard';
const CONNECTION_FORM_ID = 'connectionForm';
const QUEUE_CREATION_FORM_ID = 'queueCreationForm';
const TOPIC_CREATION_FORM_ID = 'topicCreationForm';

const QUEUE_MANAGER_CONNECTION_FORM = {
	"id":CONNECTION_FORM_ID,
    "version": "1.0.0",
    "type": "Form",
    "configuration": {
    	"title": "Queue Manager connection context",
    	"class": "form-frame-noborder",
    	"selectionListener": false,
    	"fields": [
			{
    			"name": "host",
    			"label": "Hostname",
    			"required": true,
    			"size": 4
    		},
			{
    			"name": "port",
    			"label": "Port",
    			"required": true,
    			"type": "integer",
    			"size": 2,
    			"default": 8000
    		},
    		{
				"name": "secured",
				"label": "Use HTTPS",
				"type": "switch"
			},
			{
    			"name": "token",
    			"label": "Security Token",
    			"required": true,
    			"size": 5
    		}
		]
	}
}

const QUEUE_CREATION_FORM = {
	"id":QUEUE_CREATION_FORM_ID,
    "version": "1.0.0",
    "type": "Form",
    "configuration": {
    	"title": "New Message Queue creation",
    	"class": "form-frame-noborder",
    	"selectionListener": false,
    	"fields": [
			{
    			"name": "name",
    			"label": "Queue Name",
    			"required": true,
    			"size": 4
    		},
    		{
				"name": "persistent",
				"label": "Persist messages",
				"type": "switch"
			}
		]
	}
}

const TOPIC_CREATION_FORM = {
	"id":TOPIC_CREATION_FORM_ID,
    "version": "1.0.0",
    "type": "Form",
    "configuration": {
    	"title": "New Topic creation",
    	"class": "form-frame-noborder",
    	"selectionListener": false,
    	"fields": [
			{
    			"name": "name",
    			"label": "Topic Name",
    			"required": true,
    			"size": 4
    		}
		]
	}
}

var treeViewer = null;
var currentNode = null;
var currentQueueManager = null;
var currentTopic = null;
var currentQueue = null;

let queueManagerVisitor = {
	getLabel(element){
		return element.name;
	},
	getChildren(element){
		if(element.type){
			if('queueManager'==element.type){
				return element.queues.concat(element.topics);
			}
			if('topic'==element.type){
				return element.subscribers;
			}
		}
		return [];
	},
	isParent(element){
		if(element.type){
			if('queueManager'==element.type){
				return true;
			}
			if('topic'==element.type){
				return true;
			}
		}
		return false;
	}
};
let queueManagerDecorator = {
	decorate(element,label){
		if(element.type){
			if('queueManager'==element.type){
				return '<img src="/uiTools/img/silk/database.png">&nbsp;<b>'+label+'</b>';
			}
			if('queue'==element.type){
				if(element.persistent){
					return '<img src="/uiTools/img/silk/email_go.png">&nbsp;<b>'+label+'</b><span style="padding-left: 50px;"><img src="/uiTools/img/silk/drive_disk.png"></span>';
				}else{
					return '<img src="/uiTools/img/silk/email_go.png">&nbsp;<b>'+label+'</b>';
				}
			}
			if('topic'==element.type){
				return '<img src="/uiTools/img/silk/transmit.png">&nbsp;<b>'+label+'</b>';
			}
			if('subscriber'==element.type){
				return '<img src="/uiTools/img/silk/basket.png">&nbsp;<b>'+label+'</b>';
			}
		}
		return label;
	}
};
let queueManagerEventListener = {
	onNodeSelected(node){
		currentNode = node;
		let selectedItem = node.data;
		let toolbar = $apaf(TOOLBAR_ID);
		toolbar.setEnabled('addQueue',false);
		toolbar.setEnabled('deleteQueue',false);
		toolbar.setEnabled('addTopic',false);
		toolbar.setEnabled('deleteTopic',false);
		$('#queueTestArea').hide();
		$('#topicRegisterArea').hide();
		if('queueManager'==selectedItem.type){
			toolbar.setEnabled('addQueue',true);
			toolbar.setEnabled('deleteQueue',false);
			toolbar.setEnabled('addTopic',true);
			toolbar.setEnabled('deleteTopic',false);
			currentQueueManager = selectedItem;
			currentQueue = null;
			currentTopic = null;
			setStatus('Selected Queue Manager: '+selectedItem.context.host+':'+selectedItem.context.port);
		}
		if('queue'==selectedItem.type){
			toolbar.setEnabled('addQueue',false);
			toolbar.setEnabled('deleteQueue',true);
			toolbar.setEnabled('addTopic',false);
			toolbar.setEnabled('deleteTopic',false);
			currentQueue = selectedItem;
			currentTopic = null;
			setStatus('Selected Queue: '+selectedItem.name+' ('+selectedItem.token+')');
			$('#queueTestArea').show();
			$('#pickupMessageButton').prop('disabled',false);
		}
		if('topic'==selectedItem.type){
			toolbar.setEnabled('addQueue',false);
			toolbar.setEnabled('deleteQueue',false);
			toolbar.setEnabled('addTopic',false);
			toolbar.setEnabled('deleteTopic',true);
			currentTopic = selectedItem;
			currentQueue = null;
			setStatus('Selected Topic: '+selectedItem.name+' ('+selectedItem.token+')');
			$('#queueTestArea').show();
			$('#topicRegisterArea').show();
			$('#pickupMessageButton').prop('disabled',true);
		}
	}
};

$(document).ready(function(){
	checkSessionStatus(initializeUi);
});

initializeUi = function(){
	npaUi.loadConfigFrom(GLOBAL_CONFIGURATION_FILE,function(){
		npaUi.initialize(function(){
			npaUi.onComponentLoaded = onComponentLoaded;
			npaUi.on(CONNECT_ACTION_ID,openConnectionDialog);
			npaUi.on(ADD_QUEUE_ACTION_ID,openQueueCreationDialog);
			npaUi.on(ADD_TOPIC_ACTION_ID,addNewTopic);
			npaUi.on(DELETE_QUEUE_ACTION_ID,deleteQueue);
			npaUi.on(DELETE_TOPIC_ACTION_ID,deleteTopic);
			npaUi.render();
		});
	});
}

onComponentLoaded = function(){
	initTreeViewer();
	$('#postMessageButton').on('click',postMessage);
	$('#pickupMessageButton').on('click',pickupMessage);
	$('#registerSubscriberButton').on('click',registerSubscriber);
}

initTreeViewer = function(){
	// create default Tree
	$('#queueManagersArea').empty();
	treeViewer = new TreeViewer('queueManagersTree',$('#queueManagersArea')[0]);
	treeViewer.init();
	treeViewer.setVisitor(queueManagerVisitor);
	treeViewer.setDecorator(queueManagerDecorator);
	treeViewer.setEventListener(queueManagerEventListener);
}

setStatus = function(status){
	let card = $apaf(CARD_ID);
	card.setStatus(status);
}

openConnectionDialog = function(){
	let dialog = $apaf(DIALOG_ID);
	dialog.setTitle('Connect to a remote Queue Manager...');
	dialog.onClose(function(){
		let connectionForm = $apaf(CONNECTION_FORM_ID);
		let connectionContext = connectionForm.getData();
		getQueueManagerCatalog(connectionContext);
	});
	let html = '';
	html += '<div id="connectionFormArea"></div>';
	dialog.setBody(html);
	npaUi.renderSingleComponent('connectionFormArea',QUEUE_MANAGER_CONNECTION_FORM,function(){
		let form = npaUi.getComponent(CONNECTION_FORM_ID);
		form.setData({"host": "localhost","port": 8000,"secured": false,"token": "myToken"});
		form.setEditMode(true);
		dialog.open();
	});
	
}

openQueueCreationDialog = function(){
	let dialog = $apaf(DIALOG_ID);
	dialog.setTitle('Remote Queue Manager configuration');
	dialog.onClose(function(){
		let form = $apaf(QUEUE_CREATION_FORM_ID);
		let queueConfiguration = form.getData();
		addNewQueue(queueConfiguration);
	});
	let html = '';
	html += '<div id="queueCreationFormArea"></div>';
	dialog.setBody(html);
	npaUi.renderSingleComponent('queueCreationFormArea',QUEUE_CREATION_FORM,function(){
		let form = npaUi.getComponent(QUEUE_CREATION_FORM_ID);
		form.setData({"name": "MY_QUEUE_01","persistent": false});
		form.setEditMode(true);
		dialog.open();
	});
	
}

getQueueManagerCatalog = function(connectionContext){
	apaf.call({"method": "POST","uri": "/apaf-mq-client/getCatalog","payload": connectionContext})
	.then(function(managedObjects){
		let name = connectionContext.host+':'+connectionContext.port;
		let queueManager = {"type": "queueManager","name": name,"queues": [],"topics": [],"context": connectionContext};
		for(var i=0;i<managedObjects.length;i++){
			let managedObject = managedObjects[i];
			if('queue'==managedObject.type){
				queueManager.queues.push(managedObject);
			}
			if('topic'==managedObject.type){
				queueManager.topics.push(managedObject);
			}
		}
		treeViewer.addRootData(queueManager);
		treeViewer.refreshTree();
	})
	.onError(function(msg){
		showError(msg);
	});
}

addNewQueue = function(queueConfiguration){
	if(currentQueueManager!=null){
		let payload = Object.assign({"queue": queueConfiguration},currentQueueManager.context);
		apaf.call({"method": "POST","uri": "/apaf-mq-client/queue","payload": payload})
		.then(function(response){
			console.log(response);
			if(response.status==200){
				let managedObject = response.data;
				currentQueueManager.queues.push(managedObject);
				let treeNode = currentNode.tree.createTreeStructure(currentNode.id+'_queue_'+Math.floor(Math.random() * 100000),managedObject);
				currentNode.addChild(treeNode);
				currentNode.open();
				treeViewer.refreshTree();
			}else{
				showWarning(response.message+': '+response.data);
			}
		})
		.onError(function(msg){
			showError(msg);
		});
	}
}

addNewTopic = function(){
	if(currentQueueManager!=null){
		let payload = Object.assign({"topic": {"name": "SOME_TOPIC"}},currentQueueManager.context);
		apaf.call({"method": "POST","uri": "/apaf-mq-client/topic","payload": payload})
		.then(function(response){
			console.log(response);
			if(response.status==200){
				let managedObject = response.data;
				currentQueueManager.topics.push(managedObject);
				let treeNode = currentNode.tree.createTreeStructure(currentNode.id+'_topic_'+Math.floor(Math.random() * 100000),managedObject);
				currentNode.addChild(treeNode);
				currentNode.open();
				treeViewer.refreshTree();
			}else{
				showWarning(response.message+': '+response.data);
			}
		})
		.onError(function(msg){
			showError(msg);
		});
	}
}

deleteQueue = function(){
	if(currentQueue!=null && currentQueueManager!=null && confirm('Delete Queue '+currentQueue.name+'?')){
		let payload = Object.assign({"destination": {"type": "queue","name": currentQueue.name}},currentQueueManager.context);
		apaf.call({"method": "POST","uri": "/apaf-mq-client/delete","payload": payload})
		.then(function(data){
			initTreeViewer();
			getQueueManagerCatalog(currentQueueManager.context);
			currentQueueManager = null;
			currentQueue = null;
			let toolbar = $apaf(TOOLBAR_ID);
			toolbar.setEnabled('addQueue',false);
			toolbar.setEnabled('deleteQueue',false);
			toolbar.setEnabled('addTopic',false);
			toolbar.setEnabled('deleteTopic',false);
		})
		.onError(function(msg){
			showError(msg);
		});
	}
}

deleteTopic = function(){
	if(currentTopic!=null && currentQueueManager!=null && confirm('Delete Topic '+currentTopic.name+'?')){
		let payload = Object.assign({"destination": {"type": "topic","name": currentTopic.name}},currentQueueManager.context);
		apaf.call({"method": "POST","uri": "/apaf-mq-client/delete","payload": payload})
		.then(function(data){
			initTreeViewer();
			getQueueManagerCatalog(currentQueueManager.context);
			currentQueueManager = null;
			currentTopic = null;
			let toolbar = $apaf(TOOLBAR_ID);
			toolbar.setEnabled('addQueue',false);
			toolbar.setEnabled('deleteQueue',false);
			toolbar.setEnabled('addTopic',false);
			toolbar.setEnabled('deleteTopic',false);
		})
		.onError(function(msg){
			showError(msg);
		});
	}
}

postMessage = function(){
	let messageContent = $('#content').val();
	let expirationExpr = $('#expiration').val();
	let type = 'undefined';
	let name = 'unknown';
	let token = '';
	if(currentQueue!=null){
		type = 'queue';
		name = currentQueue.name;
		token = currentQueue.token;
	}
	if(currentTopic!=null){
		type = 'topic';
		name = currentTopic.name;
		token = currentTopic.token;
	}
	let payload = Object.assign({"destination": {"type": type,"name": name,"token": token}},currentQueueManager.context);
	if(expirationExpr && expirationExpr.length>0){
		let switchValue =  $('#maxAgeSwitch').prop('checked');
		if(switchValue){
			try{
				payload.maxAge = parseInt(expirationExpr);
			}catch(pe){
				flash('Invalid message maximum age - using 120sec. instead!');
				payload.maxAge = 120;
			}
		}else{
			payload.expire = expirationExpr;
		}
	}else{
		payload.maxAge = 120;
	}
	payload.content = messageContent;
	apaf.call({"method": "POST","uri": "/apaf-mq-client/message","payload": payload})
	.then(function(data){
		showInfo(JSON.stringify(data,null,'\t').replace(/\t/g,'&nbsp;&nbsp;').replace(/\n/g,'<br>'));
	})
	.onError(function(msg){
		showError(msg);
	});
}

pickupMessage = function(){
	if(currentQueue!=null){
		let payload = Object.assign({"destination": {"type": "queue","name": currentQueue.name,"token": currentQueue.token}},currentQueueManager.context);
		apaf.call({"method": "POST","uri": "/apaf-mq-client/message/query","payload": payload})
		.then(function(data){
			$('#content').val(data.content);
			showInfo(JSON.stringify(data,null,'\t').replace(/\t/g,'&nbsp;&nbsp;').replace(/\n/g,'<br>'));
		})
		.onError(function(msg){
			showError(msg);
		});
	}
}

registerSubscriber = function(){
	if(currentTopic!=null){
		let subscriberId = $('#subscriberId').val();
		let endpointUrl = $('#endpointUrl').val();
		let payload = Object.assign({"destination": {"type": "topic","name": currentTopic.name,"token": currentTopic.token},"subscriber": {"name": subscriberId,"endpoint": endpointUrl}},currentQueueManager.context);
		apaf.call({"method": "POST","uri": "/apaf-mq-client/subscribe","payload": payload})
		.then(function(data){
			showInfo(JSON.stringify(data,null,'\t').replace(/\t/g,'&nbsp;&nbsp;').replace(/\n/g,'<br>'));
		})
		.onError(function(msg){
			showError(msg);
		});
	}
}