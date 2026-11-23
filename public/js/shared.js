// Referências de imagens de embalagens encontradas em pesquisas individuais.\n// Não implicam licença comercial: confirmar direitos de utilização antes de manter em produção.
// Quando falhar, o site mostra a foto original do estoque (arquivo local).
// A imagem salva pelo proprietário no admin sempre tem prioridade sobre estas referências.
export const REAL_PRODUCT_PHOTOS = Object.freeze({
  "Heineken": "https://images.tcdn.com.br/img/img_prod/1099308/cerveja_heineken_long_neck_330ml_782_2_a5ef9669e349cf3c67b4090eafd5bbce.jpg",
  "Corona": "https://covabra.vtexassets.com/arquivos/ids/561900/82896.jpg?v=638925544262730000",
  "Spaten": "https://zonasul.vtexassets.com/arquivos/ids/3665468/VF4qT-qqCUAAAAAAAAcCMw.jpg?v=638593739030970000",
  "Budweiser": "https://www.extramercado.com.br/img/uploads/1/452/33197452.png",
  "Smirnoff Ice": "https://marketplace.loji.com.br/storage/uploads/KzQ5B4WQBJmyzRlOGYXeHAmRUUUtpzF1bfcW0aUU.png",
  "Doritos": "https://paulistaoatacadista.vtexassets.com/arquivos/ids/361722/SalgadinhoElmaChipsDoritos84gQue1.jpg?v=638379141202030000",
  "Fandangos": "https://www.drogariaminasbrasil.com.br/media/webp/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/image/38374f6a8/salgadinho-fandangos-sabor-presunto-37g-elma-chips_jpg.webp",
  "Torcida Bacon": "https://destro.fbitsstatic.net/img/p/salgadinho-torcida-sabor-bacon-60g-87636/274633.jpg?h=1000&qs=ignore&v=no-change&w=1000",
  "Torcida (embalagem roxa)": "https://www.arenaatacado.com.br/on/demandware.static/-/Sites-storefront-catalog-sv/default/dw1c2936b0/Produtos/1013050-7892840822590-salgadinho%20torcida%20churrasco%2060g-torcida-1.jpg",
  "Fofura (embalagem roxa)": "https://destro.fbitsstatic.net/img/p/salgadinho-fofura-churrasco-70g-82845/269400-1.jpg?h=1000&qs=ignore&v=no-change&w=1000",
  "Fofura (embalagem azul)": "https://gigavc.vtexassets.com/arquivos/ids/157385/68fe65586e007a2185e6c6ef.jpg?v=638970993934230000",
  "Trident (embalagem verde)": "https://www.dosecerta.com.br/uploads/dosecerta/produtos_imagens/7895800304228-41631803565901199067.jpg",
  "Mentos Mint": "https://farmaciaindiana.vtexassets.com/arquivos/ids/206709/7896262304450_0.jpg?v=638780778304170000",
  "Mentos Wild": "https://paguemenos.vtexassets.com/arquivos/ids/1085824/bala-mentos-wild-sabor-spearmint-37-5g-principal.png?v=638966493026100000",
  "Bubbaloo (embalagem rosa)": "https://www.palaciodasfestas.com.br/pub/media/catalog/product/cache/6fb2a49fda90fa3bc27e8290a21c793e/6/6/66769_b.png",
  "Fofura (embalagem vermelha)": "https://www.arenaatacado.com.br/on/demandware.static/-/Sites-storefront-catalog-sv/default/dwfcd70dde/Produtos/1012606-7892840823214-salgadinho%20fofura%20palito%20queijo%2060g-fofura-1.jpg",
  "Torcida (embalagem verde)": "https://superangeloni.vtexassets.com/arquivos/ids/232791/7892840822460-2.jpg?v=638502520456970000",
  "Lay's (embalagem preta)": "https://static.extramercado.com.br/img/uploads/1/718/33244718.png?im=Resize%2Cwidth%3D800",
  "Bala Felicidades": "https://www.havan.com.br/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/c/a/caixa-de-bombom-sortido-lacta-favoritos_1081881.jpg",
  "Caixa de bombons Lacta Felicidades": "https://www.havan.com.br/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/c/a/caixa-de-bombom-sortido-lacta-favoritos_1081881.jpg",
  "Bala Te Adoro": "https://zaffari.vtexassets.com/arquivos/ids/311578/1095517-00.jpg.jpg?v=639106578386600000",
  "Caixa de bombons Lacta Te Adoro": "https://lojasmel1.vtexassets.com/arquivos/ids/226183-800-800?aspect=true&height=800&v=638636662602430000&width=800",
  "Pilhas Panasonic": "https://carrefourbr.vtexassets.com/arquivos/ids/152582635/d6a961e722d74505b0e221faad21bfa0.jpg?v=638527213924130000",
  "51 Ice": "https://zaffari.vtexassets.com/arquivos/ids/293985/1069957-00.jpg?v=638989870365730000",
  "Trident (embalagem rosa)": "https://assets.ibecom.com.br/ib.item.image.large/l-a974796cb2c849eba7998fddab6109de.png",
  "Bubbaloo (embalagem azul)": "https://supernova.vteximg.com.br/arquivos/ids/156864-1000-1000/289.jpg?v=637177357131570000",
  "Bubbaloo": "https://a-static.mlcdn.com.br/800x800/chiclete-bubbaloo-morango-c-60-adams/docesmalu/11/36594db389595f9513340000e29a5b56.jpeg"
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
