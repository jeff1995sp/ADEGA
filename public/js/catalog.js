import {api,CATEGORIES,fmt,esc,pad,priceParse,toast,setBrand,stageLabels,photoFor,photoFallbackFor,photoStatusFor,catalogCategory,isStandaloneIce,productDescription,isDoseProduct,energyMatchesDose,optionAvailable,isHouseGin,isCommonEnergy,doseUnitPrice,normalizeProduct,unconfirmedDuplicate} from './shared.js?v=20261124-12';

let products=[],drinkOptions=[],shop={name:'Hora Extra Drinks',accepting_orders:true},category='Todos',working=false,lastSnapshot='',doseSelected=null;
const cart=new Map();
let bestSellers=[];
let currentOrder=null,searchText='',shakeSelected=null;
const isShake=p=>p?.category==='Batidas';
const validShake=v=>v==='com'||v==='sem';
const $=id=>document.getElementById(id);
const photoSlug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const open=id=>$(id)?.classList.add('open');
const close=id=>$(id)?.classList.remove('open');
const available=p=>p.active && p.price_cents>0 && (p.unlimited || p.stock>0) && shop.accepting_orders;
const total=()=>[...cart.values()].reduce((sum,item)=>sum+doseUnitPrice(products.find(p=>p.id===item.id),optionById(item.energy_id))*item.quantity,0);
const count=()=>[...cart.values()].reduce((sum,item)=>sum+item.quantity,0);
// O dono confirmou que somente limão e morango seguem no catálogo de caipirinhas.
const visibleInCatalog=p=>p.active&&p.price_cents>0&&(p.unlimited||p.stock>0)&&(!isDoseProduct(p)||hasDrinkOptions(p))&&!unconfirmedDuplicate(p)&&!isStandaloneIce(p)&&(p.category!=='Caipirinhas'||['Caipirinha de Limão','Caipirinha de Morango','Caipirinha de cerveja'].includes(p.name));
const desiredQty=p=>[...cart.values()].filter(i=>i.id===p.id).reduce((sum,i)=>sum+i.quantity,0);
const optionById=id=>drinkOptions.find(o=>o.id===id);
const drinkChoiceList=(group,p)=>drinkOptions.filter(o=>o.option_group===group&&(group!=='energy'||energyMatchesDose(p,o)));
const hasDrinkOptions=p=>drinkChoiceList('ice',p).some(remainingOption)&&drinkChoiceList('energy',p).some(remainingOption);
const iceSummary=item=>{
 if(validShake(item.shake_alcohol))return item.shake_alcohol==='com'?'Com álcool':'Sem álcool';
 if(!item.ice_id)return '';
 return 'Gelo: '+(optionById(item.ice_id)?.name||'indisponível')+' · Energético: '+(optionById(item.energy_id)?.name||'indisponível');
};
const getAvailableOption=id=>{const o=optionById(id);return optionAvailable(o)?o:null;};
const amountUsed=(id,field)=>[...cart.values()].filter(i=>i[field]===id).reduce((s,i)=>s+i.quantity,0);
const remainingOption=o=>optionAvailable(o)&&(o.unlimited||amountUsed(o.id,o.option_group==='ice'?'ice_id':'energy_id')<o.stock);
const availableOptionMarkup=(choices,placeholder)=>`<option value="">${esc(placeholder)}</option>`+choices.filter(remainingOption).map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');
const preferredEnergy=(choices,name)=>choices.find(o=>o.name===name&&remainingOption(o))||choices.find(remainingOption);

