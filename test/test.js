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

xp.stream('find-friend', 'user', ['currentUser']);

xp.stream('following', 'friend', ['currentUser', 'from']);

xp.stream('follower', 'friend', ['currentUser', 'to']);

xp.object('follow', 'friend', ['from', 'to']);

xp.stream('favorites', 'favorite', ['currentUser', 'user']);

xp.object('save', 'favorite', ['user', 'spot']);

xp.connect('localhost', 27017, 'test', function(err) {
  if(!err) console.log('connected');
});
