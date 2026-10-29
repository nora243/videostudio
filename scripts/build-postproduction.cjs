const path=require('node:path');
const fs=require('node:fs');
const upstream=path.resolve(process.argv[2]||'E:/Projects/gemini-watermark-remover');
const esbuild=require(path.join(upstream,'node_modules/esbuild'));
esbuild.buildSync({stdin:{contents:`export {removeGeminiVideoWatermark,inspectGeminiVideoFile} from './src/video/videoExport.js';export {concatenateVideos} from './src/video/videoConcatenate.js';`,resolveDir:upstream,sourcefile:'videostudio-entry.js'},bundle:true,format:'esm',platform:'browser',minify:true,outfile:path.resolve('src/vendor/gwr/video-engine.js')});
fs.writeFileSync('src/vendor/gwr/NOTICE.md','Video engine bundled from gemini-watermark-remover (MIT). See LICENSE.\nBuild: node scripts/build-postproduction.cjs <upstream checkout>\nBundled on '+new Date().toISOString()+'\n');
