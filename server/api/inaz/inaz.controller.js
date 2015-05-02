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

function checkReqOpt(req) {
  var reqopt = req.body;
  if (reqopt) {
    var now = new Date();
    reqopt.today = merge(now.getDate()) + '/' + merge((now.getMonth() + 1)) + '/' + now.getFullYear();
  }
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
  w.doHttpsRequest('accesso', options, undefined, undefined, function(o1, r1, c1) {
    if (r1.code!=200)
      return w.error(res, new Error('[accesso] - terminata con codice: '+r1.code));

    cookies = r1.headers['set-cookie'];

    check(reqopt.user, cookies, function(err, encpsw) {
      if (err)
        return w.error(res, err);

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

        manageHistory(reqopt, table, function(result) {
          if (!reqopt.all)
            result.data = result.data.filter(function (r) { return r['C1'] == reqopt.today; }).reverse();
          //var result = reqopt.all ? data : data.filter(function (r) { return r['C1'] == reqopt.today; }).reverse();
          return w.ok(res, result);
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

function merge(v, tmpl) {
  tmpl = tmpl || '00';
  v = ''+v;
  var diff = tmpl.length-v.length;
  if (diff>0)
    v = tmpl.slice(0,diff) + v;
  return v;
}


function manageHistory(opt, data, cb) {
  //console.log('RISULTATI: ' + JSON.stringify(data));
  cb = cb || noop;
  var filename = './server/data/'+ u.validateFileName(opt.user.name)+'.json';
  // STRUTTURA DEI RISULTATI:
  var results = {
    data: data,
    meta: []
  };
  // inserisce le peculiarità del giorno se esistono
  if (opt.perm>0 || opt.work!=480)
    results.meta.push({day:opt.today, perm:opt.perm, work:opt.work});

  //apre il file degli storici dell'utente
  fs.stat(filename, function(err, stats){
    if (err) console.log("Errore in fase di recupero del file '"+filename+"': "+JSON.stringify(err));
    if (!err && stats.isFile()) {
      var content = fs.readFileSync(filename);
      var savedresults = JSON.parse(content);
      //mergia i risultati
      if (savedresults) {
        // mergia i dati
        if (savedresults.data) {
          // recupera tutti i record non censiti nell'ultima mungitura
          var others = savedresults.data.filter(function (r) {
            return !results.data.some(function (d) {
              return d['C1'] == r['C1'];
            });
          });
          results.data = results.data.concat(others);
        }
        // mergia i meta
        if (savedresults.meta) {
          // recupera tutti i meta diversi da oggi
          var others = savedresults.meta.filter(function (m) { return m.day!=opt.today; });
          results.meta = results.meta.concat(others);
        }
      }
    }
    //salva il file degli storici
    fs.writeFile(filename, JSON.stringify(results), function(err){
      if (err) console.log("Errore in fase di salvataggio del file '"+filename+"': "+JSON.stringify(err));
      //restituisce tutti i risultati
      cb(results);
    });
  });
}

exports.upload = function(req, res) {
  console.log('Richiesta di upload...');
};
