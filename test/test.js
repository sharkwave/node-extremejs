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

xp.doc('user', '用户基本信息');

xp.entity('setting', {
  user:'user',
  notifyFollow:'boolean',
  notifyReply:'boolean',
  //notifyFave:'boolean',
  shareFave:'boolean',
  shareReply:'boolean'
});

xp.doc('setting', '用户设置');

xp.entity('spot', {
  name:'string',
  address:'string',
  location:'geo',
  source:'string',
  city:'string',
  district:'string',
  category:'string',
  verified:'boolean',
  key:'string optional',


  save:['save', ['_id']],
  todo:['todo-it', ['_id']],
  favoriteBy:['favorite-by', ['_id']],
  todoBy:['todo-by', ['_id']],
  commentsAll: ['spot-cmts-all', ['_id']],
  commentsFriends: ['spot-cmts-friends', ['_id']],
  commentsMe: ['spot-cmts-me', ['_id']]
});

xp.doc('spot', '地点信息');

xp.entity('friend', {
  from:'user',
  to:'user',
});

xp.doc('friend', '关注关系，谁关注谁');

xp.entity('favorite', {
  user:'user',
  spot:'spot',
  tags:'set',
  hidden:'boolean optional'
});

xp.doc('favorite', '收藏');

xp.entity('todo', {
  user:'user',
  spot:'spot',
});

xp.doc('todo', '想去');

xp.entity('apnToken', {
  user:'user',
  base64Token:'string'
});

xp.doc('apnToken', 'iPhone 的 APN Token, 用于推送消息');

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

xp.doc('notification', '通知，会被push到客户端的信息');

xp.entity('comment', {
  user:'user',
  spot:'spot',
  source:'comment optional',
  device:'string optional',
  image:'object optional',
  message:'string optional',

  edit: ['cmt-edit', ['_id']],
  likes: ['cmt-likes', ['_id']],
  like: ['like-it', ['_id']],
  replys: ['cmt-replys', ['_id']],
  replysMe: ['cmt-replys-me', ['_id']]
});

xp.doc('comment', '用户对 spot 的评论，以发图片为主');

xp.entity('reply', {
  user:'user',
  comment:'comment',
  message:'string',
  edit: ['reply-edit', ['_id']],
});

xp.doc('reply', '对 comment 的回复');

xp.entity('like', {
  user:'user',
  comment:'comment',
});

xp.doc('like', '喜欢');

xp.resource('start', [], {
  signup: ['signup', []],
  login: ['login', []],
  discover: ['discover-nologin', []],
  publicTimeline: ['pub-tl', []],
  search: ['search', []]
});
xp.doc('start', 'API 入口');

xp.stream('signup', 'user', []);
xp.doc('signup', '注册新用户');

xp.before('signup', function(req, context, input, next, callback) {
  console.log(req.method);
  if(req.method!='POST') {
    callback(405);
    return;
  }
  input.category = 'normal';
  delete input.key;
  input.password = md5(input.password);
  next();
});

xp.after('signup', function(req, ctx, input, status, output, next, cb) {
  if(status != 409) {
    next();
    return;
  }
  cb(409, {error:'username_exists', alertMsg:_(req, 'username-exists')});

});

xp.object('user-by-name', 'user', ['username']);

xp.object('me', 'user', [], {'_id':'currentUser'});
xp.doc('me', '当前登录用户的信息');
xp.stream('spot-cmts-all', 'comment', ['spot']);
xp.doc('spot-cmts-all', 'spot 的所有 comment');
xp.stream('spot-cmts-friends', 'comment', ['spot'], byFriends);
xp.doc('spot-cmts-friends', 'spot 的当前用户所关注的用户发的 comment');
xp.stream('spot-cmts-me', 'comment', ['spot'], {'user':'currentUser'});
xp.doc('spot-cmts-me', '当前用户对 spot 发的 comment');

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
xp.doc('cmt-edit', '删除 comment');
xp.stream('cmt-replys', 'reply', ['comment']);
xp.doc('cmt-replys', 'comment 的所有回复');
xp.stream('cmt-replys-me', 'reply', ['comment'], {'user':'currentUser'});
xp.doc('cmt-replys-me', '当前用户对 comment 的所有回复');

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
xp.doc('reply-edit', '删除回复');

xp.stream('cmt-likes', 'like', ['comment']);
xp.doc('cmt-likes', '谁喜欢过这个 comment');
xp.stream('user-likes', 'like', ['user']);
xp.doc('user-likes', 'user 喜欢过哪些 comment');
xp.object('like-it', 'like', ['comment'], {'user':'currentUser'});
xp.doc('like-it', '喜欢和取消喜欢操作');
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
xp.doc('login', '登录');
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
xp.doc('搜索 spot');
xp.stream('find-friend', 'user', []);
xp.doc('find-friend', '查找好友');
xp.stream('discover', 'spot', []);
xp.doc('discover', '发现 spot');
xp.stream('discover-nologin', 'spot', []);
xp.doc('discover-nologin', '发现 spot');
xp.stream('following', 'friend', ['from']);
xp.doc('following', 'user 关注了谁');
xp.stream('follower', 'friend', ['to']);
xp.doc('follower', 'user 被水关注');
xp.object('follow', 'friend', ['to'],{'from':'currentUser'});
xp.doc('follow', '加关注和取消关注操作');
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
xp.doc('favorites', 'user 收藏了哪些 spot');
xp.stream('favorite-by', 'favorite', ['spot']);
xp.doc('favorite-by', 'spot 被哪些人收藏');
xp.object('save', 'favorite', ['spot'], {'user':'currentUser'});
xp.doc('save', '收藏和取消收藏操作');
xp.stream('todo-list', 'todo', ['user']);
xp.doc('todo-list', 'user 想去哪些 spot');
xp.stream('todo-by', 'todo', ['spot']);
xp.doc('todo-by', 'spot 有哪些 user 想去');
xp.object('todo-it', 'todo', ['spot'], {'user':'currentUser'});
xp.doc('todo-it', '想去和取消想去操作');

