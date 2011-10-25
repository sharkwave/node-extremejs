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

xp.object('user-by-name', 'user', ['username']);

xp.object('u', 'user', ['currentUser', '_id']);

xp.object('s', 'spot', ['currentUser', '_id']);

xp.resource('login', ['a','b'], function(req, callback) {
  console.log(req);
  callback(200, {ok:1});
});

xp.stream('find-friend', 'user', ['currentUser']);

xp.stream('following', 'friend', ['currentUser', 'from'], ['to']);

xp.stream('follower', 'friend', ['currentUser', 'to'], ['from']);

xp.object('follow', 'friend', ['from', 'to']);

xp.stream('favorites', 'favorite', ['currentUser', 'user'], ['spot']);

xp.object('save', 'favorite', ['user', 'spot']);

xp.resource('home', ['currentUser'], {
  me: ['u', ['currentUser', 'currentUser']],
  findFriend: ['find-friend', ['currentUser']],
  
});

xp.connect('localhost', 27017, 'test', function(err) {
  if(err) console.log('error%j', err);
  //xp.test();
  /*
  for(var i=0; i<100; i++) {
    xp.post('/signup', {username:'user' + i, password:'12345' + i}, 
      function(code, doc){
        //console.log(code);
      });
  }
  */
  xp.get("/find-friend/133391bf69ba27cc?first=", function(err,obj){
    console.log(err);
    console.log(obj);
  });
});
