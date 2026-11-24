// Local PCM-to-MP3 conversion, no external API.
export function wavToMp3(wav){
 const d=new DataView(wav);if(d.byteLength<44||d.getUint32(0)!==0x52494646||d.getUint32(8)!==0x57415645)throw Error('WAV inválido.');
 let fmt=null,start=0,length=0;
 for(let i=12;i+8<=d.byteLength;){const kind=d.getUint32(i),n=d.getUint32(i+4,true),p=i+8;if(p+n>d.byteLength)throw Error('Áudio incompleto.');
  if(kind===0x666d7420&&n>=16)fmt={format:d.getUint16(p,true),channels:d.getUint16(p+2,true),rate:d.getUint32(p+4,true),bits:d.getUint16(p+14,true)};
  if(kind===0x64617461){start=p;length=n;break;}i=p+n+(n%2);}
 if(!fmt||fmt.format!==1||fmt.channels!==1||fmt.bits!==16||!length||length%2!==0)throw Error('Formato PCM incompatível.');
 const encoder=new window.lamejs.Mp3Encoder(1,fmt.rate,64),chunks=[];
 for(let i=0;i<length/2;i+=1152){const n=Math.min(1152,length/2-i),pcm=new Int16Array(n);for(let k=0;k<n;k++)pcm[k]=d.getInt16(start+(i+k)*2,true);const out=encoder.encodeBuffer(pcm);if(out.length)chunks.push(new Uint8Array(out));}
 const tail=encoder.flush();if(tail.length)chunks.push(new Uint8Array(tail));return new Blob(chunks,{type:'audio/mpeg'});
}