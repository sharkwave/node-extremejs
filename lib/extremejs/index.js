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

function isStringType(value) {
  return value.match(/\bstring\b/) != null;
}

function isString(value) {
  return typeof(value) == 'string';
}

function isNumberType(value) {
  return value.match(/\bnumber\b/) != null;
}

function isNumber(value) {
  return typeof(value) == 'number';
}

function isBooleanType(value) {
  value.match(/\bboolean\b/) != null;
}
function isBoolean(value) {
  return typeof(value) == 'boolean';
}

function isIntegerType(value) {
  value.match(/\binteger\b/) != null;
}

function isInteger(value) {
  return isNumber(value) && value % 1 == 0;
}

function isGeoType(value) {
  return value.match(/\bgeo\b/) != null;
}

function isGeo(value) {
  return isObject(value) && isNumber(value.lat) && isNumber(value.long);
}

function isSetType(value) {
  return value.match(/\bset\b/) != null;
}

function isSet(value) {
  return isArray(value) && value.every(function(i) { return isString(value); });
}
function isObjectType(value) {
  return value.match(/\bobject\b/) != null;
}
function isObject(value) {
  return typeof(value) == 'object' && value != null;
}

function isArray(value) {
  return value instanceof Array;
}

function isOptionalType(value) {
  return value.match(/\boptional\b/) != null;
}
function isMatchType(type, value) {

  if(isStringType(type) && isString(value) ||
      isNumberType(type) && isNumber(value) ||
      isIntegerType(type) && isInteger(value) ||
      isBooleanType(type) && isBoolean(value) ||
      isGeoType(type) && isGeo(value) ||
      isSetType(type) && isSet(value) ||
      isObjectType(type) && isObject(value)) {

    return true;
  }
  else 
    return isOptionalType(type) && value == null;
}

