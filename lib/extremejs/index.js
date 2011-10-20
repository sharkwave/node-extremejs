"use strict";

var util = require('./util');
var mongodb = require('./db');

var db = null;
var resources = {};


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

exports.stream = function(name, entity, properties) {
  resources[name] = {  type:         'stream', 
                          entity:       entity, 
                          properties:   properties};
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
