// Pinned official browser distribution. No esm.sh dependency.
let runtime;
export async function loadRuntime(){
 if(runtime)return runtime;
 const candidates=[
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.web.js',
  'https://unpkg.com/@huggingface/transformers@3.5.1/dist/transformers.web.js'
 ];
 let errors=[];
 for(const url of candidates){try{
  const m=await import(url);
  if(!m.StyleTextToSpeech2Model||!m.AutoTokenizer||!m.Tensor)throw Error('Distribuição incompleta');
  m.env.allowLocalModels=false;
  m.env.backends.onnx.wasm.numThreads=1;
  m.env.backends.onnx.wasm.proxy=false;
  runtime=m;return m;
 }catch(e){errors.push(new URL(url).hostname+': '+e.message);}}
 throw Error('Motor Transformers.js não carregou ('+errors.join('; ')+').');
}
const m=await loadRuntime();
export const {StyleTextToSpeech2Model,AutoTokenizer,Tensor}=m;