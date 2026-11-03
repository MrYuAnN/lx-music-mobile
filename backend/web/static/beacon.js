/* beacon.js 官网匿名埋点单源（看板补齐批 2026-11-03 代码审优化 S-2：5 页内联
   抽单文件，白名单/字段调整只改此处——GA/Matomo 官方 snippet 单文件引用惯例；
   净屏 index.html 同构同源相对路径适配——官网与 API 同进程无跨域）。
   localStorage 随机访客 id（sy_vid）+ ?from= 渠道首触（sy_from，白名单与服务端
   SanitizeChannel 一致）；fire-and-forget 失败静默。 */
(function(){var k='sy_vid',v;
 try{v=localStorage.getItem(k);if(!v){v='v'+Math.random().toString(36).slice(2,10)+Date.now().toString(36);localStorage.setItem(k,v)}}catch(e){v=''}
 var f='';try{f=localStorage.getItem('sy_from');if(!f){var q=new URLSearchParams(location.search).get('from');if(q&&/^[a-z0-9_-]{1,32}$/.test(q)){localStorage.setItem('sy_from',q);f=q}}}catch(e){f=''}
 function post(path,body,keep){try{var o={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};if(keep)o.keepalive=true;fetch(path,o).catch(function(){})}catch(e){}}
 // 匿名浏览量(PV/UV)：localStorage 随机访客 id + 当前路径
 if(v)post('/site/visit',{visitor_id:v,page:location.pathname,ref:document.referrer||'',from:f||''});
 // 下载点击统计（B 方案，净屏 __jpTrackDownload 同构）：keep=true 防 a 标签
 // 导航取消请求丢点（审查 S-6）；download.html #dl-main onclick 接线
 window.__syTrackDownload=function(){if(v)post('/site/download',{visitor_id:v},true)};
})();
