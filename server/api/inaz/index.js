/**
 * Created by Leo on 02/04/2015.
 */
'use strict';

'use strict';

var express = require('express');
var controller = require('./inaz.controller');

var router = express.Router();

router.post('/', controller.data);

module.exports = router;
