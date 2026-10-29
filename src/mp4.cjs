const fs = require('node:fs');
function inspectMp4(filename, {maxBytes=512 * 1024 * 1024}={}) {
  const size = fs.statSync(filename).size;
  if (size < 1000 || size > maxBytes) throw new Error('Tệp video rỗng, quá nhỏ hoặc vượt giới hạn dung lượng.');
  let data;
  let ftyp = false, moov = false, mdat = false, duration = 0, width = 0, height = 0;
  if(size<=512*1024*1024)data=fs.readFileSync(filename);
  else{
    // Large assembled films: read metadata only, skip the encoded media payload.
    const fd=fs.openSync(filename,'r'),headerBytes=Buffer.alloc(16);
    try{let pos=0;while(pos+8<=size){if(fs.readSync(fd,headerBytes,0,Math.min(16,size-pos),pos)<8)throw Error('MP4 header lỗi.');let length=headerBytes.readUInt32BE(0),header=8;const type=headerBytes.toString('ascii',4,8);if(length===1){if(pos+16>size)throw Error('MP4 header lỗi.');length=Number(headerBytes.readBigUInt64BE(8));header=16;}if(length===0)length=size-pos;if(!Number.isSafeInteger(length)||length<header||pos+length>size)throw Error('MP4 bị cắt cụt hoặc không hợp lệ.');if(type==='ftyp')ftyp=true;if(type==='mdat')mdat=true;if(type==='moov'){if(length>64*1024*1024)throw Error('Metadata MP4 quá lớn.');data=Buffer.alloc(length);let read=0;while(read<length){const n=fs.readSync(fd,data,read,length-read,pos+read);if(!n)throw Error('Metadata MP4 bị cắt cụt.');read+=n;}}pos+=length;}if(!data)throw Error('Không tìm thấy metadata MP4.');}finally{fs.closeSync(fd);}
  }
  function boxes(start, end) {
    let pos = start;
    while (pos + 8 <= end) {
      let length = data.readUInt32BE(pos), header = 8;
      const type = data.toString('ascii', pos + 4, pos + 8);
      if (length === 1) { if (pos + 16 > end) throw new Error('MP4 header lỗi.'); length = Number(data.readBigUInt64BE(pos + 8)); header = 16; }
      if (length === 0) length = end - pos;
      if (length < header || pos + length > end) throw new Error('MP4 bị cắt cụt hoặc không hợp lệ.');
      const payload = pos + header;
      if (type === 'ftyp') ftyp = true;
      if (type === 'mdat') mdat = true;
      if (type === 'moov') { moov = true; boxes(payload, pos + length); }
      if (type === 'trak') boxes(payload, pos + length);
      if (type === 'mvhd' && length >= header + 32) {
        const version = data[payload];
        const scale = data.readUInt32BE(payload + (version === 1 ? 20 : 12));
        const ticks = version === 1 ? Number(data.readBigUInt64BE(payload + 24)) : data.readUInt32BE(payload + 16);
        if (scale) duration = ticks / scale;
      }
      if (type === 'tkhd' && length >= header + 80) {
        const w = data.readUInt32BE(pos + length - 8) / 65536, h = data.readUInt32BE(pos + length - 4) / 65536;
        if (w && h) { width = Math.round(w); height = Math.round(h); }
      }
      pos += length;
    }
  }
  boxes(0, data.length);
  if (!ftyp || !moov || !mdat || !duration || !width || !height) throw new Error('Không đọc được metadata video MP4 hợp lệ.');
  return { size, duration, width, height, validation:'MP4 container/metadata; chưa kiểm tra giải mã toàn bộ' };
}
module.exports = { inspectMp4 };
