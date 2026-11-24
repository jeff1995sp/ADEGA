import {api,esc,pad,toast,setBrand} from './shared.js';
const $=id=>document.getElementById(id);
const STORAGE='adega_tv_code_v1', VOICES='adega_tv_voices_v1';
let tvCode=localStorage.getItem(STORAGE)||'',soundEnabled=false,started=false,seen=new Set(),voiceList=[],queue=[],speaking=false,checking=false;
let voicePrefs={female:'',male:''};
let tvPage=0, lastOrders=[];
try{voicePrefs=JSON.parse(localStorage.getItem(VOICES)||'{}');}catch{}
const smallTicket=o=>`<article class="tv-ticket"><span class="tv-ticket-symbol" aria-hidden="true">${o.status==='ready'?'✓':'◷'}</span><div class="tv-ticket-body"><strong>${esc(o.public_name)}</strong><small>PEDIDO <b>${pad(o.number)}</b></small></div><span class="tv-ticket-check" aria-hidden="true">${o.status==='ready'?'✧':'◷'}</span></article>`;
function showAuth(){ $('tvAuth').classList.remove('hidden');$('tvBoard').classList.add('hidden'); }
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
  const item=queue.shift();say(item.text,item.voice);
}
function speakOrder(o){
  queue.push({text:`Atenção! ${o.first_name}, seu pedido está pronto! Aguarde a entrega no portão.`,voice:o.voice||'female'});
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
  const readyNow=new Map(ready.map(o=>[o.id+':'+o.ready_at,o]));
  if(!started){for(const key of readyNow.keys())seen.add(key);started=true;}
  else for(const [key,o] of readyNow){if(!seen.has(key)){seen.add(key);if(soundEnabled)speakOrder(o);}}
  if(seen.size>1500)seen=new Set([...seen].slice(-300));
}
async function poll(){
  if(checking || !tvCode)return;
  checking=true;
  try{
    const d=await api('tv',null,{method:'GET',tvCode});
    showBoard();renderTv(d.orders||[]);
    $('modeBanner').className='mode-banner live';$('modeBanner').textContent='● Painel conectado • atualização automática a cada 8 segundos';
  }catch(e){if(/c[oó]digo.*incorreto|passcode|TV_PASSCODE/i.test(e.message)){tvCode='';localStorage.removeItem(STORAGE);showAuth();}else $('modeBanner').textContent='Conexão indisponível • reconectando automaticamente';}
  finally{checking=false;}
}
function time(){ $('tvClock').textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date()); }
function start(){
  time();setInterval(time,10000);
  $('tvAuthForm').addEventListener('submit',e=>{e.preventDefault();tvCode=$('tvKey').value.trim();localStorage.setItem(STORAGE,tvCode);started=false;seen.clear();poll();});
  $('changeKey').onclick=()=>{tvCode='';started=false;seen.clear();localStorage.removeItem(STORAGE);showAuth();};
  $('fullScreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('A TV não permite tela cheia neste navegador.',true);}};
  $('activateSound').onclick=()=>{
    if(!('speechSynthesis' in window))return toast('Este navegador não suporta fala. Use um navegador Android TV compatível ou APK.',true);
    soundEnabled=!soundEnabled;$('activateSound').setAttribute('aria-label',soundEnabled?'Desativar chamadas por voz':'Ativar chamadas por voz');$('activateSound').classList.toggle('sound-on',soundEnabled);$('soundStatus').textContent=soundEnabled?'🔊 Chamadas por voz ativadas':'🔇 Chamadas por voz desativadas';
    if(soundEnabled){updateVoices();say('Chamadas por voz ativadas.','female');nextSpeech();}
    else {speechSynthesis.cancel();queue=[];speaking=false;}
  };
  for(const type of ['female','male']){
    const select=$(type==='female'?'femaleVoice':'maleVoice');
    select.addEventListener('change',()=>{voicePrefs[type]=select.value;localStorage.setItem(VOICES,JSON.stringify(voicePrefs));});
    $(type==='female'?'testFemale':'testMale').onclick=()=>{if(!('speechSynthesis' in window))return toast('Sem suporte a voz.',true);say(type==='female'?'Bruna, seu pedido está pronto.':'Carlos, seu pedido está pronto.',type);};
  }
  if('speechSynthesis' in window){updateVoices();speechSynthesis.onvoiceschanged=updateVoices;}
  if(tvCode)poll();else showAuth();
  setInterval(poll,8000);
  setInterval(()=>{tvPage++; if(lastOrders.length)renderTv(lastOrders);},8500);
}
start();
