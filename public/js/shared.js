// Referências de imagens de embalagens encontradas em pesquisas individuais.\n// Não implicam licença comercial: confirmar direitos de utilização antes de manter em produção.
// Quando falhar, o site mostra a foto original do estoque (arquivo local).
// A imagem salva pelo proprietário no admin sempre tem prioridade sobre estas referências.
export const REAL_PRODUCT_PHOTOS = Object.freeze({
  "Heineken": "https://images.tcdn.com.br/img/img_prod/1099308/cerveja_heineken_long_neck_330ml_782_2_a5ef9669e349cf3c67b4090eafd5bbce.jpg",
  "Corona": "https://covabra.vtexassets.com/arquivos/ids/561900/82896.jpg?v=638925544262730000",
  "Spaten": "https://zonasul.vtexassets.com/arquivos/ids/3665468/VF4qT-qqCUAAAAAAAAcCMw.jpg?v=638593739030970000",
  "Budweiser": "https://www.extramercado.com.br/img/uploads/1/452/33197452.png",
  "Smirnoff Ice": "https://www.chegouafeira.com.br/image/cache/catalog/PRODUTOS/Smirnoff%20ICE%20275ml-500x500.jpg",
  "Doritos": "https://assets.instabuy.app.br/ib.item.image.large/l-8aea75a14a0848debe0d096a48173a48.jpeg",
  "Fandangos": "https://imgprd.martinsatacado.com.br/catalogoimg/482262/01_482262_01.jpg?ims=1000x&v=170520242304",
  "Torcida Bacon": "https://www.drogariaminasbrasil.com.br/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/image/117580f491/salgadinho-bacon-torcida-35g.jpg",
  "Torcida (embalagem roxa)": "https://promofarma.vtexassets.com/arquivos/ids/181217/salgadinho-torcida-churrasco-60g-1117443--1-.jpg?v=638839528761330000",
  "Fofura (embalagem roxa)": "https://destro.fbitsstatic.net/img/p/salgadinho-fofura-churrasco-90g-71022/257558.jpg?h=500&qs=ignore&v=202501231555&w=500",
  "Fofura (embalagem azul)": "https://down-br.img.susercontent.com/file/dfeee5a6a43c9aca81871623742e119b",
  "Trident (embalagem verde)": "https://farma22.vtexassets.com/arquivos/ids/194384-800-auto?aspect=true&height=auto&v=639059964082800000&width=800",
  "Mentos Mint": "https://drogariavenancio.vtexassets.com/arquivos/ids/1376485/51987_Z.jpg?v=639059193294300000",
  "Mentos Wild": "https://superadega.agilecdn.com.br/385307.jpg?v=512-2631630625",
  "Bubbaloo (embalagem rosa)": "https://www.palaciodasfestas.com.br/pub/media/catalog/product/cache/6fb2a49fda90fa3bc27e8290a21c793e/6/6/66769_b.png"
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
