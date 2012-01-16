'use strict';

var TAIL_LEN = 0x100000;
var counterForId = Math.floor(Math.random() * TAIL_LEN);

function nextCounterForId() {
  counterForId++;
  if(counterForId >= TAIL_LEN) 
    counterForId = 0;
  return counterForId;
}

function cxn(c, n) {
  var r = "";
  for(var i = 0; i < n; i++)
    r += c;
  return r;
}
exports.id = function() {
  var nid = Date.now();
  var sid = nid.toString(16);
  var tid =  nextCounterForId().toString(16);
  var zero = 5 - tid.length;
  if(zero > 0)
    tid = cxn('0', zero) + tid;
  return sid + tid;
}

