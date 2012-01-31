'use strict';
var config = require('./config'),
	xp = require('extremejs'),
	http = require('http'),
	url = require('url'),
	OAuth = require('node-oauth').OAuth || require('node-oauth'),
        gt = require('gettext'), 
        crypto = require('crypto');

function md5(input) {
    var md5sum = crypto.createHash('md5');
      md5sum.update(input);
        return md5sum.digest('hex');
}

function _(req, msgid) {
  var al = req.headers['accept-language'];
  if(al) {
    console.log('accept-language: %s', al);
    gt.setlocale('LC_ALL', '');
    var def = gt.gettext(msgid);
    var ls = al.split(/\s*,\s*/).map(
        function(i) { return i.split(/\s*;\s*/)[0].toLowerCase(); });
    for(var i in ls) {
      gt.setlocale('LC_ALL', ls[i]);
      var text = gt.gettext(msgid);
      if(text != def) return text;
    }
    return def;
  }
  gt.setlocale('LC_ALL', '');
  return gt.gettext(msgid);
}

xp.entity('user', {
  username:'string',
  password:'string',
  key:'string optional',
  category:'string',
  logo:'object optional',
  tel:'string optional',
  bio:'string optional',
  blog:'string optional',
  email:'string optional',
  language:'string optional',
  timezone:'string optional',
  location:'string optional',

  timeline: ['tl', ['_id']],
  favorites:['favorites', ['_id']],
  todoList:['todo-list', ['_id']],
  likes: ['user-likes', ['_id']],
  following:['following', ['_id']],
  follower:['follower', ['_id']],
  follow:['follow', ['_id']]
});

xp.entity('setting', {
  user:'user',
  notifyFollow:'boolean',
  notifyReply:'boolean',
  //notifyFave:'boolean',
  shareFave:'boolean',
  shareReply:'boolean'
});

xp.entity('spot', {
  name:'string',
  address:'string',
  location:'geo',
  source:'string',
  city:'string',
  district:'string',
  category:'string',
  verified:'boolean',


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
  source:'user optional',
  hidden:'boolean optional'
});
xp.entity('todo', {
  user:'user',
  spot:'spot',
});


xp.entity('apnToken', {
  user:'user',
  base64Token:'string'
});

