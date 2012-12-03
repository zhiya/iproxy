var http = require('http'),
    url = require('url'),
    irule = require('./irule');

var proxyserver = http.createServer(function(clientreq,clientres){
  var clienturl = url.parse(clientreq.url);

  var reqhostname = irule.transfilter(clienturl.hostname);
  if(!reqhostname){
    console.warn('DENIED: %s',clienturl.hostname);
    clientres.writeHead(404);
    return clientres.end();
  }

  var proxyreqopts = {
    //ost: clienturl.host,
    hostname: reqhostname,
    port: clienturl.port?clienturl.port:80,
    path: clienturl.path,
    method: clientreq.method,
    headers: clientreq.headers,
  };

  var t = Date.now();
  var l = 0;
  function end(){
    irule.trace(
      proxyreqopts.hostname,
      clienturl.pathname,
      clienturl.query,
      proxyreqopts.headers.cookie,
      l,
      Date.now()-t);
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

