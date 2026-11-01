import {ALL_FORMATS,BlobSource,Input,VideoSampleSink} from 'mediabunny';
import {detectVideoWatermarkFromFramesAsync,scoreVideoWatermarkFrame} from './src/video/videoWatermarkDetector.js';
import {removeWatermark} from './src/core/blendModes.js';
import {applyVideoResidualCleanup} from './src/video/videoCleanupBackends.js';

export async function extractCleanVideoFrame(file,{selection='time',seconds=0}={}){
 const input=new Input({formats:ALL_FORMATS,source:new BlobSource(file)});
 try{
  const track=await input.getPrimaryVideoTrack();if(!track)throw Error('Video không có luồng hình ảnh.');
  const [width,height,first,duration]=await Promise.all([track.getDisplayWidth(),track.getDisplayHeight(),track.getFirstTimestamp(),track.computeDuration({skipLiveWait:true})]);
  if(!width||!height||!Number.isFinite(duration)||duration<=0)throw Error('Không đọc được kích thước/thời lượng video.');
  const target=selection==='first'?first:selection==='last'?first+duration:first+Math.min(Math.max(0,seconds),duration);
  const sink=new VideoSampleSink(track),sample=await sink.getSample(target);if(!sample)throw Error('Không đọc được khung hình tại vị trí đã chọn.');
  const canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});
  let actualSeconds;
  try{sample.draw(ctx,0,0,width,height);actualSeconds=Math.max(0,sample.timestamp-first);}finally{sample.close();}
  const original=ctx.getImageData(0,0,width,height),frames=[{timestamp:first+actualSeconds,imageData:original}];
  for(const timestamp of [first,first+duration/3,first+duration*2/3,first+duration]){
   if(Math.abs(timestamp-first-actualSeconds)<.001)continue;
   const neighbor=await sink.getSample(timestamp);if(!neighbor)continue;
   try{neighbor.draw(ctx,0,0,width,height);frames.push({timestamp:neighbor.timestamp,imageData:ctx.getImageData(0,0,width,height)});}finally{neighbor.close();}
  }
  const detection=await detectVideoWatermarkFromFramesAsync({frames,width,height,yieldToMainThread:()=>new Promise(r=>setTimeout(r,0))});
  const score=scoreVideoWatermarkFrame(original,detection.position,detection.alphaMap);
  const cleaned=Boolean(detection.isConfident&&score.confidence>=.035);
  ctx.putImageData(original,0,0);
  if(cleaned){
   removeWatermark(original,detection.alphaMap,detection.position,{alphaGain:detection.alphaSeed?.seedGain||1});
   ctx.putImageData(original,0,0);
   applyVideoResidualCleanup(ctx,detection.position,detection.alphaMap,{denoiseBackend:'none',textureRepair:false,highQualityCleanup:true});
  }
  const blob=await canvas.convertToBlob({type:'image/png'});
  return {blob,report:{width,height,actualSeconds,requestedSeconds:seconds,selection,watermarkChecked:true,watermarkRemoved:cleaned,watermarkKind:detection.watermarkKind,confidence:score.confidence,position:detection.position,status:cleaned?'cleaned':'not-detected'}};
 }finally{input.dispose();}
}
