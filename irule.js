var fs = require('fs'),
    log4js = require('log4js'),
    redis = require('redis').createClient(18088);

exports.conf = conf = {};
try{
  conf = JSON.parse(fs.readFileSync(__dirname+'/conf/iproxy.json'));
}catch(error){
  console.error('parsing iproxy.json: %s',error);
  process.exit(-1);
}

log4js.loadAppender('file');
log4js.loadAppender('multiprocess');
log4js.clearAppenders();
log4js.addAppender(log4js.appenders.multiprocess({
  mode: 'master',
  actualAppender: log4js.appenders.file(conf.log.path)
}),'iproxy');
exports.logger = logger = log4js.getLogger('iproxy');
logger.setLevel(conf.log.level);

function loadRegExps(filename){
  return fs.readFileSync(filename,'utf8')
    .split('\n')
    .filter(function(line){return line.length>1&&line[0]!=='#'})
    .map(function(line){return RegExp('^'+line+'.*')});
};

function WatchListConf(file){
  if(!(this instanceof WatchListConf)){
    return new WatchListConf(file);
  }
  this.list = [];
  this.file = file;
  this.path = __dirname+'/conf/'+file;
  this.update_timeout = null;
  this.update = (function(self){
    return function(){
      self.list = loadRegExps(self.path);
      logger.trace('[UPDATE CONF] - %s',self.file);
      logger.trace(self.list);
    };
  })(this);

  var self = this;

  fs.watchFile(self.path,function(curr,prev){
    if(self.update_timeout){
      clearTimeout(self.update_timeout);
    }
    self.update_timeout = setTimeout(self.update,500);
  });

  this.update();
};

var confs = {
  white: new WatchListConf('whitelist'),
  black: new WatchListConf('blacklist'),
  ip: new WatchListConf('iplist'),
  cache: new WatchListConf('cachelist'),
};

exports.footprint = function footprint(hostname,pathname,parameters,cookie,clientip,bodylen,usedtime){
  logger.trace('[PROXY] - %s%s%s - %s/%d/%d',
    hostname,
    pathname?pathname:'',
    parameters?parameters:'',
    clientip,
    bodylen,
    usedtime/1000);
  redis.hincrby(clientip,hostname,1,function(error,res){
    if(error){
      logger.error(error);
    }
  });
};

exports.filter = function filter(srcurl){
  if(!srcurl){
    return false;
  }
  var wl = confs.white.list;
  for(var i=0;i<wl.length;++i){
    if(wl[i].test(srcurl)){
      return srcurl;
    }
  }
  var bl = confs.black.list;
  for(var i=0;i<bl.length;++i){
    if(bl[i].test(srcurl)){
      return false;
    }
  }
  return srcurl;
};

exports.ipfilter = function ipfilter(ip){
  if(!ip){
    return false;
  }
  var il = confs.ip.list;
  for(var i=0;i<il.length;++i){
    if(il[i].test(ip)){
      return true;
    }
  }
  return false;
};

exports.cachefilter = function cachefilter(contentType){
  if(!contentType){
    return false;
  }
  var cl = confs.cache.list;
  for(var i=0;i<cl.length;++i){
    if(cl[i].test(contentType)){
      return true;
    }
  }
  return false;
};

exports.openCacheFile = function openCacheFile(filename){
  var pathsegs = filename.split('/').filter(function(seg){return seg.length});
  var ipath = conf.cache.path;
  for(var i=0;i<pathsegs.length;++i){
    ipath += '/';
    ipath += pathsegs[i];
    if(i===pathsegs.length-1){
      break;
    }
    try{
      fs.mkdirSync(ipath);
    }catch(error){}
  }
  return fs.openSync(ipath,'w');
};

