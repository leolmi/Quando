/**
 * Created by Leo on 30/04/2015.
 */
'use strict';

var u = require('./util');
var _ = require('lodash');
var https = require('https');
var querystring = require('querystring');

/**
 * Return standard 200
 * @param res
 * @param obj
 * @returns {*}
 */
var ok = function(res, obj) {return res.json(200, obj);};
exports.ok = ok;

/**
 * Return standard 201
 * @param res
 * @param obj
 * @returns {*}
 */
var created = function(res, obj) {return res.json(201, obj);};
exports.created = created;

/**
 * Return standard 204
 * @param res
 * @returns {*}
 */
var deleted = function(res) {return res.json(204);};
exports.deleted = deleted;

/**
 * Return standard 404
 * @param res
 * @returns {*}
 */
var notfound = function(res) {return res.send(404); };
exports.notfound = notfound;

/**
 * Return standard 500
 * @param res
 * @param err
 * @returns {*}
 */
var error = function(res, err) { return res.send(500, err); };
exports.error = error;



function getData(o, encode) {
  if (encode) {
    var eo = {}
    for (var p in o)
      eo[p] = u.encodeToEsa(o[p]);
    return querystring.stringify(eo);
  }
  else{
    return querystring.stringify(o);
  }
}
exports.getData = getData;

var getRedirectPath = function(pre, nxt) {
  var pre_split = pre.split('/');
  var nxt_split = nxt.split('/');

  pre_split.pop();
  nxt_split.forEach(function(e){
    if (e=='..')
      pre_split.pop();
    else
      pre_split.push(e);
  });

  return pre_split.join('/');
};


/**
 * Richiesta
 * @param desc
 * @param options
 * @param data
 * @param target
 * @param cb
 */
var doHttpsRequest = function(desc, options, data, target, cb) {
  var skipped = false;
  var download = false;
  cb = cb || noop;
  console.log('['+desc+']-OPTIONS: ' + JSON.stringify(options));

  var req = https.request(options, function(res) {
    var result = {
      code:res.statusCode,
      headers:res.headers
    };
    //console.log('['+desc+']-RESULTS: ' + JSON.stringify(result));

    var newpath = res.headers.location;
    if (res.statusCode.toString()=='302' && newpath) {
      skipped = true;
      options.path = getRedirectPath(options.path ,newpath);
      doHttpsRequest('redir - '+desc, options, null, null, cb);
    }

    if (target) {
      download = true;
      res.setEncoding('binary');
      res.pipe(target);
      target.on('finish', function() {
        console.log('Finito di scrivere il file!');
        target.close(cb(options,result, null));
      });
    }
    else res.setEncoding('utf8');

    var content = '';

    res.on('data', function (chunk) {
      //console.log('['+desc+']-download data: '+chunk);
      content+=chunk;
    });
    res.on('end', function () {
      //console.log('['+desc+']-Fine richiesta!   skipped='+skipped+'   download='+download+'  target='+(target ? 'si' : 'no'));
      if (!skipped && !target && !download) {
        options.headers = _.merge(options.headers, req.headers);
        cb(options, result, content);
      }
    });
  });

  req.on('error', function(e) {
    console.log('['+desc+']-problem with request: ' + e.message);
  });

  if (data) {
    console.log('['+desc+']-send data: '+data);
    req.write(data);
  }

  req.end();
};
exports.doHttpsRequest = doHttpsRequest;


/**
 * Effettua una catena di chiamate sequenziali
 * @param options
 * @param sequence
 * @param i
 * @param cb
 */
function chainOfRequests(options, sequence, i, cb) {
  if (sequence[i].method) options.method = sequence[i].method;
  if (sequence[i].path) options.path = sequence[i].path;
  if (sequence[i].referer) options.headers.referer = sequence[i].referer;

  var data_str = undefined;
  if (sequence[i].data_str)
    data_str = sequence[i].data_str;
  else if (sequence[i].data)
    data_str = getData(sequence[i].data);

  options.headers['content-length'] = data_str ? data_str.length : 0;

  //console.log('['+sequence[i].title+']-REQUEST BODY: '+data_str);
  doHttpsRequest(sequence[i].title, options, data_str, undefined, function(o, r, c) {
    if (r.code!=200)
      return cb(new Error('['+sequence[i].title+'] - terminata con codice: '+r.code));
    //console.log('['+(i+1)+' '+sequence[i].title+'] - RICHIESTA EFFETTUATA CON SUCCESSO, CONTENT: '+c);

    if (i>=sequence.length-1)
      return cb(null, c);

    chainOfRequests(options, sequence, i + 1, cb);
  });
}
exports.chainOfRequests = chainOfRequests;