function isMatchEntityType(type, value) {
  return isEntityName(type) && isString(value)
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
  if(json['_id']) {
    ret['_id'] = json['_id'];
    ret['_modified'] = new Date();
  }
  else {
    ret['_modified'] = new Date();
    ret['_created'] = new Date();
  }
  for(var k in def) { 
    if(! isString(def[k])) continue;
    if(isMatchType(def[k], json[k])) {
      if(json[k] != null)
        ret[k] = json[k];
    }
    else if(isMatchEntityType(def[k], json[k]))
      ret[k] = json[k];
    else
      return null;
      
  }
  for(var k in context) 
    if(isMatchType(def[k], context[k]))
      ret[k] = context[k];
  return ret;
}
function urlprefix(url) {
  var p = URL.parse(url);
  if(p.protocol && p.host)
    return p.protocol + '//' + p.host;
  else 
    return '';
}
function makeUrl(template, object, context, url) {
  var prefix = '';
  if(url != null)
    prefix = urlprefix(url);
  var ret = prefix + '/' + template[0];
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
function output(name, json, context, url) {
  var ret = {};
  var def = resources[name].def;
  ret['_id'] = json['_id'];
  if(ret['_modified']) ret['_modified'] = json['_modified'].toISOString();
  if(ret['_created']) ret['_created'] = json['_created'].toISOString();
  for(var k in def) {
    if(isLink(def[k])) {
      var link = makeUrl(def[k], json, context, url);
      if(link != null) ret[k] = link;
    }
    else if(isMatchType(def[k], json[k]))
      ret[k] = json[k];
    else if(isMatchEntityType(def[k], json[k]))
      ret[k] = json[k];
  }
  return ret;
}
function constOutput(def, context, url) {
  var ret = {};
  for(var k in def) {
    if(isLink(def[k])) {
      var link = makeUrl(def[k], {}, context, url);
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
  var res = resources[name];
  if(res.type != 'const')
    return resources[name].entity;
  else
    return name;
}

function inputUrl(url, object) {
  var name = urlentity(url);
  var context = url2context(url);
  return input(name, object, context);
}

function parseJSON(req, callback) {
  var buffer = '';
  req.addListener('data', function(chunk) {
    buffer += chunk;
  });
  req.addListener('end', function() {
    try {
      callback(JSON.parse(buffer));
    }
    catch(e) {
      callback(null);
    }

  });
}

function outputUrl(url, object) {
  var name = urlentity(url);
  var context = url2context(url);
  return output(name, object, context, url);
}

function objectConstGet(url, callback) {
  var context = url2context(url);
  var name = urlname(url);
  var def = resources[name].def;
  var obj = constOutput(def, context, url);
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
function streamNextGet(url, query, callback) {
  var opt = {limit: 5, sort:[['_id', 'asc']]};
  var qry = url2query(url);
  if(query != null)
    for(var f in query)
        qry[f] = query[f];
  var next = urlqry(url).next;
  if(next) qry._id = {$gt:next};
  mongodb.find(exports.db, urlentity(url), qry, opt, function(err, docs) {
    if(err != null) callback(500, null);
    else if(docs.length == 0) callback(404, null);
    else callback(200, streamObject(url, docs));
  });

}
function streamPrevGet(url, query, callback) {
  var opt = {limit: 5, sort:[['_id', 'desc']]};
  var qry = url2query(url);
  if(query != null)
    for(var f in query)
        qry[f] = query[f];
  var prev = urlqry(url).prev;
  if(prev) qry._id = {$lt:prev};
  mongodb.find(exports.db, urlentity(url), qry, opt, function(err, docs) {
    if(err != null) callback(500, null);
    else if(docs.length == 0) callback(404, null);
    else callback(200, streamObject(url, docs.reverse()));
  });
}
function streamQryGet(url, pos, qry, callback) {
  if(pos.first == '')
    streamNextGet(url, qry, callback);
  else if(pos.last == '')
    streamPrevGet(url, qry, callback);
  else if(pos.prev)
    streamPrevGet(url, qry, callback);
  else if(pos.next)
    streamNextGet(url, qry, callback);
}
function streamGet(url, callback) {
  var pos = urlqry(url);
  if(pos == null) {
    callback(200, streamObject(url));
    return;
  }
  streamQryGet(url, pos, null, callback);
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

exports.stream = function(name, entity, properties, query) {
  resources[name] = {  type:         'stream', 
                       entity:       entity, 
                       properties:   properties,
                       query:        query};
}

exports.resource = function(name, params, def) {
  resources[name] = {type:'const', properties:params, def:def};
}

exports.hook = function(resource, callback) {
}

exports.url = function(name, params, base) {
  var prefix = '';
  if(base != null)
    prefix = urlprefix(base);
  return prefix + '/' + name + '/' + params.join('/');
}

exports.get = function(url, callback) {
  var name = urlname(url);
  if(isObjectConstName(name)) {
    objectConstGet(url, function(code, ret) {
            if(code < 300)
              callback(code, outputUrl(url, ret));
          else
              callback(code, ret);
        });
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
    if(input == null) {
      callback(400, null);
      return;
    }
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
    if(input == null) {
      callback(400, null);
      return;
    }
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

function response(res, code, entity) {
  if(entity != null) {
    res.writeHead(code, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(entity));
  }
  else {
    res.writeHead(code);
    res.end();
  }
}
function processMethod(req, res, input) {
  if(input == null) input = {};
  if(req.method == 'GET') {
    exports.get(req.url, function(code, entity) {
      response(res, code, entity);
    });
  }
  else if(req.method == 'PUT') {
    exports.put(req.url, input, function(code, entity) {
      response(res, code, entity);
    });
  }
  else if(req.method == 'DELETE') {
    exports.delete(req.url, function(code, entity) {
      response(res, code, entity);
    });
  }
  else if(req.method == 'POST') {
    exports.post(req.url, input, function(code, entity) {
      response(res, code, entity);
    });
  }
}
exports.httpfunc = function(req, res) {
  console.log(req.method);
  var input = null;
  var headers = req.headers;
  var contentType = headers['content-type'];
  var contentLen = headers['content-length'];
  req.url = 'http://' + headers['host'] + req.url;
  if(contentType == 'application/json' && contentLen) {
    parseJSON(req, function(object) {
      console.log('input %j', object);
      if(object != null) {
        processMethod(req, res, object);
      }
      else {
        res.writeHead(400);
        res.end();
      }
    });
  }
  else {
    processMethod(req, res, null);
  }
}

exports.test = function() {
}
