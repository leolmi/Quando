/**
 * Created by Leo on 02/04/2015.
 */
'use strict';

'use strict';

var express = require('express');
var controller = require('./inaz.controller');

var router = express.Router();

router.post('/', controller.data);
router.post('/download', controller.download);
router.post('/upload', controller.upload);


module.exports = router;
