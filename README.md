# npa-messaging
A basic messaging engine and server based on NPA. The administrative console is provided as an APAF extension in the Development menu named "Queue Manager Workbench"

### Features

Basic in-memory Queue management with posting message, picking up the oldest message from the queue or picking up a message with given UUID
In-memory queue size management with maximum queue size, maximum message age (in seconds) or explicit message expiration timestamp (YYY/MM/DD HH/mm/ss)
Basic persistent Queue management with posting message, picking up the oldest message from the queue or picking up a message with given UUID
Persistent Queue size management with maximum message age (in seconds) or explicit message expiration timestamp (YYY/MM/DD HH/mm/ss)
Basic Topic queue management with publish and subscribe

### Configuration

The npa.message.server is a standard APAF application. The simplest command-line would be:

    $>node app.js --installation ./configs/messagingEngineConfig.json --logs ./logs --level info --name "APAF Messaging Engine Server" --application mq4npa

Where messagingEngineConfig.json is a JSON configuration file for APAF that provides plugin site locations for APAF

```json
{ 
	"sites": [
		{
			"id": "default",
			"location": "./plugins"
		},
		{
			"id": "npa.messaging",
			"location": "C:/Git/npa-messaging/src/plugins"
		}
	]
}
```
The following environment variables may further configure the message server behavior:

    APAF_COUCH_DB_HOST=<127.0.0.1>
    APAF_COUCH_DB_PORT=<5984>
    COUCH_DATABASE_PREFIX=<mq_>
    ENABLE_SSL=<true>
    HTTP_SESSION_TIMEOUT=<30>
    NODE_PATH=<C:\Git\Node-Plugin-Architecture\src\node_modules>
    PERSIST_HTTP_SESSION=<false>
    PERSISTENCE_DB_HOST=<127.0.0.1>
    PERSISTENCE_DB_PORT=<5984>
    PERSISTENCE_DB_USER=<some-username>
    PERSISTENCE_DB_USER_PASSWD=<some-password>
    PORT=<8000>
    SECURITY_KEY=<a-30-characters-passPhrase-for-RSA256>
    SSL_CERTIFICATE=<C:/apaf-certificate.pem>
    SSL_PRIVATE_KEY=<C:/apaf-private-key.pem>
    
Notice that the PERSISTENCE_DB database is used for message persistence while the APAF_COUCH_DB database is used for administrative persistence (catalog). Of course, both databases may be the same.

### APIs

#### Administrative APIs

All the administrative APIs have same HTTP method and same URI schema:

__method:__ POST

__uri:__ /mq/admin/:*actionId*

##### actions

| __actionId:__ | generateToken |
| --- | --- |
| __input:__ | {"passPhrase": "some pass-phrase with at least 8 characters"} |
| __output:__ | {"status": 200,"message": "ok","data": "encryptedToken"} |
| __documentation:__ | use this API to generate your own security token and copy the generated value in the npa.messaging.server manifest.json file (/security/token) |



| __actionId:__ | createQueue |
| --- | --- |
| __input:__ | {"token": "the message server pass-Phrase","name": "the new Queue name","persistent": true/false} |
| __output:__ | {"status": 200,"message": "ok","data": "the couchDB record for the new Queue","db_data": "datasource-reference"} |
| __documentation:__ | use this API to create a new Queue with the given name. Persistent queues keep freshly posted, not yet read message after a server restart |



| __actionId:__ | getQueues |
| --- | --- |
| __input:__ | {"token": "the message server pass-Phrase"} |
| __output:__ | {"status": 200,"message": "ok","data": "the list of configured Queues on this Message server"} |
| __documentation:__ | use this API to get the current list of configured Message Queues objects on this Message server |



| __actionId:__ | deleteQueue |
| --- | --- |
| __input:__ | {"token": "the message server pass-Phrase","name": "the name of the Message Queue to delete"} |
| __output:__ | {"status": 200,"message": "ok","data": "deleted"} |
| __documentation:__ | use this API to remove a configured Queue Manager given its name |



| __actionId:__ | createTopic |
| --- | --- |
| __input:__ | {"token": "the message server pass-Phrase","name": <the new Queue name"} |
| __output:__ | {"status": 200,"message": "ok","data": <the couchDB record for the new Topic"} |
| __documentation:__ | use this API to create a new Topic with the given name. |



| __actionId:__ | getTopics
| --- | --- |
| __input:__ | {"token": "the message server pass-Phrase"} |
| __output:__ | {"status": 200,"message": "ok","data": <the list of configured Topics on this Message server"} |
| __documentation:__ | use this API to get the current list of configured Message Topic objects on this Message server |



| __actionId:__ | deleteTopic
| --- | --- |
| __input:__ | {"token": "the message server pass-Phrase","name": "the name of the Message Topic to delete"} |
| __output:__ | {"status": 200,"message": "ok","data": "deleted"} |
| __documentation:__ | use this API to remove a configured Topic Manager given its name |



| __actionId:__ | register |
| --- | --- |
| __input:__ | {"token": "the message server pass-Phrase","destination": {"name": "the name of the Message Topic to register to"},"subscriber": {"name": "a name for this subscriber","endpoint": "an endpoint URL to send the message to"}} |
| __output:__ | {"status": 200,"message": "ok","data": "Registered"} |
| __documentation:__ | use this API to register a new subscriber to a gien Topic |
