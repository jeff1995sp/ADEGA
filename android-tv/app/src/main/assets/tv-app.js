import {api,esc,pad,toast,setBrand} from './shared.js?v=20261124-auth';
import {wavToMp3} from './tv-audio-codec.js?v=1';
const $=id=>document.getElementById(id);
const STORAGE='adega_tv_code_v1', VOICES='adega_tv_voices_v1';
let tvCode='',soundEnabled=false,started=false,seen=new Set(),voiceList=[],queue=[],speaking=false,checking=false,connected=false,retryAt=0;
try{tvCode=localStorage.getItem(STORAGE)||'';}catch{}
let voicePrefs={female:'',male:''},voiceChoice='order',demandVoice='female';try{voiceChoice=localStorage.getItem('hora_voice_choice')||'order';demandVoice=localStorage.getItem('hora_demand_voice')||'female';}catch{}
let tvPage=0,lastOrders=[],tvSnapshot='',demandActive=false,lastDemandSpeech=null;
let idleEnabled=true;try{idleEnabled=localStorage.getItem('adega_tv_idle_v1')!=='off';}catch{}
function updateIdle(){const active=idleEnabled&&connected&&!demandActive&&retryAt===0&&lastOrders.length===0;$('tvIdle').classList.toggle('hidden',!active);$('tvBoard').classList.toggle('tv-is-idle',active);}
let voiceMode='auto',neuralWorker=null,neuralReady=false,neuralBusy=false,neuralTask=null,neuralTimer=null,neuralFailed=false,localVoicePromise=null,localVoiceReady=false,localAudioUrl='',speechGeneration=0,finishTimer=null;
try{voiceMode=localStorage.getItem('adega_tv_voice_mode_v1')||'auto';}catch{}
if(!['auto','audio','wav','native'].includes(voiceMode))voiceMode='auto';try{if(localStorage.getItem('hora_tv_voice_v2')!=='1'){voiceMode='auto';localStorage.setItem('hora_tv_voice_v2','1');localStorage.setItem('adega_tv_voice_mode_v1','auto');}}catch{}
const appBridge=typeof window.HoraNative?.postMessage==='function';
let nativeFallback=!appBridge, autoStarted=false, autoActivate=()=>{}, nativeReply=null;
let volume=1,rate=.95;
try{volume=Math.max(0,Math.min(1,Number(localStorage.getItem('hora_tv_volume')??1)));rate=Math.max(.7,Math.min(1.3,Number(localStorage.getItem('hora_tv_rate')??.95)));}catch{}
if(appBridge)window.HoraNative.onmessage=e=>{try{const msg=JSON.parse(e.data);if(nativeReply&&msg.id===nativeReply.id){const fn=nativeReply.fn;nativeReply=null;fn(msg.ok===true);}}catch{}};
function sendNative(message){try{window.HoraNative.postMessage(JSON.stringify(message));return true;}catch{return false;}}
const nativeSpeech=()=>('speechSynthesis' in window)&&('SpeechSynthesisUtterance' in window);
const useLocalAudio=()=>voiceMode==='audio'||voiceMode==='wav'||nativeFallback;
function neuralStatus(message){const el=$('horaNeuralStatus');if(el)el.textContent=message;}
function releaseNeural(message){clearTimeout(neuralTimer);if(neuralWorker)neuralWorker.terminate();neuralWorker=null;neuralBusy=false;neuralReady=false;neuralFailed=true;const task=neuralTask;neuralTask=null;neuralStatus(message);if(task)task(null);}
function prepareNeural(){
 if(voiceMode!=='auto'||neuralWorker||neuralFailed)return;
 if(!window.Worker||!window.WebAssembly){neuralStatus('Voz neural indisponível; usando a voz do Android.');return;}
 try{
  neuralWorker=new Worker('/js/kokoro-test-worker.js?v=2',{type:'module'});neuralBusy=true;neuralStatus('Preparando voz natural. Chamadas continuam com a voz de reserva.');
  neuralWorker.onerror=()=>releaseNeural('Voz neural incompatível; usando a voz do Android.');
  neuralWorker.onmessage=({data:d})=>{
   if(d.type==='status'){if(!neuralReady)neuralStatus(d.message||'Preparando voz natural…');return;}
   if(d.type==='error'){releaseNeural('Voz neural indisponível; usando a voz do Android.');return;}
   if(d.type==='audio'){clearTimeout(neuralTimer);neuralBusy=false;neuralReady=true;neuralStatus('Voz natural disponível.');const task=neuralTask;neuralTask=null;if(task)task(d.wav);}
  };
  neuralTimer=setTimeout(()=>releaseNeural('Modelo demorou para carregar; usando a voz do Android.'),180000);
  neuralWorker.postMessage({voice:'dora',text:'Hora Extra Drinks.'});
 }catch{releaseNeural('Voz neural indisponível; usando a voz do Android.');}
}
function synthesizeNeural(text,type,done){
 if(voiceMode!=='auto'||!neuralReady||neuralBusy||!neuralWorker||text.length>200)return false;
 neuralBusy=true;neuralTask=done;
 neuralTimer=setTimeout(()=>releaseNeural('Voz neural lenta neste aparelho; usando a voz do Android.'),8000);
 try{neuralWorker.postMessage({voice:type==='santa'?'santa':type==='male'?'alex':'dora',text});return true;}catch{releaseNeural('Falha na voz neural; usando a voz do Android.');return true;}
}
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
function stopSpeech(){neuralTask=null;nativeReply=null;if(appBridge)sendNative({action:'stop'});speechGeneration++;clearTimeout(finishTimer);if(nativeSpeech())speechSynthesis.cancel();clearAudio();queue=[];speaking=false;}
let soundNoticeTimer;
function audioNotice(message,persistent=false){
 const notice=$('tvAudioNotice');notice.textContent=message;notice.classList.remove('hidden');clearTimeout(soundNoticeTimer);if(!persistent)soundNoticeTimer=setTimeout(()=>notice.classList.add('hidden'),8000);
}
function updateSoundUI(message){
 $('activateSound').setAttribute('aria-label',soundEnabled?'Desativar chamadas por voz':'Ativar chamadas por voz');
 $('activateSound').classList.toggle('sound-on',soundEnabled);
 const label=$('activateSound').querySelector('.hora-tv-sound-label');if(label)label.textContent=soundEnabled?'🔊 Voz ativa':'🔇 Ativar voz';
 $('tvAudioToggle').textContent=soundEnabled?'Desativar voz':'Ativar voz';
 if(message)audioNotice(message);
 $('soundStatus').textContent=message||(soundEnabled?(useLocalAudio()?'🔊 Chamadas por áudio ativadas':'🔊 Chamadas por voz ativadas'):'🔇 Chamadas por voz desativadas');
}
function preloadLocalVoice(){if(useLocalAudio())loadLocalVoice().catch(()=>{if(!soundEnabled)updateSoundUI('⚠ Áudio local indisponível. Toque em Ativar voz para tentar novamente.');});}
const DEMAND_INTERVAL=5*60*1000;
const DEMAND_MESSAGE='Atenção, clientes! A adega está com alta demanda. Seu pedido poderá demorar um pouco mais que o normal. A Hora Extra Drinks agradece a compreensão e a preferência.';
try{voicePrefs=JSON.parse(localStorage.getItem(VOICES)||'{}');}catch{}
const basketIcon="<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 23h36l-4 18H10L6 23ZM15 28l2 8m7-8v8m9-8-2 8M13 23V12l4-3V4h5v5l3 3v11M29 23V13l4-3V6h5v4l3 3v10\"/></svg>";const chefIcon="<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 28v12h24V28M12 34h24M12 28C1 28 3 10 14 12 17 3 31 3 34 12 45 10 47 28 36 28\"/></svg>";const bagIcon="<svg viewBox=\"0 0 48 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10 16h28l5 26H5l5-26ZM17 21V12a7 7 0 0 1 14 0v9M17 30l5 5 10-11\"/></svg>";
const smallTicket=o=>`<article class="tv-ticket"><span class="hora-ticket-icon" aria-hidden="true">${basketIcon}</span><div class="tv-ticket-body"><span class="tv-ticket-number">Pedido ${esc(pad(o.number))}</span><strong class="${String(o.public_name||'').length>25?'tv-name-long':''}">${esc(o.public_name)}</strong></div><span aria-hidden="true" class="${o.status==='ready'?'hora-ticket-state':'hora-ticket-spinner'}">${o.status==='ready'?'✓':''}</span></article>`;
function showAuth(){ $('tvAuth').classList.remove('hidden');$('tvBoard').classList.add('hidden'); }
function tvError(message){$('tvLoginError').textContent=message;}
function tvClearCode(){autoStarted=false;soundEnabled=false;stopSpeech();updateSoundUI();try{localStorage.removeItem(STORAGE);}catch{}tvCode='';connected=false;started=false;seen.clear();lastOrders=[];tvSnapshot='';setDemand(false);updateIdle();}
function showBoard(){ $('tvAuth').classList.add('hidden');$('tvBoard').classList.remove('hidden'); }
function updateVoices(){
  if(appBridge){for(const type of ['female','male']){const el=$(type==='female'?'femaleVoice':'maleVoice');el.innerHTML='<option value="">Voz automática do Android</option>';}return;}
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
  if(!error){$('tvAudioNotice').classList.add('hidden');clearTimeout(soundNoticeTimer);}
  if(error){if(nativeSpeech())speechSynthesis.cancel();audioNotice('⚠ '+error);nextSpeech();return;}nextSpeech();};
 finishTimer=setTimeout(()=>finish('A reprodução de voz não respondeu. Ative a voz novamente.'),30000);

 const nativeOrLocal=()=>{
 if(generation!==speechGeneration)return;
 if(appBridge&&!useLocalAudio()){
  const fallback=()=>{if(generation!==speechGeneration)return;nativeReply=null;sendNative({action:'stop'});clearTimeout(finishTimer);nativeFallback=true;audioNotice('Preparando voz de reserva…',true);finishTimer=setTimeout(()=>finish('Voz de reserva indisponível.'),25000);loadLocalVoice().then(()=>{if(generation===speechGeneration){clearTimeout(finishTimer);say(text,type);}}).catch(()=>finish('Voz do Android e voz de reserva indisponíveis.'));};
  clearTimeout(finishTimer);finishTimer=setTimeout(fallback,45000);
  const id=String(generation);nativeReply={id,fn:ok=>ok?finish():fallback()};
  if(!sendNative({action:'speak',id,text:String(text).slice(0,350),voice:type==='santa'?'male':type,volume,rate}))fallback();
  return;
 }
 if(useLocalAudio()){
  try{
   if(!localVoiceReady){clearTimeout(finishTimer);finishTimer=setTimeout(()=>finish('Voz de reserva indisponível.'),25000);loadLocalVoice().then(()=>{if(generation===speechGeneration){clearTimeout(finishTimer);nativeOrLocal();}}).catch(()=>finish('Voz de reserva indisponível.'));return;}
   const wav=window.meSpeak.speak(String(text).slice(0,350),{voice:'pt',variant:type==='male'||type==='santa'?'m3':'f3',speed:Math.round(158*rate),pitch:type==='male'||type==='santa'?44:56,amplitude:100,rawdata:true});
   if(!wav||!wav.byteLength)throw Error('Não foi possível gerar o áudio.');
   clearTimeout(finishTimer);finishTimer=setTimeout(()=>finish('Tempo limite de áudio.'),30000);clearAudio();const a=$('tvVoiceAudio');a.playbackRate=1;const blob=voiceMode==='wav'?new Blob([wav],{type:'audio/wav'}):wavToMp3(wav);
   localAudioUrl=URL.createObjectURL(blob);a.src=localAudioUrl;a.volume=volume;a.muted=false;
   a.onplaying=()=>{if(generation===speechGeneration)$('tvAudioNotice').classList.add('hidden');};
   a.onended=()=>finish();a.onerror=()=>finish('Falha ao reproduzir '+(voiceMode==='wav'?'WAV':'MP3')+'. Código '+(a.error?.code||'?')+'. Teste outro formato nas configurações.');
   const playback=a.play();if(playback&&playback.catch)playback.catch(()=>finish('A TV bloqueou o áudio. Toque novamente em Ativar voz.'));
  }catch(e){finish(e.message||'Falha no áudio local.');}
  return;
 }
 if(!nativeSpeech()){finish('Voz do navegador indisponível. Selecione Áudio compatível com TV.');return;}
 try{const u=new SpeechSynthesisUtterance(text);u.lang='pt-BR';u.rate=.91;u.pitch=type==='male'?.95:1.08;u.volume=1;
 const voice=chooseVoice(type);if(voice)u.voice=voice;
 u.onend=()=>finish();u.onerror=()=>{if(generation!==speechGeneration)return;if(voiceMode==='auto'){voiceMode='audio';$('tvVoiceMode').value='audio';preloadLocalVoice();}finish('Voz do navegador falhou. Ative a voz novamente para testar o modo áudio.');};speechSynthesis.speak(u);}catch(e){finish('Voz do navegador indisponível.');}
 };
 if(!synthesizeNeural(String(text),type,wav=>{
  if(generation!==speechGeneration)return;
  if(!(wav instanceof ArrayBuffer)||wav.byteLength<44){nativeOrLocal();return;}
  clearTimeout(finishTimer);clearAudio();const a=$('tvVoiceAudio');let failed=false;
  const fallback=()=>{if(failed||generation!==speechGeneration)return;failed=true;clearTimeout(finishTimer);clearAudio();nativeOrLocal();};
  try{localAudioUrl=URL.createObjectURL(new Blob([wav],{type:'audio/wav'}));a.src=localAudioUrl;a.volume=volume;a.playbackRate=rate/.95;a.muted=false;a.onended=()=>finish();a.onerror=fallback;finishTimer=setTimeout(fallback,30000);Promise.resolve(a.play()).catch(fallback);}catch{fallback();}
 }))nativeOrLocal();
}
function nextSpeech(){
  if(!soundEnabled || speaking || !queue.length || !connected || retryAt!==0)return;
  const item=queue.shift();if(item.demand){if(!demandActive)return nextSpeech();lastDemandSpeech=Date.now();const notice=$('tvDemandNotice');notice.classList.remove('hora-app-demand-pulse');void notice.offsetWidth;notice.classList.add('hora-app-demand-pulse');}
  if(item.orderId&&!lastOrders.some(o=>o.id===item.orderId&&o.status===item.status))return nextSpeech();
  say(item.text,item.voice);
  if(item.status==='ready'&&!item.repeat)setTimeout(()=>{if(soundEnabled&&connected&&retryAt===0&&lastOrders.some(o=>o.id===item.orderId&&o.status==='ready')){queue.push({...item,repeat:true});nextSpeech();}},30000);
}
function setDemand(active){
  if(!active){lastDemandSpeech=null;queue=queue.filter(item=>!item.demand);}
  demandActive=active;
  $('tvDemandNotice').classList.toggle('hidden',!active);document.querySelector('.tv-concept-canvas').classList.toggle('hora-demand-on',active);
}
function announceDemand(){
  if(!demandActive||!soundEnabled||!connected)return;
  if(lastDemandSpeech!==null&&Date.now()-lastDemandSpeech<DEMAND_INTERVAL)return;
  if(queue.some(item=>item.demand))return;
  queue.push({text:DEMAND_MESSAGE,voice:demandVoice,demand:true});
  nextSpeech();
}
function speakOrder(o){
  const item={text:o.status==='preparing'?`${o.first_name}, pedido número ${o.number}, seu pedido está sendo preparado.`:`Atenção! ${o.first_name}, pedido número ${o.number}, seu pedido está pronto! Por favor, retire no portão. A Hora Extra Drinks agradece a preferência.`,voice:voiceChoice==='order'?(o.voice||'female'):voiceChoice,orderId:o.id,status:o.status};const demandIndex=queue.findIndex(x=>x.demand);if(demandIndex<0)queue.push(item);else queue.splice(demandIndex,0,item);
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
  if(!started){for(const [key,o] of readyNow){seen.add(key);if(o.status==='ready')speakOrder(o);}started=true;}
  else for(const [key,o] of readyNow){if(!seen.has(key)){seen.add(key);speakOrder(o);}}
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
    const activeCount=Number.isFinite(d.demand_count)?d.demand_count:d.orders.filter(o=>o.status==='received'||o.status==='preparing').length;
    setDemand(activeCount>5);
    const rows=d.orders,snapshot=JSON.stringify(rows);
    if(snapshot!==tvSnapshot||!started){renderTv(rows);tvSnapshot=snapshot;}
    connected=true;retryAt=0;updateIdle();nextSpeech();announceDemand();
    try{localStorage.setItem(STORAGE,code);}catch{}
    $('tvKey').value='';tvError('');showBoard();
    if(!autoStarted){autoStarted=true;autoActivate();}
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
  const copy=document.querySelector('#tvDemandNotice .demand-copy');if(copy){copy.querySelector('b').textContent='A adega está com alta demanda.';copy.querySelector('span').textContent='Seu pedido poderá demorar um pouco mais que o normal. Agradecemos a compreensão!';}
  document.body.classList.add('hora-tv-apk');
  const style=document.createElement('style');style.textContent=".hora-tv-apk #tvBoard:not(.hidden){height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}\n.hora-tv-apk.tv-body .tv-concept-canvas{width:min(100vw,177.7778vh);height:min(100vh,56.25vw);min-height:0!important;min-width:0!important;flex:none;background:radial-gradient(ellipse at 55% 0%,#a7182455,transparent 55%),linear-gradient(180deg,#29060988,#100506d9),url('/img/comunidade-urbana.svg') center/cover!important}\n.hora-tv-apk .hora-tv-head{top:2.4%;left:6.8%;right:35%;height:18%;display:flex;align-items:center}\n.hora-tv-apk .hora-tv-head .brand{display:flex;align-items:center;gap:1.5vw;width:100%}\n.hora-tv-apk .hora-tv-head .brand-crest{width:clamp(50px,10vw,185px);height:clamp(50px,10vw,185px);flex:none;background:none;border:0;box-shadow:none}\n.hora-tv-apk .hora-tv-head .brand-crest img{width:100%;height:100%;object-fit:contain}\n.hora-tv-apk .hora-tv-head .brand>div{border-left:2px solid #fb4e58;padding-left:1.5vw;min-width:0}\n.hora-tv-apk .hora-tv-head .brand-name{font-family:Outfit,Arial,sans-serif;font-style:italic;font-size:clamp(15px,3.2vw,60px);line-height:1;letter-spacing:-.045em;white-space:nowrap;font-weight:900;color:#fff}\n.hora-tv-apk .hora-tv-head .brand-name em{color:#ff4f59;font-style:inherit}\n.hora-tv-apk .hora-tv-head .muted-line{font-size:clamp(6px,1.05vw,19px);font-weight:750;letter-spacing:.18em;margin-top:.7vw;color:#eee;white-space:nowrap}\n.hora-tv-apk .hora-tv-intro{display:none!important}\n.hora-tv-apk #activateSound{top:8.4%;left:69%;width:14%;height:7%;border:1.5px solid #ff505a;border-radius:100px;background:linear-gradient(110deg,#6d151b,#190709);color:white;box-shadow:0 0 12px #fd283b66;font-size:clamp(10px,1.4vw,26px);font-weight:800}\n.hora-tv-apk #activateSound.sound-on:after{content:none!important}.hora-tv-apk #activateSound .hora-tv-sound-label{display:inline!important}\n.hora-tv-apk #tvClock{top:7.9%;right:2.5%;height:8.3%;width:12%;border:1.5px solid #ff505a;border-radius:15px;background:#20090d;color:#fff;box-shadow:0 0 10px #e62b4266;font-size:clamp(18px,3.1vw,60px)}\n.hora-tv-apk .hora-tv-panel{position:absolute;top:23%;height:64%;width:43%;border:2px solid var(--edge);border-radius:1.7vw;padding:1.55vw;box-sizing:border-box;display:flex;flex-direction:column;gap:1.2vw;overflow:hidden;background:linear-gradient(145deg,var(--panel),#0d0608f5);box-shadow:0 0 1.3vw var(--glow);z-index:3}\n.hora-tv-apk .hora-panel-preparing{left:6.6%;--edge:#ff505a;--accent:#ff5c64;--panel:#3b0c10ed;--glow:#f72c444d;--card:#4f1318;--tile:#a62a2c}\n.hora-tv-apk .hora-panel-ready{left:51.2%;width:45.3%;--edge:#57f464;--accent:#63ff70;--panel:#102c0eeb;--glow:#48ef5b4d;--card:#173d13;--tile:#257a1c}\n.hora-tv-apk .hora-panel-header{display:flex;align-items:center;gap:1.6vw;min-height:0;flex:0 0 23%}\n.hora-tv-apk .hora-panel-icon,.hora-ticket-icon{display:grid;place-items:center;flex:none;color:#fff;background:linear-gradient(135deg,var(--tile),var(--card));border:1px solid var(--edge);border-radius:1.25vw;box-shadow:inset 0 0 10px #ffffff0c}\n.hora-tv-apk .hora-panel-icon{width:6.2vw;height:6.2vw}.hora-tv-apk .hora-panel-icon svg{width:64%;height:64%}\n.hora-tv-apk .hora-panel-header>div:last-child{min-width:0}\n.hora-tv-apk .hora-panel-header h2{margin:0;font-size:clamp(12px,2.68vw,49px);line-height:1.1;letter-spacing:-.025em;color:#fff;font-weight:850;white-space:nowrap}\n.hora-tv-apk .hora-panel-header p{font-size:clamp(8px,1.37vw,26px);margin:.45vw 0 .75vw;color:#dfd7d9;line-height:1.15}\n.hora-tv-apk .hora-panel-header i{display:block;width:9.5vw;height:.35vw;min-height:2px;border-radius:9px;background:var(--accent)}\n.hora-tv-apk .hora-tv-panel .tv-concept-list{position:static!important;inset:auto!important;width:100%!important;height:auto!important;min-height:0;flex:1;display:flex;flex-direction:column;gap:1.05vw;overflow:hidden}\n.hora-tv-apk .hora-tv-panel .tv-ticket{height:auto!important;min-height:0;flex:1 1 0;max-height:32%;padding:.65vw 1.5vw;box-sizing:border-box;gap:1.55vw;border:1px solid var(--edge);border-radius:1.35vw;background:linear-gradient(105deg,var(--card),#0d0a0de8);box-shadow:inset 0 0 1vw #ffffff08;margin:0;display:flex;align-items:center}\n.hora-tv-apk .hora-ticket-icon{width:4.9vw;height:4.9vw;border-radius:1.05vw;border-color:#ffffff24}\n.hora-tv-apk .hora-ticket-icon svg{width:70%;height:70%}\n.hora-tv-apk .hora-tv-panel .tv-ticket-body{border-left:1px solid var(--edge);padding-left:1.55vw;display:flex;flex:1;min-width:0;height:auto;gap:.2vw;justify-content:center}\n.hora-tv-apk .hora-tv-panel .tv-ticket-number{font-size:clamp(9px,1.7vw,33px);font-weight:850;line-height:1;color:var(--accent);white-space:nowrap}\n.hora-tv-apk .hora-tv-panel .tv-ticket strong{font-size:clamp(12px,2.25vw,42px);line-height:1.1;font-weight:800;color:white;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;display:block}\n.hora-tv-apk .hora-tv-panel .tv-ticket strong.tv-name-long{font-size:clamp(10px,1.72vw,31px)}\n.hora-tv-apk .hora-ticket-state{display:grid;place-items:center;flex:none;width:3vw;height:3vw;color:#1a2815;background:var(--accent);border-radius:50%;font-size:2vw;font-weight:900}\n.hora-tv-apk .hora-ticket-spinner{display:block;flex:none;width:2.6vw;height:2.6vw;border:.38vw dotted #ff9b41;border-radius:50%;animation:horaSpin 3s linear infinite}\n@keyframes horaSpin{to{transform:rotate(360deg)}}\n.hora-tv-apk .hora-tv-panel .tv-empty{height:auto!important;flex:1;display:grid;place-items:center;border:1px dashed var(--edge);background:#0c080a66;border-radius:1.2vw;text-align:center}\n.hora-tv-apk .hora-tv-panel .tv-empty strong{font-size:clamp(10px,1.55vw,29px);color:#ddd;white-space:normal}\n.hora-tv-apk .hora-tv-bottom{bottom:3.5%;left:6%;right:6%;border:0;padding:0;display:flex;justify-content:center;align-items:center;gap:2vw;font-size:clamp(8px,1.28vw,23px);letter-spacing:.07em;color:white}\n.hora-tv-apk .hora-tv-bottom>span+span{border-left:2px solid #ff5159;padding-left:2vw}\n.hora-tv-apk #soundStatus,.hora-tv-apk #tvAudioToggle,.hora-tv-apk #fullScreen{display:none!important}\n.hora-tv-apk .tv-concept-tools{position:absolute;right:1%;bottom:1%;background:transparent;padding:0;z-index:12;display:block}\n.hora-tv-apk .tv-settings details{background:#17171be8;border-radius:7px;color:white;padding:5px 9px}\n.hora-tv-apk .tv-settings details[open]{position:absolute;bottom:0;right:0;width:min(390px,85vw);max-height:85vh;overflow:auto;box-shadow:0 4px 30px #000a;padding:16px}\n.hora-tv-apk .tv-settings summary{font-size:clamp(10px,1vw,16px);cursor:pointer}\n.hora-tv-apk .tv-concept-canvas.hora-demand-on .hora-tv-panel{height:52.5%}\n.hora-tv-apk .tv-concept-canvas.hora-demand-on .hora-panel-header{flex-basis:25%}\n.hora-tv-apk .tv-concept-canvas.hora-demand-on .hora-panel-icon{width:4.2vw;height:4.2vw}\n.hora-tv-apk .tv-concept-canvas.hora-demand-on .hora-ticket-icon{height:3.5vw;width:3.5vw}\n.hora-tv-apk .tv-concept-canvas.hora-demand-on .tv-ticket strong{font-size:clamp(11px,1.9vw,35px)}\n.hora-tv-apk .tv-concept-canvas.hora-demand-on .hora-tv-bottom{bottom:3.5%}\n.hora-tv-apk #tvDemandNotice{left:6.6%;right:3.5%;top:77%;height:10%;bottom:auto}\n.hora-tv-apk .mode-banner.offline{position:fixed;top:0;left:0;right:0;z-index:20}\n.hora-tv-apk .tv-is-idle .hora-tv-panel{visibility:hidden}.hora-tv-apk .tv-is-idle #activateSound,.hora-tv-apk .tv-is-idle #tvClock{z-index:7}\n@keyframes horaDemandPulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.28)}}.hora-app-demand-pulse{animation:horaDemandPulse 1.2s ease-in-out 3}\n@media(prefers-reduced-motion:reduce){.hora-app-demand-pulse,.hora-ticket-spinner{animation:none}}";document.head.appendChild(style);
  const canvas=document.querySelector('.tv-concept-canvas');
  const brand=canvas.querySelector('.brand-name');brand.innerHTML='HORA EXTRA <em>DRINKS</em>';
  canvas.querySelector('.muted-line').textContent='BEBIDAS • COMUNIDADE • RESPEITO';
  const makePanel=(id,kind,title,desc,icon)=>{
    const list=$(id),panel=document.createElement('section');panel.className='hora-tv-panel hora-panel-'+kind;panel.setAttribute('aria-label',title);
    const head=document.createElement('header');head.className='hora-panel-header';head.innerHTML='<span class="hora-panel-icon" aria-hidden="true">'+icon+'</span><div><h2>'+title+'</h2><p>'+desc+'</p><i aria-hidden="true"></i></div>';
    canvas.appendChild(panel);panel.append(head,list);
  };
  canvas.querySelectorAll('.hora-tv-label').forEach(e=>e.hidden=true);
  makePanel('preparingList','preparing','Em preparação','Pedidos que estão sendo separados',chefIcon);
  makePanel('readyList','ready','Prontos para retirar','Pedidos liberados, aguardando retirada',bagIcon);
  const settings=document.querySelector('.tv-settings details');if(settings){const panel=document.createElement('div');panel.innerHTML='<div class="form-field"><label for="horaAppVolume">Volume da voz</label><input id="horaAppVolume" type="range" min="0" max="100" step="5"></div><div class="form-field"><label for="horaAppRate">Velocidade da fala</label><input id="horaAppRate" type="range" min="70" max="130" step="5"></div><div class="form-field"><label for="horaVoiceChoice">Voz dos pedidos</label><select id="horaVoiceChoice"><option value="order">Automática / escolhida no admin</option><option value="female">Dora — feminina</option><option value="male">Alex — masculina</option><option value="santa">Santa — masculina grave</option></select></div><div class="form-field"><label for="horaDemandVoice">Voz dos avisos</label><select id="horaDemandVoice"><option value="female">Dora — feminina</option><option value="male">Alex — masculina</option><option value="santa">Santa — masculina grave</option></select></div><button id="horaSantaTest" class="btn btn-outline btn-sm" type="button">Testar voz grave</button> <button id="horaMaleTest" class="btn btn-outline btn-sm" type="button">Testar voz masculina</button><p id="horaNeuralStatus" class="small sub" role="status">Voz natural automática quando compatível com a TV.</p><button id="horaNeuralRetry" class="btn btn-outline btn-sm" type="button">Preparar voz natural</button>';settings.appendChild(panel);$('horaVoiceChoice').value=voiceChoice;$('horaDemandVoice').value=demandVoice;$('horaVoiceChoice').onchange=()=>{voiceChoice=$('horaVoiceChoice').value;try{localStorage.setItem('hora_voice_choice',voiceChoice);}catch{}};$('horaDemandVoice').onchange=()=>{demandVoice=$('horaDemandVoice').value;try{localStorage.setItem('hora_demand_voice',demandVoice);}catch{}};$('horaSantaTest').onclick=()=>{if(!soundEnabled)activateVoice();queue.push({text:'Atenção! Teste da voz masculina grave. Hora Extra Drinks.',voice:'santa'});nextSpeech();};settings.querySelector('summary').textContent='⚙ Configurações';const neuralLink=settings.querySelector('a[href="/teste-voz.html"]');if(neuralLink)neuralLink.hidden=true;$('horaNeuralRetry').onclick=()=>{if(neuralBusy)return;neuralFailed=false;if(neuralWorker){neuralWorker.terminate();neuralWorker=null;neuralReady=false;}voiceMode='auto';$('tvVoiceMode').value='auto';nativeFallback=!appBridge;try{localStorage.setItem('adega_tv_voice_mode_v1','auto');}catch{}prepareNeural();};$('horaAppVolume').value=Math.round(volume*100);$('horaAppRate').value=Math.round(rate*100);$('horaAppVolume').oninput=()=>{volume=Number($('horaAppVolume').value)/100;try{localStorage.setItem('hora_tv_volume',volume)}catch{}};$('horaAppRate').oninput=()=>{rate=Number($('horaAppRate').value)/100;try{localStorage.setItem('hora_tv_rate',rate)}catch{}};$('horaMaleTest').onclick=()=>{if(!soundEnabled)activateVoice();queue.push({text:'Atenção! Teste da voz masculina. Hora Extra Drinks.',voice:'male'});nextSpeech();};}
  time();setInterval(time,10000);
  $('tvAuthForm').addEventListener('submit',e=>{e.preventDefault();if(checking)return;const code=$('tvKey').value.trim();if(!code)return tvError('Informe o código da TV.');tvClearCode();tvCode=code;retryAt=0;poll();});
  $('tvIdleEnabled').checked=idleEnabled;$('tvIdleEnabled').onchange=()=>{idleEnabled=$('tvIdleEnabled').checked;try{localStorage.setItem('adega_tv_idle_v1',idleEnabled?'on':'off');}catch{}updateIdle();};
  $('changeKey').onclick=()=>{tvClearCode();retryAt=0;tvError('');showAuth();$('modeBanner').textContent='TV desconectada';};
  $('fullScreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('A TV não permite tela cheia neste navegador.',true);}};
  function activateVoice(){
    if(!connected)return toast('Conecte o painel da TV primeiro.',true);
    if(useLocalAudio()&&!localVoiceReady){updateSoundUI('Carregando áudio em português…');loadLocalVoice().then(()=>{if(!soundEnabled&&connected)activateVoice();}).catch(()=>updateSoundUI('⚠ Não foi possível carregar o áudio. Tente novamente.'));return;}
    if(!useLocalAudio()&&!appBridge&&!nativeSpeech())return toast('Selecione Áudio compatível com TV nas configurações.',true);
    soundEnabled=true;updateSoundUI();prepareNeural();nextSpeech();announceDemand();
  }
  autoActivate=activateVoice;
  $('activateSound').onclick=$('tvAudioToggle').onclick=()=>{if(soundEnabled){soundEnabled=false;stopSpeech();updateSoundUI();}else activateVoice();};
  $('tvVoiceMode').innerHTML='<option value="auto">Natural automática (neural + Android)</option><option value="native">Voz de alta qualidade do Android</option><option value="audio">Reserva MP3</option><option value="wav">Reserva WAV</option>';$('tvVoiceMode').value=voiceMode;$('tvVoiceMode').onchange=()=>{soundEnabled=false;stopSpeech();voiceMode=$('tvVoiceMode').value;nativeFallback=!appBridge;try{localStorage.setItem('adega_tv_voice_mode_v1',voiceMode);}catch{}updateSoundUI();preloadLocalVoice();if(connected)activateVoice();};
  $('tvTestVoice').onclick=()=>{if(!soundEnabled)activateVoice();queue.push({text:'Atenção! Pedido de teste. Seu pedido está pronto. Pode retirar no portão.',voice:'female'});nextSpeech();};

  for(const type of ['female','male']){
    const select=$(type==='female'?'femaleVoice':'maleVoice');
    select.addEventListener('change',()=>{voicePrefs[type]=select.value;localStorage.setItem(VOICES,JSON.stringify(voicePrefs));});

  }
  if(appBridge){updateVoices();const oldVoices=$('femaleVoice').closest('.grid-2');if(oldVoices)oldVoices.hidden=true;}else if(nativeSpeech()){updateVoices();speechSynthesis.onvoiceschanged=()=>{updateVoices();preloadLocalVoice();};}preloadLocalVoice();
  if(tvCode){showAuth();poll();}else{showAuth();$('modeBanner').textContent='TV desconectada';}
  setInterval(poll,3000);
  window.addEventListener('focus',poll);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
  setInterval(()=>{tvPage++; if(lastOrders.length)renderTv(lastOrders);},8500);
}
start();
