var xp = require('extremejs');
var http = require('http');

// entity: define database table

// user table
xp.entity('user', {
  username: 'string',
  password: 'string',
  shop: ['my-shop', ['_id']]
});

// shop table
xp.entity('shop', {
  name:'string',
  owner:'user',
  'goods': ['goods-for-shop', ['_id']]
});

// goods table
xp.entity('goods', {
  name:'string',
  price:'number',
  shop:'shop'
});

// define URL handler, handle table data directly

// get user by username. indexed username
xp.object('user-by-username', 'user', ['username']);

// signup
xp.stream('signup', 'user', []);

// get my-shop by user id
xp.object('my-shop', 'shop', ['owner']);

// get all goods of a shop by its shop id
xp.stream('goods-for-shop', 'goods', ['shop']);

// extremejs internal key, for encrypted data
xp.setKey('123456');

// connect to mongoDB
xp.connect('localhost', 27017, 'extremejsDemo', function(err) {
  if(err) {
    console.log('error%j', err);
    return;
  }
  // listen 8080 port
  http.createServer(function(req,res) {
      xp.httpfunc(req, res);
  }).listen(8088);
});
