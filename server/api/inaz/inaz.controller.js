/**
 * Created by Leo on 02/04/2015.
 */
'use strict';

var _ = require('lodash');
var cheerio = require("cheerio");
var fs = require('fs');
var u = require('../utilities/util');
var w = require('../utilities/web');

var content_type_appwww = 'application/x-www-form-urlencoded';
var user_agent_moz = 'Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko';
var content_accept_text = 'text/html, application/xhtml+xml, */*';


function check(user, cookies, cb) {
  cb = cb || noop;
  var data = {
    SuHrWeb:'0',
    IdLogin:user.name,
    IdPwd:user.password,
    ServerLDAP:process.env.INAZ_SERVER_LDAP
  };
  var str_data = w.getData(data,true);

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

  w.doHttpsRequest('check', options, str_data, undefined, function(o, r, c) {
    if (r.code!=200)
      return cb(new Error('[check] - terminato con codice: '+r.code));
    if (!c || c.indexOf("[$OK$]:") != 0)
      return cb(new Error('Verifica password fallita: '+c));
    var encpsw = u.decodeFromEsa(c.substring(7));
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
function getToday() {
  var now = new Date();
  return u.merge(now.getDate()) + '/' + u.merge((now.getMonth() + 1)) + '/' + now.getFullYear();
}
function checkReqOpt(req) {
  var reqopt = req.body;
  if (reqopt) reqopt.today = getToday();
  return (!reqopt || !reqopt.user || !reqopt.user.password || !reqopt.user.name) ? undefined : reqopt;
}

exports.data = function(req, res) {
  var reqopt = checkReqOpt(req);
  if (!reqopt) return w.error(res, new Error('Utente non definito correttamente!'));

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
  w.doHttpsRequest('accesso', options, undefined, undefined, function(o1, r1) {
    if (r1.code!=200)
      return w.error(res, new Error('[accesso] - terminata con codice: '+r1.code));

    cookies = r1.headers['set-cookie'];

    check(reqopt.user, cookies, function(err, encpsw) {
      if (err) return w.error(res, err);

      o1.headers.cookie = cookies;

      var sequence = [{
        title:'DEFAULT',
        method:'POST',
        path:process.env.INAZ_PATH_DEFAULT,
        referer:process.env.INAZ_PATH_REFERER_LOGIN,
        data: {
          IdLogin: reqopt.user.name,
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
          AccessCode:process.env.INAZ_P2_AccessCode,
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
          AccessCode:process.env.INAZ_P2_AccessCode,
          ParamFrame:paramsReplace(process.env.INAZ_START_ParamFrame),
          ParamPage:'',
          VoceMenu:process.env.INAZ_P1_VoceMenu
        }
      },{
        title:'FIND',
        method:'POST',
        path:process.env.INAZ_PATH_FIND,
        referer:process.env.INAZ_PATH_REFERER_START,
        data: {
          AccessCode:process.env.INAZ_P2_AccessCode,
          ParamPage:paramsReplace(process.env.INAZ_FIND_ParamPage)
        }
      },{
        title:'TIMB',
        method:'POST',
        path:process.env.INAZ_PATH_TIMB,
        referer:process.env.INAZ_PATH_REFERER_FIND,
        data: {
          AccessCode:process.env.INAZ_P2_AccessCode,
          ParamPage:paramsReplace(process.env.INAZ_TIMB_ParamPage),
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

      w.chainOfRequests(o1, sequence, 0, function(err, c3){
        if (err) return w.error(res, err);

        var table = parseInaz(c3);

        manageHistory(reqopt, table, function(err, results) {
          if (err)
            results.error = err;
          if (!reqopt.all)
            results.data = results.data.filter(function (r) { return r['C1'] == reqopt.today; }).reverse();
          return w.ok(res, results);
        });
      });
    });
  });
};

function paramsReplace(voice) {
  voice = voice.replace('[P1]',process.env.INAZ_P1_VoceMenu);
  voice = voice.replace('[P2]',process.env.INAZ_P2_AccessCode);
  voice = voice.replace('[P3]',process.env.INAZ_P3_Query);
  return voice;
}



function manageHistory(reqopt, data, cb) {
  // STRUTTURA DEI RISULTATI:
  var results = {
    data: data,
    meta: []
  };
  // inserisce le peculiarità del giorno se esistono
  if (reqopt.perm>0 || reqopt.work!=480)
    results.meta.push({day:reqopt.today, perm:reqopt.perm, work:reqopt.work});

  mergeHistory(reqopt.user, results, reqopt.today, cb);
}

function getUserFileName(user) {
  return './server/data/'+ u.validateFileName(user.name)+'.json';
}

/**
 * Restituisce un valore numerico univoco per l'item
 * @param d
 * @returns {Number}
 */
function getDataN(d){
  return parseInt(d['C1'].substr(6,4)+d['C1'].substr(3,2)+d['C1'].substr(0,2)+ u.merge(d['C2'])+u.merge(d['C3']));
}

function replaceHistory(user, history, cb) {
  cb = cb || noop;
  var filename = getUserFileName(user);

  history.data.sort(function(d1,d2){
    return getDataN(d2) - getDataN(d1);
  });

  //salva il file degli storici
  fs.writeFile(filename, JSON.stringify(history), function(err){
    if (err) return cb(new Error("Errore in fase di salvataggio del file degli storici"), history);
    cb(null, history);
  });
}

function mergeHistory(user, history, today, cb) {
  cb = cb || noop;
  var filename = getUserFileName(user);

  //apre il file degli storici dell'utente
  fs.stat(filename, function(err, stats){
    if (err) return cb(new Error("Errore in fase di recupero del file degli storici"), history);
    //console.log("Errore in fase di recupero del file '"+filename+"': "+JSON.stringify(err));
    if (!err && stats.isFile()) {
      var content = fs.readFileSync(filename);
      var exhistory = JSON.parse(content);
      //mergia i risultati
      if (exhistory) {
        // mergia i dati
        if (exhistory.data) {
          // recupera tutti i record non censiti nell'ultima mungitura
          var others_data = exhistory.data.filter(function (r) {
            return !history.data.some(function (d) {
              return d['C1'] == r['C1'];
            });
          });
          history.data = history.data.concat(others_data);
        }
        // mergia i meta
        if (exhistory.meta) {
          // recupera tutti i meta diversi da oggi
          var others_meta = exhistory.meta.filter(function (m) { return m.day!=today; });
          history.meta = history.meta.concat(others_meta);
        }
      }
    }
    //salva il file degli storici
    replaceHistory(user, history, cb);
  });
}


exports.download = function(req, res) {
  var reqopt = checkReqOpt(req);
  console.log('opzioni: '+JSON.stringify(reqopt));
  if (!reqopt) return w.error(res, new Error('Utente non definito correttamente!'));
  check(reqopt.user, null, function(err) {
    if (err) return w.error(res, err);
    var filename = getUserFileName(reqopt.user);
    console.log('filename: '+filename);
    fs.stat(filename, function(err, stats) {
      if (err) console.log("Errore in fase di recupero del file '"+filename+"': "+JSON.stringify(err));
      if (!err && stats.isFile()) {
        var content = fs.readFileSync(filename);
        var history = JSON.parse(content);
        w.ok(res, history);
      }
    });
  })
};

exports.upload = function(req, res) {
  var reqopt = checkReqOpt(req);
  if (!reqopt) return w.error(res, new Error('Utente non definito correttamente!'));
  check(reqopt.user, null, function(err) {
    if (err) return w.error(res, err);
    if (!reqopt.history || reqopt.history.length <= 0) return w.error(res, new Error('Storico non definito!'));
    var history = {};
    try {
      history = JSON.parse(reqopt.history);
    } catch (err) {
      return w.error(res, err);
    }
    if (!history || (!history.data && !history.meta))
      return w.error(res, new Error('Storico senza contenuti!'));
    var dataempty = (!history.data || history.data.length <= 0);
    var metaempty = (!history.meta || history.meta.length <= 0);
    if (dataempty && metaempty)
      return w.error(res, new Error('Storico senza valori significativi!'));

    if (!history.replace) {
      mergeHistory(reqopt.user, history, reqopt.today, function (err) {
        if (err) return w.error(res, err);
        return w.ok(res);
      });
    } else {
      replaceHistory(reqopt.user, history, function (err) {
        if (err) return w.error(res, err);
        return w.ok(res);
      });
    }
  });
};
