// Fotografias de embalagens reais pesquisadas. Links de terceiros: podem sair do ar ou impedir incorporação.
// Quando falhar, o site mostra a foto original do estoque (arquivo local).
// A imagem salva pelo proprietário no admin sempre tem prioridade sobre estas referências.
export const REAL_PRODUCT_PHOTOS = Object.freeze({
  "Heineken": "https://cdn.irmaospatrocinio.com.br/img/p/1/5/7/4/9/7/157497-thickbox_default.jpg",
  "Corona": "https://down-br.img.susercontent.com/file/sg-11134201-824g0-mf4hq3db8irvc9",
  "Spaten": "https://zonasul.vtexassets.com/arquivos/ids/3665468/VF4qT-qqCUAAAAAAAAcCMw.jpg?v=638593739030970000",
  "Budweiser": "https://bistek.vtexassets.com/arquivos/ids/209624/1868675%20Cerveja%20Budweiser%20American%20Lager%20Long%20Neck%20330ml..png?v=639016814605600000",
  "Doritos": "https://precopopular.vtexassets.com/arquivos/ids/211833/747728.jpg?v=638503540612900000",
  "Fandangos": "https://tfchgi.vteximg.com.br/arquivos/ids/179464-1000-1000/62918.jpg.jpg?v=638744594880470000"
});
export const photoSlug = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const localPhotoFor = p => '/imagens/' + photoSlug(p?.name||'foto-pendente') + '.webp';
export const photoFor = p => {
  // Sempre respeitar qualquer upload ou link personalizado pelo administrador.
  const stored = String(p?.image_url||'').trim();
  if (stored && !stored.startsWith('/imagens/')) return stored;
  return REAL_PRODUCT_PHOTOS[p?.name] || stored || localPhotoFor(p);
};
export const photoFallbackFor = p => {
  const stored = String(p?.image_url||'').trim();
  return stored.startsWith('/imagens/') ? stored : localPhotoFor(p);
};
export const CATEGORIES=["Todos","Cervejas","Doses","Batidas","Caipirinhas","Vinhos","Bebidas prontas","Águas e Refrigerantes","Complementos","Doces e Balas","Salgadinhos","Diversos","Doces e Snacks","Bebidas","Águas","Combos","Tabacaria"];
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
