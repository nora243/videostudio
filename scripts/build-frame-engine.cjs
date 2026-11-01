const fs=require('node:fs'),path=require('node:path');
const upstream=path.resolve(process.argv[2]||'E:/Projects/gemini-watermark-remover');
const esbuild=require(path.join(upstream,'node_modules/esbuild'));
esbuild.buildSync({stdin:{contents:fs.readFileSync(path.join(__dirname,'frame-engine-entry.mjs'),'utf8'),resolveDir:upstream,sourcefile:'videostudio-frame-entry.js'},bundle:true,format:'esm',platform:'browser',minify:true,outfile:path.resolve('src/vendor/gwr/frame-engine.js')});