const productCard=(p,featured=false)=>{
  const left=p.unlimited?'Disponível':p.stock>0?`${p.stock} em estoque`:'Esgotado';
  const inactive=!p.active?'Indisponível — produto pausado':!p.price_cents?'Indisponível — preço a definir':!p.unlimited && !p.stock?'Indisponível — esgotado':!shop.accepting_orders?'Indisponível — pedidos pausados':null;
  const q=desiredQty(p);
  const customizable=isDoseProduct(p);
  const canConfigure=available(p)&&hasDrinkOptions(p)&&Boolean(p.unlimited||q<p.stock);
  const availabilityText=inactive||(customizable&&!hasDrinkOptions(p)?'Indisponível — gelo ou energético sem estoque':left);
  const blocked=Boolean(inactive||(customizable&&!hasDrinkOptions(p)));
  const simpleBlocked=blocked&&!customizable&&!isShake(p)&&q===0;
  const packaged = ['Cervejas','Doces e Salgadinhos','Diversos','Bebidas prontas','Águas e Refrigerantes','Tabacaria'].includes(catalogCategory(p));
  const fallback = photoFallbackFor(p);
  const status=photoStatusFor(p);
  const photoNote=status==='pending'?'<span class="photo-note">Foto real pendente</span>':status==='licensed'?'<span class="photo-note">Foto real ilustrativa</span>':(status==='illustrative'||status==='custom'&&['Whisky','Gin','Vodka','Batidas','Caipirinhas'].includes(catalogCategory(p)))?'<span class="photo-note">Imagem ilustrativa</span>':'';
  const media = `<img class="product-photo" src="${esc(photoFor(p))}" data-fallback="${esc(fallback)}" alt="Foto do produto ${esc(p.name)}" loading="lazy" onerror="if(this.dataset.fallback){const f=this.dataset.fallback;delete this.dataset.fallback;this.src=f}else{this.onerror=null;this.src='/imagens/foto-pendente.webp'}">`;
  return `<article class="product ${featured?'hora-best-seller':''} ${blocked?'product-unavailable':''} ${simpleBlocked?'product-simple-blocked':''}">
    <div class="product-visual ${packaged?'packshot':''}">${media}${featured?'<span class="hora-best-label">Mais vendido</span>':''}<span class="flag">${esc(catalogCategory(p))}</span>${photoNote}</div>
    <div class="product-content"><h3>${esc(p.name)}</h3><p>${esc(productDescription(p))}</p>
    <span class="tiny product-availability ${!p.unlimited&&p.stock<=5?'warn':''}"><span class="desktop-availability">${availabilityText}</span><span class="mobile-availability">${availabilityText.replace(/^Indisponível — /,'')}</span></span>
    <div class="product-footer"><span class="price">${p.price_cents?(isHouseGin(p)?'A partir de '+fmt(p.price_cents):fmt(p.price_cents)):'Preço em breve'}</span>
    ${isShake(p)?`<div class="qty dose-qty" data-count="${q}"><strong>${q} no carrinho</strong><button type="button" class="btn btn-primary btn-sm" data-shake="${esc(p.id)}" ${!available(p)||(!p.unlimited&&q>=p.stock)?'disabled':''}>${available(p)&&(p.unlimited||q<p.stock)?'Com ou sem álcool':'Indisponível'}${q>0?`<span class="mobile-dose-count"> · ${q}</span>`:''}</button></div>`:customizable?`<div class="qty dose-qty" data-count="${q}"><strong>${q} no carrinho</strong><button type="button" class="btn btn-primary btn-sm" data-configure="${esc(p.id)}" ${!canConfigure?'disabled':''}>${!canConfigure?'Indisponível':isHouseGin(p)?'Escolher energético e gelo':'Escolher gelo'}${q>0?`<span class="mobile-dose-count"> · ${q}</span>`:''}</button></div>`:`<div class="qty"><button type="button" aria-label="Diminuir ${esc(p.name)}" data-qty="-1" data-id="${p.id}" ${q<1?'disabled':''}>−</button><strong>${q}</strong><button type="button" aria-label="Adicionar ${esc(p.name)}" data-qty="1" data-id="${p.id}" ${!available(p)||(!p.unlimited&&q>=p.stock)?'disabled':''}>+</button></div>${simpleBlocked?'<button type="button" class="mobile-unavailable-button" disabled>Indisponível</button>':''}`}</div>${q>0&&available(p)&&p.category!=='Tabacaria'?`<button type="button" class="btn btn-primary product-pay-now" data-pay-now aria-label="Ir para pagamento com todos os itens do carrinho">Ir para pagamento <span aria-hidden="true">→</span></button>`:''}</div></article>`;
};
const categoryIcons={"Todos":"<svg class=\"hora-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.4\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1.4\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.4\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1.4\"/></svg>","Batidas":"<svg class=\"hora-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 8h14l-2 13H7L5 8ZM4 8h16M13 8l3-6h4M8 13h8\"/></svg>","Whisky":"<svg class=\"hora-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M10 3h4v5l3 3v9H7v-9l3-3V3ZM9 3h6M7 13h10M7 17h10\"/></svg>","Vodka":"<svg class=\"hora-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M10 3h4v5l3 3v9H7v-9l3-3V3ZM9 3h6M7 13h10M7 17h10\"/></svg>","Gin":"<svg class=\"hora-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 4h18l-9 10L3 4ZM12 14v7M7 21h10M16 4l3-3M7 8h10\"/></svg>","Cervejas":"<svg class=\"hora-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 7h12v14H5zM17 9h3v8h-3M5 7V5a2 2 0 0 1 4-1 3 3 0 0 1 5 0 2 2 0 0 1 3 2v1M9 11v6M13 11v6\"/></svg>","Caipirinhas":"<svg class=\"hora-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 4h18l-9 10L3 4ZM12 14v7M7 21h10M16 4l3-3M7 8h10\"/></svg>","Bebidas prontas":"<svg class=\"hora-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"7\" y=\"3\" width=\"10\" height=\"18\" rx=\"2\"/><path d=\"M8 6h8M8 18h8m5-9-3 4h4l-3 4\"/></svg>","Águas e Refrigerantes":"<svg class=\"hora-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M10 3h4v4l2 2v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l2-2V3ZM8 13h8M8 17h8\"/></svg>","Doces e Salgadinhos":"<svg class=\"hora-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"7\" y=\"7\" width=\"10\" height=\"10\" rx=\"3\" transform=\"rotate(-30 12 12)\"/><path d=\"m6 10-4-3 1 7 4-1m11 1 4 3-1-7-4 1\"/></svg>","Diversos":"<svg class=\"hora-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l10 4\"/></svg>","Vinhos":"<svg class=\"hora-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M8 3h8l2 6a6 6 0 0 1-12 0l2-6ZM7 10h10M12 15v6M8 21h8\"/></svg>","Tabacaria":"<svg class=\"hora-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3c.5 3.5-3 5-3 9a5 5 0 0 0 10 0c0-3-2-5.5-3-7-1 2-2.5 2.5-3 1 .5-1 0-2.5-1-3Z\"/></svg>"};
const categoryLabel=c=>c==='Todos'?'Todos os Produtos':c==='Batidas'?'Batidas (700 ml)':c;
const categoryCover={'Batidas':'/imagens/morango-com-nutella.webp','Whisky':'/imagens/jack-com-red-bull-natural-v5.webp','Vodka':'/imagens/absolut-com-red-bull-natural-v5.webp','Gin':'/imagens/beefeater-com-red-bull-natural-v5.webp','Cervejas':'/imagens/heineken.webp','Caipirinhas':'/imagens/caipirinha-de-limao-v4.webp','Bebidas prontas':'/imagens/draft.webp','Águas e Refrigerantes':'/imagens/refrigerante-em-lata.webp','Doces e Salgadinhos':'/imagens/doritos.webp','Diversos':'/imagens/pilhas-panasonic.webp','Tabacaria':'/imagens/seda.webp'};
const publicCategoryOrder=['Todos','Batidas','Caipirinhas','Whisky','Vodka','Gin','Cervejas','Bebidas prontas','Águas e Refrigerantes','Doces e Salgadinhos','Vinhos','Diversos','Tabacaria'];
let viewedCategory='Todos',categoryFrame=0;
function syncViewedCategory(){
 categoryFrame=0;
 const tabs=$('mobileCategoryTabs');
 if(!tabs||!matchMedia('(max-width:800px)').matches)return;
 let next=category;
 if(category==='Todos'&&!searchText){
  const header=document.querySelector('.hora-nav'),grid=$('productGrid');
  const line=Math.max(0,header.getBoundingClientRect().bottom)+Math.min(64,window.innerHeight*.1);
  if(grid.getBoundingClientRect().bottom>line){
   for(const heading of grid.querySelectorAll('[data-scroll-section]')){
    if(heading.getBoundingClientRect().top<=line)next=heading.dataset.scrollSection;
    else break;
   }
  }
 }
 const changed=next!==viewedCategory;
 viewedCategory=next;
 let activeButton=null;
 for(const button of tabs.querySelectorAll('[data-category]')){
  const active=button.dataset.category===next;
  button.classList.toggle('active',active);
  if(active){button.setAttribute('aria-current','true');activeButton=button;}
  else button.removeAttribute('aria-current');
 }
 if(activeButton&&(changed||!activeButton.dataset.scrollAligned)){
  const outer=tabs.getBoundingClientRect(),inner=activeButton.getBoundingClientRect();
  if(inner.left<outer.left+6||inner.right>outer.right-6){
   tabs.scrollLeft+=inner.left-outer.left-(outer.width-inner.width)/2;
  }
  activeButton.dataset.scrollAligned='true';
 }
}
function queueViewedCategory(){if(!categoryFrame)categoryFrame=requestAnimationFrame(syncViewedCategory);}
function showCategories(){
 const exist=new Set(products.filter(p=>visibleInCatalog(p)).map(catalogCategory));
 const cats=[...new Set([...publicCategoryOrder,...CATEGORIES])].filter(c=>c==='Todos'||exist.has(c));
 if(!cats.includes(category))category='Todos';
 $('categorySideLinks').innerHTML=cats.map(c=>`<button type="button" class="hora-side-link ${c===category?'active':''}" data-category="${esc(c)}" aria-pressed="${c===category}"><span aria-hidden="true">${categoryIcons[c]||categoryIcons.Diversos}</span>${esc(categoryLabel(c))}</button>`).join('');
 const mobileTabs=$('mobileCategoryTabs'),mobileScroll=mobileTabs.scrollLeft;
 const displayCategory=category==='Todos'&&!searchText?viewedCategory:category;
 const mobileMarkup=cats.map(c=>`<button type="button" class="mobile-category-chip ${c===displayCategory?'active':''}" data-category="${esc(c)}" aria-pressed="${c===category}"${c===displayCategory?' aria-current="true"':''}>${esc(c==='Todos'?'Todos':categoryLabel(c))}</button>`).join('');
 if(mobileTabs.innerHTML!==mobileMarkup){mobileTabs.innerHTML=mobileMarkup;mobileTabs.scrollLeft=mobileScroll;}
 $('categoryTabs').innerHTML=cats.filter(c=>c!=='Todos').map(c=>{
  const sample=products.find(p=>visibleInCatalog(p)&&catalogCategory(p)===c&&photoStatusFor(p)!=='pending');
  const photo=categoryCover[c]||(sample?photoFor(sample):null);
  return `<button type="button" class="tab ${c===category?'active':''} ${['Batidas','Caipirinhas'].includes(c)?'hora-category-featured':''}" data-category="${esc(c)}" aria-pressed="${c===category}"><span class="hora-category-media">${photo?`<img src="${esc(photo)}" alt="" loading="lazy">`:`<span class="category-symbol">${categoryIcons[c]||categoryIcons.Diversos}</span>`}</span><span class="hora-category-label">${categoryIcons[c]||categoryIcons.Diversos}<strong>${esc(categoryLabel(c))}</strong></span></button>`;
 }).join('');
}
function snackGroup(p){
 const n=photoSlug(p.name);
 if(/trident|bubbaloo|plutonita|chiclete/.test(n))return 'Chicletes';
 if(/doritos|fofura|torcida|fandangos|lays|lay-s|salgadinho|rikitos/.test(n))return 'Salgadinhos';
 if(/halls|mentos|bala|pirulito/.test(n))return 'Balas e pirulitos';
 return 'Doces e chocolates';
}
function tabacariaGroup(p){
 const n=photoSlug(p.name);
 if(/seda|sadhu|piteira|tabaco|tabaquin|acrema/.test(n))return 'Sedas, Piteiras e Tabacos';
 if(/gift|eight|cigarro/.test(n))return 'Cigarros';
 if(/isqueiro|bic|tesoura|cuia/.test(n))return 'Isqueiros e Acessórios';
 return 'Essências e Narguilé';
}
let lastCartCount=0;
function pulseCart(){const el=$('headerCart');if(!el)return;el.classList.remove('cart-attention');void el.offsetWidth;el.classList.add('cart-attention');}
function renderProducts(){
 showCategories();
 const general=products.filter(p=>visibleInCatalog(p));
 const norm=photoSlug(searchText);
 const list=general.filter(p=>(category==='Todos'||catalogCategory(p)===category)&&(!norm||photoSlug(p.name+' '+catalogCategory(p)).includes(norm)));
 $('catalogHeading').textContent=searchText?'RESULTADOS DA BUSCA':category==='Todos'?'DESTAQUES DA HORA EXTRA':categoryLabel(category).toUpperCase();
 $('catalogResultCount').textContent=list.length+' produtos';
 const message='<div class="empty">Nenhum produto encontrado.</div>';
 if(category==='Doces e Salgadinhos'&&list.length){
  const groups=['Salgadinhos','Chicletes','Balas e pirulitos','Doces e chocolates'];
  $('productGrid').innerHTML=groups.map(group=>{
   const rows=list.filter(p=>snackGroup(p)===group).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
   return rows.length?`<h3 class="hora-product-group">${group}</h3>`+rows.map(p=>productCard(p)).join(''):'';
  }).join('');
 }else if(category==='Tabacaria'&&list.length){
  const groups=['Essências e Narguilé','Sedas, Piteiras e Tabacos','Cigarros','Isqueiros e Acessórios'];
  $('productGrid').innerHTML=groups.map(group=>{
   const rows=list.filter(p=>tabacariaGroup(p)===group).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
   return rows.length?`<h3 class="hora-product-group">${group}</h3>`+rows.map(p=>productCard(p)).join(''):'';
  }).join('');
 }else{
  const ordered=category==='Todos'?[...list].sort((a,b)=>publicCategoryOrder.indexOf(catalogCategory(a))-publicCategoryOrder.indexOf(catalogCategory(b))||(a.sort_order||0)-(b.sort_order||0)):list;
  const featured=category==='Todos'&&!norm?bestSellers.map(id=>ordered.find(p=>p.id===id)).filter(p=>p&&available(p)&&(!isDoseProduct(p)||hasDrinkOptions(p))):[];
  const featuredIds=new Set(featured.map(p=>p.id));
  const rest=ordered.filter(p=>!featuredIds.has(p.id));
  let previousSection=null;
  const restMarkup=rest.map(p=>{
   const section=catalogCategory(p);
   const heading=category==='Todos'&&!norm&&section!==previousSection?`<h3 class="mobile-scroll-section" data-scroll-section="${esc(section)}">${esc(categoryLabel(section))}</h3>`:'';
   previousSection=section;
   return heading+productCard(p);
  }).join('');
  $('productGrid').innerHTML=ordered.length?(featured.length?'<h3 class="hora-product-group hora-best-heading">MAIS VENDIDOS <small>Últimos 30 dias</small></h3>'+featured.map(p=>productCard(p,true)).join('')+(rest.length?'<h3 class="hora-product-group">TODOS OS OUTROS PRODUTOS</h3>':''):'')+restMarkup:message;
 }
 $('endCategory').innerHTML='';
 queueViewedCategory();
 document.body.classList.toggle('mobile-cart-active',count()>0&&Boolean(shop.accepting_orders));
 $('cartCount').textContent=`${count()} ${count()===1?'item':'itens'}`;
 $('headerCartCount').textContent=count();
 $('headerCart').classList.toggle('cart-has-items',count()>0);
 if(count()>lastCartCount)pulseCart();lastCartCount=count();
 $('cartTotal').textContent=fmt(total());
 $('openCart').disabled=count()===0||!shop.accepting_orders;
 $('goPayment').disabled=$('openCart').disabled;
 $('checkoutGoPayment').disabled=$('openCart').disabled;
 $('checkoutQuickTotal').textContent=fmt(total());
}
function cleanCart(){
 let changed=false;
 const productsUsed=new Map(),optionsUsed=new Map();
 for(const [key,item] of cart){
  const p=products.find(x=>x.id===item.id);
  if(!p||!available(p)){cart.delete(key);changed=true;continue;}
  let max=p.unlimited?99:Math.max(0,p.stock-(productsUsed.get(item.id)||0));
  if(isDoseProduct(p)){
   if(!item.ice_id||!item.energy_id){cart.delete(key);changed=true;continue;}
   for(const [field,group] of [['ice_id','ice'],['energy_id','energy']]){
    const o=getAvailableOption(item[field]);
    if(!o||o.option_group!==group||(group==='energy'&&!energyMatchesDose(p,o))){max=0;break;}
    if(!o.unlimited)max=Math.min(max,Math.max(0,o.stock-(optionsUsed.get(o.id)||0)));
   }
  }else if(item.ice_id||item.energy_id){max=0;}
  if(isShake(p)?!validShake(item.shake_alcohol):item.shake_alcohol!=null)max=0;
  const quantity=Math.min(item.quantity,max);
  if(quantity<=0){cart.delete(key);changed=true;continue;}
  if(quantity!==item.quantity){item.quantity=quantity;changed=true;}
  productsUsed.set(item.id,(productsUsed.get(item.id)||0)+quantity);
  if(item.ice_id)optionsUsed.set(item.ice_id,(optionsUsed.get(item.ice_id)||0)+quantity);
  if(item.energy_id)optionsUsed.set(item.energy_id,(optionsUsed.get(item.energy_id)||0)+quantity);
 }
 if(changed)toast('Carrinho atualizado conforme o estoque e os sabores disponíveis.',true);
}
function refreshHouseGinEnergy(){
 const p=doseSelected;if(!isHouseGin(p))return;
 const kind=$('doseEnergyKind').value,choices=drinkChoiceList('energy',p).filter(o=>kind==='common'?isCommonEnergy(o):kind==='redbull'&&String(o.name).startsWith('Red Bull')).filter(remainingOption);
 $('doseEnergy').innerHTML=availableOptionMarkup(choices,'Escolha o sabor');
 $('doseEnergy').disabled=!kind;
 const choice=kind?preferredEnergy(choices,kind==='redbull'?'Red Bull Original':'Energético'):null;
 $('doseEnergy').value=choice?.id||'';
 $('doseIce').disabled=!choice;
 if(!$('doseIce').value||!remainingOption(optionById($('doseIce').value)))$('doseIce').value='';
 $('dosePrice').textContent=(kind?fmt(doseUnitPrice(p,{name:kind==='redbull'?'Red Bull':''})):fmt(p.price_cents)+' / '+fmt(p.price_cents+1000))+' • Copo de 700 ml • Gelo e energético inclusos';
}
function showDoseConfigurator(p){
 if(!available(p)||!hasDrinkOptions(p))return toast('Dose ou sabores indisponíveis. O dono precisa liberar no admin.',true);
 doseSelected=p;
 $('doseTitle').textContent=p.name;
 $('dosePrice').textContent=fmt(p.price_cents)+' • Copo de 700 ml • Gelo e energético inclusos';
 const choices=drinkChoiceList('ice',p).filter(remainingOption);
 const energies=drinkChoiceList('energy',p).filter(remainingOption);
 $('doseIce').innerHTML=availableOptionMarkup(choices,'Escolha o gelo');
 $('doseEnergy').innerHTML=availableOptionMarkup(energies,'Escolha o energético');
 const vibe=p.name.toLowerCase().includes('com vibe');
 $('doseEnergyLabel').textContent=vibe?'Vibe incluído':'Red Bull incluído — sabor';
 const house=isHouseGin(p),form=$('doseForm'),iceField=$('doseIce').closest('.form-field'),energyField=$('doseEnergy').closest('.form-field');
 $('doseEnergyKindField').classList.toggle('hidden',!house);
 energyField.classList.toggle('hidden',vibe&&!house);
 $('doseIncludedEnergy').classList.toggle('hidden',!vibe||house);
 $('doseIncludedEnergy').textContent='✓ Vibe Original incluído no preço';
 $('doseEnergyKind').required=house;$('doseEnergyKind').disabled=!house;
 $('doseIce').disabled=house;$('doseEnergy').disabled=true;$('doseEnergyKind').value='';
 $('doseInstructions').textContent=house?'Escolha Energético ou Red Bull e o gelo. O valor muda conforme a escolha.':vibe?'Escolha apenas o sabor do gelo. O Vibe já está incluído no valor.':'Escolha o gelo. O Red Bull já está incluído; se quiser, altere o sabor entre os disponíveis.';
 if(house){
  form.insertBefore(energyField,iceField);
  $('doseEnergyLabel').textContent='2. Escolha o sabor do energético';$('doseIceLabel').textContent='3. Escolha o sabor do gelo';
  const common=energies.some(o=>isCommonEnergy(o)&&remainingOption(o)),redbull=energies.some(o=>String(o.name).startsWith('Red Bull')&&remainingOption(o));
  $('doseEnergyKind').innerHTML='<option value="">Escolha o energético</option>'+[['common','Energético',p.price_cents,common],['redbull','Red Bull',p.price_cents+1000,redbull]].filter(row=>row[3]).map(([v,n,price,ok])=>`<option value="${v}" ${ok?'':'disabled'}>${n} — ${fmt(price)}${ok?'':' (indisponível)'}</option>`).join('');
  refreshHouseGinEnergy();
 }else{
  form.insertBefore(iceField,energyField);
  $('doseIceLabel').textContent='Escolha o sabor do gelo';
  const choice=vibe?energies.find(o=>o.name==='Vibe Original'):preferredEnergy(energies,'Red Bull Original');
  if(!choice)return toast('Energético sem estoque disponível. Confira o carrinho.',true);
  $('doseEnergy').value=choice.id;
  $('doseEnergy').disabled=vibe;
  $('doseIce').disabled=false;
 }
 open('doseModal');syncChoiceCards();
}
function addConfiguredDose(event){
 event.preventDefault();
 if(!doseSelected)return;
 const p=products.find(x=>x.id===doseSelected.id);
 if(!p||!available(p))return toast('Esta dose está indisponível.',true);
 const ice=getAvailableOption($('doseIce').value),energy=getAvailableOption($('doseEnergy').value);
 if(!ice||!energy||ice.option_group!=='ice'||energy.option_group!=='energy'||!energyMatchesDose(p,energy)){
  return toast('Selecione um gelo e um energético disponíveis.',true);
 }
 if(!p.unlimited&&desiredQty(p)>=p.stock)return toast('Dose esgotada.',true);
 for(const o of [ice,energy])if(!o.unlimited&&amountUsed(o.id,o.option_group==='ice'?'ice_id':'energy_id')>=o.stock){
  return toast(o.name+' esgotou. Escolha outro sabor.',true);
 }
 const key=p.id+'|'+ice.id+'|'+energy.id;
 const item=cart.get(key)||{id:p.id,quantity:0,ice_id:ice.id,energy_id:energy.id};
 item.quantity++;
 cart.set(key,item);
 close('doseModal');renderProducts();
 toast('Dose adicionada com gelo '+ice.name+' e '+energy.name+'.');
}

