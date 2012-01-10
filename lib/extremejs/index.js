"use strict";

var util = require('./util');
var mongodb = require('./db');
var URL = require('url');
var Cookies = require('cookies');
var crypto = require('crypto');

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
  return value && value.match(/\bstring\b/) != null;
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
  return value.match(/\bboolean\b/) != null;
}
function isBoolean(value) {
  return typeof(value) == 'boolean';
}

function isDateType(value) {
  return value.match(/\bdate\b/) != null;
}
function isDate(value) {
  return value instanceof Date || isString(value) && ! isNaN(Date.parse(value));
}

function isIntegerType(value) {
  return value.match(/\binteger\b/) != null;
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
  return isArray(value) && value.every(function(i) { return isString(i); });
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
  if(! isString(type)) return false;
  if(isStringType(type) && isString(value) ||
      isNumberType(type) && isNumber(value) ||
      isIntegerType(type) && isInteger(value) ||
      isBooleanType(type) && isBoolean(value) ||
      isDateType(type) && isDate(value) ||
      isGeoType(type) && isGeo(value) ||
      isSetType(type) && isSet(value) ||
      isObjectType(type) && isObject(value)) {

    return true;
  }
  else 
    return isOptionalType(type) && value == null;
}

function convertValue(type, value) {
  if(! isDateType(type))
    return value;
  else
    return new Date(value);
}

function typedef2entityname(type) {
  return type.trim().split(/\s+/)[0];
}
function isMatchEntityType(type, value) {
  if(value == null) return true;
  var name = typedef2entityname(type);
  var urln = urlname(value);
  var id = urlId(value);
  return isEntityType(type) && name == urln && id != null;
}

