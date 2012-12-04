var http = require('http'),
    url = require('url'),
    fs = require('fs'),
    irule = require('./irule');

var proxyserver = http.createServer(function(clientreq,clientres){
  var cip = clientreq.socket.remoteAddress;
  if(clientreq.headers.hasOwnProperty('x-forwarded-for')){
    cip = clientreq.headers['x-forwarded-for'];
  }
  if(!irule.ipfilter(cip)){
    clientres.writeHead(403);
    return clientres.end();
  }

  var clienturl = url.parse(clientreq.url);
  var requrl = irule.filter(clienturl.host+clienturl.path);

  if(!requrl){
    irule.logger.info('[DENY] - %s%s - %s',clienturl.host,clienturl.path,cip);
    clientres.writeHead(404);
    return clientres.end();
  }

  var proxyreqopts = {
    host: clienturl.host,
    hostname: clienturl.hostname,
    port: clienturl.port?clienturl.port:80,
    path: clienturl.path,
    method: clientreq.method,
    headers: clientreq.headers,
  };

  var t = Date.now();
  var l = 0;
  var cfd = null;

  function cleanup(){
    irule.footprint(
      proxyreqopts.hostname,
      clienturl.pathname,
      clienturl.query,
      proxyreqopts.headers.cookie,
      cip, l, Date.now()-t);
    if(cfd){
      fs.close(cfd);
    }
    clientres.end();
  }
  var proxyreq = http.request(proxyreqopts,function(proxyres){
    if(irule.cachefilter(proxyres.headers['content-type'])){
      var cachepath = clienturl.hostname+clienturl.pathname;
      cfd = irule.openCacheFile(cachepath);
      if(cfd){
        irule.logger.trace('[CACHE] - %s',cachepath);
      }
    }
    clientres.writeHead(proxyres.statusCode,proxyres.headers);
    proxyres.on('data',function(chunk){
      clientres.write(chunk);
      if(cfd){
        fs.write(cfd,chunk,0,chunk.length,l);
      }
      l += chunk.length;
    });
    proxyres.on('end',function(){
      cleanup();
    });
    proxyres.on('close',function(){
      cleanup();
    });
  });
  proxyreq.on('error',function(){
    cleanup();
  });
  proxyreq.end();
});

proxyserver.listen(8088);

