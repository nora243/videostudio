/* Compare the media identity, not thumbnail resize parameters or signed query strings. */
function referenceIdentity(source){
 try{const url=new URL(source);if(url.protocol!=='https:')return null;const tail=url.pathname.split('/').pop();
  if(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(tail))return tail.toLowerCase();
  if(url.hostname==='flow.google.com'&&url.pathname.startsWith('/asb/')){
   const token=url.pathname.slice(5).split('=')[0];if(/^[a-z0-9_-]{20,}$/i.test(token))return 'asb:'+token;
  }
 }catch{}return null;
}
module.exports={referenceIdentity};
