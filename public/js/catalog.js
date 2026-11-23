import {api,CATEGORIES,fmt,esc,pad,priceParse,toast,setBrand,stageLabels,photoFor,photoFallbackFor,photoStatusFor} from './shared.js';

let products=[],shop={name:'ADEGA DIGITAL',accepting_orders:true},category='Todos',working=false,lastSnapshot='';
const cart=new Map();
let currentOrder=null;
const $=id=>document.getElementById(id);
const photoSlug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const open=id=>$(id)?.classList.add('open');
const close=id=>$(id)?.classList.remove('open');
const available=p=>p.active && p.price_cents>0 && (p.unlimited || p.stock>0) && shop.accepting_orders;
const total=()=>products.reduce((s,p)=>s+(cart.get(p.id)||0)*p.price_cents,0);
const count=()=>[...cart.values()].reduce((a,b)=>a+b,0);
const desiredQty=p=>cart.get(p.id)||0;
const productCard=p=>{
  const left=p.unlimited?'Disponível':p.stock>0?`${p.stock} em estoque`:'Esgotado';
  const inactive=!p.active?'Indisponível':!p.price_cents?'Indisponível — preço a definir':!p.unlimited && !p.stock?'Indisponível — esgotado':!shop.accepting_orders?'Indisponível — pedidos pausados':null;
  const q=desiredQty(p);
  const packaged = ['Cervejas','Salgadinhos','Doces e Balas','Diversos','Bebidas prontas'].includes(p.category);
  const fallback = photoFallbackFor(p);
  const photoNote = photoStatusFor(p)==='pending'?'<span class="photo-note">Foto real pendente</span>':'';
  const media = `<img class="product-photo" src="${esc(photoFor(p))}" data-fallback="${esc(fallback)}" alt="Foto do produto ${esc(p.name)}" loading="lazy" onerror="if(this.dataset.fallback){const f=this.dataset.fallback;delete this.dataset.fallback;this.src=f}else{this.onerror=null;this.src='/imagens/foto-pendente.webp'}">`;
  return `<article class="product">
    <div class="product-visual ${packaged?'packshot':''}">${media}<span class="flag">${esc(p.category)}</span>${photoNote}</div>
    <div class="product-content"><h3>${esc(p.name)}</h3><p>${esc(p.description||'Escolha a quantidade e retire no portão.')}</p>
    <span class="tiny ${!p.unlimited&&p.stock<=5?'warn':''}">${inactive||left}</span>
    <div class="product-footer"><span class="price">${p.price_cents?fmt(p.price_cents):'Preço em breve'}</span>
    <div class="qty"><button type="button" aria-label="Diminuir ${esc(p.name)}" data-qty="-1" data-id="${p.id}" ${q<1?'disabled':''}>−</button><strong>${q}</strong><button type="button" aria-label="Adicionar ${esc(p.name)}" data-qty="1" data-id="${p.id}" ${!available(p)||(!p.unlimited&&q>=p.stock)?'disabled':''}>+</button></div></div></div></article>`;
};
function showCategories(){
  const exist=new Set(products.map(p=>p.category));
  const cats=CATEGORIES.filter(c=>c==='Todos'||(c!=='Tabacaria'&&exist.has(c)));
  if(!cats.includes(category))category='Todos';
  $('categoryTabs').innerHTML=cats.map(c=>`<button class="tab ${c===category?'active':''}" data-category="${esc(c)}">${esc(c)}</button>`).join('');
}
function renderProducts(){
  showCategories();
  const general=products.filter(p=>p.category!=='Tabacaria');
  const list=category==='Todos'?general:general.filter(p=>p.category===category);
  const message='<div class="empty">O cardápio será cadastrado em breve. Nenhuma cobrança ou pedido fictício será criado.</div>';
  $('productGrid').innerHTML=list.length?list.map(productCard).join(''):message;
  // O estoque de Tabacaria permanece exclusivamente no admin, não no checkout online.
  $('endCategory').innerHTML='';
  $('cartCount').textContent=`${count()} ${count()===1?'item':'itens'}`;
  $('cartTotal').textContent=fmt(total());
  $('openCart').disabled=count()===0||!shop.accepting_orders;
}
function cleanCart(){
  let changed=false;
  for(const [id,q] of cart){const p=products.find(x=>x.id===id);if(!p||!available(p)){cart.delete(id);changed=true;continue;}if(!p.unlimited&&q>p.stock){if(p.stock)cart.set(id,p.stock);else cart.delete(id);changed=true;}}
  if(changed)toast('Carrinho atualizado conforme a disponibilidade do estoque.',true);
}
async function loadCatalog(){
  try{
    const d=await api('catalog',null,{method:'GET'});
    const snapshot=JSON.stringify(d);
    if(snapshot===lastSnapshot)return;
    lastSnapshot=snapshot;products=d.products||[];shop=d.store||shop;
    setBrand(shop.name);
    const banner=$('modeBanner');banner.className='mode-banner live';banner.textContent=shop.accepting_orders?'● Catálogo conectado • Estoque atualizado automaticamente':'● Pedidos temporariamente pausados pelo proprietário';
    cleanCart();renderProducts();
  }catch(e){
    // Catálogo de consulta quando Supabase/Netlify ainda não estão configurados.
    // Nunca habilita pedidos fictícios, mesmo que alguns preços já sejam conhecidos.
    try {
      const response = await fetch('/catalogo-previa.json',{cache:'no-store'});
      if (!response.ok) throw Error('Catálogo indisponível');
      const d=await response.json();
      if (!Array.isArray(d.products)) throw Error('Catálogo inválido');
      products=d.products.filter(p=>p.category!=='Tabacaria').map(p=>({...p,active:false,stock:0,unlimited:false}));
      shop={...(d.store||{}),accepting_orders:false};
      setBrand(shop.name);
      $('modeBanner').className='mode-banner offline';
      $('modeBanner').textContent='Catálogo disponível para consulta • pedidos temporariamente indisponíveis';
      renderProducts();
    } catch {
      if(!lastSnapshot){$('productGrid').innerHTML='<div class="empty">Catálogo ainda não configurado. Confira o Netlify e Supabase.</div>';
        $('modeBanner').className='mode-banner offline';$('modeBanner').textContent='Conexão pendente — configurar banco de dados';}
    }
  }
}
function showCheckout(){
  if(!count())return;
  try{
    const saved=JSON.parse(sessionStorage.getItem('adega_customer_profile_v1')||'null');
    if(saved && typeof saved.first==='string' && typeof saved.last==='string'){
      $('first').value=saved.first;$('last').value=saved.last;
      $('ageAck').checked=sessionStorage.getItem('adega_age_ok')==='1';
    }
  }catch{}
  const chosen=products.filter(p=>cart.get(p.id));
  $('checkoutSummary').innerHTML=chosen.map(p=>`<div class="order-line"><span>${cart.get(p.id)}x ${esc(p.name)}</span><strong>${fmt(cart.get(p.id)*p.price_cents)}</strong></div>`).join('')+`<div class="order-line"><strong>Total</strong><strong class="gold">${fmt(total())}</strong></div>`;
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
  open('cartModal');
}
function refreshCash(){
  const method=document.querySelector('input[name="payment"]:checked')?.value;
  $('cashField').classList.toggle('hidden',method!=='cash');
}
async function submitOrder(event){
  event.preventDefault();
  if(working)return;
  const first=$('first').value.trim(),last=$('last').value.trim(),method=document.querySelector('input[name="payment"]:checked')?.value;
  if(first.length<2||last.length<2)return toast('Informe nome e sobrenome.',true);
  if(!$('ageAck').checked)return toast('Confirme ter pelo menos 18 anos.',true);
  if(!['cash','card'].includes(method))return toast('Pagamento online ainda não integrado.',true);
  const cash=$('cash').value.trim()?priceParse($('cash').value):null;
  if(method==='cash' && $('cash').value.trim() && (cash===null||cash<total()))return toast('Informe o valor correto para calcular o troco.',true);
  const items=[...cart.entries()].map(([id,quantity])=>({id,quantity}));
  const button=$('placeOrder');working=true;button.disabled=true;button.textContent='Registrando pedido...';
  try{
    const d=await api('create-order',{first_name:first,last_name:last,payment_method:method,cash_given_cents:method==='cash'?cash:null,items,age_confirmed:true,honeypot:''});
    currentOrder={id:d.order.id,token:d.order.token,number:d.order.number};
    localStorage.setItem('adega_my_order_v1',JSON.stringify(currentOrder));
    cart.clear();close('cartModal');renderProducts();await loadTracking();open('trackingModal');toast('Pedido recebido pela adega!');
    $('trackBtn')?.classList.remove('hidden');
    loadCatalog();
  }catch(e){toast(e.message,true);}finally{working=false;button.disabled=false;button.textContent='Confirmar pedido →';}
}
async function loadTracking(){
  if(!currentOrder)return;
  try{
    const {order}=await api('track',{id:currentOrder.id,token:currentOrder.token});
    const instructions=order.payment_status==='paid'?'Pagamento confirmado pelo estabelecimento.':order.payment_method==='cash'?'Pague em dinheiro quando o dono entregar no portão.':'Pague com cartão na maquininha, na retirada.';
    const steps=['received','preparing','ready','delivered'];let current=steps.indexOf(order.status);
    $('trackingContent').innerHTML=`<div class="track" style="margin:12px 0"><div class="eyebrow">${esc(pad(order.order_no))} • Retirada no portão</div><h2 style="margin:10px 0">${esc(order.first_name)} ${esc(order.last_name)}</h2><div class="big-status">${esc(stageLabels[order.status]||order.status)}</div><div class="steps">${steps.slice(0,3).map((s,i)=>`<div class="step ${i===current?'current':i<current?'done':''}">${esc(stageLabels[s])}</div>`).join('')}</div><p class="sub small">${esc(instructions)}</p><p style="margin-top:12px">Valor do pedido: <b>${fmt(order.total_cents)}</b></p><p class="small sub" style="margin-top:12px">Acompanhe esta tela ou a TV da adega. Aguarde do lado de fora.</p></div>`;
  }catch(e){$('trackingContent').innerHTML=`<p class="notice danger">${esc(e.message)}</p>`;}
}
function start(){
  $('catalogo').addEventListener('click',e=>{const btn=e.target.closest('button[data-qty]');if(!btn)return;const p=products.find(p=>p.id===btn.dataset.id);if(!p)return;const qty=Math.max(0,(cart.get(p.id)||0)+Number(btn.dataset.qty));if(qty && (!available(p)||(!p.unlimited&&qty>p.stock)))return;qty?cart.set(p.id,qty):cart.delete(p.id);renderProducts();});
  $('categoryTabs').addEventListener('click',e=>{const btn=e.target.closest('[data-category]');if(!btn)return;category=btn.dataset.category;renderProducts();});
  $('openCart').addEventListener('click',showCheckout);
  $('closeCart').onclick=()=>close('cartModal');
  $('closeTracking').onclick=()=>close('trackingModal');
  $('checkoutForm').addEventListener('submit',submitOrder);
  $('paymentOptions').addEventListener('change',refreshCash);
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
  $('trackBtn')?.addEventListener('click',()=>{loadTracking();open('trackingModal');});
  loadCatalog();setInterval(loadCatalog,5000);setInterval(()=>{if(currentOrder)loadTracking();},3500);
}
start();
