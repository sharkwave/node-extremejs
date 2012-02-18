var xp = require('extremejs');
var http = require('http');


xp.entity('chat', {
  roomName: 'string',
  userName: 'string',
  message: 'string',
});

xp.stream('room', 'chat', ['roomName']);
xp.setComet('room');

xp.setKey('123456');

xp.connect('localhost', 27017, 'extremejsChatDemo', function(err) {
  if(err) {
    console.log('error%j', err);
    return;
  }
  http.createServer(function(req,res) {
      xp.httpfunc(req, res);
  }).listen(8088);
});