xp.entity('notification', {
  type:'string', //follow like reply
  user:'user',
  from:'user',
  message:'string optional',
  relatedUser:'user optional',
  relatedSpot:'spot optional',
  relatedComment:'comment optional',
  relatedReply:'reply optional',
  apnToken: ['apn-token-user', ['user']]
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

xp.before('signup', function(req, context, input, next, callback) {
  input.category = 'normal';
  next();
});

xp.after('signup', function(req, ctx, input, status, output, next, cb) {
  if(status != 409) {
    next();
    return;
  }
  cb(409, {error:'username_exists', alertMsg:_(req, 'username-exists')});

});

xp.stream('spot-import', 'spot', []);

xp.object('user-by-name', 'user', ['username']);

xp.object('me', 'user', [], {'_id':'currentUser'});


xp.object('spot-by-na', 'spot', ['name', 'address']);
xp.stream('spot-cmts-all', 'comment', ['spot']);
xp.stream('spot-cmts-friends', 'comment', ['spot'], byFriends);
xp.stream('spot-cmts-me', 'comment', ['spot'], {'user':'currentUser'});

xp.after('spot-cmts-me', function(req, ctx, input, status, output, next, cb) {
  if(req.method=='POST' && status < 300) {
    var elems = xp.urlelement(req.url);
    var saveurl = xp.url('save', [elems.spot], req.url);
    xp.put(saveurl, {}, function(code, entity) {
      if(code < 300 || code == 409)
        next();
      else
        cb(code, entity);
    }, ctx);
  }
  else
    next();
});

xp.edit('cmt-edit', 'comment', ['_id'], {'user':'currentUser'});

xp.stream('cmt-replys', 'reply', ['comment']);
xp.stream('cmt-replys-me', 'reply', ['comment'], {'user':'currentUser'});

function sendNotification(req, notify, next, callback) {
  var notifyurl = xp.url('notify-queue', [], req.url);
  xp.post(notifyurl, notify, function(code, entity) {
    if(code < 300) {
      console.log('notify: %j', entity);
      next();
    }
    else
      callback(code, entity);
  });
}
xp.after('cmt-replys-me', function(req, ctx, input, status, output, next, cb) {
  if(req.method=='POST' && status < 300) {
    xp.get(output.comment, function(code, entity) {
      if(code >= 300) {
        cb(code, entity);
        return;
      }
      var n = {
        type:'reply',
        user:entity.user,
        from:output.user,
        message:output.message,
        relatedComment:output.comment,
        relatedReply:output._self
      };
      sendNotification(req, n, next, cb);
    });
  }
  else
    next();
});

xp.edit('reply-edit', 'reply', ['_id'], {'user':'currentUser'});


xp.stream('cmt-likes', 'like', ['comment']);
xp.stream('user-likes', 'like', ['user']);
xp.object('like-it', 'like', ['comment'], {'user':'currentUser'});
xp.after('like-it', function(req, ctx, input, status, output, next, cb) {
  if(req.method=='PUT' && status < 300) {
    xp.get(output.comment, function(code, entity) {
      if(code >= 300) {
        cb(code, entity);
        return;
      }
      var n = {
        type:'like',
        user:entity.user,
        from:output.user,
        message:'喜欢您的收藏',
        relatedComment:output.comment,
        relatedReply:output._id
      };
      sendNotification(req, n, next, cb);
    });
  }
  else
    next();
});

xp.resource('login', [], function(req, callback) {
  var userinfo = req.entity;
  xp.get(xp.url('user-by-name',[userinfo.username]), function(code, obj) {
    if(code==200) {
      var key = obj.key ? obj.key : "";
      var m = md5(userinfo.password + key);
      if(m==obj.password) {
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
xp.after('follow', function(req, ctx, input, status, output, next, cb) {
  if(req.method=='PUT' && status < 300) {
    var n = {
      type:'follow',
      user:output.to,
      from:output.from,
      relatedUser:output.from,
    };
    sendNotification(req, n, next, cb);
  }
  else
    next();
});

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
  findFriend: ['find-friend', []],
  notification: ['notify', []],
  apnToken:['apn-token', {}]
  
});
xp.stream('tl', 'comment', ['user']);
xp.stream('fl-tl', 'comment', [], byFriends);
xp.stream('pub-tl', 'comment', []);

xp.stream('notify', 'notification',[], {'user':'currentUser'});
xp.stream('notify-queue', 'notification', []);

xp.stream('apn-token', 'apnToken', [], {'user':'currentUser'});
xp.object('base64-token', 'apnToken', ['base64Token']);
xp.stream('apn-token-user', 'apnToken', ['user']);

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

xp.stream('tmp-sync-user', 'user', []);

xp.stream('sync-fave', 'favorite', []);
xp.resource('tmp-sync-fave', [], function(req, callback) {
  if(req.method!='post') {
    callback(405);
    return;
  }
  var entity = req.entity;
  if(entity.username == null || typeof(entity.spot) != 'object') {
    callback(400);
    return;
  }
  xp.get(xp.url('user-by-name',[entity.username]), function(code, user) {
    if(code>=400) {
      callback(400, {error:'can not find user:' + entity.username, code:code});
      return;
    }
    console.log('%j', entity.spot);
    xp.post('/discover', entity.spot, function(code, spot) {
      if(code >= 400 && code != 409) {
        callback(400, {error:'can not save spot', code:code});
        return;
      }
      xp.get(xp.url('spot-by-na', [entity.spot.name, entity.spot.address]), 
        function(code, spot) {
          if(code >= 400) {
            callback(400, 
              {error:'can not find spot:' + entity.spot.name, code:code});
            return;
          }
          var fave = {
            user:'/user/' + user._id,
            spot:'/spot/' + spot._id
          };
          xp.post('/sync-fave', fave, callback);
        });
    });
  });
});

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
  gt.loadLocaleDirectory(__dirname + '/locale', function() {});

});
