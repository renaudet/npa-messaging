/*
 * npaUtil.js - NPA plugin adapter class for external installation site
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ENV_NPA_INSTALL_DIR = 'NPA_INSTALL_DIR';
const Plugin = require(process.env[ENV_NPA_INSTALL_DIR]+'/core/plugin.js');

class MessagingPlugin extends Plugin{
	getRequiredSecurityRole(extensionId){
		let requiredRole = null;
		for(var i=0;i<this.config.extends.length;i++){
			let extent = this.config.extends[i];
			if(extent.id==extensionId && typeof extent.securityRole!='undefined'){
				requiredRole = extent.securityRole;
			}
		}
		return requiredRole;
	}
}

module.exports = MessagingPlugin;