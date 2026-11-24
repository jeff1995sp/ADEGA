import {api,CATEGORIES,fmt,esc,pad,priceParse,toast,setBrand,stageLabels,photoFor,photoFallbackFor,photoStatusFor,catalogCategory,isStandaloneIce,productDescription,isDoseProduct,energyMatchesDose,optionAvailable,isHouseGin,isCommonEnergy,doseUnitPrice,normalizeProduct,unconfirmedDuplicate} from './shared.js';

let products=[],drinkOptions=[],shop={name:'Hora Extra Drinks',accepting_orders:true},category='Todos',working=false,lastSnapshot='',doseSelected=null;
const cart=new Map();
let currentOrder=null,searchText='';
const $=id=>document.getElementById(id);
const photoSlug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const open=id=>$(id)?.classList.add('open');
const close=id=>$(id)?.classList.remove('open');
const available=p=>p.active && p.price_cents>0 && (p.unlimited || p.stock>0) && shop.accepting_orders;
const total=()=>[...cart.values()].reduce((sum,item)=>sum+doseUnitPrice(products.find(p=>p.id===item.id),optionById(item.energy_id))*item.quantity,0);
const count=()=>[...cart.values()].reduce((sum,item)=>sum+item.quantity,0);
// O dono confirmou que somente limão e morango seguem no catálogo de caipirinhas.
const visibleInCatalog=p=>!unconfirmedDuplicate(p)&&!isStandaloneIce(p)&&(p.category!=='Caipirinhas'||['Caipirinha de Limão','Caipirinha de Morango'].includes(p.name));
const desiredQty=p=>[...cart.values()].filter(i=>i.id===p.id).reduce((sum,i)=>sum+i.quantity,0);
const optionById=id=>drinkOptions.find(o=>o.id===id);
const drinkChoiceList=(group,p)=>drinkOptions.filter(o=>o.option_group===group&&(group!=='energy'||energyMatchesDose(p,o)));
const hasDrinkOptions=p=>drinkChoiceList('ice',p).some(optionAvailable)&&drinkChoiceList('energy',p).some(optionAvailable);
const iceSummary=item=>{
 if(!item.ice_id)return '';
 return 'Gelo: '+(optionById(item.ice_id)?.name||'indisponível')+' · Energético: '+(optionById(item.energy_id)?.name||'indisponível');
};
const getAvailableOption=id=>{const o=optionById(id);return optionAvailable(o)?o:null;};
const amountUsed=(id,field)=>[...cart.values()].filter(i=>i[field]===id).reduce((s,i)=>s+i.quantity,0);