function isEntityName(value) {
  var res = resources[value];
  if(res == null) return false;
  var t = res.type;
  return t == 'entity';
}
function isEntityType(value) {
  if(! isString(value)) return false;
  var name = typedef2entityname(value);
  return isEntityName(name);
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
    if(json['_created']) { 
      var ts = Date.parse(json['_created']);
      if(isNaN(ts)) return null;
      else ret['_created'] = new Date(ts);
    }
    else return null;
  }
  else {
    ret['_modified'] = new Date();
    ret['_created'] = new Date();
  }
  for(var k in def) { 
    if(! isString(def[k])) continue;
    if(isMatchType(def[k], json[k])) {
      if(json[k] != null)
        ret[k] = convertValue(def[k], json[k]);
    }
    else if(isMatchEntityType(def[k], json[k]))
      if(json[k] != null) {
        ret[k] = urlId(json[k]);
      }
    else if(! context[k]){
      console.log('Type Error: %s.%s def: %s value: %j', 
          name, k, def[k], json[k]);
      return null;
    }
      
  }
  for(var k in context) 
    if(isMatchType(def[k], context[k]))
      ret[k] = convertValue(def[k], json[k]);
    else if(isEntityType(def[k]))
      ret[k] = context[k];
    else {
    }

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
function makeEntityUrl(name, id, url) {
  name = typedef2entityname(name);
  var prefix = '';
  if(url != null)
    prefix = urlprefix(url);
  return prefix + '/' + name + '/' + id;
}
function output(name, json, context, url) {
  var ret = {};
  var def = resources[name].def;
  var id = json['_id'];
  ret['_id'] = id;
  ret['_self'] = makeEntityUrl(name, id, url);
  for(var k in def) {
    if(isLink(def[k])) {
      var link = makeUrl(def[k], json, context, url);
      if(link != null) ret[k] = link;
    }
    else if(isMatchType(def[k], json[k])) {
      ret[k] = json[k];
    }
    else if(isEntityType(def[k])) {
      ret[k] = makeEntityUrl(def[k], json[k], url);
    }
  }
  if(json['_modified']) ret['_modified'] = json['_modified'];
  if(json['_created']) ret['_created'] = json['_created'];
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

function pathId(path) {
  return path2array(path)[1];
}

function urlname(url) {
  try {
    return pathname(urlpath(url));
  }
  catch(err) {
    return null;
  }
}

function urlId(url) {
  try {
    return pathId(urlpath(url));
  }
  catch(err) {
    return null;
  }
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
    if(p == '_id' || isStringType(def[p]) || isEntityType(def[p]))
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
  if(isEntityName(name)) return name;
  var res = resources[name];
  if(res.type != 'const')
    return resources[name].entity;
  else
    return name;
}
function objectJoin(obj1, obj2) {
  var ret = {};
  if(obj1 == null) obj1 = {};
  if(obj2 == null) obj2 = {};
  for(var i in obj1) 
    ret[i] = obj1[i];
  for(var i in obj2) 
    ret[i] = obj2[i];
  return ret;
}
function inputUrl(url, object, context) {
  var name = urlentity(url);
  var uc = url2context(url);
  context = objectJoin(context, uc);
  return input(name, object, context);
}

function parseJSON(req, callback) {
  var buffer = '';
  req.addListener('data', function(chunk) {
    buffer += chunk;
  });
  req.addListener('end', function() {
    var json = null;
    try {
      json = JSON.parse(buffer);
    }
    catch(e) {
      callback(null);
      return;
    }
    callback(json);

  });
}

function outputUrl(url, object, context) {
  var name = urlentity(url);
  var uc = url2context(url);
  context = objectJoin(context, uc);
  return output(name, object, context, url);
}

function objectConstGet(url, callback, context) {
  var uc = url2context(url);
  context = objectJoin(context, uc);
  var name = urlname(url);
  var def = resources[name].def;
  var obj = constOutput(def, context, url);
  callback(200, obj);
}
function funcConstGet(url, callback, context) {
  funcConstOp('get', url, null, callback, context);
}
function objectGet(url, callback, context) {
  var query = url2query(url);
  mongodb.find(exports.db, urlentity(url), query, function(err, docs) {
    if(err == null) {
      if(docs.length > 0)
        callback(200, outputUrl(url, docs[0], context));
      else
        callback(404, null);
    }
    else
      callback(500, null);
  });
}
function entityGet(url, callback, context) {
  var id = urlId(url);
  mongodb.find(exports.db, urlname(url), {_id: id}, function(err, docs) {
    if(err == null) {
      if(docs.length > 0)
        callback(200, outputUrl(url, docs[0], context));
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
  var q = {}
  if(p.query) {
    for(var k in p.query)
      if(k.indexOf('_') != 0)
        q[k] = p.query[k];
  }
  p.query = objectJoin(q, qry);
  return URL.format(p);
}
function streamObject(url, slice, context) {
  var ret = {};
  ret.first = urlsetqry(url, {_first:''});
  ret.last = urlsetqry(url, {_last:''});
  if(slice != null) {
    ret.prev = urlsetqry(url, {_prev:slice[0]._id});
    ret.next = urlsetqry(url, {_next:slice[slice.length-1]._id});
    ret.slice = slice.map(function(item) {
      return outputUrl(url, item, context);
    });
  }
  return ret;
}
function streamNextGet(url, query, callback, context) {
  var opt = {limit: 5, sort:[['_id', 'asc']]};
  var qry = url2query(url);
  if(query != null)
    for(var f in query)
        qry[f] = query[f];
  var next = urlqry(url)._next;
  if(next) qry._id = {$gt:next};
  mongodb.find(exports.db, urlentity(url), qry, opt, function(err, docs) {
    if(err != null) callback(500, null);
    else if(docs.length == 0) callback(404, null);
    else callback(200, streamObject(url, docs, context));
  });

}
function streamPrevGet(url, query, callback, context) {
  var opt = {limit: 5, sort:[['_id', 'desc']]};
  var qry = url2query(url);
  if(query != null)
    for(var f in query)
        qry[f] = query[f];
  var prev = urlqry(url)._prev;
  if(prev) qry._id = {$lt:prev};
  mongodb.find(exports.db, urlentity(url), qry, opt, function(err, docs) {
    if(err != null) callback(500, null);
    else if(docs.length == 0) callback(404, null);
    else callback(200, streamObject(url, docs.reverse(), context));
  });
}
function streamQryGet(url, pos, qry, callback, context) {
  if(pos._first == '')
    streamNextGet(url, qry, callback, context);
  else if(pos._last == '')
    streamPrevGet(url, qry, callback, context);
  else if(pos._prev)
    streamPrevGet(url, qry, callback, context);
  else if(pos._next)
    streamNextGet(url, qry, callback, context);
  else callback(400, null);
}
function hasStreamParam(qry) {
  var sp = ['_first', '_last', '_next', '_prev'];
  for(var k in qry)
    if(sp.indexOf(k) != -1) return true;
  return false;
}
function streamGet(url, callback, context) {
  var pos = urlqry(url);
  if(pos == null || ! hasStreamParam(pos)) {
    callback(200, streamObject(url), context);
    return;
  }
  var stream = resources[urlname(url)];
  if(stream.query) {
    stream.query(url, url2context(url), context, function(code, query) {
      if(code < 300)
        streamQryGet(url, pos, query, callback, context);
      else
        callback(code, null);

    });
  }
  else 
    streamQryGet(url, pos, null, callback, context);
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
  var entity = urlentity(url);
  if(! object._id) {
    object._id = util.id();
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
  else {
    var cond = {};
    object._modified = new Date();
    cond._id = object._id;
    cond._created = object._created;
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
function funcConstOp(method, url, object, callback, context) {
  var params = url2context(url);
  var req = {method:method,context:context, params:params, 
    entity:object, url:url};
  var name = urlname(url);
  var func = resources[name].def;
  func(req, callback);
}


exports.db = null;

var clipher = null;
var decipher = null;
var key = null;

exports.setKey = function(k) {
  key = k;
}

function encodeJSON(json) {
  var str = JSON.stringify(json);
  var cipher = crypto.createCipher('des', key);
  var result = cipher.update(str, 'utf8', 'base64');
  result += cipher.final('base64');
  return result;
}

function decodeJSON(str) {
  var decipher = crypto.createDecipher('des', key);
  var result = decipher.update(str, 'base64', 'utf8');
  result += decipher.final('utf8');
  if(result == '') return null;
  else {
    try {
      return JSON.parse(result);
    }
    catch(err) {
      return null;
    }
  }
}
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
exports.streamIds = function(stream, field, params, callback) {
  var path = [stream].concat(params);
  var query = patharray2query(path);
  var entity = resources[stream].entity;
  var fields = {};
  fields[field] = 1;
  mongodb.find(exports.db, entity, query, {}, function(err, docs) {
    if(err != null) callback(500, null);
    var ids = docs.map(function(i) { return i[field];});
    callback(200, ids);
  }, fields);
  
}

exports.get = function(url, callback, context) {
  var name = urlname(url);
  if(isObjectConstName(name)) {
    objectConstGet(url, function(code, ret) {
          if(code < 300)
              callback(code, ret);
          else
              callback(code, ret);
        }, context);
  }
  else if(isFuncConstName(name)) {
    funcConstGet(url, callback, context);
  }
  else if(isObjectName(name)) {
    objectGet(url, callback, context);
  }
  else if(isStreamName(name)) {
    streamGet(url, callback, context);
  }
  else if(isEntityName(name)) {
    entityGet(url, callback, context);
  }
}

exports.post = function(url, object, callback, context) {
  var name = urlname(url);
  if(isStreamName(name)) {
    var input = inputUrl(url, object, context);
    if(input == null) {
      callback(400, null);
      return;
    }
    streamPost(url, input, function(code, ret) {
      if(code < 300)
        callback(code, outputUrl(url, ret, context));
      else
        callback(code, ret);
    });
  }
  else if(isFuncConstName(name))
    funcConstOp('post', url, object, callback, context);
  else
    console.log('name: %j not found', name);
}

exports.put = function(url, object, callback, context) {
  var name = urlname(url);
  if(isObjectName(name)) {
    var input = inputUrl(url, object, context);
    if(input == null) {
      callback(400, null);
      return;
    }
    objectPut(url, input, function(code, ret) {
      if(code < 300)
        callback(code, outputUrl(url, ret, context));
      else
        callback(code, ret);
    });
  }
}

exports.delete= function(url, callback, context) {
  var name = urlname(url);
  if(isObjectName(name)) {
    objectDelete(url, function(code) {
        callback(code);
    });
  }
}

function response(req, res, code, entity, context) {

  if(context) {
    var expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    var c = new Cookies(req, res);
    var id = encodeJSON(context);
    c.set('extremejsId', id, {expires: expires, httpOnly: false});
  }
  if(entity) {
    res.writeHead(code, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(entity));
  }
  else {
    res.writeHead(code);
    res.end();
  }
}
function processMethod(req, res, input) {
  var c = new Cookies(req, res);
  var id = c.get('extremejsId');
  var context = null;
  if(id) context = decodeJSON(id);
  if(input == null) input = {};
  if(req.method == 'GET') {
    exports.get(req.url, function(code, entity, context) {
      response(req, res, code, entity, context);
    }, context);
  }
  else if(req.method == 'PUT') {
    exports.put(req.url, input, function(code, entity, context) {
      response(req, res, code, entity, context);
    }, context);
  }
  else if(req.method == 'DELETE') {
    exports.delete(req.url, function(code, entity, context) {
      response(req, res, code, entity, context);
    }, context);
  }
  else if(req.method == 'POST') {
    exports.post(req.url, input, function(code, entity, context) {
      response(req, res, code, entity, context);
    }, context);
  }
  else {
    res.writeHead(200);
    res.end();
  }
}
function setupAccessControl(req, res) {
  if(req.method == 'OPTIONS') {
    var requestHeader = req.headers['access-control-request-headers'];
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 
        'POST, GET, PUT, DELETE, OPTIONS');
    if(requestHeader != null)
      res.setHeader('Access-Control-Allow-Headers', requestHeader);
    res.setHeader('Access-Control-Max-Age', 24 * 3600);
  }
  else
    res.setHeader('Access-Control-Allow-Origin', '*');
}
exports.httpfunc = function(req, res) {
  setupAccessControl(req, res);
  var input = null;
  var headers = req.headers;
  var contentType = headers['content-type'];
  var contentLen = headers['content-length'];
  req.url = 'http://' + headers['host'] + req.url;
  if(contentType == null || contentLen == null || contentLen == 0){
    processMethod(req, res, null);
  }
  else if(contentType.indexOf('application/json')==0) {
    parseJSON(req, function(object) {
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
    res.writeHead(415);
    res.end();
  }
}

exports.test = function() {
}
