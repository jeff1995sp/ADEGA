import {api,esc,pad,toast,setBrand} from './shared.js?v=20261124-auth';
import {wavToMp3} from './tv-audio-codec.js?v=1';
const $=id=>document.getElementById(id);
const STORAGE='adega_tv_code_v1', VOICES='adega_tv_voices_v1';
let tvCode='',soundEnabled=false,started=false,seen=new Set(),voiceList=[],queue=[],speaking=false,checking=false,connected=false,retryAt=0;
try{tvCode=localStorage.getItem(STORAGE)||'';}catch{}
let voicePrefs={female:'',male:''};
let tvPage=0,lastOrders=[],tvSnapshot='',demandActive=false,lastDemandSpeech=null;
let idleEnabled=true;try{idleEnabled=localStorage.getItem('adega_tv_idle_v1')!=='off';}catch{}
function updateIdle(){const active=idleEnabled&&connected&&!demandActive&&retryAt===0&&lastOrders.length===0;$('tvIdle').classList.toggle('hidden',!active);$('tvBoard').classList.toggle('tv-is-idle',active);}
let voiceMode='auto',localVoicePromise=null,localVoiceReady=false,localAudioUrl='',speechGeneration=0,finishTimer=null;
try{voiceMode=localStorage.getItem('adega_tv_voice_mode_v1')||'auto';}catch{}
if(!['auto','audio','wav','native'].includes(voiceMode))voiceMode='auto';
const nativeSpeech=()=>('speechSynthesis' in window)&&('SpeechSynthesisUtterance' in window);
const useLocalAudio=()=>(voiceMode==='audio'||voiceMode==='wav')||(voiceMode==='auto'&&(!nativeSpeech()||!voiceList.some(v=>/^pt(?:-|_)/i.test(v.lang))));
function loadLocalVoice(){
 if(localVoicePromise)return localVoicePromise;
 localVoicePromise=(async()=>{
  if(!window.meSpeak)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/mespeak/mespeak.js';script.onload=resolve;script.onerror=()=>reject(Error('Motor de voz indisponível.'));document.head.appendChild(script);});
  const engine=window.meSpeak;if(!engine)throw Error('Motor de voz não iniciou.');
  if(!window.lamejs)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/lamejs/lame.min.js';script.onload=resolve;script.onerror=()=>reject(Error('Codificador MP3 indisponível.'));document.head.appendChild(script);});
  if(!window.lamejs||!window.lamejs.Mp3Encoder)throw Error('Codificador MP3 não iniciou.');
  if(!engine.isConfigLoaded())engine.loadConfig('/vendor/mespeak/mespeak_config.json');
  if(!engine.isVoiceLoaded('pt'))engine.loadVoice('/vendor/mespeak/voices/pt.json');
  await new Promise((resolve,reject)=>{const deadline=Date.now()+20000;function check(){if(engine.isConfigLoaded()&&engine.isVoiceLoaded('pt'))return resolve();if(Date.now()>=deadline)return reject(Error('Voz em português indisponível.'));setTimeout(check,100);}check();});
  localVoiceReady=true;
 })().catch(e=>{localVoicePromise=null;localVoiceReady=false;throw e;});
 return localVoicePromise;
}
function clearAudio(){
 const a=$('tvVoiceAudio');a.onended=null;a.onerror=null;a.onplaying=null;a.pause();a.removeAttribute('src');if(localAudioUrl){URL.revokeObjectURL(localAudioUrl);localAudioUrl='';}
}
function stopSpeech(){speechGeneration++;clearTimeout(finishTimer);if(nativeSpeech())speechSynthesis.cancel();clearAudio();queue=[];speaking=false;}
let soundNoticeTimer;
function audioNotice(message,persistent=false){
 const notice=$('tvAudioNotice');notice.textContent=message;notice.classList.remove('hidden');clearTimeout(soundNoticeTimer);if(!persistent)soundNoticeTimer=setTimeout(()=>notice.classList.add('hidden'),8000);
}
function updateSoundUI(message){
 $('activateSound').setAttribute('aria-label',soundEnabled?'Desativar chamadas por voz':'Ativar chamadas por voz');
 $('activateSound').classList.toggle('sound-on',soundEnabled);
 const label=$('activateSound').querySelector('.hora-tv-sound-label');if(label)label.textContent=soundEnabled?'🔊 Voz ativada':'🔊 Ativar voz';
 $('tvAudioToggle').textContent=soundEnabled?'Desativar voz':'Ativar voz';
 if(message)audioNotice(message);
 $('soundStatus').textContent=message||(soundEnabled?(useLocalAudio()?'🔊 Chamadas por áudio ativadas':'🔊 Chamadas por voz ativadas'):'🔇 Chamadas por voz desativadas');
}
function preloadLocalVoice(){if(useLocalAudio())loadLocalVoice().catch(()=>{if(!soundEnabled)updateSoundUI('⚠ Áudio local indisponível. Toque em Ativar voz para tentar novamente.');});}
const DEMAND_INTERVAL=5*60*1000;
const DEMAND_MESSAGE='Atenção! Estamos com alta demanda. Seu pedido pode demorar um pouco mais que o normal. Obrigado pela compreensão.';
try{voicePrefs=JSON.parse(localStorage.getItem(VOICES)||'{}');}catch{}
const smallTicket=o=>`<article class="tv-ticket"><div class="tv-ticket-number"><span>PEDIDO</span><b>${pad(o.number)}</b></div><div class="tv-ticket-body"><strong class="${String(o.public_name||'').length>25?'tv-name-long':''}">${esc(o.public_name)}</strong><span class="tv-ticket-status">${o.status==='ready'?'Pode retirar no portão':o.status==='preparing'?'Na preparação':'Pedido recebido'}</span></div></article>`;
function showAuth(){ $('tvAuth').classList.remove('hidden');$('tvBoard').classList.add('hidden'); }
function tvError(message){$('tvLoginError').textContent=message;}
function tvClearCode(){soundEnabled=false;stopSpeech();updateSoundUI();try{localStorage.removeItem(STORAGE);}catch{}tvCode='';connected=false;started=false;seen.clear();lastOrders=[];tvSnapshot='';setDemand(false);updateIdle();}
function showBoard(){ $('tvAuth').classList.add('hidden');$('tvBoard').classList.remove('hidden'); }
function updateVoices(){
  if(!('speechSynthesis' in window))return;
  voiceList=speechSynthesis.getVoices().filter(v=>/^pt(?:-|_)/i.test(v.lang));
  if(!voiceList.length)voiceList=speechSynthesis.getVoices();
  for(const type of ['female','male']){
    const el=$(type==='female'?'femaleVoice':'maleVoice');
    el.innerHTML='<option value="">Voz padrão do aparelho</option>'+voiceList.map(v=>`<option value="${esc(v.voiceURI)}">${esc(v.name)} (${esc(v.lang)})</option>`).join('');
    el.value=voicePrefs[type]||'';
  }
}
function chooseVoice(type){
  const uri=voicePrefs[type];
  if(uri){const v=voiceList.find(x=>x.voiceURI===uri);if(v)return v;}
  const re=type==='male'?/daniel|ricardo|paulo|jo[aã]o|felipe|male|masculin/i:/luciana|fernanda|maria|vitoria|vit[oó]ria|female|feminin/i;
  return voiceList.find(v=>re.test(v.name))||voiceList[0]||null;
}
function say(text,type){
 const generation=++speechGeneration;speaking=true;
 const finish=(error)=>{if(generation!==speechGeneration)return;speechGeneration++;clearTimeout(finishTimer);clearAudio();speaking=false;
  if(!error)audioNotice('Áudio finalizado. Você ouviu a chamada?');
  if(error){soundEnabled=false;queue=[];if(nativeSpeech())speechSynthesis.cancel();updateSoundUI('⚠ '+error);toast(error,true);return;}nextSpeech();};
 finishTimer=setTimeout(()=>finish('A reprodução de voz não respondeu. Ative a voz novamente.'),30000);
 audioNotice('Preparando chamada de voz…',true);
 if(useLocalAudio()){
  try{
   if(!localVoiceReady)throw Error('Áudio local ainda não carregado.');
   const wav=window.meSpeak.speak(String(text).slice(0,350),{voice:'pt',variant:type==='male'?'m3':'f3',speed:150,pitch:type==='male'?44:56,amplitude:100,rawdata:true});
   if(!wav||!wav.byteLength)throw Error('Não foi possível gerar o áudio.');
   clearAudio();const a=$('tvVoiceAudio');const blob=voiceMode==='wav'?new Blob([wav],{type:'audio/wav'}):wavToMp3(wav);
   localAudioUrl=URL.createObjectURL(blob);a.src=localAudioUrl;a.volume=1;a.muted=false;
   a.onplaying=()=>{if(generation===speechGeneration)audioNotice('Reproduzindo '+(voiceMode==='wav'?'WAV':'MP3')+' • confira o volume da TV',true);};
   a.onended=()=>finish();a.onerror=()=>finish('Falha ao reproduzir '+(voiceMode==='wav'?'WAV':'MP3')+'. Código '+(a.error?.code||'?')+'. Teste outro formato nas configurações.');
   const playback=a.play();if(playback&&playback.catch)playback.catch(()=>finish('A TV bloqueou o áudio. Toque novamente em Ativar voz.'));
  }catch(e){finish(e.message||'Falha no áudio local.');}
  return;
 }
 if(!nativeSpeech()){finish('Voz do navegador indisponível. Selecione Áudio compatível com TV.');return;}
 try{const u=new SpeechSynthesisUtterance(text);u.lang='pt-BR';u.rate=.91;u.pitch=type==='male'?.95:1.08;u.volume=1;
 const voice=chooseVoice(type);if(voice)u.voice=voice;
 u.onend=()=>finish();u.onerror=()=>{if(generation!==speechGeneration)return;if(voiceMode==='auto'){voiceMode='audio';$('tvVoiceMode').value='audio';preloadLocalVoice();}finish('Voz do navegador falhou. Ative a voz novamente para testar o modo áudio.');};speechSynthesis.speak(u);}catch(e){finish('Voz do navegador indisponível.');}
}
function nextSpeech(){
  if(!soundEnabled || speaking || !queue.length)return;
  const item=queue.shift();if(item.demand){if(!demandActive)return nextSpeech();lastDemandSpeech=Date.now();}say(item.text,item.voice);
}
function setDemand(active){
  if(!active){lastDemandSpeech=null;queue=queue.filter(item=>!item.demand);}
  demandActive=active;
  $('tvDemandNotice').classList.toggle('hidden',!active);
}
function announceDemand(){
  if(!demandActive||!soundEnabled||!connected)return;
  if(lastDemandSpeech!==null&&Date.now()-lastDemandSpeech<DEMAND_INTERVAL)return;
  if(queue.some(item=>item.demand))return;
  queue.push({text:DEMAND_MESSAGE,voice:'female',demand:true});
  nextSpeech();
}
function speakOrder(o){
  queue.push({text:o.status==='preparing'?`${o.first_name}, pedido número ${o.number}, seu pedido está sendo preparado.`:`Atenção! ${o.first_name}, pedido número ${o.number}, seu pedido está pronto! Aguarde a entrega no portão.`,voice:o.voice||'female'});
  nextSpeech();
}
function renderTv(orders){
  const working=orders.filter(o=>o.status==='received'||o.status==='preparing').sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  const ready=orders.filter(o=>o.status==='ready').sort((a,b)=>new Date(b.ready_at)-new Date(a.ready_at));
  lastOrders=orders;
  const paged=(list)=>{const n=Math.ceil(list.length/3);return !n?[]:list.slice((tvPage%n)*3,(tvPage%n)*3+3)};
  $('preparingList').innerHTML=working.length?paged(working).map(smallTicket).join(''):'<div class="tv-empty"><strong>Nenhum pedido em preparação.</strong></div>';
  $('readyList').innerHTML=ready.length?paged(ready).map(smallTicket).join(''):'<div class="tv-empty"><strong>Aguardando pedidos prontos.</strong></div>';
  $('preparingList').dataset.count=String(Math.min(3,working.length));
  $('readyList').dataset.count=String(Math.min(3,ready.length));
  const readyNow=new Map(orders.filter(o=>['preparing','ready'].includes(o.status)).map(o=>[o.id+':'+o.status+(o.status==='ready'?':'+o.ready_at:''),o]));
  if(!started){for(const key of readyNow.keys())seen.add(key);started=true;}
  else for(const [key,o] of readyNow){if(!seen.has(key)){seen.add(key);if(soundEnabled)speakOrder(o);}}
  if(seen.size>1500)seen=new Set([...seen].slice(-300));
}
async function poll(){
  if(checking||!tvCode||Date.now()<retryAt)return;
  const code=tvCode;
  checking=true;
  $('tvConnect').disabled=true;$('tvConnect').textContent='Conectando…';
  if(!connected)tvError('');
  try{
    const d=await api('tv',null,{method:'GET',tvCode:code,timeout:12000});
    if(tvCode!==code)return;
    if(!Array.isArray(d.orders))throw Error('Resposta inválida do painel da TV.');
    setDemand(d.high_demand===true);
    const rows=d.orders,snapshot=JSON.stringify(rows);
    if(snapshot!==tvSnapshot||!started){renderTv(rows);tvSnapshot=snapshot;}
    connected=true;retryAt=0;updateIdle();announceDemand();
    try{localStorage.setItem(STORAGE,code);}catch{}
    $('tvKey').value='';tvError('');showBoard();
    $('modeBanner').className='mode-banner live';$('modeBanner').textContent='● Painel conectado • atualização automática a cada 3 segundos';
  }catch(e){
    if(tvCode!==code)return;
    const msg=e.message||'Não foi possível conectar à TV.';
    const rejected=[401,403,429].includes(e.status)||/c[oó]digo.*incorreto|passcode|TV_PASSCODE/i.test(msg);
    $('modeBanner').className='mode-banner offline';
    if(!connected||rejected){
      tvClearCode();showAuth();tvError(msg);
      $('modeBanner').textContent='TV desconectada';
    }else{
      retryAt=Date.now()+15000;updateIdle();queue=queue.filter(item=>!item.demand);
      $('modeBanner').textContent='Conexão indisponível • nova tentativa em 15 segundos';
    }
  }finally{checking=false;$('tvConnect').disabled=false;$('tvConnect').textContent='Conectar painel ↗';}
}
function time(){ $('tvClock').textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date()); }
function start(){
  time();setInterval(time,10000);
  $('tvAuthForm').addEventListener('submit',e=>{e.preventDefault();if(checking)return;const code=$('tvKey').value.trim();if(!code)return tvError('Informe o código da TV.');tvClearCode();tvCode=code;retryAt=0;poll();});
  $('tvIdleEnabled').checked=idleEnabled;$('tvIdleEnabled').onchange=()=>{idleEnabled=$('tvIdleEnabled').checked;try{localStorage.setItem('adega_tv_idle_v1',idleEnabled?'on':'off');}catch{}updateIdle();};
  $('changeKey').onclick=()=>{tvClearCode();retryAt=0;tvError('');showAuth();$('modeBanner').textContent='TV desconectada';};
  $('fullScreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('A TV não permite tela cheia neste navegador.',true);}};
  function activateVoice(){
    if(!connected)return toast('Conecte o painel da TV primeiro.',true);
    if(useLocalAudio()&&!localVoiceReady){updateSoundUI('Carregando áudio em português…');loadLocalVoice().then(()=>{if(!soundEnabled)updateSoundUI('Áudio preparado. Toque em Ativar voz.');}).catch(()=>updateSoundUI('⚠ Não foi possível carregar o áudio. Tente novamente.'));return;}
    if(!useLocalAudio()&&!nativeSpeech())return toast('Selecione Áudio compatível com TV nas configurações.',true);
    soundEnabled=true;updateSoundUI();audioNotice('Testando a voz da TV…',true);say('Chamadas por voz ativadas. Hora Extra Drinks.','female');announceDemand();
  }
  $('activateSound').onclick=$('tvAudioToggle').onclick=()=>{if(soundEnabled){soundEnabled=false;stopSpeech();updateSoundUI('Chamadas por voz desativadas.');}else activateVoice();};
  $('tvVoiceMode').value=voiceMode;$('tvVoiceMode').onchange=()=>{soundEnabled=false;stopSpeech();voiceMode=$('tvVoiceMode').value;try{localStorage.setItem('adega_tv_voice_mode_v1',voiceMode);}catch{}updateSoundUI();preloadLocalVoice();};
  $('tvTestVoice').onclick=()=>{if(!soundEnabled){activateVoice();return;}audioNotice('Teste de voz na fila…',true);queue.push({text:'Atenção! Pedido de teste. Seu pedido está pronto. Pode retirar no portão.',voice:'female'});nextSpeech();};

  for(const type of ['female','male']){
    const select=$(type==='female'?'femaleVoice':'maleVoice');
    select.addEventListener('change',()=>{voicePrefs[type]=select.value;localStorage.setItem(VOICES,JSON.stringify(voicePrefs));});

  }
  if(nativeSpeech()){updateVoices();speechSynthesis.onvoiceschanged=()=>{updateVoices();preloadLocalVoice();};}preloadLocalVoice();
  if(tvCode){showAuth();poll();}else{showAuth();$('modeBanner').textContent='TV desconectada';}
  setInterval(poll,3000);
  window.addEventListener('focus',poll);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
  setInterval(()=>{tvPage++; if(lastOrders.length)renderTv(lastOrders);},8500);
}
start();
