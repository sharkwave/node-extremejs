"use strict";

var util = require('./util');
var mongodb = require('./db');
var db = null;

exports.entity = function(name, def) {
}

exports.object = function(name, entity, properties) {
}

exports.stream = function(name, entity, properties) {
}

exports.const = function(name, params, object) {
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

  /*
  mongodb.connect('localhost', 27017, 'test', function(err, d){
    db = d;
    console.log("connected");
  });
  */
}
