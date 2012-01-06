'use strict';
var xp = require('extremejs');
var http = require('http');

xp.entity('user', {
  username:'string',
  password:'string',
  timeline: ['tl', ['currentUser', 'currentUser']],
  favorites:['favorites', ['currentUser', '_id']],
  following:['following', ['currentUser', '_id']],
  follower:['follower', ['currentUser', '_id']],
  follow:['follow', ['currentUser', '_id']]
});

xp.entity('spot', {
  name:'string',
  save:['save', ['currentUser', '_id']],
  comments: ['spot-cmts', ['currentUser', 'currentUser', '_id']]
});

xp.entity('friend', {
  from:'user',
  to:'user',
  hrefFrom: ['u', ['currentUser', 'from']],
  hrefTo: ['u', ['currentUser', 'to']]
});

xp.entity('favorite', {
  user:'user',
  spot:'spot',
  hrefUser: ['u', ['currentUser', 'user']],
  hrefSpot: ['s', ['currentUser', 'spot']]
});

xp.entity('timeline', {
  user:'user',
  spot:'spot',
  type:'string',
  hrefUser: ['u', ['currentUser', 'user']],
  hrefSpot: ['s', ['currentUser', 'spot']]
});

xp.entity('notification', {
  type:'string'
});

xp.entity('comment', {
  user:'user',
  spot:'spot',
  message:'string',
  hrefUser: ['u', ['currentUser', 'user']],
  hrefSpot: ['s', ['currentUser', 'spot']],
  replys: ['cmt-replys', ['currentUser', 'currentUser', '_id']]
});

xp.entity('reply', {
  user:'user',
  comment:'comment',
  message:'string',
  hrefComment:['cmt', ['currentUser', 'comment']],
  hrefUser: ['u', ['currentUser', 'user']]
});

xp.resource('start', [], {
  signup: ['signup', []],
  login: ['login', []],
  discover: ['discover-nologin', []],
  publicTimeline: ['pub-tl', []]
});

xp.stream('signup', 'user', []);

xp.stream('spot-import', 'spot', []);

xp.object('user-by-name', 'user', ['username']);

xp.object('u', 'user', ['currentUser', '_id']);

xp.object('s', 'spot', ['currentUser', '_id']);

xp.object('cmt', 'comment', ['currentUser', '_id']);

xp.stream('spot-cmts', 'comment', ['currentUser', 'user', 'spot']);

xp.stream('cmt-replys', 'reply', ['currentUser', 'user', 'comment']);

xp.resource('login', [], function(req, callback) {
  var userinfo = req.entity;
  xp.get(xp.url('user-by-name',[userinfo.username]), function(code, obj) {
    if(code==200) {
      if(userinfo.password==obj.password) {
        xp.get(xp.url('home', [obj._id], req.url), function(code, home) {
          callback(200, home, {currentUser:obj._id, _token:Math.random()});
        });
      }
      else
        callback(403);
    }
    else 
      callback(403);
  });
});

xp.stream('find-friend', 'user', ['currentUser']);

xp.stream('discover', 'spot', ['currentUser']);
xp.stream('discover-nologin', 'spot', ['currentUser']);

xp.stream('following', 'friend', ['currentUser', 'from']);

xp.stream('follower', 'friend', ['currentUser', 'to']);

xp.object('follow', 'friend', ['from', 'to']);

xp.stream('favorites', 'favorite', ['currentUser', 'user']);

xp.object('save', 'favorite', ['user', 'spot']);

xp.resource('home', ['currentUser'], {
  me: ['u', ['currentUser', 'currentUser']],
  discover: ['discover', ['currentUser']],
  timeline: ['tl', ['currentUser', 'currentUser']],
  notification: ['notify', ['currentUser', 'currentUser']],
  findFriend: ['find-friend', ['currentUser']]
  
});

xp.stream('tl', 'comment', ['currentUser', 'user']);
xp.stream('pub-tl', 'comment', []);

<<<<<<< HEAD
xp.connect('localhost', 27017, 'favespot2_test', function(err) {
=======
xp.setKey('sh0ckwave-favesp0t');
xp.connect('localhost', 27017, 'test', function(err) {
>>>>>>> 6ecb2f042c2a5034b041c0725e552613d1dcbd28
  if(err) console.log('error%j', err);

  //xp.test();
/*
  for(var i=1; i<=100; i++) {
    xp.post('/spot-import', {name:'spot' + i}, 
      function(code, doc){
        //console.log(code);
      });
  }
*/
  /*
  xp.get("/discover/133391bf69ba27cc?first=", function(err,obj){
    console.log(err);
    console.log(obj);
  });
  */
  /*
  xp.put('/save/133391bf69ba27cc/1333a1f4d68b5959', {}, function(code, obj) {
    console.log(code);
    console.log(obj);

  });
  */
  /*
  xp.delete('/save/133391bf69ba27cc/1333a1f4d68b5959', function(code) {
    console.log(code);
  });
  */
  /*
  xp.post('/login', {username:'user1', password:'12345'}, 
      function(code, home) {
        console.log(code);
        console.log(home);
      });
      */
  process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err.stack);
  });
  http.createServer(xp.httpfunc).listen(8080);
  console.log('listen on 8080');

});
function cb(code, entity) {
  console.log('code: ' + code);
  console.log(entity);
}
exports.post = function(url, entity) {
  xp.post(url, entity, cb);
}

exports.put = function(url, entity) {
  xp.put(url, entity, cb);
}
exports.delete = function(url) {
  xp.delete(url, cb);
}
exports.get = function(url) {
  xp.get(url, cb);
}
