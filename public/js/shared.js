// Origem: FOTOS-POR-PRODUTO.csv, 23/11/2026.
// Imagens de IA e desenhos não são fotografias reais; não exibir como produto confirmado.
// Não usar automaticamente links de imagens de outras lojas (possíveis bloqueios e embalagens diferentes).
export const PHOTO_PENDING='/imagens/foto-pendente.webp';
export const ILLUSTRATIVE_LOCAL_PATHS=new Set(["/imagens/51-ice.webp","/imagens/abacaxi-com-vinho.webp","/imagens/acai-batido.webp","/imagens/ballantine-s-com-red-bull.webp","/imagens/ballantine-s-com-vibe.webp","/imagens/beefeater-com-red-bull.webp","/imagens/bell-s-com-red-bull.webp","/imagens/caipirinha-de-amora.webp","/imagens/caipirinha-de-cerveja.webp","/imagens/caipirinha-de-framboesa.webp","/imagens/caipirinha-de-maracuja.webp","/imagens/caipirinha.webp","/imagens/cavalo-com-red-bull.webp","/imagens/cavalo-com-vibe.webp","/imagens/ciroc-com-red-bull.webp","/imagens/draft.webp","/imagens/ferrero-rocher.webp","/imagens/kinder-ovo.webp","/imagens/morango-com-nutella.webp","/imagens/ninho-trufado.webp","/imagens/refrigerante-em-lata.webp","/imagens/rocks-com-red-bull.webp","/imagens/seda.webp","/imagens/smirnoff-ice.webp","/imagens/spaten.webp","/imagens/vinho.webp","/imagens/ceu-azul.webp","/imagens/maracuja.webp","/imagens/frutas-vermelhas.webp","/imagens/jack-com-red-bull.webp","/imagens/red-label-com-red-bull.webp","/imagens/absolut-com-red-bull.webp","/imagens/gin-dose.webp","/imagens/bossa-nova-dose.webp","/imagens/tanqueray-dose.webp","/imagens/gelo-de-agua.webp","/imagens/halls.webp","/imagens/pirulito.webp","/imagens/fandangos.webp","/imagens/lay-s-embalagem-preta.webp","/imagens/torcida-embalagem-roxa.webp","/imagens/torcida-embalagem-verde.webp","/imagens/fofura-embalagem-azul.webp","/imagens/fofura-embalagem-vermelha.webp","/imagens/fofura-embalagem-roxa.webp","/imagens/bubbaloo-embalagem-rosa.webp","/imagens/bubbaloo-embalagem-azul.webp","/imagens/trident-embalagem-verde.webp","/imagens/mentos-mint.webp","/imagens/mentos-wild.webp","/imagens/mentos.webp","/imagens/trident.webp","/imagens/caipirinha-de-limao.webp","/imagens/caipirinha-de-morango.webp","/imagens/torcida-bacon.webp","/imagens/doritos.webp","/imagens/fofura.webp","/imagens/torcida.webp","/imagens/bubbaloo.webp","/imagens/bala-te-adoro.webp","/imagens/caipirinha-de-limao-v4.webp","/imagens/caipirinha-de-morango-v4.webp","/imagens/cavalo-com-red-bull-v4.webp"]);
export const LICENSED_LOCAL_PATHS=new Set(["/imagens/heineken.webp","/imagens/corona.webp","/imagens/budweiser.webp","/imagens/agua.webp","/imagens/balas-sortidas.webp"]);
export const photoSlug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const localPhotoFor=p=>'/imagens/'+photoSlug(p?.name||'foto-pendente')+'.webp';
const PHOTO_ALIAS={"produto-063":"/imagens/rocks-com-red-bull.webp","produto-064":"/imagens/beefeater-com-red-bull.webp","interno-800":"/imagens/seda.webp","interno-803":"/imagens/isqueiro-bic.webp","interno-804":"/imagens/piteira.webp","interno-805":"/imagens/tesoura.webp","interno-806":"/imagens/carvao-fumax.webp","interno-807":"/imagens/isqueiros-sortidos.webp","produto-001":"/imagens/corona.webp","produto-002":"/imagens/heineken.webp","produto-003":"/imagens/spaten.webp","produto-004":"/imagens/budweiser.webp","produto-005":"/imagens/jack-com-red-bull.webp","produto-006":"/imagens/cavalo-com-red-bull-v4.webp","produto-007":"/imagens/cavalo-com-vibe.webp","produto-008":"/imagens/ballantine-s-com-red-bull.webp","produto-009":"/imagens/ballantine-s-com-vibe.webp","produto-010":"/imagens/red-label-com-red-bull.webp","produto-011":"/imagens/beefeater-com-red-bull.webp","produto-012":"/imagens/bell-s-com-red-bull.webp","produto-013":"/imagens/absolut-com-red-bull.webp","produto-014":"/imagens/ciroc-com-red-bull.webp","produto-015":"/imagens/rocks-com-red-bull.webp","produto-016":"/imagens/acai-batido.webp","produto-017":"/imagens/abacaxi-com-vinho.webp","produto-018":"/imagens/ceu-azul.webp","produto-019":"/imagens/ferrero-rocher.webp","produto-020":"/imagens/kinder-ovo.webp","produto-021":"/imagens/maracuja.webp","produto-022":"/imagens/morango-com-nutella.webp","produto-023":"/imagens/frutas-vermelhas.webp","produto-024":"/imagens/ninho-trufado.webp","produto-025":"/imagens/caipirinha.webp","produto-026":"/imagens/caipirinha-de-cerveja.webp","produto-027":"/imagens/smirnoff-ice.webp","produto-028":"/imagens/51-ice.webp","produto-029":"/imagens/draft.webp","produto-030":"/imagens/refrigerante-em-lata.webp","produto-031":"/imagens/doritos.webp","produto-032":"/imagens/fofura.webp","produto-033":"/imagens/torcida.webp","produto-034":"/imagens/bubbaloo.webp","produto-035":"/imagens/trident.webp","produto-036":"/imagens/mentos.webp","produto-037":"/imagens/bala-felicidades.webp","produto-038":"/imagens/bala-te-adoro.webp","produto-039":"/imagens/balas-sortidas.webp","produto-040":"/imagens/gel-kids.webp","produto-041":"/imagens/pilhas-panasonic.webp","produto-042":"/imagens/caipirinha-de-limao-v4.webp","produto-043":"/imagens/caipirinha-de-morango-v4.webp","produto-044":"/imagens/caipirinha-de-maracuja.webp","produto-045":"/imagens/caipirinha-de-amora.webp","produto-046":"/imagens/caipirinha-de-framboesa.webp","produto-047":"/imagens/fandangos.webp","produto-048":"/imagens/lay-s-embalagem-preta.webp","produto-049":"/imagens/fofura-embalagem-azul.webp","produto-050":"/imagens/fofura-embalagem-vermelha.webp","produto-051":"/imagens/fofura-embalagem-roxa.webp","produto-052":"/imagens/torcida-bacon.webp","produto-053":"/imagens/torcida-embalagem-roxa.webp","produto-054":"/imagens/torcida-embalagem-verde.webp","produto-055":"/imagens/bubbaloo-embalagem-rosa.webp","produto-056":"/imagens/bubbaloo-embalagem-azul.webp","produto-057":"/imagens/trident-embalagem-verde.webp","produto-058":"/imagens/trident-embalagem-rosa.webp","produto-059":"/imagens/mentos-mint.webp","produto-060":"/imagens/mentos-wild.webp","produto-061":"/imagens/agua.webp","produto-062":"/imagens/gin-dose.webp","produto-065":"/imagens/bossa-nova-dose.webp","produto-066":"/imagens/tanqueray-dose.webp","produto-067":"/imagens/gelo-de-agua.webp","produto-070":"/imagens/balas-sortidas.webp","interno-801":"/imagens/carvao-fumax.webp","produto-068":"/imagens/halls.webp","produto-069":"/imagens/pirulito.webp"};
const REPLACED_PHOTOS={"produto-042":"/imagens/caipirinha-de-limao.webp","produto-043":"/imagens/caipirinha-de-morango.webp","produto-006":"/imagens/cavalo-com-red-bull.webp"};
const localPhotoPath=p=>{
 const stored=String(p?.image_url||'').trim();
 if(stored&&stored!==PHOTO_PENDING&&stored!==REPLACED_PHOTOS[p?.id])return stored;
 return PHOTO_ALIAS[p?.id]||(stored||localPhotoFor(p));
};
export const photoStatusFor=p=>{
 const local=localPhotoPath(p);
 if(!local.startsWith('/imagens/'))return 'custom';
 if(local===PHOTO_PENDING)return 'pending';
 if(ILLUSTRATIVE_LOCAL_PATHS.has(local))return 'illustrative';
 return LICENSED_LOCAL_PATHS.has(local)?'licensed':'local';
};
const NAME_CORRECTIONS={"produto-049":["Fofura (embalagem azul)","Fofura Presunto"],"produto-051":["Fofura (embalagem roxa)","Fofura Churrasco"],"produto-053":["Torcida (embalagem roxa)","Torcida Churrasco"],"produto-055":["Bubbaloo (embalagem rosa)","Bubbaloo Tutti-Frutti"],"produto-056":["Bubbaloo (embalagem azul)","Bubbaloo Hortelã"],"produto-057":["Trident (embalagem verde)","Trident Melancia"],"produto-048":["Lay's (embalagem preta)","Lay's Sensações"],"produto-031":["Doritos","Doritos Queijo Nacho"],"produto-047":["Fandangos","Fandangos Presunto"],"produto-050":["Fofura (embalagem vermelha)","Fofura Queijo"],"produto-054":["Torcida (embalagem verde)","Torcida Pimenta Mexicana"],"produto-058":["Trident (embalagem rosa)","Trident — sabor a confirmar"]};
export const normalizeProduct=p=>{const known=NAME_CORRECTIONS[p?.id];let name=known&&p.name===known[0]?known[1]:p.name;if(p.id==='produto-048'&&["Lay's Sensações","Lay's (embalagem preta)"].includes(name))name="Lay's Sensações Peito de Peru";if(p.id==='produto-029'&&name==='Draft')name='Draft Uva Roxa';if(p.id==='produto-060'&&name==='Mentos Wild')name='Mentos Wild Spearmint';return name===p.name?p:{...p,name};};
const LEGACY_DUPLICATE_NAMES={"produto-032":"Fofura","produto-033":"Torcida","produto-034":"Bubbaloo","produto-035":"Trident","produto-036":"Mentos","produto-011":"Beefeater com Red Bull","produto-015":"Rocks com Red Bull","produto-039":"Balas sortidas"};
export const unconfirmedDuplicate=p=>Boolean(p&&!p.active&&!p.unlimited&&!(p.stock>0)&&(LEGACY_DUPLICATE_NAMES[p.id]===p.name||p.id==='produto-058'&&['Trident (embalagem rosa)','Trident — sabor a confirmar'].includes(p.name)));

