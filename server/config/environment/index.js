'use strict';

var path = require('path');
var _ = require('lodash');

function requiredProcessEnv(name) {
  if(!process.env[name]) {
    throw new Error('You must set the ' + name + ' environment variable');
  }
  return process.env[name];
}

// All configurations will extend these options
// ============================================
var all = {
  env: process.env.NODE_ENV,

  // Root path of server
  root: path.normalize(__dirname + '/../../..'),

  ip: process.env.OPENSHIFT_NODEJS_IP ||
      process.env.IP ||
      undefined,

  // Server port
  port: process.env.OPENSHIFT_NODEJS_PORT ||
        process.env.PORT ||
        9000,


  // Should we populate the DB with sample data?
  seedDB: false,

  // Secret for session, you will want to change this and make it an environment variable
  secrets: {
    session: 'empty-secret'
  }
};

// Export the config object based on the NODE_ENV
// ==============================================
module.exports = all;