function showStoreClosed(closed){for(const id of ['storeClosedNotice','storeClosedEntry'])$(id)?.classList.toggle('hidden',!closed);if(closed&&$('cartModal').classList.contains('open'))close('cartModal');}
let loadingCatalog=false;
async function loadCatalog(){
  if(loadingCatalog||working)return;
  loadingCatalog=true;
  try{
    const d=await api('catalog',null,{method:'GET'});
    if(working)return;
    const snapshot=JSON.stringify(d);
    showStoreClosed(d.store?.accepting_orders===false||d.store?.accepting_orders===0);
    if(snapshot===lastSnapshot)return;
    lastSnapshot=snapshot;bestSellers=Array.isArray(d.best_sellers)?d.best_sellers:[];products=(d.products||[]).map(normalizeProduct);drinkOptions=d.drink_options||[];shop=d.store||shop;
    setBrand(shop.name);updateLocationPanel();if(notificationIsPrepared&&(!shop.location_required||locationOptIn))dismissEntryPermissions();
    const banner=$('modeBanner');banner.className='mode-banner live';banner.textContent=shop.accepting_orders?'● Catálogo conectado • Estoque atualizado automaticamente':'● Pedidos temporariamente pausados pelo proprietário';
    cleanCart();renderProducts();
    if($('doseModal').classList.contains('open')&&doseSelected){
      const p=products.find(x=>x.id===doseSelected.id),ice=$('doseIce').value,energy=$('doseEnergy').value,kind=$('doseEnergyKind').value;
      if(!p||!available(p)||!hasDrinkOptions(p)||(!p.unlimited&&desiredQty(p)>=p.stock)){close('doseModal');doseSelected=null;toast('A disponibilidade desta dose mudou. Confira o cardápio.',true);}
      else {showDoseConfigurator(p);if(isHouseGin(p)&&[...$('doseEnergyKind').options].some(o=>o.value===kind&&kind)){ $('doseEnergyKind').value=kind;refreshHouseGinEnergy(); }if([...$('doseEnergy').options].some(o=>o.value===energy&&energy))$('doseEnergy').value=energy;if([...$('doseIce').options].some(o=>o.value===ice&&ice))$('doseIce').value=ice;syncChoiceCards();}
    }
    if($('cartModal').classList.contains('open')){
      if(!count())close('cartModal');
      else {renderCheckoutSummary();renderCheckoutExtras();}
    }
  }catch(e){
    showStoreClosed(false);lastSnapshot='';bestSellers=[];
    // Catálogo de consulta quando o D1 ainda não está configurado.
    // Nunca habilita pedidos fictícios, mesmo que alguns preços já sejam conhecidos.
    try {
      const response = await fetch('/catalogo-previa.json',{cache:'no-store'});
      if (!response.ok) throw Error('Catálogo indisponível');
      const d=await response.json();
      if (!Array.isArray(d.products)) throw Error('Catálogo inválido');
      products=d.products.map(normalizeProduct).map(p=>({...p,active:false,stock:0,unlimited:false}));drinkOptions=[];
      shop={...(d.store||{}),accepting_orders:false};
      setBrand(shop.name);
      $('modeBanner').className='mode-banner offline';
      $('modeBanner').textContent='Catálogo disponível para consulta • pedidos temporariamente indisponíveis';
      renderProducts();
    } catch {
      if(!lastSnapshot){$('productGrid').innerHTML='<div class="empty">Catálogo ainda não configurado. Confira a conexão do Cloudflare.</div>';
        $('modeBanner').className='mode-banner offline';$('modeBanner').textContent='Conexão pendente — configurar banco de dados';}
    }
  }finally{loadingCatalog=false;}
}
// Extras opcionais no checkout: não incluem Tabacaria nem produtos sem preço/estoque.
// A mesma sugestão aparece sem obrigar o cliente a adicionar qualquer item.
const checkoutExtras=[
 {key:'pirulito',label:'Pirulito',icon:'🍭',matches:n=>n==='pirulito'||n.startsWith('pirulito-')},
 {key:'bala',label:'Bala',icon:'🍬',matches:n=>n==='bala'||n==='balas'||n.startsWith('bala-')||n.startsWith('balas-')},
 {key:'agua',label:'Água',icon:'💧',matches:n=>n==='agua'}
];
let extrasDismissed=false;
const extraProduct=kind=>{
 const match=checkoutExtras.find(x=>x.key===kind);
 if(!match)return null;
 const found=products.filter(p=>p.category!=='Tabacaria'&&!isDoseProduct(p)&&visibleInCatalog(p)&&match.matches(photoSlug(p.name)));
 return found.find(available)||found[0]||null;
};
const renderCheckoutSummary=()=>{
 $('checkoutSummary').innerHTML=[...cart.entries()].map(([key,item])=>{
  const p=products.find(p=>p.id===item.id);
  if(!p)return '';
  return `<div class="order-line"><span>${item.quantity}x ${esc(p.name)}<small style="display:block">${esc(iceSummary(item))}</small>
   <button type="button" class="btn btn-secondary btn-sm" data-remove-choice="${esc(key)}">Remover</button></span><strong>${fmt(item.quantity*doseUnitPrice(p,optionById(item.energy_id)))}</strong></div>`;
 }).join('')+`<div class="order-line"><strong>Total</strong><strong class="gold">${fmt(total())}</strong></div>`;
 updateCashPreview();
};
const renderCheckoutExtras=()=>{
 const panel=$('checkoutExtras');
 if(!panel)return;
 const rows=extrasDismissed?'':checkoutExtras.map(extra=>{
  const p=extraProduct(extra.key);
  const usable=Boolean(p&&available(p)&&(!p.unlimited?desiredQty(p)<p.stock:true));
  const qty=p?desiredQty(p):0;
  if(!usable)return '';
  const description=fmt(p.price_cents);
  return `<div class="checkout-extra">
   <span class="checkout-extra-emoji" aria-hidden="true">${extra.icon}</span>
   <div class="checkout-extra-name"><strong>${esc(extra.label)}</strong><small>${esc(description)}${qty?' · '+qty+' no pedido':''}</small></div>
   <button type="button" class="btn btn-secondary btn-sm" data-checkout-extra="${esc(extra.key)}" ${usable?'':'disabled'}>${usable?'+ Adicionar':'Indisponível'}</button>
  </div>`;
 }).join('');
 $('checkoutExtrasList').innerHTML=rows;
 panel.classList.toggle('hidden',!rows);
};
const addCheckoutExtra=key=>{
 const p=extraProduct(key);
 if(!p||!available(p)||isDoseProduct(p))return toast('Este extra não está disponível.',true);
 const q=desiredQty(p);
 if(!p.unlimited&&q>=p.stock)return toast('Este extra esgotou.',true);
 if(q>=99)return toast('Limite de 99 unidades por produto.',true);
 cart.set(p.id,{id:p.id,quantity:q+1});
 renderCheckoutSummary();renderCheckoutExtras();renderProducts();
 toast(p.name+' adicionado ao pedido.');
};
function checkoutMode(direct){
  const modal=$('cartModal');modal.classList.toggle('payment-direct',direct);
  $('checkoutTitle').textContent=direct?'Pagamento':'Finalizar pedido';
  $('checkoutQuickTotal').textContent=fmt(total());
  const content=modal.querySelector('.modal');content.scrollTop=0;
}
let permissionPanelShown=false,locationBusy=false,locationOptIn=false;try{locationOptIn=sessionStorage.getItem('adega_gps_optin')==='1';}catch{}
function updateLocationPanel(){
 const el=$('entryLocationBox');if(!el)return;el.classList.toggle('hidden',!shop.location_required);
 $('entryLocationRadius').textContent='Raio de atendimento: '+(shop.location_radius||50)+' m. A localização é opcional. Se não quiser permitir, pode fazer seu pedido normalmente.';
}
async function checkEntryLocation(){
 if(locationBusy)return;locationBusy=true;const btn=$('entryLocation');btn.disabled=true;$('entryLocationResult').textContent='Consultando GPS…';
 try{const position=await readCurrentPosition();locationOptIn=true;try{sessionStorage.setItem('adega_gps_optin','1');}catch{}const r=await api('check-location',{position});$('entryLocationResult').textContent=r.message+(Number.isFinite(r.distance)?' Distância aproximada: '+r.distance+' m · precisão: '+r.accuracy+' m.':'');btn.textContent='Verificar novamente';}catch(e){locationOptIn=false;try{sessionStorage.removeItem('adega_gps_optin');}catch{}$('entryLocationResult').textContent='Não foi possível confirmar a localização. Você pode pedir normalmente sem GPS.';}finally{locationBusy=false;btn.disabled=false;}
}
function dismissEntryPermissions(){ $('entryPermissions').classList.add('hidden');try{sessionStorage.setItem('adega_permissions_dismissed','1');}catch{} }
function showEntryPermissions(){if(permissionPanelShown)return;permissionPanelShown=true;let dismissed=false;try{dismissed=sessionStorage.getItem('adega_permissions_dismissed')==='1';}catch{}if(!dismissed)$('entryPermissions').classList.remove('hidden');updateLocationPanel();void initNotifications();}
function updatePickupNotice(message=''){
 const el=$('pickupLocationNotice');
 el.classList.toggle('hidden',!shop.location_required&&!message);
 el.textContent=message||(shop.location_required?'📍 Retirada no portão. Raio de atendimento: '+(shop.location_radius||50)+' m. A localização é opcional; se autorizada, será conferida antes de aceitar o pedido.':'');
}
function readCurrentPosition(){
 return new Promise((resolve,reject)=>{
  if(!navigator.geolocation)return reject(Error('Este navegador não oferece localização. Abra o site no Chrome ou Safari do celular.'));
  navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp}),e=>reject(Error(e.code===1?'Autorize a localização precisa nas permissões do navegador e tente novamente.':e.code===3?'Não conseguimos localizar você a tempo. Ative o GPS e tente novamente.':'Localização indisponível. Ative o GPS e aproxime-se do portão.')),{enableHighAccuracy:true,maximumAge:0,timeout:15000});
 });
}
function showCheckout(direct=false){
  if(!count()||!shop.accepting_orders)return;
  try{
    const saved=JSON.parse(sessionStorage.getItem('adega_customer_profile_v1')||'null');
    if(saved && typeof saved.first==='string' && typeof saved.last==='string'){
      $('first').value=saved.first;$('last').value=saved.last;
      $('ageAck').checked=sessionStorage.getItem('adega_age_ok')==='1';
    }
  }catch{}
  extrasDismissed=false;
  renderCheckoutSummary();
  renderCheckoutExtras();
  $('paymentOptions').innerHTML=[['cash','💵 Dinheiro','Pagamento no portão'],['card','💳 Cartão','Crédito ou débito na maquininha']].map(([v,label,sub])=>`<label class="pay-option"><input type="radio" name="payment" value="${v}" ${v==='cash'?'checked':''}><b>${label}</b><small>${sub}</small></label>`).join('');
  $('payWarning').classList.remove('hidden');
  $('payWarning').textContent='Pagamento na retirada.';
  $('cashField').classList.remove('hidden');
  refreshCash();updatePickupNotice();
  open('cartModal');checkoutMode(direct===true);
}
function updateCashPreview(){
 const info=$('cashChangePreview');
 if(!info)return;
 const mode=document.querySelector('input[name="payment"]:checked')?.value;
 if(mode!=='cash'){info.textContent='';return;}
 const value=$('cash').value.trim(),given=priceParse(value);
 if(!value){info.textContent='Total: '+fmt(total())+'. Informe quanto vai entregar para calcular o troco.';info.className='notice';return;}
 if(given===null){info.textContent='Valor inválido. Exemplo: 50,00';info.className='notice danger';return;}
 if(given<total()){info.textContent='Faltam '+fmt(total()-given)+' para pagar o pedido. Informe um valor igual ou maior que o total.';info.className='notice danger';return;}
 info.textContent='💵 Troco a preparar: '+fmt(given-total())+' • Você entrega '+fmt(given)+' • Pedido '+fmt(total());
 info.className='notice ok';
}
function refreshCash(){
 const method=document.querySelector('input[name="payment"]:checked')?.value;
 $('cashField').classList.toggle('hidden',method!=='cash');
 $('cash').required=method==='cash';
 $('payWarning').textContent=method==='card'?'Pague com cartão de crédito ou débito na maquininha, ao retirar. Nenhum dado de cartão será solicitado no site.':'Pagamento em dinheiro na retirada. Informe o valor para calcular o troco.';
 updateCashPreview();
}
async function submitOrder(event){
  event.preventDefault();
  if(working)return;
  const first=$('first').value.trim(),last=$('last').value.trim(),method=document.querySelector('input[name="payment"]:checked')?.value;
  if(first.length<2||last.length<2)return toast('Informe nome e sobrenome.',true);
  if(!$('ageAck').checked)return toast('Confirme ter pelo menos 18 anos.',true);
  if(!['cash','card'].includes(method))return toast('Escolha dinheiro ou cartão na retirada.',true);
  const cash=$('cash').value.trim()?priceParse($('cash').value):null;
  if(method==='cash' && (cash===null||cash<total()))return toast('Em dinheiro, informe com quanto vai pagar. O valor deve cobrir o total e o troco será enviado ao admin.',true);
  const items=[...cart.values()].map(i=>({...i}));
  const button=$('placeOrder');working=true;button.disabled=true;button.textContent='Registrando pedido...';
  try{
    const payload={first_name:first,last_name:last,payment_method:method,cash_given_cents:method==='cash'?cash:null,items,age_confirmed:true,honeypot:'',expected_total_cents:total()};
    const key='adega_pending_request_v2';
    const fingerprint=JSON.stringify(payload);
    let pending;try{pending=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}
    if(pending&&pending.fingerprint!==fingerprint){
      const recovered=await api('recover-order',{request_id:pending.id});
      if(recovered.order){trackingFinished=false;currentOrder={id:recovered.order.id,token:recovered.order.token,number:recovered.order.number};localStorage.setItem('adega_my_order_v1',JSON.stringify(currentOrder));sessionStorage.removeItem(key);cart.clear();close('cartModal');renderProducts();await loadTracking();open('trackingModal');$('trackBtn')?.classList.remove('hidden');return toast('Seu pedido anterior já foi registrado. Confira o acompanhamento.');}
      if(Date.now()-pending.at<30000)return toast('Aguarde a confirmação do pedido anterior antes de alterar o carrinho.',true);
    }
    let position;
    if(shop.location_required&&locationOptIn){button.textContent='Verificando localização…';updatePickupNotice('📍 Consultando sua localização atual…');try{position=await readCurrentPosition();}catch{locationOptIn=false;try{sessionStorage.removeItem('adega_gps_optin');}catch{}updatePickupNotice('GPS indisponível. Continuando sem localização.');}button.textContent='Registrando pedido…';}
    const request_id=pending?.fingerprint===fingerprint?pending.id:crypto.randomUUID();
    sessionStorage.setItem(key,JSON.stringify({fingerprint,id:request_id,at:Date.now()}));
    const d=await api('create-order',{...payload,request_id,...(position?{position}:{}),...(pushSubscription&&Notification.permission==='granted'?{subscription:pushSubscription.toJSON()}: {})});
    sessionStorage.removeItem(key);
    trackingFinished=false;
    currentOrder={id:d.order.id,token:d.order.token,number:d.order.number};pushLast=0;void bindNotifications();
    localStorage.setItem('adega_my_order_v1',JSON.stringify(currentOrder));
    cart.clear();close('cartModal');renderProducts();await loadTracking();open('trackingModal');toast('Pedido recebido pela adega!');
    $('trackBtn')?.classList.remove('hidden');
  }catch(e){if(shop.location_required||/localização|proximidade|GPS|área de retirada/i.test(e.message))updatePickupNotice(e.message);toast(e.message,true);}finally{working=false;button.disabled=false;button.textContent='Confirmar pedido →';void loadCatalog();}
}
let trackingBusy=false,trackingFinished=false,customerCancelBusy=false,reviewSubmitting=false,reviewPrompted='',reviewRows=[],reviewExpanded=false,reviewLoading=false;
const reviewStars=n=>'★'.repeat(Math.max(0,Math.min(5,Number(n)||0)))+'☆'.repeat(5-Math.max(0,Math.min(5,Number(n)||0)));
function reviewPanel(order){
 if(order.status!=='delivered'||order.payment_status!=='paid')return '';
 if(order.reviewed)return '<div class="review-thanks">Obrigado pela sua avaliação!</div>';
 return `<form id="storeReviewForm" class="review-form"><span class="eyebrow">SUA OPINIÃO IMPORTA</span><h3>Como foi sua experiência?</h3><p class="small sub">Avalie a Hora Extra Drinks. O comentário é opcional.</p><fieldset class="review-rating"><legend class="sr-only">Nota de 1 a 5 estrelas</legend>${[1,2,3,4,5].map(n=>`<label><input type="radio" name="rating" value="${n}" required><span aria-hidden="true">★</span><span class="sr-only">${n} estrela(s)</span></label>`).join('')}</fieldset><p id="ratingLabel" class="small sub" aria-live="polite">Escolha sua nota</p><label for="reviewComment">Comentário (opcional)</label><textarea id="reviewComment" rows="3" maxlength="500" placeholder="Conte como foi o atendimento..."></textarea><label class="review-consent"><input type="checkbox" id="reviewShareName"> Mostrar meu primeiro nome (opcional)</label><p class="tiny sub">A nota e o comentário serão públicos. Não inclua telefone, endereço ou dados pessoais.</p><button type="submit" class="btn btn-primary btn-wide">Enviar avaliação</button><button type="button" id="reviewLater" class="btn btn-secondary btn-wide">Agora não</button></form>`;
}
function renderPublicReviews(){
 const visible=reviewExpanded?reviewRows:reviewRows.slice(0,6);
 $('publicReviews').innerHTML=visible.length?visible.map(r=>`<article class="review-card"><div class="review-stars" aria-label="${Number(r.rating)} de 5 estrelas">${reviewStars(r.rating)}</div><p class="review-copy">${esc(r.comment||'Avaliou o estabelecimento.')}</p><div class="review-author"><strong>${esc(r.display_name)}</strong><small>Compra verificada · ${esc(new Date(r.created_at).toLocaleDateString('pt-BR'))}</small></div></article>`).join(''):'<p class="sub">Ainda não temos avaliações. Seja o primeiro a contar como foi!</p>';
 $('moreReviews').classList.toggle('hidden',reviewRows.length<=6);$('moreReviews').textContent=reviewExpanded?'Ver menos':'Ver mais avaliações';
}
async function loadReviews(){
 if(reviewLoading)return;reviewLoading=true;
 try{const data=await api('reviews',null,{method:'GET'});reviewRows=Array.isArray(data.reviews)?data.reviews:[];const n=Number(data.summary?.count)||0,avg=Number(data.summary?.average)||0;$('reviewSummary').innerHTML=n?`<strong>${avg.toFixed(1).replace('.',',')} <span>★</span></strong><small>${n} ${n===1?'avaliação':'avaliações'}</small>`:'<small>Sem avaliações ainda</small>';renderPublicReviews();}
 catch{$('publicReviews').textContent='Avaliações temporariamente indisponíveis.';}
 finally{reviewLoading=false;}
}
async function sendReview(e){
 e.preventDefault();if(reviewSubmitting||!currentOrder)return;
 const form=e.target,rating=Number(new FormData(form).get('rating'));if(!Number.isInteger(rating)||rating<1||rating>5)return toast('Escolha de 1 a 5 estrelas.',true);
 const order={...currentOrder},comment=$('reviewComment').value,share_name=$('reviewShareName').checked;
 reviewSubmitting=true;const btn=form.querySelector('[type="submit"]');btn.disabled=true;
 try{await api('review',{id:order.id,token:order.token,rating,comment,share_name});if(currentOrder?.id===order.id){form.outerHTML='<div class="review-thanks">Obrigado pela sua avaliação!</div>';}$('trackBtn').classList.remove('review-pending');toast('Avaliação enviada. Obrigado!');void loadReviews();}
 catch(err){toast(err.message,true);if(/já foi avaliado/.test(err.message))await loadTracking();}
 finally{reviewSubmitting=false;btn.disabled=false;}
}
function maybePromptReview(order){
 if(order.status!=='delivered'||order.reviewed||order.payment_status!=='paid')return;
 $('trackBtn').classList.add('review-pending');
 if(reviewPrompted===order.id||document.hidden||!$('ageGate').classList.contains('hidden'))return;
 if(document.querySelector('.modal-backdrop.open:not(#trackingModal)')){toast('Pedido finalizado! Avalie em Meu pedido.');reviewPrompted=order.id;return;}
 reviewPrompted=order.id;open('trackingModal');
}
function orderMessage(name,status){const messages={received:'recebemos seu pedido!',preparing:'seu pedido está sendo preparado.',ready:'seu pedido está pronto! Aguarde a entrega no portão.',delivered:'seu pedido foi entregue. Obrigado!',cancelled:'seu pedido foi cancelado.'};return name+', '+(messages[status]||'acompanhe seu pedido.');}
async function loadTracking(){
  if(!currentOrder||trackingBusy||reviewSubmitting||customerCancelBusy)return;
  const trackingId=currentOrder.id;
  trackingBusy=true;
  try{
    const {order}=await api('track',{id:currentOrder.id,token:currentOrder.token});
    if(currentOrder?.id!==trackingId)return;
    trackingFinished=['delivered','cancelled'].includes(order.status);
    $('trackBtn').classList.toggle('review-pending',order.status==='delivered'&&order.payment_status==='paid'&&!order.reviewed);
    const instructions=order.payment_status==='paid'?'Pagamento confirmado.':order.payment_method==='cash'?'Pagamento em dinheiro na retirada.':order.payment_method==='card'?'Pagamento na maquininha, na retirada.':'Aguardando confirmação do pagamento pelo provedor.';
    const steps=['received','preparing','ready','delivered'];let current=steps.indexOf(order.status);
    $('trackingContent').innerHTML=`<div class="track premium-track track-${esc(order.status)}"><div class="track-reference"><span>SEU PEDIDO · RETIRADA NO PORTÃO</span><b class="track-order-number">#${esc(pad(order.order_no))}</b></div><div class="track-person">${esc(order.first_name)} ${esc(order.last_name)}</div><div class="track-status"><span class="track-status-dot"></span>${esc(stageLabels[order.status]||order.status)}</div><h3 class="track-message">${esc(orderMessage(order.first_name,order.status))}</h3><div class="track-timeline" aria-label="Etapas do pedido">${steps.map((s,n)=>`<div class="track-stage ${n===current?'current':n<current?'done':''}"><span class="track-stage-point">${n<current?'✓':n+1}</span><span>${esc(stageLabels[s])}</span></div>`).join('')}</div><div class="track-payment"><span>${esc(instructions)}</span><strong>${fmt(order.total_cents)}</strong></div><p class="small sub">Quando estiver pronto, retire no portão em até 15 minutos. Depois desse prazo, o pedido não retirado poderá ser cancelado. Se houver nomes iguais, basta informar o número do pedido.</p>${order.status==='ready'&&order.ready_at?`<div class="notice">Retire até ${esc(new Date(Date.parse(order.ready_at)+900000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}))}.</div>`:''}${order.status==='received'&&order.payment_status==='pending'?'<div class="notice"><p class="small">Você pode cancelar enquanto a adega ainda não iniciou o preparo.</p><button type="button" class="btn btn-danger btn-wide" id="customerCancelOrder">Cancelar meu pedido</button></div>':order.status==='preparing'||order.status==='ready'?'<p class="small sub">O preparo já começou. Se precisar cancelar, fale com o atendente.</p>':''}${reviewPanel(order)}</div>`;
    if(order.status==='ready'){let seen=false;const key='adega_ready_seen_'+trackingId;try{seen=localStorage.getItem(key)==='1';if(!seen)localStorage.setItem(key,'1');}catch{seen=readyNoticeId===trackingId;}if(!seen){readyNoticeId=trackingId;toast('Seu pedido está pronto! Retire no portão em até 15 minutos.');}}
    void bindNotifications();maybePromptReview(order);
  }catch(e){$('trackingContent').innerHTML=`<p class="notice danger">${esc(e.message)}</p>`;}finally{trackingBusy=false;}
}
let pushRegistration=null,pushKey=null,pushSubscription=null,pushBound='',pushBinding=false,pushLast=0,readyNoticeId='';
const supportsPush=()=>window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const notificationText=s=>{$('entryNotifyText').textContent=s;};
let notificationIsPrepared=false;
function notificationPrepared(){
 notificationIsPrepared=true;
 notificationText('Avisos autorizados. Serão vinculados ao seu pedido.');
 $('entryNotify').classList.add('hidden');
 $('entryNotify').closest('.entry-permissions-row')?.classList.add('hidden');
 if(!shop.location_required||locationOptIn)dismissEntryPermissions();
 pushLast=0;void bindNotifications();
}
async function initNotifications(){
 const b=$('entryNotify');if(!supportsPush()){notificationText('No iPhone, adicione o site à Tela de Início e abra por lá. Se não for compatível, acompanhe pela TV.');return;}
 try{
  const [k,reg]=await Promise.all([api('push-key',null,{method:'GET'}),navigator.serviceWorker.register('/pedido-sw.js',{scope:'/'})]);
  pushRegistration=reg.active?reg:await navigator.serviceWorker.ready;
  const key=k.public_key;pushKey=Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-key.length%4)%4)),c=>c.charCodeAt(0));
  pushSubscription=await pushRegistration.pushManager.getSubscription();
  const savedKey=pushSubscription?.options?.applicationServerKey;
  if(savedKey){const bytes=new Uint8Array(savedKey);if(bytes.length!==pushKey.length||bytes.some((v,i)=>v!==pushKey[i])){await pushSubscription.unsubscribe();pushSubscription=null;}}
  if(Notification.permission==='granted'&&pushSubscription){notificationPrepared();}
  else if(Notification.permission==='denied'){notificationText('Notificações bloqueadas. Altere nas permissões do navegador ou acompanhe pela TV.');}
  else {b.disabled=false;notificationText('Ative os avisos para receber a chamada do seu pedido.');}
 }catch{notificationText('Não foi possível preparar avisos. Tente novamente ou acompanhe pela TV.');b.disabled=false;}
}
async function enableNotifications(){
 const b=$('entryNotify');b.disabled=true;
 try{
  if(!pushRegistration||!pushKey){await initNotifications();if(!pushRegistration||!pushKey)throw Error('Avisos indisponíveis');}
  if(Notification.permission==='default')await Notification.requestPermission();
  if(Notification.permission!=='granted')throw Error('Permissão não concedida');
  pushSubscription=await pushRegistration.pushManager.getSubscription()||await pushRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:pushKey});
  pushBound='';notificationPrepared();
 }catch{notificationText('Não foi possível ativar o aviso. Tente novamente ou acompanhe pela TV.');b.disabled=Notification.permission==='denied';}
}
async function bindNotifications(){
 if(!currentOrder||trackingFinished||!pushSubscription||Notification.permission!=='granted'||pushBinding||pushBound===currentOrder.id||Date.now()-pushLast<10000)return;
 const o=currentOrder;pushBinding=true;pushLast=Date.now();
 try{const r=await api('order-push',{id:o.id,token:o.token,subscription:pushSubscription.toJSON()});if(r.registered){pushBound=o.id;notificationText('Avisos vinculados ao seu pedido.');}}
 catch{notificationText('Não foi possível vincular aviso. Acompanhe pela TV.');}
 finally{pushBinding=false;}
}

