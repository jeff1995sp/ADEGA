import {api,esc,pad,toast,setBrand} from './shared.js?v=20261124-auth';
const $=id=>document.getElementById(id);
const STORAGE='adega_tv_code_v1', VOICES='adega_tv_voices_v1';
let tvCode='',soundEnabled=false,started=false,seen=new Set(),voiceList=[],queue=[],speaking=false,checking=false,connected=false,retryAt=0;
try{tvCode=localStorage.getItem(STORAGE)||'';}catch{}
let voicePrefs={female:'',male:''};
let tvPage=0,lastOrders=[],tvSnapshot='',demandActive=false,lastDemandSpeech=null;
const DEMAND_INTERVAL=5*60*1000;
const DEMAND_MESSAGE='Atenção, família! Hoje a casa está cheia. Seu pedido pode demorar um pouco mais que o normal. Valeu pela paciência!';
try{voicePrefs=JSON.parse(localStorage.getItem(VOICES)||'{}');}catch{}
const smallTicket=o=>`<article class="tv-ticket"><div class="tv-ticket-number"><span>PEDIDO</span><b>${pad(o.number)}</b></div><div class="tv-ticket-body"><strong class="${String(o.public_name||'').length>25?'tv-name-long':''}">${esc(o.public_name)}</strong><span class="tv-ticket-status">${o.status==='ready'?'Pode retirar no portão':o.status==='preparing'?'Na preparação':'Pedido recebido'}</span></div></article>`;
function showAuth(){ $('tvAuth').classList.remove('hidden');$('tvBoard').classList.add('hidden'); }
function tvError(message){$('tvLoginError').textContent=message;}
function tvClearCode(){try{localStorage.removeItem(STORAGE);}catch{}tvCode='';connected=false;started=false;seen.clear();lastOrders=[];tvSnapshot='';setDemand(false);}
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
  if(!('speechSynthesis' in window))return;
  const u=new SpeechSynthesisUtterance(text);u.lang='pt-BR';u.rate=.91;u.pitch=type==='male'?.95:1.08;u.volume=1;
  const voice=chooseVoice(type);if(voice)u.voice=voice;
  u.onend=()=>{speaking=false;nextSpeech();};u.onerror=()=>{speaking=false;nextSpeech();};speaking=true;speechSynthesis.speak(u);
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
  queue.push({text:o.status==='preparing'?`${o.first_name}, seu pedido está sendo preparado.`:`Atenção! ${o.first_name}, seu pedido está pronto! Aguarde a entrega no portão.`,voice:o.voice||'female'});
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
    connected=true;retryAt=0;announceDemand();
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
      retryAt=Date.now()+15000;queue=queue.filter(item=>!item.demand);
      $('modeBanner').textContent='Conexão indisponível • nova tentativa em 15 segundos';
    }
  }finally{checking=false;$('tvConnect').disabled=false;$('tvConnect').textContent='Conectar painel ↗';}
}
function time(){ $('tvClock').textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date()); }
function start(){
  time();setInterval(time,10000);
  $('tvAuthForm').addEventListener('submit',e=>{e.preventDefault();if(checking)return;const code=$('tvKey').value.trim();if(!code)return tvError('Informe o código da TV.');tvClearCode();tvCode=code;retryAt=0;poll();});
  $('changeKey').onclick=()=>{tvClearCode();retryAt=0;tvError('');showAuth();$('modeBanner').textContent='TV desconectada';};
  $('fullScreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('A TV não permite tela cheia neste navegador.',true);}};
  $('activateSound').onclick=()=>{
    if(!('speechSynthesis' in window))return toast('Este navegador não suporta fala. Use um navegador Android TV compatível ou APK.',true);
    soundEnabled=!soundEnabled;$('activateSound').setAttribute('aria-label',soundEnabled?'Desativar chamadas por voz':'Ativar chamadas por voz');$('activateSound').classList.toggle('sound-on',soundEnabled);$('soundStatus').textContent=soundEnabled?'🔊 Chamadas por voz ativadas':'🔇 Chamadas por voz desativadas';
    if(soundEnabled){updateVoices();say('Chamadas por voz ativadas.','female');announceDemand();nextSpeech();}
    else {speechSynthesis.cancel();queue=[];speaking=false;}
  };

  for(const type of ['female','male']){
    const select=$(type==='female'?'femaleVoice':'maleVoice');
    select.addEventListener('change',()=>{voicePrefs[type]=select.value;localStorage.setItem(VOICES,JSON.stringify(voicePrefs));});

  }
  if('speechSynthesis' in window){updateVoices();speechSynthesis.onvoiceschanged=updateVoices;}
  if(tvCode){showAuth();poll();}else{showAuth();$('modeBanner').textContent='TV desconectada';}
  setInterval(poll,3000);
  window.addEventListener('focus',poll);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
  setInterval(()=>{tvPage++; if(lastOrders.length)renderTv(lastOrders);},8500);
}
start();
