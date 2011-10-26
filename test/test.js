'use strict';
var xp = require('extremejs');

xp.entity('user', {
  username:'string',
  password:'string',
  favorites:['favorites', ['currentUser', '_id']],
  following:['following', ['currentUser', '_id']],
  follower:['follower', ['currentUser', '_id']],
  follow:['follow', ['currentUser', '_id']]
});

xp.entity('spot', {
  name:'string',
  save:['save', ['currentUser', '_id']]
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

xp.resource('start', [], {
  signup: ['signup', []],
  login: ['login', []]
});

xp.stream('signup', 'user', []);

xp.stream('spot-import', 'spot', []);

xp.object('user-by-name', 'user', ['username']);

xp.object('u', 'user', ['currentUser', '_id']);

xp.object('s', 'spot', ['currentUser', '_id']);

xp.resource('login', [], function(req, callback) {
  var userinfo = req.entity;
  xp.get(xp.url('user-by-name',[userinfo.username]), function(code, obj) {
    if(code==200) {
      if(userinfo.password==obj.password) {
        xp.get(xp.url('home', [obj._id]), function(code, home) {
          callback(200, home);
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

xp.stream('following', 'friend', ['currentUser', 'from'], ['to']);

xp.stream('follower', 'friend', ['currentUser', 'to'], ['from']);

xp.object('follow', 'friend', ['from', 'to']);

xp.stream('favorites', 'favorite', ['currentUser', 'user'], ['spot']);

xp.object('save', 'favorite', ['user', 'spot']);

xp.resource('home', ['currentUser'], {
  me: ['u', ['currentUser', 'currentUser']],
  discover: ['discover', ['currentUser']],
  findFriend: ['find-friend', ['currentUser']]
  
});

xp.connect('localhost', 27017, 'test', function(err) {
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
  xp.post('/login', {username:'user1', password:'12345'}, 
      function(code, home) {
        console.log(code);
        console.log(home);
      });
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
