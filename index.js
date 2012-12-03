var http = require('http'),
    url = require('url'),
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
    console.warn('[DENY] - %s%s - %s',clienturl.host,clienturl.path,cip);
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
  function end(){
    irule.footprint(
      proxyreqopts.hostname,
      clienturl.pathname,
      clienturl.query,
      proxyreqopts.headers.cookie,
      cip, l, Date.now()-t);
    clientres.end();
  }
  var proxyreq = http.request(proxyreqopts,function(proxyres){
    clientres.writeHead(proxyres.statusCode,proxyres.headers);
    proxyres.on('data',function(chunk){
      clientres.write(chunk);
      l += chunk.length;
    });
    proxyres.on('end',function(){
      end();
    });
    proxyres.on('close',function(){
      end();
    });
  });
  proxyreq.on('error',function(){
    end();
  });
  proxyreq.end();
});

proxyserver.listen(8088);

