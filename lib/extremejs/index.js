"use strict";

var util = require('./util');
var mongodb = require('./db');

var db = null;
var resources = {};

function isString(value) {
  return value instanceof String;
}

function isArray(value) {
  return value instanceof Array;
}

function isEntityName(value) {
  var res = resources[value];
  if(res == null) return false;
  var t = res.type;
  return t == 'object' || t == 'stream' || t == 'const';
}

function isLinkName(value) {
  var res = resources[value];
  if(res == null) return false;
  var t = res.type;
  return t == 'object' || t == 'stream' || t == 'const';
}

function isLink(value) {
  return isArray(value) && isLinkName(value[0]);
}

function input(name, json, context) {
  var ret = {};
  var def = resources[name];
  for(var k in def) {
    
  }
  for(var k in context) 
    if(def[k]) ret[k] = context[k];
  
}

function output(name, entity, context) {
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
}

exports.post = function(url, object, callback) {
}

exports.put = function(url, object, callback) {
}

exports.delete= function(url, callback) {
}

exports.test = function() {

}