export const photoFor=p=>localPhotoPath(p);
export const photoFallbackFor=p=>{
 const local=localPhotoPath(p);
 return local.startsWith('/imagens/')?local:(PHOTO_ALIAS[p?.id]||localPhotoFor(p));
};
export const CATEGORIES=["Todos","Cervejas","Whisky","Gin","Vodka","Batidas","Caipirinhas","Vinhos","Bebidas prontas","Águas e Refrigerantes","Doces e Salgadinhos","Diversos","Bebidas","Águas","Combos","Doces e Balas","Salgadinhos","Doces e Snacks","Complementos","Doses","Tabacaria"];
export const catalogCategory=p=>p?.category==='Doses'?'Vodka':['Doces e Balas','Salgadinhos','Doces e Snacks','Doces e Salgadinhos'].includes(p?.category)?'Doces e Salgadinhos':p?.category;
export const isStandaloneIce=p=>p?.id==='produto-067'||p?.category==='Complementos'&&photoSlug(p?.name)==='gelo-de-agua';
export const publicCatalogProduct=p=>p?.category!=='Tabacaria'&&!unconfirmedDuplicate(p)&&!isStandaloneIce(p)&&(p?.category!=='Caipirinhas'||['Caipirinha de Limão','Caipirinha de Morango'].includes(p.name));
export const isDoseProduct=p=>['Whisky','Gin'].includes(p?.category);
export const productDescription=p=>{
 if(p?.category==='Batidas')return 'Batida de 700 ml. Escolha com ou sem álcool.';
 if(isHouseGin(p))return 'Gin de 700 ml com gelo e energético. Escolha Energético ou Red Bull.';
 if(p?.name==='Caipirinha de Limão')return 'Caipirinha de limão no copo de 700 ml.';
 if(p?.name==='Caipirinha de Morango')return 'Caipirinha de morango no copo de 700 ml.';
 if(isDoseProduct(p)&&(!p.description||/personalize após|dose com gelo e energético inclusos/i.test(p.description)))return 'Copo de 700 ml com gelo e energético inclusos.';
 if(catalogCategory(p)==='Vodka'&&/gelo e energético|personalize após/i.test(p.description||''))return 'Dose no copo de 700 ml com Red Bull.';
 if(p?.category==='Cervejas'&&/imagem ilustrativa para conferência/i.test(p.description||''))return 'Cerveja gelada.';
 if(p?.category==='Batidas'&&/imagem ilustrativa para conferência/i.test(p.description||''))return 'Batida no copo de 700 ml.';
 if(/imagem ilustrativa para conferência/i.test(p?.description||''))return 'Confira a disponibilidade e retire no portão.';
 return p?.description||'Escolha a quantidade e retire no portão.';
};
export const isHouseGin=p=>p?.id==='produto-062'&&p.category==='Gin';
export const isCommonEnergy=o=>String(o?.name||'')==='Energético'||String(o?.name||'').startsWith('Energético — ');
export const doseUnitPrice=(p,energy)=>Number(p?.price_cents||0)+(isHouseGin(p)&&String(energy?.name||'').startsWith('Red Bull')?1000:0);
export const energyMatchesDose=(product,energy)=>{
 if(isHouseGin(product))return isCommonEnergy(energy)||String(energy?.name||'').startsWith('Red Bull');
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
export const setBrand=(name)=>document.querySelectorAll('.brand-name').forEach(e=>e.textContent=(!name||/^adega digital$/i.test(name.trim()))?'Hora Extra Drinks':name);
export const minutesAgo=iso=>{
  const d=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));
  return d<1?'Agora':d+' min atrás';
};