function syncChoiceCards(){
 for(const id of ['shakeAlcohol','doseEnergyKind','doseEnergy','doseIce']){
  const select=$(id);if(!select)continue;
  let panel=select.nextElementSibling;
  if(!panel?.classList.contains('hora-choice-cards')){
   panel=document.createElement('div');panel.className='hora-choice-cards';panel.setAttribute('role','group');select.after(panel);select.classList.add('hora-native-choice');
  }
  panel.setAttribute('aria-label',select.closest('.form-field')?.querySelector('label')?.textContent||'Escolha uma opção');
  panel.replaceChildren();
  for(const opt of select.options){
   if(!opt.value||opt.disabled)continue;
   const b=document.createElement('button');b.type='button';b.className='hora-choice-card';b.disabled=select.disabled;b.setAttribute('aria-pressed',String(select.value===opt.value));
   const mark=document.createElement('span');mark.className='hora-choice-mark';mark.textContent=id==='doseIce'?'❄':id==='shakeAlcohol'?(opt.value==='com'?'🍹':'🥤'):'⚡';
   const name=document.createElement('span');name.textContent=opt.textContent;b.append(mark,name);
   b.addEventListener('click',()=>{select.value=opt.value;select.dispatchEvent(new Event('change',{bubbles:true}));syncChoiceCards();});panel.append(b);
  }
 }
}
function start(){
  $('entryLocation').onclick=checkEntryLocation;$('entryPermissionsDismiss').onclick=dismissEntryPermissions;
  $('entryNotify').onclick=enableNotifications;
  const header=document.querySelector('.hora-nav');
  // Keep one cart node; a fixed element must not inherit the sticky header's containing block.
  const cartBar=$('cartBar'),cartAnchor=document.createComment('cart desktop position'),mobileQuery=matchMedia('(max-width:800px)');
  cartBar.before(cartAnchor);
  const placeCart=()=>{if(mobileQuery.matches){if(cartBar.parentElement!==document.body)document.body.append(cartBar);}else if(cartBar.parentElement!==header){cartAnchor.after(cartBar);}};
  placeCart();
  if(mobileQuery.addEventListener)mobileQuery.addEventListener('change',placeCart);else mobileQuery.addListener(placeCart);
  const scrollCatalog=()=>{const target=$('catalogo');const offset=getComputedStyle(header).position==='sticky'?header.getBoundingClientRect().height:0;window.scrollTo({top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-offset-8),behavior:'instant'});};
  const syncHeaderHeight=()=>document.documentElement.style.setProperty('--hora-header-height',Math.ceil(header.getBoundingClientRect().height)+'px');
  syncHeaderHeight();if('ResizeObserver' in window)new ResizeObserver(()=>{syncHeaderHeight();queueViewedCategory();}).observe(header);window.addEventListener('resize',syncHeaderHeight);window.addEventListener('resize',queueViewedCategory);window.addEventListener('scroll',queueViewedCategory,{passive:true});
  let helpTrigger=$('helpBtn');
  const openHelp=trigger=>{helpTrigger=trigger;open('helpModal');$('closeHelp').focus();};
  $('helpBtn').onclick=()=>openHelp($('helpBtn'));
  $('mobileHelpBtn').onclick=()=>openHelp($('mobileHelpBtn'));
  $('mobileTrackBtn').onclick=()=>$('trackBtn').click();
  const closeHelp=()=>{close('helpModal');helpTrigger.focus();};
  $('closeHelp').onclick=closeHelp;
  $('helpToCatalog').onclick=()=>{closeHelp();$('catalogo').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  $('helpModal').addEventListener('click',e=>{if(e.target===$('helpModal'))closeHelp();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('helpModal').classList.contains('open'))closeHelp();});
  $('headerCart').addEventListener('animationend',()=> $('headerCart').classList.remove('cart-attention'));
  $('moreReviews').onclick=()=>{reviewExpanded=!reviewExpanded;renderPublicReviews();};
  $('trackingContent').addEventListener('click',async e=>{
   const btn=e.target.closest('#customerCancelOrder');if(!btn||!currentOrder||customerCancelBusy)return;
   if(!confirm('Cancelar este pedido? Os itens serão liberados para outros clientes.'))return;
   const order=currentOrder;customerCancelBusy=true;btn.disabled=true;
   try{await api('cancel-order',{id:order.id,token:order.token});toast('Pedido cancelado.');}
   catch(err){toast(err.message,true);}
   finally{customerCancelBusy=false;await loadTracking();void loadCatalog();}
  });
  $('trackingContent').addEventListener('submit',e=>{if(e.target.id==='storeReviewForm')sendReview(e);});
  $('trackingContent').addEventListener('change',e=>{if(e.target.name==='rating'){const n=Number(e.target.value);$('ratingLabel').textContent=n+' de 5 estrelas';e.target.closest('.review-rating').querySelectorAll('label').forEach((label,k)=>label.classList.toggle('selected',k<n));}});
  $('trackingContent').addEventListener('click',e=>{if(e.target.id==='reviewLater')close('trackingModal');});
  $('catalogo').addEventListener('click',e=>{
    if(e.target.closest('button[data-pay-now]')){showCheckout(true);return;}
    const shake=e.target.closest('button[data-shake]');
    if(shake){const p=products.find(x=>x.id===shake.dataset.shake);if(p&&available(p)){shakeSelected=p.id;$('shakeTitle').textContent=p.name;$('shakePrice').textContent=fmt(p.price_cents)+' · 700 ml';$('shakeAlcohol').value='';open('shakeModal');syncChoiceCards();}return;}
    const config=e.target.closest('button[data-configure]');
    if(config){const p=products.find(x=>x.id===config.dataset.configure);if(p)showDoseConfigurator(p);return;}
    const btn=e.target.closest('button[data-qty]');if(!btn)return;
    const p=products.find(x=>x.id===btn.dataset.id);if(!p||isDoseProduct(p)||isShake(p))return;
    const qty=Math.max(0,(cart.get(p.id)?.quantity||0)+Number(btn.dataset.qty));
    if(qty&&(!available(p)||(!p.unlimited&&qty>p.stock)))return;
    qty?cart.set(p.id,{id:p.id,quantity:qty}):cart.delete(p.id);renderProducts();
  });
  $('doseEnergyKind').addEventListener('change',()=>{refreshHouseGinEnergy();syncChoiceCards();});
  $('doseEnergy').addEventListener('change',()=>{if(isHouseGin(doseSelected)){$('doseIce').disabled=!$('doseEnergy').value;}});
  // Changing ice never clears the already included energy drink.
  $('shakeForm').addEventListener('submit',e=>{e.preventDefault();const p=products.find(x=>x.id===shakeSelected),v=$('shakeAlcohol').value;if(!p||!isShake(p)||!validShake(v)||!available(p)||(!p.unlimited&&desiredQty(p)>=p.stock))return toast('Confira o preparo e a disponibilidade.',true);const key=p.id+':shake:'+v;const item=cart.get(key)||{id:p.id,quantity:0,shake_alcohol:v};item.quantity++;cart.set(key,item);close('shakeModal');renderProducts();toast('Batida adicionada: '+(v==='com'?'com álcool':'sem álcool'));});
  $('closeShake').addEventListener('click',()=>close('shakeModal'));
  $('doseForm').addEventListener('submit',addConfiguredDose);
  $('closeDose').addEventListener('click',()=>close('doseModal'));
  $('checkoutSummary').addEventListener('click',e=>{
   const btn=e.target.closest('[data-remove-choice]');if(!btn)return;
   cart.delete(btn.dataset.removeChoice);
   if(!count())close('cartModal');
   else {renderCheckoutSummary();renderCheckoutExtras();}
   renderProducts();
  });
  $('checkoutExtrasList').addEventListener('click',event=>{
   const button=event.target.closest('button[data-checkout-extra]');
   if(button)addCheckoutExtra(button.dataset.checkoutExtra);
  });
  $('checkoutExtrasDismiss').addEventListener('click',()=>{extrasDismissed=true;renderCheckoutExtras();});
  const chooseCategory=e=>{const btn=e.target.closest('[data-category]');if(!btn)return;category=btn.dataset.category;viewedCategory=category;searchText='';$('productSearch').value='';renderProducts();$('categorySidebar').classList.remove('mobile-open');$('menuToggle').setAttribute('aria-expanded','false');};
  $('categoryTabs').addEventListener('click',chooseCategory);
  $('mobileCategoryTabs').addEventListener('click',e=>{const button=e.target.closest('[data-category]');if(!button)return;chooseCategory(e);requestAnimationFrame(scrollCatalog);});
  $('categorySideLinks').addEventListener('click',e=>{chooseCategory(e);if(mobileQuery.matches)requestAnimationFrame(scrollCatalog);});
  $('productSearch').addEventListener('input',e=>{searchText=e.target.value.trim();category='Todos';viewedCategory='Todos';renderProducts();});
  $('productSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('productSearch').blur();requestAnimationFrame(scrollCatalog);}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('categorySidebar').classList.contains('mobile-open')&&!document.querySelector('.modal-backdrop.open')){$('categorySidebar').classList.remove('mobile-open');$('menuToggle').setAttribute('aria-expanded','false');$('menuToggle').focus();}});
  $('menuToggle').addEventListener('click',()=>{const el=$('categorySidebar');el.classList.toggle('mobile-open');$('menuToggle').setAttribute('aria-expanded',String(el.classList.contains('mobile-open')));if(el.classList.contains('mobile-open'))requestAnimationFrame(scrollCatalog);});
  $('headerCart').onclick=()=>count()?showCheckout():toast('Seu carrinho está vazio. Escolha um produto.');
  $('openCart').addEventListener('click',()=>showCheckout(false));
  $('goPayment').addEventListener('click',()=>showCheckout(true));
  $('checkoutGoPayment').addEventListener('click',()=>checkoutMode(true));
  $('checkoutReviewCart').addEventListener('click',()=>checkoutMode(false));
  $('closeCart').onclick=()=>close('cartModal');
  $('closeTracking').onclick=()=>close('trackingModal');
  $('checkoutForm').addEventListener('submit',submitOrder);
  $('paymentOptions').addEventListener('change',refreshCash);
  $('cash').addEventListener('input',updateCashPreview);
  const profileKey='adega_customer_profile_v1';
  const readProfile=()=>{try{const p=JSON.parse(sessionStorage.getItem(profileKey)||'null');
    return p && typeof p.first==='string' && typeof p.last==='string' && p.first.trim().length>=2 && p.last.trim().length>=2?p:null;
  }catch{return null;}};
  const fillProfile=p=>{
    $('first').value=p.first;$('last').value=p.last;
    $('ageAck').checked=true;
    $('ageGate').classList.add('hidden');
    showEntryPermissions();pulseCart();
  };
  $('ageYes').onclick=()=>{
    sessionStorage.setItem('adega_age_ok','1');
    $('ageStep').classList.add('hidden');
    $('entryNameStep').classList.remove('hidden');
    $('entryFirst').focus();
  };
  $('ageNo').onclick=()=>{
    $('ageGate').innerHTML='<div class="age-box"><h2>Acesso restrito a maiores de 18 anos</h2><p>O catálogo é destinado exclusivamente a adultos. Não é possível continuar.</p></div>';
  };
  $('customerEntryForm').addEventListener('submit',event=>{
    event.preventDefault();
    const first=$('entryFirst').value.trim().replace(/\s+/g,' ');
    const last=$('entryLast').value.trim().replace(/\s+/g,' ');
    if(first.length<2||last.length<2)return toast('Informe nome e sobrenome.',true);
    const profile={first,last};
    sessionStorage.setItem(profileKey,JSON.stringify(profile));
    fillProfile(profile);
  });
  const savedProfile=readProfile();
  if(sessionStorage.getItem('adega_age_ok')==='1' && savedProfile){
    fillProfile(savedProfile);
  }else if(sessionStorage.getItem('adega_age_ok')==='1'){
    $('ageStep').classList.add('hidden');
    $('entryNameStep').classList.remove('hidden');
  }else{
    $('ageStep').classList.remove('hidden');
    $('entryNameStep').classList.add('hidden');
  }
  try{currentOrder=JSON.parse(localStorage.getItem('adega_my_order_v1')||'null');}catch{}
  if(currentOrder){$('trackBtn')?.classList.remove('hidden');loadTracking();if(new URLSearchParams(location.search).get('pedido')==='1')open('trackingModal');}
  $('trackBtn')?.addEventListener('click',()=>{if(!currentOrder)return toast('Você ainda não possui pedido neste dispositivo.');loadTracking();open('trackingModal');});
  (async()=>{try{const pending=JSON.parse(sessionStorage.getItem('adega_pending_request_v2')||'null');if(pending?.id){const d=await api('recover-order',{request_id:pending.id});if(d.order){trackingFinished=false;currentOrder={id:d.order.id,token:d.order.token,number:d.order.number};localStorage.setItem('adega_my_order_v1',JSON.stringify(currentOrder));sessionStorage.removeItem('adega_pending_request_v2');$('trackBtn')?.classList.remove('hidden');await loadTracking();open('trackingModal');}}}catch{}})();
  loadCatalog();loadReviews();
  setInterval(()=>{if(!document.hidden)loadReviews();},60000);
  setInterval(()=>{if(!document.hidden)loadCatalog();},3000);
  setInterval(()=>{if(currentOrder&&!trackingFinished&&!document.hidden)loadTracking();},3000);
  window.addEventListener('focus',()=>{loadCatalog();if(currentOrder&&!trackingFinished)loadTracking();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){loadCatalog();if(currentOrder&&!trackingFinished)loadTracking();}});
}
start();
