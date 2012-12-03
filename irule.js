var fs = require('fs'),
    log4js = require('log4js'),
    redis = require('redis').createClient(18088);

exports.conf = conf = {};
try{
  conf = JSON.parse(fs.readFileSync(__dirname+'/conf/iproxy.json'));
}catch(error){
  console.error(error);
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

var whitelist = [];
var blacklist = [];
var iplist = [];

var whitelistfile = __dirname+'/conf/whitelist';
var blacklistfile = __dirname+'/conf/blacklist';
var iplistfile = __dirname+'/conf/iplist';

var update_blacklist_timeout = null;
var update_whitelist_timeout = null;
var update_iplist_timeout = null;

var update_delay = 500;

fs.watchFile(whitelistfile,function(curr,prev){
  if(update_whitelist_timeout){
    clearTimeout(update_whitelist_timeout);
  }
  update_whitelist_timeout = setTimeout(function(){
    update_whitelist();
  },update_delay);
});

fs.watchFile(blacklistfile,function(curr,prev){
  if(update_blacklist_timeout){
    clearTimeout(update_blacklist_timeout);
  }
  update_blacklist_timeout = setTimeout(function(){
    update_blacklist();
  },update_delay);
});

fs.watchFile(iplistfile,function(curr,prev){
  if(update_iplist_timeout){
    clearTimeout(update_iplist_timeout);
  }
  update_iplist_timeout = setTimeout(function(){
    update_iplist();
  },update_delay);
});

function loadRegExps(filename){
  return fs.readFileSync(filename,'utf8')
    .split('\n')
    .filter(function(line){return line.length>1&&line[0]!=='#'})
    .map(function(line){return RegExp('^'+line+'.*')});
};

function update_blacklist(){
  blacklist = loadRegExps(blacklistfile);
  logger.trace('---- update blacklist');
  logger.trace(blacklist);
};

function update_whitelist(){
  whitelist = loadRegExps(whitelistfile);
  logger.trace('---- update whitelist');
  logger.trace(whitelist);
};

function update_iplist(){
  iplist = loadRegExps(iplistfile);
  logger.trace('---- update iplist');
  logger.trace(iplist);
};

update_blacklist();
update_whitelist();
update_iplist();

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
  for(var i=0;i<whitelist.length;++i){
    if(whitelist[i].test(srcurl)){
      return srcurl;
    }
  }
  for(var i=0;i<blacklist.length;++i){
    if(blacklist[i].test(srcurl)){
      return false;
    }
  }
  return srcurl;
};

exports.ipfilter = function ipfilter(ip){
  if(!ip){
    return false;
  }
  for(var i=0;i<iplist.length;++i){
    if(iplist[i].test(ip)){
      return true;
    }
  }
  return false;
};

