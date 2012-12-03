var http = require('http'),
    url = require('url');

var proxyserver = http.createServer(function(clientreq,clientres){
  var clienturl = url.parse(clientreq.url);
  var proxyreqopts = {
    host: clienturl.host,
    hostname: clienturl.hostname,
    port: clienturl.port?clienturl.port:80,
    path: clienturl.path,
    method: clientreq.method,
    headers: clientreq.headers,
  };
  //console.log(proxyreqopts);
  console.log(clientreq.headers);
  http.request(proxyreqopts,function(proxyres){
    clientres.end('fine,iproxy!');
  });
});

proxyserver.listen(8088);

