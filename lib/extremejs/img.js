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
      max_field_size : 1 * 1024 * 1024, 
      max_file_size : 6 * 1024 * 1024
    };

exports.cropImg = function(req, res, cb){
  var fields = [],
      files  = [],
      rs     = {code:400},
      form   = new formidable.IncomingForm();
  form.maxFieldsSize = imgCon.max_size;
  form.keepExtensions = true;
  form.uploadDir = imgCon.dir;
  form.on('field', function(field, value) {
    fields.push(value);
  }).on('file', function(name, file) {
    if(file.size > imgCon.max_file_size) rs.code = 413;
    files.push(file);
  }).on('end', function() {
    var file = files[0],
        field = fields[0];
    if(!file.name||!field||413==rs.code) {
      fs.unlink(file.path);  
      cb(rs);
      return;
    }
    if(-1 < file.type.indexOf('image/jpeg') || -1 < file.type.indexOf('image/png')) {
      var fn = imgCon.dir + '/' + file.name;
      fs.rename(file.path, fn);
      rs.slice = {};
      for(var j in sizes) {
        var fnr = file.name.replace(/(\.\w+?)$/,'_' + sizes[j] + '_' + new Date().getTime() + '$1');
        resize(fn, imgCon.dir + fnr, sizes[j], field, res);
        rs.slice[j] = 'http://test.favspot.net/image_temp/' + fnr;
      }
      rs.code = 201;
    } else {
      rs.code = 415;
    }    
    cb(rs);
  }).on('error',function(err) {
    //cb(rs);
    throw error;    
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
