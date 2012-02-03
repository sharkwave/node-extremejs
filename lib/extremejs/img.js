var formidable = require('formidable'),
    im         = require('imagemagick'),
    path       = require('path'),
    fs         = require('fs'), 
    sizes      = {
      '22'     : 22,
      '22@2x'  : 44,
      '29'     : 29,
      '29@2x'  : 58,
      '36'     : 36,
      '36@2x'  : 72,
      '41'     : 41,
      '41@2x'  : 82,
      '69'     : 69,
      '69@2x'  : 138,
      '294'    : 294,
      '294@2x' : 588
    },
    imgCon     = {
      dir      : '/data/php_project/image_temp/',
      max_size : 6 * 1024 * 1024,
    };

exports.cropImg = function(req, res, cb){
  var fields = {},
      rs     = {code:400},
      form   = new formidable.IncomingForm();
  form.maxFieldsSize = imgCon.max_size;
  form.keepExtensions = true;
  form.on('field', function(field, value) {
    fields[field]=value;
  }).on('file', function(field, file) {
    if(!file.name||!fields.username) return;
    if(-1 < file.type.indexOf('image/jpeg') || -1 < file.type.indexOf('image/png')) {
      var fn = imgCon.dir + '/' + file.name;
      fs.rename(file.path, fn);
      rs.slice = {};
      for(var j in sizes) {
        var fnr = file.name.replace(/(\.\w+?)$/,'_' + sizes[j] + '_' + new Date().getTime() + '$1');
        resize(fn, imgCon.dir + fnr, sizes[j], fields.username, res);
        rs.slice[j] = 'http://test.favspot.net/image_temp/' + fnr;
      }
      rs.code = 201;
    } else {
      rs.code = 415;
    }
  }).on('end', function() {
    cb(rs);
  }).on('error',function(err) {
    cb(rs);    
  });
  form.parse(req);
}

function resize(src, target, size, username, res) {
  im.resize({
    srcPath: src,
  dstPath: target,
  width:   size
  }, function(err, stdout, stderr) {
    if(err) return;
    //console.log('resized %s to %d', src, size);
    if(200 < size) {
      im.convert(
        [
        target,
        '-gravity','southeast',
        '-fill','white',
        '-pointsize','16',
        '-draw','text 5,5 '+username,
        target
        ],function(err, metadata) {
          if(err) return;     
          im.convert(
            [
            target,
            imgCon.dir + 'logo.png',
            '-gravity','northwest',
            '-geometry','+5+10',
            '-composite',
            target
            ],function(err, metadata) {
              if(err) return;      
            }
          );
        }
      );
    }
  });
}