xp.resource('home', [], {
  me: ['me', []],
  discover: ['discover', []],
  timeline: ['fl-tl', []],
  findFriend: ['find-friend', []],
  notification: ['notify', []],
  apnToken:['apn-token', {}]
  
});
xp.stream('tl', 'comment', ['user']);
xp.doc('tl', 'user 所有 comment');
xp.stream('fl-tl', 'comment', [], byFriends);
xp.doc('fl-tl', 'user 自己以及所有关注的 user 的 comment');
xp.stream('pub-tl', 'comment', []);
xp.doc('pub-tl', '没有登录时显示的默认 timeline');

xp.stream('notify', 'notification',[], {'user':'currentUser'});
xp.stream('notify-queue', 'notification', []);
xp.doc('notify', '当前登录 user 的所有通知');
xp.stream('apn-token', 'apnToken', [], {'user':'currentUser'});
xp.doc('apn-token', '当前登录 user 的所有 iPhone APN Token');
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
/*---------------------begin of SYNC from 1.0---------------------*/
xp.object('spot-by-na', 'spot', ['name', 'address']);
xp.entity('tmp_faveid_to_cmtid', {
  faveId:'string',
  cmtId:'string'
});
xp.entity('tmp_replyid', {
  replyId:'string'
});
xp.object('tmp-replyid', 'tmp_replyid', ['replyId']);
xp.object('tmp-fc-by-fid', 'tmp_faveid_to_cmtid', ['faveId']);
xp.object('tmp-fc-by-fidcid', 'tmp_faveid_to_cmtid', ['faveId', 'cmtId']);
xp.stream('tmp-sync-user', 'user', []);

xp.stream('sync-fave', 'favorite', []);
xp.stream('sync-cmt', 'comment', []);
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
            spot:'/spot/' + spot._id,
            tags:entity.fave.tags,
            hidden:entity.fave.hidden,
            _rawCreated:entity.fave._rawCreated,
            _rawModified:entity.fave._rawModified
          };
          xp.post('/sync-fave', fave, function(code, fave) {
            if(code < 400 && ! entity.fave.hidden) {
              var cmt = {
                user:'/user/' + user._id,
                spot:'/spot/' + spot._id,
                image:entity.comment.image,
                message:entity.comment.message,
                device:entity.comment.device,
                _rawCreated:entity.comment._rawCreated,
                _rawModified:entity.comment._rawModified
              };
              xp.post('/sync-cmt', cmt, function(cmtcode, cmt) {
                callback(cmtcode, {fave:fave, comment:cmt});
                if(cmtcode < 400) 
                  xp.put(xp.url('tmp-fc-by-fidcid',[entity.fave.key, cmt._id]),
                      {},
                      function(code, fidcid){
                      });

              });
            }
            else callback(code, fave);
          });
        });
    });
  });
});
xp.stream('sync-friend', 'friend', []);
xp.resource('tmp-sync-friend', [], function(req, callback) {
  var from = req.entity.from;
  var to = req.entity.to;
  xp.get(xp.url('user-by-name',[from]), function(code, from) {
    if(code >= 400) {
      callback(code, {error: from + " not found"});
      return;
    }
    xp.get(xp.url('user-by-name',[to]), function(code, to) {
      if(code >= 400) {
        callback(code, {error: to + " not found"});
        return;
      }
      var f = {
        from: '/user/' + from._id,
        to: '/user/' + to._id,
        _rawCreated:req.entity._rawCreated,
        _rawModified:req.entity._rawModified
      };
      xp.post('/sync-friend', f, callback);
    });
  });
});
xp.stream('sync-reply', 'reply', []);
xp.resource('tmp-sync-reply', [], function(req, callback) {
  var reply = req.entity;
  xp.get(xp.url('tmp-fc-by-fid', [reply.key]), function(code, fc) {
    if(code >= 400) {
      callback(code, {error:'can not find faveId:' + reply.key});
      return;
    }
    xp.get(xp.url('user-by-name',[reply.username]), function(code, user) {
      if(code>=400) {
        callback(code, {error:'can not find user:'+reply.username});
        return;
      }
      xp.put(xp.url('tmp-replyid', [reply.key2]), {}, function(code, rid) {
        if(code >= 400) {
          callback(code, {reply:reply});
          return;
        }
        var r = {
          user:'/user/' + user._id,
          comment:'/comment/' + fc.cmtId,
          message:reply.message,
          _rawCreated:reply._rawCreated,
          _rawModified:reply._rawModified
        };
        xp.post('/sync-reply', r, callback);
      });
    });
  });
});
/*---------------------end of SYNC from 1.0---------------------*/

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
