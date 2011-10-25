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
  to:'user'
});

xp.entity('favorite', {
  user:'user',
  spot:'spot'
});

xp.resource('home', [], {
  signup: ['signup', []],
  login: ['login', []]
});

xp.stream('signup', 'user', []);

xp.object('user-by-name', 'user', ['username']);

xp.resource('login', [], function(req, callback) {
});

xp.stream('find-friend', 'user', ['currentUser']);

xp.stream('following', 'friend', ['currentUser', 'from'], ['to']);

xp.stream('follower', 'friend', ['currentUser', 'to'], ['from']);

xp.object('follow', 'friend', ['from', 'to']);

xp.stream('favorites', 'favorite', ['currentUser', 'user'], ['spot']);

xp.object('save', 'favorite', ['user', 'spot']);

xp.connect('localhost', 27017, 'test', function(err) {
  if(err) console.log('error%j', err);
  //xp.test();
setTimeout(function() {
  console.log('here');
  xp.post("/signup", {username:'liudian', password:'12345'}, function(err,obj){
    console.log(err);
    console.log(obj);
  });
}, 1000);
});
