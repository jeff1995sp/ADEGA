let engine=null,busy=false;
const report=(message,progress)=>self.postMessage({type:'status',message,progress});
self.onmessage=async({data})=>{
 if(busy)return;busy=true;
 try{
  if(!['dora','alex','santa'].includes(data.voice)||typeof data.text!=='string'||data.text.length>200)throw Error('Teste inválido.');
  if(!engine){report('Carregando biblioteca de voz em português…');
   const {Vozz}=await import('https://esm.sh/@pedrobef/vozz@0.3.0?bundle&deps=@huggingface/transformers@3.5.2');
   if(!Vozz?.carregar)throw Error('Biblioteca de voz indisponível.');
   engine=await Vozz.carregar({dispositivo:'wasm',precisao:'q8',aoProgredir:p=>{const percent=Number.isFinite(p.progresso)?Math.round(p.progresso*100):undefined;report('Preparando modelo'+(p.arquivo?' — '+p.arquivo:'')+(percent===undefined?'':' • '+percent+'%'),percent);}});
  }
  report('Gerando fala neural em português…');const start=performance.now();
  const audio=await engine.falar(data.text,{voz:data.voice,velocidade:0.95});
  const wav=audio.paraWav();if(!(wav instanceof ArrayBuffer)||wav.byteLength<44)throw Error('Áudio inválido.');
  self.postMessage({type:'audio',wav,seconds:(performance.now()-start)/1000},[wav]);
 }catch(e){self.postMessage({type:'error',message:e.message||String(e)});}finally{busy=false;}
};