/*
 * npaUtil.js - NPA plugin adapter class for external installation site
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const ENV_NPA_INSTALL_DIR = 'NPA_INSTALL_DIR';
const Plugin = require(process.env[ENV_NPA_INSTALL_DIR]+'/core/plugin.js');

class MessagingPlugin extends Plugin{
}

module.exports = MessagingPlugin;