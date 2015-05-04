/**
 * Created by Leo on 01/02/2015.
 */
'use strict';

var _ = require('lodash');

/**
 * Modifica tutti i caratteri diversi dalle lettere e numeri in underscore
 * @param filename
 * @returns {*}
 */
function validateFileName(filename){
  return filename.replace(/[^0-9a-zA-Z]+/g, "_");
}
exports.validateFileName = validateFileName;


exports.uiid_templates = {
  guid: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
  id12: 'xxxxxxxxxxxx'
};

exports.uuid = function(template) {
  template = template || 'xxxxxxxxxxxx';
  var d = new Date().getTime();
  var id = template.replace(/[xy]/g, function(c) {
    var r = (d + Math.random()*16)%16 | 0;
    d = Math.floor(d/16);
    return (c=='x' ? r : (r&0x3|0x8)).toString(16);
  });
  return id;
};

exports.merge = function(v, tmpl) {
  tmpl = tmpl || '00';
  v = ''+v;
  var diff = tmpl.length-v.length;
  if (diff>0)
    v = tmpl.slice(0,diff) + v;
  return v;
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
exports.encodeToEsa = encodeToEsa;

function decodeFromEsa(s) {
  var res = '';
  for (var i = 0, n = s.length; i<n; i += 2) {
    res += String.fromCharCode("0x" + s.substring(i, i + 2));
  }
  return res;
}
exports.decodeFromEsa = decodeFromEsa;


