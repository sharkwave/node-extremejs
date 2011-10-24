"use strict";

var util = require('./util');
var mongodb = require('./db');
var URL = require('url');

var db = null;
var resources = {};

function isString(value) {
  return typeof(value) == 'string';
}

function isArray(value) {
  return value instanceof Array;
}

function isEntityName(value) {
  var res = resources[value];
  if(res == null) return false;
  var t = res.type;
  return t == 'entity';
}

function isLinkName(value) {
  var res = resources[value];
  if(res == null) return false;
  var t = res.type;
  return t == 'object' || t == 'stream' || t == 'const';
}

function isObjectName(value) {
  var res = resources[value];
  if(res == null) return false;
  var t = res.type;
  return t == 'object';
}

function isStreamName(value) {
  var res = resources[value];
  if(res == null) return false;
  var t = res.type;
  return t == 'stream';
}

function isConstName(value) {
  var res = resources[value];
  if(res == null) return false;
  var t = res.type;
  return t == 'const';
}

function isLink(value) {
  return isArray(value) && isLinkName(value[0]);
}

function input(name, json, context) {
  var ret = {};
  var def = resources[name].def;
  if(json['_id']) ret['_id'] = json['_id'];
  for(var k in def) 
    if(isString(def[k])) ret[k] = json[k];
  for(var k in context) 
    if(isString(def[k])) ret[k] = context[k];
  return ret;
}
function makeUrl(template, object, context) {
  var ret = '/' + template[0];
  var tail = template[1];
  var path = [];
  for(var i in tail) {
    var name = tail[i];
    if(object[name]) path.push(object[name]);
    else if(context[name]) path.push(context[name]);
    else path.push('!null!');
  }
  ret += '/' + path.join('/');
  return ret;
}
function output(name, json, context) {
  var ret = {};
  var def = resources[name].def;
  ret['_id'] = json['_id'];
  for(var k in def) {
    if(isString(def[k])) ret[k] = json[k];
    if(isLink(def[k])) ret[k] = makeUrl(def[k], json, context);
  }
  return ret;
}
function urlpath(url) {
  return URL.parse(url).pathname;
}
function path2array(path) {
  return path.substring(1).split('/');
}
function pathname(path) {
  return path2array(path)[0];

}
function patharray2context(path) {
  var name = path[0];
  var values = path.slice(1);
  var properties = resources[name].properties;
  var ret = {};
  for(var i in properties) {
    var p = properties[i];
    var v = values[i];
    ret[p] = v;
  }
  return ret;
}
function path2context(path) {
  return patharray2context(path2array(path));
}

function constGet(url, callback) {
  var def = resources[
}
function entityGet(url, callback) {
}
function objectGet(url, callback) {
}
function streamGet(url, callback) {
}

exports.connect = function(host, port, db, callback) {
  mongodb.connect(host, port, db, function(err, d){
    db = d;
    callback(err);
  });
}

exports.entity = function(name, def) {
  resources[name] = {type:'entity', def:def};
}

exports.object = function(name, entity, properties) {
  resources[name] = {  type:         'object', 
                       entity:       entity, 
                       properties:   properties};
}

exports.stream = function(name, entity, properties, embed) {
  if(embed == null) embed = [];
  resources[name] = {  type:         'stream', 
                       entity:       entity, 
                       properties:   properties,
                       embed:        embed};
}

exports.const = function(name, params, def) {
  resources[name] = {type:'const', params:params, def:def};
}

exports.hook = function(resource, callback) {
}

exports.get = function(url, callback) {
  var name = urlname(url);
  if(isConstName(name) {
    constGet(url, callback);
  }
  else if(isEntityName(name) {
    entityGet(url, callback);
  }
  else if(isObjectName(name) {
    objectGet(url, callback);
  }
  else if(isStreamName(name) {
    streamGet(url, callback);
  }
}

exports.post = function(url, object, callback) {
}

exports.put = function(url, object, callback) {
}

exports.delete= function(url, callback) {
}

exports.test = function() {
  /*
  console.log(isString('string'));
 var test = {username: "liudian", password: "1234"};
 var id = util.id();
 test._id = util.id();
 var out = output('user', test, {currentUser:id});
 console.log(out);
 console.log(input('user', out, {currentUser:id}));
 console.log(path2context('/favorites/1332510c12c76b85/1332510c12c76b86'));
 */
  console.log(pathname('/favorites/1332510c12c76b85/1332510c12c76b86'));
  console.log(isStreamName('favorites'));
  console.log(isObjectName('save'));
}
