var fs = require('fs');

var leaklist = [];
var transtable = {};

function load_transtable(){
  leaklist = [];
  transtable = {};
  fs.readFileSync(__dirname+'/conf/transtable.ip','utf8')
    .split('\n')
    .filter(function(line){return line.length;})
    .map(function(line){
      var segs = line.split(' ').filter(function(el){return el.length});
      if(segs.length===0){
        return false;
      }
      var p1 = segs[0].trim();
      var p2 = segs.length>=2?segs[1].trim():false;
      switch(p1){
      case '-':
        transtable[p2] = false;
        break;
      case '+':
        leaklist.push(RegExp(p2));
        break;
      default:
        transtable[p1] = p2;
        break;
      }
      return true;
    });

  console.log('-- leak list --');
  console.log(leaklist);
  console.log('-- transtable --');
  console.log(transtable);
}

load_transtable();

exports.trace = function trace(hostname,pathname,parameters,cookie,bodylen,usedtime){
  console.log('%s%s%s - %d/%d',hostname,pathname?pathname:'',parameters?parameters:'',bodylen,usedtime/1000);
};

exports.transfilter = function transfilter(srcurl){
  if(!srcurl){
    return false;
  }
  for(var i=0;i<leaklist.length;++i){
    if(leaklist[i].test(srcurl)){
      return srcurl;
    }
  }
  for(var k in transtable){
    var r = RegExp(k);
    if(r.test(srcurl)){
      return transtable[k];
    }
  }
  return srcurl;
};

