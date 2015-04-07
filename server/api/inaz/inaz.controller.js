/**
 * Created by Leo on 02/04/2015.
 */
'use strict';

var _ = require('lodash');
var https = require('https');
var config = require('../../config/environment');
var querystring = require('querystring');
var cheerio = require("cheerio");

var content_type_appwww = 'application/x-www-form-urlencoded';
var user_agent_moz = 'Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko';
var content_accept_text = 'text/html, application/xhtml+xml, */*';

function handleError(res, err) {
  return res.send(500, err);
}


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
    //console.log('['+desc+']-send data: '+data);
    req.write(data);
  }

  req.end();
};

function getCharEsa(cc, upper){
  var h = cc.toString(16);
  if (upper) h = h.toUpperCase();
  if (h.length < 2)
    h = "0" + h;
  return h;
}

function isLitteral(cc) {
  return (cc>=65 && cc<=90) || (cc>=97 && cc<=122);
}

function encodeToEsa(s, pswmode) {
  var res = '';
  for (var i = 0,n = s.length; i<n; i++) {
    if (pswmode) {
      if (isLitteral(s.charCodeAt(i)))
        res += s[i];
      else {
        res += '%'+getCharEsa(s.charCodeAt(i), true);
      }
    }
    else {
      res += getCharEsa(s.charCodeAt(i));
    }
  }
  return res;
}

function decodeFromEsa(s) {
  var res = '';
  for (var i = 0, n = s.length; i<n; i += 2) {
    res += String.fromCharCode("0x" + s.substring(i, i + 2));
  }
  return res;
}

function getData(o, encode) {
  if (encode) {
    var eo = {}
    for (var p in o)
      eo[p] = encodeToEsa(o[p]);
    return querystring.stringify(eo);
  }
  else{
    return querystring.stringify(o);
  }
}


function check(user, cookies, cb) {
  cb = cb || noop;
  var data = {
    SuHrWeb:'0',
    IdLogin:user.name,
    IdPwd:user.password,
    ServerLDAP:process.env.INAZ_SERVER_LDAP
  };
  var str_data = getData(data,true);

  var options = {
    host: process.env.INAZ_HOST,
    method:'POST',
    path: process.env.INAZ_PATH_CHECK,
    keepAlive:true,
    headers:{
      'cookie': cookies,
      'content-type':content_type_appwww,
      'content-length':str_data.length,
      'Connection': 'close'
    }
  };

  doHttpsRequest('check', options, str_data, undefined, function(o, r, c) {
    if (r.code!=200)
      return cb(new Error('[check] - terminato con codice: '+r.code));
    if (!c || c.indexOf("[$OK$]:") != 0)
      return cb(new Error('Verifica password fallita: '+c));
    var encpsw = decodeFromEsa(c.substring(7));
    return cb(null, encpsw);
  });
}

function parseInaz(html) {
  var table = [];
  var $ = cheerio.load(html);
  $('#ris_umane > tbody > tr').each(function() {
    var row = {};
    $(this).children().each(function(i, e){
      row['C'+i] = $(e).text();
    });
    table.push(row);
  });
  return table;
}

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

  console.log('['+sequence[i].title+']-REQUEST BODY: '+data_str);
  doHttpsRequest(sequence[i].title, options, data_str, undefined, function(o, r, c) {
    if (r.code!=200)
      return cb(new Error('['+sequence[i].title+'] - terminata con codice: '+r.code));
    console.log('['+(i+1)+' '+sequence[i].title+'] - RICHIESTA EFFETTUATA CON SUCCESSO, CONTENT: '+c);

    if (i>=sequence.length-1)
      return cb(null, c);

    chainOfRequests(options, sequence, i + 1, cb);
  });
}

