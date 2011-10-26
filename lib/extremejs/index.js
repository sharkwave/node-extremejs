"use strict";

var util = require('./util');
var mongodb = require('./db');
var URL = require('url');

var resources = {};

function ensureIndex(callback) {
  var objects = [];
  for(var k in resources) {
    var v = resources[k];
    if(v.type == 'object')
      objects.push(v);
  }
  if(objects.length == 0) {
    callback(null);
    return;
  }

  function iter(n) {
    if(n == objects.length)
      callback(null);
    else {
      var idx = {};
      var ps = objects[n].properties;
      var entity = objects[n].entity;
      for(var i in ps)
        idx[ps[i]] = 1;
      mongodb.ensureIndex(exports.db, entity, idx, {unique: true}, 
          function(err) {
            if(err == null)
              iter(n+1);
            else
              callback(err);
          });
    }
  }
  iter(0);
}

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

function isFuncConstName(value) {
  return isConstName(value) && typeof(resources[value].def) == 'function'
}

function isObjectConstName(value) {
  return isConstName(value) && typeof(resources[value].def) == 'object'
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
    else return null;
  }
  if(path.length > 0)
    ret += '/' + path.join('/');
  return ret;
}
function output(name, json, context) {
  var ret = {};
  var def = resources[name].def;
  ret['_id'] = json['_id'];
  for(var k in def) {
    if(isString(def[k])) ret[k] = json[k];
    if(isLink(def[k])) {
      var link = makeUrl(def[k], json, context);
      if(link != null) ret[k] = link;
    }
  }
  return ret;
}
function constOutput(def, context) {
  var ret = {};
  for(var k in def) {
    if(isLink(def[k])) {
      var link = makeUrl(def[k], {}, context);
      if(link != null) ret[k] = link;
    }
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

function urlname(url) {
  return pathname(urlpath(url));
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

function patharray2query(path) {
  var name = path[0];
  var values = path.slice(1);
  var properties = resources[name].properties;
  var def = resources[resources[name].entity].def;
  var ret = {};
  for(var i in properties) {
    var p = properties[i];
    var v = values[i];
    if(p == '_id' || isString(def[p]))
      ret[p] = v;
  }
  return ret;
}

function path2context(path) {
  return patharray2context(path2array(path));
}

function url2context(url) {
  return path2context(urlpath(url));
}
function path2query(path) {
  return patharray2query(path2array(path));
}

function url2query(url) {
  return path2query(urlpath(url));
}
function urlentity(url) {
  var name = urlname(url);
  return resources[name].entity;
}

function inputUrl(url, object) {
  var name = urlentity(url);
  var context = url2context(url);
  return input(name, object, context);
}

function outputUrl(url, object) {
  var name = urlentity(url);
  var context = url2context(url);
  return output(name, object, context);
}

function objectConstGet(url, callback) {
  var context = url2context(url);
  var name = urlname(url);
  var def = resources[name].def;
  var obj = constOutput(def, context);
  callback(200, obj);
}
function funcConstGet(url, callback) {
  funcConstOp('get', url, null, callback);
}
function objectGet(url, callback) {
  var query = url2query(url);
  mongodb.find(exports.db, urlentity(url), query, function(err, docs) {
    if(err == null) {
      if(docs.length > 0)
        callback(200, outputUrl(url, docs[0]));
      else
        callback(404, null);
    }
    else
      callback(500, null);
  });
}
function urlqry(url) {
  var p = URL.parse(url, true);
  if(p.search != '') return p.query;
  else return null;
}
function urlsetqry(url, qry) {
  var p = URL.parse(url, true);
  delete p.search;
  p.query = qry;
  return URL.format(p);
}
function streamObject(url, slice) {
  var ret = {};
  ret.first = urlsetqry(url, {first:''});
  ret.last = urlsetqry(url, {last:''});
  if(slice != null) {
    ret.prev = urlsetqry(url, {prev:slice[0]._id});
    ret.next = urlsetqry(url, {next:slice[slice.length-1]._id});
    ret.slice = slice.map(function(item) {
      return outputUrl(url, item);
    });
  }
  return ret;
}
function streamNextGet(url, callback) {
  var opt = {limit: 5, sort:[['_id', 'asc']]};
  var qry = url2query(url);
  var next = urlqry(url).next;
  if(next) qry._id = {$gt:next};
  mongodb.find(exports.db, urlentity(url), qry, opt, function(err, docs) {
    if(err != null) callback(500, null);
    else if(docs.length == 0) callback(404, null);
    else callback(200, streamObject(url, docs));
  });

}
function streamPrevGet(url, callback) {
  var opt = {limit: 5, sort:[['_id', 'desc']]};
  var qry = url2query(url);
  var prev = urlqry(url).prev;
  if(prev) qry._id = {$lt:prev};
  mongodb.find(exports.db, urlentity(url), qry, opt, function(err, docs) {
    if(err != null) callback(500, null);
    else if(docs.length == 0) callback(404, null);
    else callback(200, streamObject(url, docs.a.reverse()));
  });
}
function streamGet(url, callback) {
  var qry = urlqry(url);
  if(qry == null)
    callback(200, streamObject(url));
  else if(qry.first == '')
    streamNextGet(url, callback);
  else if(qry.last == '')
    streamPrevGet(url, callback);
  else if(qry.prev)
    streamPrevGet(url, callback);
  else if(qry.next)
    streamNextGet(url, callback);


}
function streamPost(url, object, callback) {
  object._id = util.id();
  var entity = urlentity(url);
  mongodb.insert(exports.db, entity, object, function(err, doc) {
    if(err == null)
      callback(201, object);
    else if(err.code == 11000) {
      console.log(err);
      callback(409, null);
    }
    else {
      console.log(err);
      callback(500, null);
    }
  });
}
function objectPut(url, object, callback) {
  object._id = util.id();
  var entity = urlentity(url);
  var cond = url2query(url);
  mongodb.update(exports.db, entity, cond, object, true, function(err, doc) {
    if(err == null)
      callback(200, object);
    else if(err.code == 11000) {
      console.log(err);
      callback(409, null);
    }
    else {
      console.log(err);
      callback(500, null);
    }
  });
}
function objectDelete(url, callback) {
  var entity = urlentity(url);
  var cond = url2query(url);
  mongodb.remove(exports.db, entity, cond, function(err, n) {
    if(err == null)
      callback(200);
    else {
      console.log(err);
      callback(500, null);
    }
  });
}
function funcConstOp(method, url, object, callback) {
  var params = url2context(url);
  var req = {method:method, params:params, entity:object, url:url};
  var name = urlname(url);
  var func = resources[name].def;
  func(req, callback);
}


exports.db = null;

exports.connect = function(host, port, db, callback) {
  mongodb.connect(host, port, db, function(err, d){
    if(err == null) {
      exports.db = d;
      ensureIndex(function(err) {
        callback(err);
      });
    }
    else
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

exports.resource = function(name, params, def) {
  resources[name] = {type:'const', properties:params, def:def};
}

exports.hook = function(resource, callback) {
}

exports.url = function(name, params) {
  return '/' + name + '/' + params.join('/');
}

exports.get = function(url, callback) {
  var name = urlname(url);
  if(isObjectConstName(name)) {
    objectConstGet(url, callback);
  }
  else if(isFuncConstName(name)) {
    funcConstGet(url, callback);
  }
  else if(isObjectName(name)) {
    objectGet(url, callback);
  }
  else if(isStreamName(name)) {
    streamGet(url, callback);
  }
}

exports.post = function(url, object, callback) {
  var name = urlname(url);
  if(isStreamName(name)) {
    var input = inputUrl(url, object);
    streamPost(url, input, function(code, ret) {
      if(code < 300)
        callback(code, outputUrl(url, ret));
      else
        callback(code, ret);
    });
  }
  else if(isFuncConstName(name))
    funcConstOp('post', url, object, callback);
}

exports.put = function(url, object, callback) {
  var name = urlname(url);
  if(isObjectName(name)) {
    var input = inputUrl(url, object);
    objectPut(url, input, function(code, ret) {
      if(code < 300)
        callback(code, outputUrl(url, ret));
      else
        callback(code, ret);
    });
  }
}

exports.delete= function(url, callback) {
  var name = urlname(url);
  if(isObjectName(name)) {
    objectDelete(url, function(code) {
        callback(code);
    });
  }
}

exports.test = function() {
}
