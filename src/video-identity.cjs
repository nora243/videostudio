const{referenceIdentity}=require('./reference-identity.cjs');
function videoIdentity(source){const known=referenceIdentity(source);if(known)return known;try{const url=new URL(source),id=url.pathname.split('/').pop();return url.protocol==='https:'&&/^[a-zA-Z0-9_-]{1,120}$/.test(id)?id:null;}catch{return null;}}
function normalizeVideoId(id){if(typeof id!=='string')return null;if(id.startsWith('asb:'))return videoIdentity('https://flow.google.com/asb/'+id.slice(4));if(/^[a-zA-Z0-9_-]{20,}=[a-zA-Z0-9,.-]+$/.test(id))return videoIdentity('https://flow.google.com/asb/'+id);return /^[a-zA-Z0-9_-]{1,120}$/.test(id)?id:null;}
function assetSelector(id){id=normalizeVideoId(id);if(!id)throw Error('Mã video Flow không hợp lệ.');const token=id.startsWith('asb:')?id.slice(4):id;const segment=id.startsWith('asb:')?'/asb/'+token:'/'+token;return `video[src*="${segment}"],img[src*="${segment}"]`;}
module.exports={videoIdentity,assetSelector,normalizeVideoId};