const productCard=p=>{
  const left=p.unlimited?'Disponível':p.stock>0?`${p.stock} em estoque`:'Esgotado';
  const inactive=!p.active?'Indisponível':!p.price_cents?'Indisponível — preço a definir':!p.unlimited && !p.stock?'Indisponível — esgotado':!shop.accepting_orders?'Indisponível — pedidos pausados':null;
  const q=desiredQty(p);
  const customizable=isDoseProduct(p);
  const canConfigure=available(p)&&hasDrinkOptions(p);
  const packaged = ['Cervejas','Doces e Salgadinhos','Diversos','Bebidas prontas','Águas e Refrigerantes'].includes(catalogCategory(p));
  const fallback = photoFallbackFor(p);
  const status=photoStatusFor(p);
  const photoNote=status==='pending'?'<span class="photo-note">Foto real pendente</span>':status==='licensed'?'<span class="photo-note">Foto real ilustrativa</span>':(status==='illustrative'||status==='custom'&&['Whisky','Gin','Vodka','Batidas','Caipirinhas'].includes(catalogCategory(p)))?'<span class="photo-note">Imagem ilustrativa</span>':'';
  const media = `<img class="product-photo" src="${esc(photoFor(p))}" data-fallback="${esc(fallback)}" alt="Foto do produto ${esc(p.name)}" loading="lazy" onerror="if(this.dataset.fallback){const f=this.dataset.fallback;delete this.dataset.fallback;this.src=f}else{this.onerror=null;this.src='/imagens/foto-pendente.webp'}">`;
  return `<article class="product">
    <div class="product-visual ${packaged?'packshot':''}">${media}<span class="flag">${esc(catalogCategory(p))}</span>${photoNote}</div>
    <div class="product-content"><h3>${esc(p.name)}</h3><p>${esc(productDescription(p))}</p>
    <span class="tiny ${!p.unlimited&&p.stock<=5?'warn':''}">${inactive||left}</span>
    <div class="product-footer"><span class="price">${p.price_cents?(isHouseGin(p)?'A partir de '+fmt(p.price_cents):fmt(p.price_cents)):'Preço em breve'}</span>
    ${customizable?`<div class="qty dose-qty"><strong>${q} no carrinho</strong><button type="button" class="btn btn-primary btn-sm" data-configure="${esc(p.id)}" ${!canConfigure?'disabled':''}>${isHouseGin(p)?'Escolher energético e gelo':'Escolher gelo e energético'}</button></div>`:`<div class="qty"><button type="button" aria-label="Diminuir ${esc(p.name)}" data-qty="-1" data-id="${p.id}" ${q<1?'disabled':''}>−</button><strong>${q}</strong><button type="button" aria-label="Adicionar ${esc(p.name)}" data-qty="1" data-id="${p.id}" ${!available(p)||(!p.unlimited&&q>=p.stock)?'disabled':''}>+</button></div>`}</div></div></article>`;
};
const categoryIcons={'Todos':'▦','Batidas':'◉','Whisky':'♜','Vodka':'♜','Gin':'♜','Cervejas':'▥','Caipirinhas':'◈','Bebidas prontas':'▣','Águas e Refrigerantes':'♧','Doces e Salgadinhos':'◇','Diversos':'•••','Vinhos':'♢'};
const categoryLabel=c=>c==='Todos'?'Todos os Produtos':c==='Batidas'?'Batidas (700 ml)':c;
const categoryCover={'Batidas':'/imagens/morango-com-nutella.webp','Whisky':'/imagens/jack-com-red-bull.webp','Vodka':'/imagens/absolut-com-red-bull.webp','Gin':'/imagens/beefeater-com-red-bull.webp','Cervejas':'/imagens/heineken.webp','Caipirinhas':'/imagens/caipirinha-de-limao.webp','Bebidas prontas':'/imagens/draft.webp','Águas e Refrigerantes':'/imagens/refrigerante-em-lata.webp','Doces e Salgadinhos':'/imagens/doritos.webp','Diversos':'/imagens/pilhas-panasonic.webp'};
const publicCategoryOrder=['Todos','Batidas','Whisky','Vodka','Gin','Cervejas','Caipirinhas','Bebidas prontas','Águas e Refrigerantes','Doces e Salgadinhos','Vinhos','Diversos'];
function showCategories(){
 const exist=new Set(products.filter(p=>p.category!=='Tabacaria'&&visibleInCatalog(p)).map(catalogCategory));
 const cats=[...new Set([...publicCategoryOrder,...CATEGORIES])].filter(c=>c==='Todos'||(c!=='Tabacaria'&&exist.has(c)));
 if(!cats.includes(category))category='Todos';
 $('categorySideLinks').innerHTML=cats.map(c=>`<button type="button" class="hora-side-link ${c===category?'active':''}" data-category="${esc(c)}" aria-pressed="${c===category}"><span aria-hidden="true">${categoryIcons[c]||'◇'}</span>${esc(categoryLabel(c))}</button>`).join('');
 $('categoryTabs').innerHTML=cats.filter(c=>c!=='Todos').map(c=>{
  const sample=products.find(p=>p.category!=='Tabacaria'&&visibleInCatalog(p)&&catalogCategory(p)===c&&photoStatusFor(p)!=='pending');
  const photo=sample?photoFor(sample):categoryCover[c];
  return `<button type="button" class="tab ${c===category?'active':''}" data-category="${esc(c)}" aria-pressed="${c===category}">${photo?`<img src="${esc(photo)}" alt="" loading="lazy">`:`<span class="category-symbol">${categoryIcons[c]||'◇'}</span>`}<strong>${esc(categoryLabel(c))}</strong></button>`;
 }).join('');
}
function snackGroup(p){
 const n=photoSlug(p.name);
 if(/trident|bubbaloo|plutonita|chiclete/.test(n))return 'Chicletes';
 if(/doritos|fofura|torcida|fandangos|lays|lay-s|salgadinho|rikitos/.test(n))return 'Salgadinhos';
 if(/halls|mentos|bala|pirulito/.test(n))return 'Balas e pirulitos';
 return 'Doces e chocolates';
}
function renderProducts(){
 showCategories();
 const general=products.filter(p=>p.category!=='Tabacaria'&&visibleInCatalog(p));
 const norm=photoSlug(searchText);
 const list=general.filter(p=>(category==='Todos'||catalogCategory(p)===category)&&(!norm||photoSlug(p.name+' '+catalogCategory(p)).includes(norm)));
 $('catalogHeading').textContent=searchText?'RESULTADOS DA BUSCA':category==='Todos'?'DESTAQUES DA HORA EXTRA':categoryLabel(category).toUpperCase();
 $('catalogResultCount').textContent=list.length+' produtos';
 const message='<div class="empty">Nenhum produto encontrado.</div>';
 if(category==='Doces e Salgadinhos'&&list.length){
  const groups=['Salgadinhos','Chicletes','Balas e pirulitos','Doces e chocolates'];
  $('productGrid').innerHTML=groups.map(group=>{
   const rows=list.filter(p=>snackGroup(p)===group).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
   return rows.length?`<h3 class="hora-product-group">${group}</h3>`+rows.map(productCard).join(''):'';
  }).join('');
 }else{
  const ordered=category==='Todos'?[...list].sort((a,b)=>publicCategoryOrder.indexOf(catalogCategory(a))-publicCategoryOrder.indexOf(catalogCategory(b))||(a.sort_order||0)-(b.sort_order||0)):list;
  $('productGrid').innerHTML=ordered.length?ordered.map(productCard).join(''):message;
 }
 $('endCategory').innerHTML='';
 $('cartCount').textContent=`${count()} ${count()===1?'item':'itens'}`;
 $('headerCartCount').textContent=count();
 $('cartTotal').textContent=fmt(total());
 $('openCart').disabled=count()===0||!shop.accepting_orders;
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
 const kind=$('doseEnergyKind').value,choices=drinkChoiceList('energy',p).filter(o=>kind==='common'?isCommonEnergy(o):kind==='redbull'&&String(o.name).startsWith('Red Bull'));
 $('doseEnergy').innerHTML='<option value="">Escolha o sabor</option>'+choices.map(o=>`<option value="${esc(o.id)}" ${!optionAvailable(o)?'disabled':''}>${esc(o.name)}${optionAvailable(o)?'':' (indisponível)'}</option>`).join('');
 $('doseEnergy').disabled=!kind;$('doseIce').value='';$('doseIce').disabled=true;
 if(kind==='common'&&choices.filter(optionAvailable).length===1&&choices.find(optionAvailable).name==='Energético'){$('doseEnergy').value=choices.find(optionAvailable).id;$('doseIce').disabled=false;}
 $('dosePrice').textContent=(kind?fmt(doseUnitPrice(p,{name:kind==='redbull'?'Red Bull':''})):fmt(p.price_cents)+' / '+fmt(p.price_cents+1000))+' • Copo de 700 ml • Gelo e energético inclusos';
}
function showDoseConfigurator(p){
 if(!available(p)||!hasDrinkOptions(p))return toast('Dose ou sabores indisponíveis. O dono precisa liberar no admin.',true);
 doseSelected=p;
 $('doseTitle').textContent=p.name;
 $('dosePrice').textContent=fmt(p.price_cents)+' • Copo de 700 ml • Gelo e energético inclusos';
 const choices=drinkChoiceList('ice',p);
 const energies=drinkChoiceList('energy',p);
 $('doseIce').innerHTML='<option value="">Escolha o gelo</option>'+choices.map(o=>`<option value="${esc(o.id)}" ${!optionAvailable(o)?'disabled':''}>${esc(o.name)}${optionAvailable(o)?'':' (indisponível)'}</option>`).join('');
 $('doseEnergy').innerHTML='<option value="">Escolha o energético</option>'+energies.map(o=>`<option value="${esc(o.id)}" ${!optionAvailable(o)?'disabled':''}>${esc(o.name)}${optionAvailable(o)?'':' (indisponível)'}</option>`).join('');
 $('doseEnergyLabel').textContent=p.name.toLowerCase().includes('com vibe')?'3. Escolha o Vibe incluído':'3. Escolha o sabor do Red Bull incluído';
 const house=isHouseGin(p),form=$('doseForm'),iceField=$('doseIce').closest('.form-field'),energyField=$('doseEnergy').closest('.form-field');
 $('doseEnergyKindField').classList.toggle('hidden',!house);
 $('doseEnergyKind').required=house;$('doseEnergyKind').disabled=!house;
 $('doseIce').disabled=house;$('doseEnergy').disabled=true;$('doseEnergyKind').value='';
 $('doseInstructions').textContent=house?'Escolha Energético ou Red Bull, depois o sabor disponível e o gelo. O valor muda conforme a escolha.':'Escolha o gelo e depois o energético. Sabores esgotados ou pausados não podem ser pedidos.';
 if(house){
  form.insertBefore(energyField,iceField);
  $('doseEnergyLabel').textContent='2. Escolha o sabor do energético';$('doseIceLabel').textContent='3. Escolha o sabor do gelo';
  const common=energies.some(o=>isCommonEnergy(o)&&optionAvailable(o)),redbull=energies.some(o=>String(o.name).startsWith('Red Bull')&&optionAvailable(o));
  $('doseEnergyKind').innerHTML='<option value="">Escolha o energético</option>'+[['common','Energético',p.price_cents,common],['redbull','Red Bull',p.price_cents+1000,redbull]].map(([v,n,price,ok])=>`<option value="${v}" ${ok?'':'disabled'}>${n} — ${fmt(price)}${ok?'':' (indisponível)'}</option>`).join('');
  refreshHouseGinEnergy();
 }else{form.insertBefore(iceField,energyField);$('doseIceLabel').textContent='2. Escolha o sabor do gelo';}
 open('doseModal');
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

let loadingCatalog=false;
async function loadCatalog(){
  if(loadingCatalog||working)return;
  loadingCatalog=true;
  try{
    const d=await api('catalog',null,{method:'GET'});
    const snapshot=JSON.stringify(d);
    if(snapshot===lastSnapshot)return;
    lastSnapshot=snapshot;products=(d.products||[]).map(normalizeProduct);drinkOptions=d.drink_options||[];shop=d.store||shop;
    setBrand(shop.name);
    const banner=$('modeBanner');banner.className='mode-banner live';banner.textContent=shop.accepting_orders?'● Catálogo conectado • Estoque atualizado automaticamente':'● Pedidos temporariamente pausados pelo proprietário';
    cleanCart();renderProducts();
    if($('cartModal').classList.contains('open')){
      if(!count())close('cartModal');
      else {renderCheckoutSummary();renderCheckoutExtras();}
    }
  }catch(e){
    lastSnapshot='';
    // Catálogo de consulta quando o D1 ainda não está configurado.
    // Nunca habilita pedidos fictícios, mesmo que alguns preços já sejam conhecidos.
    try {
      const response = await fetch('/catalogo-previa.json',{cache:'no-store'});
      if (!response.ok) throw Error('Catálogo indisponível');
      const d=await response.json();
      if (!Array.isArray(d.products)) throw Error('Catálogo inválido');
      products=d.products.filter(p=>p.category!=='Tabacaria').map(normalizeProduct).map(p=>({...p,active:false,stock:0,unlimited:false}));drinkOptions=[];
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
 panel.classList.toggle('hidden',extrasDismissed);
 if(extrasDismissed)return;
 $('checkoutExtrasList').innerHTML=checkoutExtras.map(extra=>{
  const p=extraProduct(extra.key);
  const usable=Boolean(p&&available(p)&&(!p.unlimited?desiredQty(p)<p.stock:true));
  const qty=p?desiredQty(p):0;
  const description=usable?fmt(p.price_cents):'Indisponível no momento';
  return `<div class="checkout-extra">
   <span class="checkout-extra-emoji" aria-hidden="true">${extra.icon}</span>
   <div class="checkout-extra-name"><strong>${esc(extra.label)}</strong><small>${esc(description)}${qty?' · '+qty+' no pedido':''}</small></div>
   <button type="button" class="btn btn-secondary btn-sm" data-checkout-extra="${esc(extra.key)}" ${usable?'':'disabled'}>${usable?'+ Adicionar':'Indisponível'}</button>
  </div>`;
 }).join('');
};
const addCheckoutExtra=key=>{
 const p=extraProduct(key);
 if(!p||!available(p)||isDoseProduct(p)||p.category==='Tabacaria')return toast('Este extra não está disponível.',true);
 const q=desiredQty(p);
 if(!p.unlimited&&q>=p.stock)return toast('Este extra esgotou.',true);
 if(q>=99)return toast('Limite de 99 unidades por produto.',true);
 cart.set(p.id,{id:p.id,quantity:q+1});
 renderCheckoutSummary();renderCheckoutExtras();renderProducts();
 toast(p.name+' adicionado ao pedido.');
};
function showCheckout(){
  if(!count())return;
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
  $('paymentOptions').innerHTML=[
    ['cash','💵 Dinheiro','Pagamento no portão',true],
    ['card','💳 Cartão','Maquininha no portão',true],
    ['pix','▦ Pix','QR Code e Copia e Cola — aguardando API',false],
    ['apple','◉ Apple Pay','Pagamento no iPhone — aguardando API',false],
    ['google','◉ Google Pay','Pagamento no Android — aguardando API',false]
  ].map(([v,label,sub,enabled])=>`<label class="pay-option"><input type="radio" name="payment" value="${v}" ${v==='cash'?'checked':''} ${enabled?'':'disabled'}><b>${label}</b><small>${sub}</small></label>`).join('');
  $('payWarning').classList.remove('hidden');
  $('payWarning').textContent='Pix, Apple Pay e Google Pay serão habilitados quando a API do provedor estiver conectada. Não é gerado nenhum código de cobrança falso.';
  $('cashField').classList.remove('hidden');
  refreshCash();
  open('cartModal');
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
 updateCashPreview();
}
async function submitOrder(event){
  event.preventDefault();
  if(working)return;
  const first=$('first').value.trim(),last=$('last').value.trim(),method=document.querySelector('input[name="payment"]:checked')?.value;
  if(first.length<2||last.length<2)return toast('Informe nome e sobrenome.',true);
  if(!$('ageAck').checked)return toast('Confirme ter pelo menos 18 anos.',true);
  if(!['cash','card'].includes(method))return toast('Pagamento online ainda não integrado.',true);
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
      if(recovered.order){currentOrder={id:recovered.order.id,token:recovered.order.token,number:recovered.order.number};localStorage.setItem('adega_my_order_v1',JSON.stringify(currentOrder));sessionStorage.removeItem(key);cart.clear();close('cartModal');renderProducts();await loadTracking();open('trackingModal');$('trackBtn')?.classList.remove('hidden');return toast('Seu pedido anterior já foi registrado. Confira o acompanhamento.');}
      if(Date.now()-pending.at<30000)return toast('Aguarde a confirmação do pedido anterior antes de alterar o carrinho.',true);
    }
    const request_id=pending?.fingerprint===fingerprint?pending.id:crypto.randomUUID();
    sessionStorage.setItem(key,JSON.stringify({fingerprint,id:request_id,at:Date.now()}));
    const d=await api('create-order',{...payload,request_id});
    sessionStorage.removeItem(key);
    trackingFinished=false;
    currentOrder={id:d.order.id,token:d.order.token,number:d.order.number};
    localStorage.setItem('adega_my_order_v1',JSON.stringify(currentOrder));
    cart.clear();close('cartModal');renderProducts();await loadTracking();open('trackingModal');toast('Pedido recebido pela adega!');
    $('trackBtn')?.classList.remove('hidden');
    loadCatalog();
  }catch(e){toast(e.message,true);}finally{working=false;button.disabled=false;button.textContent='Confirmar pedido →';}
}
let trackingBusy=false,trackingFinished=false;
async function loadTracking(){
  if(!currentOrder||trackingBusy)return;
  trackingBusy=true;
  try{
    const {order}=await api('track',{id:currentOrder.id,token:currentOrder.token});
    trackingFinished=['delivered','cancelled'].includes(order.status);
    const instructions=order.payment_status==='paid'?'Pagamento confirmado pelo estabelecimento.':order.payment_method==='cash'?'Pague em dinheiro quando o dono entregar no portão.':'Pague com cartão na maquininha, na retirada.';
    const steps=['received','preparing','ready','delivered'];let current=steps.indexOf(order.status);
    $('trackingContent').innerHTML=`<div class="track" style="margin:12px 0"><div class="eyebrow">${esc(pad(order.order_no))} • Retirada no portão</div><h2 style="margin:10px 0">${esc(order.first_name)} ${esc(order.last_name)}</h2><div class="big-status">${esc(stageLabels[order.status]||order.status)}</div><div class="steps">${steps.slice(0,3).map((s,i)=>`<div class="step ${i===current?'current':i<current?'done':''}">${esc(stageLabels[s])}</div>`).join('')}</div><p class="sub small">${esc(instructions)}</p><p style="margin-top:12px">Valor do pedido: <b>${fmt(order.total_cents)}</b></p><p class="small sub" style="margin-top:12px">Acompanhe esta tela ou a TV da adega. Aguarde do lado de fora.</p></div>`;
  }catch(e){$('trackingContent').innerHTML=`<p class="notice danger">${esc(e.message)}</p>`;}finally{trackingBusy=false;}
}
function start(){
  $('catalogo').addEventListener('click',e=>{
    const config=e.target.closest('button[data-configure]');
    if(config){const p=products.find(x=>x.id===config.dataset.configure);if(p)showDoseConfigurator(p);return;}
    const btn=e.target.closest('button[data-qty]');if(!btn)return;
    const p=products.find(x=>x.id===btn.dataset.id);if(!p||isDoseProduct(p))return;
    const qty=Math.max(0,(cart.get(p.id)?.quantity||0)+Number(btn.dataset.qty));
    if(qty&&(!available(p)||(!p.unlimited&&qty>p.stock)))return;
    qty?cart.set(p.id,{id:p.id,quantity:qty}):cart.delete(p.id);renderProducts();
  });
  $('doseEnergyKind').addEventListener('change',refreshHouseGinEnergy);
  $('doseEnergy').addEventListener('change',()=>{if(isHouseGin(doseSelected)){$('doseIce').disabled=!$('doseEnergy').value;$('doseIce').value='';}});
  $('doseIce').addEventListener('change',()=>{
   if(isHouseGin(doseSelected))return;
   $('doseEnergy').disabled=!$('doseIce').value;
   $('doseEnergy').value='';
  });
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
  const chooseCategory=e=>{const btn=e.target.closest('[data-category]');if(!btn)return;category=btn.dataset.category;searchText='';$('productSearch').value='';renderProducts();$('categorySidebar').classList.remove('mobile-open');$('menuToggle').setAttribute('aria-expanded','false');};
  $('categoryTabs').addEventListener('click',chooseCategory);
  $('categorySideLinks').addEventListener('click',chooseCategory);
  $('productSearch').addEventListener('input',e=>{searchText=e.target.value.trim();category='Todos';renderProducts();});
  $('menuToggle').addEventListener('click',()=>{const el=$('categorySidebar');el.classList.toggle('mobile-open');$('menuToggle').setAttribute('aria-expanded',String(el.classList.contains('mobile-open')));if(el.classList.contains('mobile-open'))$('catalogo').scrollIntoView({block:'start'});});
  $('headerCart').onclick=()=>count()?showCheckout():toast('Seu carrinho está vazio. Escolha um produto.');
  $('openCart').addEventListener('click',showCheckout);
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
  if(currentOrder){$('trackBtn')?.classList.remove('hidden');loadTracking();}
  $('trackBtn')?.addEventListener('click',()=>{if(!currentOrder)return toast('Você ainda não possui pedido neste dispositivo.');loadTracking();open('trackingModal');});
  (async()=>{try{const pending=JSON.parse(sessionStorage.getItem('adega_pending_request_v2')||'null');if(pending?.id){const d=await api('recover-order',{request_id:pending.id});if(d.order){currentOrder={id:d.order.id,token:d.order.token,number:d.order.number};localStorage.setItem('adega_my_order_v1',JSON.stringify(currentOrder));sessionStorage.removeItem('adega_pending_request_v2');$('trackBtn')?.classList.remove('hidden');await loadTracking();open('trackingModal');}}}catch{}})();
  loadCatalog();
  setInterval(()=>{if(!document.hidden)loadCatalog();},30000);
  setInterval(()=>{if(currentOrder&&!trackingFinished&&!document.hidden&&$('trackingModal').classList.contains('open'))loadTracking();},8000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadCatalog();});
}
start();
