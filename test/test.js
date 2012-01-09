'use strict';
var config = require('./config');
var xp = require('extremejs');
var http = require('http');

xp.entity('user', {
  username:'string',
  password:'string',
  timeline: ['tl', ['currentUser', '_id']],
  favorites:['favorites', ['currentUser', '_id']],
  following:['following', ['currentUser', '_id']],
  follower:['follower', ['currentUser', '_id']],
  follow:['follow', ['currentUser', '_id']]
});

xp.entity('spot', {
  name:'string',
  save:['save', ['currentUser', '_id']],
  commentsAll: ['spot-cmts-all', ['currentUser', '_id']],
  commentsFriends: ['spot-cmts-friends', ['currentUser', '_id']],
  commentsMe: ['spot-cmts-me', ['currentUser', 'currentUser', '_id']]
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

function byFriends(url, urlelem, context, callback) {
  var cuid = urlelem.currentUser;
  xp.streamIds('following','to', [cuid, cuid], function(code, ids) {
    if(code < 300) {
      ids.push(cuid);
      callback(code, {'user': {'$in': ids}})
    }
    else
      callback(code, null);
  });

}

xp.stream('spot-cmts-all', 'comment', ['currentUser', 'spot']);
xp.stream('spot-cmts-friends', 'comment', ['currentUser', 'spot'], byFriends);
xp.stream('spot-cmts-me', 'comment', ['currentUser', 'user', 'spot']);

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
  timeline: ['fl-tl', ['currentUser']],
  notification: ['notify', ['currentUser', 'currentUser']],
  findFriend: ['find-friend', ['currentUser']]
  
});
xp.stream('tl', 'comment', ['currentUser', 'user']);
xp.stream('fl-tl', 'comment', ['currentUser'], byFriends);
xp.stream('pub-tl', 'comment', []);

xp.setKey(config.key);
xp.connect('localhost', 27017, config.db, function(err) {
  if(err) console.log('error%j', err);
  if(! config.debug)
    process.on('uncaughtException', function (err) {
      console.log('Caught exception: ' + err.stack);
    });
  http.createServer(xp.httpfunc).listen(config.port);

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
