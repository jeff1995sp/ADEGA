// Origem: FOTOS-POR-PRODUTO.csv, 23/11/2026.
// Imagens de IA e desenhos não são fotografias reais; não exibir como produto confirmado.
// Não usar automaticamente links de imagens de outras lojas (possíveis bloqueios e embalagens diferentes).
export const PHOTO_PENDING='/imagens/foto-pendente.webp';
export const ILLUSTRATIVE_LOCAL_PATHS=new Set([
  "/imagens/51-ice.webp",
  "/imagens/abacaxi-com-vinho.webp",
  "/imagens/acai-batido.webp",
  "/imagens/ballantine-s-com-red-bull.webp",
  "/imagens/ballantine-s-com-vibe.webp",
  "/imagens/beefeater-com-red-bull.webp",
  "/imagens/bell-s-com-red-bull.webp",
  "/imagens/caipirinha-de-amora.webp",
  "/imagens/caipirinha-de-cerveja.webp",
  "/imagens/caipirinha-de-framboesa.webp",
  "/imagens/caipirinha-de-maracuja.webp",
  "/imagens/caipirinha.webp",
  "/imagens/cavalo-com-red-bull.webp",
  "/imagens/cavalo-com-vibe.webp",
  "/imagens/ciroc-com-red-bull.webp",
  "/imagens/draft.webp",
  "/imagens/ferrero-rocher.webp",
  "/imagens/kinder-ovo.webp",
  "/imagens/morango-com-nutella.webp",
  "/imagens/ninho-trufado.webp",
  "/imagens/refrigerante-em-lata.webp",
  "/imagens/rocks-com-red-bull.webp",
  "/imagens/seda.webp",
  "/imagens/smirnoff-ice.webp",
  "/imagens/spaten.webp",
  "/imagens/vinho.webp"
]);
export const LICENSED_LOCAL_PATHS=new Set(["/imagens/heineken.webp", "/imagens/corona.webp", "/imagens/budweiser.webp", "/imagens/caipirinha-de-morango.webp", "/imagens/caipirinha-de-limao.webp", "/imagens/agua.webp", "/imagens/ceu-azul.webp", "/imagens/maracuja.webp", "/imagens/frutas-vermelhas.webp", "/imagens/balas-sortidas.webp", "/imagens/jack-com-red-bull.webp", "/imagens/red-label-com-red-bull.webp", "/imagens/absolut-com-red-bull.webp"]);
export const photoSlug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const localPhotoFor=p=>'/imagens/'+photoSlug(p?.name||'foto-pendente')+'.webp';
export const photoStatusFor=p=>{
 const stored=String(p?.image_url||'').trim();
 if(stored&&!stored.startsWith('/imagens/'))return 'custom';
 const local=stored||localPhotoFor(p);
 return local===PHOTO_PENDING||ILLUSTRATIVE_LOCAL_PATHS.has(local)?'pending':LICENSED_LOCAL_PATHS.has(local)?'licensed':'local';
};
export const photoFor=p=>{
 const stored=String(p?.image_url||'').trim();
 if(stored&&!stored.startsWith('/imagens/'))return stored;
 const local=stored||localPhotoFor(p);
 return ILLUSTRATIVE_LOCAL_PATHS.has(local)?PHOTO_PENDING:local;
};
export const photoFallbackFor=p=>{
 const stored=String(p?.image_url||'').trim();
 const local=stored.startsWith('/imagens/')?stored:localPhotoFor(p);
 return ILLUSTRATIVE_LOCAL_PATHS.has(local)?PHOTO_PENDING:local;
};
export const CATEGORIES=["Todos","Cervejas","Whisky","Gin","Doses","Batidas","Caipirinhas","Vinhos","Bebidas prontas","Águas e Refrigerantes","Complementos","Doces e Balas","Salgadinhos","Diversos","Doces e Snacks","Bebidas","Águas","Combos","Tabacaria"];
// As doses e as combinações têm gelo e energético identificados individualmente no pedido.
export const isDoseProduct=p=>['Whisky','Gin','Doses'].includes(p?.category);
export const energyMatchesDose=(product,energy)=>{
 const name=String(product?.name||'').toLowerCase(),choice=String(energy?.name||'');
 // O energético Red Bull e o gelo já vêm inclusos no preço de whisky e gin;
 // a exceção é a dose cujo nome especifica Vibe.
 return name.includes('com vibe')?choice==='Vibe Original':choice.startsWith('Red Bull');
};
export const optionAvailable=o=>Boolean(o&&o.active&&(o.unlimited||o.stock>0));
export const fmt = cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(cents)||0)/100);
export const esc = value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const pad = n=>'#'+String(n??0).padStart(4,'0');
export const labels={cash:'Dinheiro',card:'Cartão na retirada',pix:'Pix',apple:'Apple Pay',google:'Google Pay'};
export const stageLabels={received:'Recebido',preparing:'Preparando',ready:'Pronto',delivered:'Entregue',cancelled:'Cancelado'};
export const priceParse = value=>{
  const s=String(value??'').trim().replace(/\s/g,'').replace(/^R\$/i,'').replace(/\./g,'').replace(',','.');
  if(!s || !/^\d+(?:\.\d{1,2})?$/.test(s))return null;
  const result=Math.round(Number(s)*100);
  return Number.isSafeInteger(result)?result:null;
};
export const toast=(message,error=false)=>{
  let el=document.querySelector('#toast');
  if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.append(el);}
  el.textContent=message;el.className='toast show'+(error?' error':'');
  clearTimeout(globalThis.__adegaToast);globalThis.__adegaToast=setTimeout(()=>el.classList.remove('show'),4500);
};
const authKey='adega_admin_session_v1';
export const authRead=()=>{try{return JSON.parse(localStorage.getItem(authKey)||'null');}catch{return null;}};
export const authSave=s=>localStorage.setItem(authKey,JSON.stringify(s));
export const authClear=()=>localStorage.removeItem(authKey);
let refreshPromise;
export async function api(route,body={},opts={}){
  const method=opts.method || (body===null?'GET':'POST');
  let session=authRead();
  if(opts.admin && session?.expires_at && session.expires_at*1000 < Date.now()+45000 && session.refresh_token){
    if(!refreshPromise)refreshPromise=api('refresh',{refresh_token:session.refresh_token}).then(authSave).finally(()=>refreshPromise=null);
    await refreshPromise;session=authRead();
  }
  const headers={'Accept':'application/json'};
  if(method!=='GET')headers['Content-Type']='application/json';
  if(opts.admin && session?.token)headers['Authorization']='Bearer '+session.token;
  if(opts.tvCode)headers['X-TV-Code']=opts.tvCode;
  const response=await fetch('/api?route='+encodeURIComponent(route),{method,headers,body:method==='GET'?undefined:JSON.stringify(body),cache:'no-store'});
  let data;try{data=await response.json();}catch{throw Error('O servidor não respondeu corretamente.');}
  if(!response.ok)throw Error(data?.error||'Falha de conexão.');
  return data;
}
export const setBrand=(name)=>document.querySelectorAll('.brand-name').forEach(e=>e.textContent=name||'ADEGA DIGITAL');
export const minutesAgo=iso=>{
  const d=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));
  return d<1?'Agora':d+' min atrás';
};
