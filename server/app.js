/**
 * Main application file
 */

'use strict';

// LOAD LOCAL ENVIROMENT VARIABLES
//////////////////////////////////////////////////
//var local = require('./config/local.env.js');
//for (var p in local)
//  process.env[p]=local[p];
//////////////////////////////////////////////////


var express = require('express');
var config = require('./config/environment');

// Setup server
var app = express();
var server = require('http').createServer(app);

require('./config/express')(app);
require('./routes')(app);

// Start server
server.listen(config.port, config.ip, function () {
  console.log('Express server listening on %d, in %s mode', config.port, app.get('env'));
});

// Expose app
exports = module.exports = app;
