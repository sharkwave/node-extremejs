'use strict';
var config = require('./config'),
	xp = require('extremejs'),
	http = require('http'),
	url = require('url'),
	OAuth = require('node-oauth').OAuth; 

xp.entity('user', {
  username:'string',
  password:'string',

  timeline: ['tl', ['_id']],
  favorites:['favorites', ['_id']],
  todoList:['todo-list', ['_id']],
  likes: ['user-likes', ['_id']],
  following:['following', ['_id']],
  follower:['follower', ['_id']],
  follow:['follow', ['_id']]
});

xp.entity('spot', {
  name:'string',

  save:['save', ['_id']],
  todo:['todo-it', ['_id']],
  favoriteBy:['favorite-by', ['_id']],
  todoBy:['todo-by', ['_id']],
  commentsAll: ['spot-cmts-all', ['_id']],
  commentsFriends: ['spot-cmts-friends', ['_id']],
  commentsMe: ['spot-cmts-me', ['_id']]
});

xp.entity('friend', {
  from:'user',
  to:'user',
});

xp.entity('favorite', {
  user:'user',
  spot:'spot',
});
xp.entity('todo', {
  user:'user',
  spot:'spot',
});


xp.entity('notification', {
  type:'string'
});

xp.entity('comment', {
  user:'user',
  spot:'spot',
  message:'string',

  edit: ['cmt-edit', ['_id']],
  likes: ['cmt-likes', ['_id']],
  like: ['like-it', ['_id']],
  replys: ['cmt-replys', ['_id']],
  replysMe: ['cmt-replys-me', ['_id']]
});

xp.entity('reply', {
  user:'user',
  comment:'comment',
  message:'string',
  edit: ['reply-edit', ['_id']],
});

xp.entity('like', {
  user:'user',
  comment:'comment',
});

xp.resource('start', [], {
  signup: ['signup', []],
  login: ['login', []],
  discover: ['discover-nologin', []],
  publicTimeline: ['pub-tl', []],
  search: ['search', []]
});

xp.stream('signup', 'user', []);

xp.stream('spot-import', 'spot', []);

xp.object('user-by-name', 'user', ['username']);

xp.object('me', 'user', [], {'_id':'currentUser'});



xp.stream('spot-cmts-all', 'comment', ['spot']);
xp.stream('spot-cmts-friends', 'comment', ['spot'], byFriends);
xp.stream('spot-cmts-me', 'comment', ['spot'], {'user':'currentUser'});
xp.edit('cmt-edit', 'comment', ['_id'], {'user':'currentUser'});

xp.stream('cmt-replys', 'reply', ['comment']);
xp.stream('cmt-replys-me', 'reply', ['comment'], {'user':'currentUser'});
xp.edit('reply-edit', 'reply', ['_id'], {'user':'currentUser'});


xp.stream('cmt-likes', 'like', ['comment']);
xp.stream('user-likes', 'like', ['user']);
xp.object('like-it', 'like', ['comment'], {'user':'currentUser'});

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
        callback(401);
    }
    else 
      callback(401);
  });
});

var factual = new OAuth(null, null, 
		config.factual_key, config.factual_secret,
		'1.0', null,'HMAC-SHA1');

xp.resource('search', [], function(req, callback) {
  var qry = url.parse(req.url, true).query;
  if(qry.q != null) {
	  var qry_url = config.factual_url + "/t/global?q="+
		encodeURIComponent(qry.q);
	  if(qry.lat != null && qry.long != null) {
		  if(qry.meters == null)
			  qry.meters = 5000;  // default
		  qry_url += "&geo={%22$circle%22:{%22$center%22:["+
			qry.lat+","+
			qry.long+"],%22$meters%22:"+
			qry.meters+"}}";
	  }
	  factual.get(
		qry_url,
	    null,
	    null,
	    function (err, data, result) {
		  callback(200, eval("("+data+")"));
	    }
	  );
  } else
	  callback(401);
});

xp.stream('find-friend', 'user', []);

xp.stream('discover', 'spot', []);
xp.stream('discover-nologin', 'spot', []);

xp.stream('following', 'friend', ['from']);

xp.stream('follower', 'friend', ['to']);

xp.object('follow', 'friend', ['to'],{'from':'currentUser'});

xp.stream('favorites', 'favorite', ['user']);
xp.stream('favorite-by', 'favorite', ['spot']);
xp.object('save', 'favorite', ['spot'], {'user':'currentUser'});

xp.stream('todo-list', 'todo', ['user']);
xp.stream('todo-by', 'todo', ['spot']);
xp.object('todo-it', 'todo', ['spot'], {'user':'currentUser'});

xp.resource('home', [], {
  me: ['me', []],
  discover: ['discover', []],
  timeline: ['fl-tl', []],
  findFriend: ['find-friend', []]
  
});
xp.stream('tl', 'comment', ['user']);
xp.stream('fl-tl', 'comment', [], byFriends);
xp.stream('pub-tl', 'comment', []);

function byFriends(url, urlelem, context, callback) {
  var cuid = context.currentUser;
  if(cuid == null) {
    callback(401, null);
    return;
  }
  xp.getStream('following','to', [cuid,cuid], context, function(code, ids) {
    if(code < 300) {
      ids.push(cuid);
      callback(code, {'user': {'$in': ids}})
    }
    else
      callback(code, null);
  });

}

xp.setKey(config.key);
xp.connect('localhost', 27017, config.db, function(err) {
  if(err) {
    console.log('error%j', err);
    return;
  }
  if(! config.debug)
    process.on('uncaughtException', function (err) {
      console.log('Caught exception: ' + err.stack);
    });
  http.createServer(xp.httpfunc).listen(config.port);

});
