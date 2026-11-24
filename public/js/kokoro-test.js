import {wavToMp3} from './tv-audio-codec.js?v=1';
const $=id=>document.getElementById(id);
let worker=null,url='',timer=null;
function status(message){$('status').textContent=message;}
function finish(){clearTimeout(timer);$('generate').disabled=false;$('progress').hidden=true;}
function failed(message){finish();$('play').disabled=true;status('Não foi possível gerar a voz: '+message);if(worker){worker.terminate();worker=null;}}
function getWorker(){
 if(worker)return worker;
 worker=new Worker('/js/kokoro-test-worker.js?v=1',{type:'module'});
 worker.onerror=e=>failed(e.message||'Motor neural incompatível com este navegador.');
 worker.onmessage=({data:d})=>{
  if(d.type==='status'){status(d.message);if(Number.isFinite(d.progress)){$('progress').hidden=false;$('progress').value=d.progress;}else $('progress').hidden=true;return;}
  if(d.type==='error'){failed(d.message);return;}
  if(d.type==='audio'){try{const blob=wavToMp3(d.wav);if(!blob.size)throw Error('Áudio vazio.');if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);$('player').src=url;$('play').disabled=false;finish();status('Áudio neural pronto! Gerado em '+d.seconds.toFixed(1)+' segundos. Aperte Ouvir voz em MP3.');}catch(e){failed(e.message);}}
 };
 return worker;
}
$('generate').onclick=()=>{
 $('generate').disabled=true;$('play').disabled=true;$('player').pause();status('Inicializando modelo neural…');
 try{if(!window.WebAssembly)throw Error('WebAssembly indisponível.');if(!window.lamejs)throw Error('Codificador MP3 não carregado.');getWorker().postMessage({voice:$('voice').value,text:$('sample').value});timer=setTimeout(()=>failed('Tempo limite de 5 minutos. A TV pode não ter memória ou potência suficiente.'),300000);}catch(e){failed(e.message);}
};
$('play').onclick=()=>{try{const a=$('player');a.currentTime=0;const p=a.play();if(p&&p.catch)p.catch(e=>status('O navegador não conseguiu reproduzir: '+e.message));}catch(e){status(e.message);}};
$('player').onplaying=()=>status('Reproduzindo voz neural em MP3…');
$('player').onended=()=>status('Teste concluído. Escolha outra voz para comparar.');
$('player').onerror=()=>status('Erro de reprodução do MP3. Código '+($('player').error?.code||'?'));
window.addEventListener('pagehide',()=>{if(worker)worker.terminate();if(url)URL.revokeObjectURL(url);});
status('Pronto para testar. O primeiro download pode ser grande.');