exports.data = function(req, res) {
  var user = req.body;
  if (!user || !user.password || !user.name)
    return handleError(res, err);

  var options = {
    host: process.env.INAZ_HOST,
    method:'GET',
    path: process.env.INAZ_PATH_LOGIN,
    keepAlive:true,
    headers:{
      'accept':content_accept_text,
      'accept-language':'it-IT',
      'content-type':content_type_appwww,
      'user-agent':user_agent_moz,
      'DNT':'1'
    }
  };

  var cookies = {};
  doHttpsRequest('accesso', options, undefined, undefined, function(o1, r1, c1) {
    if (r1.code!=200)
      return handleError(res, new Error('[accesso] - terminata con codice: '+r1.code));

    cookies = r1.headers['set-cookie'];

    check(user, cookies, function(err, encpsw) {
      if (err)
        return handleError(res, err);

      o1.headers.cookie = cookies;

      var sequence = [{
        title:'DEFAULT',
        method:'POST',
        path:process.env.INAZ_PATH_DEFAULT,
        referer:process.env.INAZ_PATH_REFERER_LOGIN,
        data: {
          IdLogin: user.name,
          IdPwdCript: encpsw,
          IdFrom: 'LOGIN',
          RetturnTo: process.env.INAZ_PATH_REFERER_LOGIN
        }
      },{
        title:'TOPM',
        method:'GET',
        path:process.env.INAZ_PATH_TOPM,
        referer:process.env.INAZ_PATH_REFERER_DEFAULT
      },{
        title:'BLANK',
        method:'GET',
        path:process.env.INAZ_PATH_BLANK,
        referer:process.env.INAZ_PATH_REFERER_DEFAULT
      },{
        title:'HOME',
        method:'POST',
        path:process.env.INAZ_PATH_HOME,
        referer:process.env.INAZ_PATH_REFERER_TOPM,
        data: {
          AccessCode:process.env.INAZ_AccessCode,
          ParamFrame:'',
          VoceMenu:'',
          ParamPage:''
        }
      },{
        title:'START',
        method:'POST',
        path:process.env.INAZ_PATH_START,
        referer:process.env.INAZ_PATH_REFERER_TOPM,
        data:{
          AccessCode:process.env.INAZ_AccessCode,
          ParamFrame:process.env.INAZ_START_ParamFrame,
          ParamPage:'',
          VoceMenu:process.env.INAZ_VoceMenu
        }
      },{
        title:'FIND',
        method:'POST',
        path:process.env.INAZ_PATH_FIND,
        referer:process.env.INAZ_PATH_REFERER_START,
        data: {
          AccessCode:process.env.INAZ_AccessCode,
          ParamPage:process.env.INAZ_FIND_ParamPage
        }
      },{
        title:'TIMB',
        method:'POST',
        path:process.env.INAZ_PATH_TIMB,
        referer:process.env.INAZ_PATH_REFERER_FIND,
        data: {
          AccessCode:process.env.INAZ_AccessCode,
          ParamPage:process.env.INAZ_TIMB_ParamPage,
          ListaSel:'',
          ActionPage:'',
          NomeFunzione:process.env.INAZ_TIMB_NomeFunzione,
          ValCampo:'',
          ValoriCampo:'',
          CampoKey:'',
          StatoRiga:'',
          ParPagina:'',
          Matches:''
        }
      }];

      chainOfRequests(o1, sequence, 0, function(err, c3){
        if (err) return handleError(res, err);

        var table = parseInaz(c3);
        var result;
        if (user.all) {
          result = table;
        }
        else {
          var now = new Date();
          var date = merge(now.getDate()) + '/' + merge((now.getMonth() + 1)) + '/' + now.getFullYear();
          result = table.filter(function (r) {
            return r['C1'] == date;
          }).reverse();
        }
        console.log('RISULTATI: ' + JSON.stringify(result));
        return res.json(200, result);
      });
    });
  });
};


function merge(v, tmpl) {
  tmpl = tmpl || '00';
  v = ''+v;
  var diff = tmpl.length-v.length;
  if (diff>0)
    v = tmpl.slice(0,diff) + v;
  return v;
}
