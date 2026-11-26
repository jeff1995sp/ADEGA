import {orderedQueue,nextOrder,queueSearch,needsPreparation,isQuickOrder} from './order-queue.js?v=2';
import {preparationSummary} from './preparation.js?v=1';
import {managementMetrics} from './admin-central.js?v=1';
import {api,authSave,authRead,authClear,CATEGORIES,fmt,esc,pad,priceParse,toast,setBrand,minutesAgo,labels,stageLabels,photoFor,photoFallbackFor,photoStatusFor,catalogCategory,isStandaloneIce,productDescription,normalizeProduct} from './shared.js?v=20261124-auth';
const $=id=>document.getElementById(id);
const photoSlug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
let cashReport=null,reportAt=0,reportLoading=false;
let orders=[],products=[],drinkOptions=[],drinkOptionsReady=false,shop={name:'Hora Extra Drinks',accepting_orders:true,low_stock_threshold:5},activeTab='orders',inventoryFilter='Todos',inventorySearch='',inventoryStatus='all',busy=false,lastFirst=null,sounds=false,audioContext;
const button=(label,action,id,value='',type='secondary',disabled=false)=>`<button class="btn btn-${type} btn-sm" data-action="${action}" data-id="${id}" data-value="${value}" ${disabled?'disabled':''}>${label}</button>`;
const statusBadge=o=>`<span class="pill ${o.payment_status==='paid'?'good':'warn'}">${o.payment_status==='paid'?'● Pago':'◷ Pagamento pendente'}</span>`;
function tone(){if(!sounds)return;try{audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();const t=audioContext.currentTime;[780,1040].forEach((hz,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=hz;g.gain.setValueAtTime(.0001,t+i*.17);g.gain.exponentialRampToValueAtTime(.11,t+i*.17+.02);g.gain.exponentialRampToValueAtTime(.0001,t+i*.17+.15);o.connect(g);g.connect(audioContext.destination);o.start(t+i*.17);o.stop(t+i*.17+.16);});}catch{}}
let shopToggleReady=false,shopToggleBusy=false,shopToggleRevision=0;
let lastOrdersAt=0,ordersConnectionFailed=false;
let refreshBusy=false,lastCatalogAt=0,ordersInitialized=false,knownOrders=new Set(),ordersRequest=null,ordersSnapshot='',orderRefreshPending=false;
function adminAnnounce(message){
 if(!sounds)return;
 tone();
 if('speechSynthesis' in window){try{const u=new SpeechSynthesisUtterance(message);u.lang='pt-BR';u.rate=.95;window.speechSynthesis.speak(u);}catch{}}
}
function handleRefreshError(e,quiet){
 if(e.status===401||/sessão expirada|faça login no admin/i.test(e.message)){authClear();showLogin();$('loginError').textContent=e.message;return;}
 if(!quiet)toast(e.message,true);
}
async function refreshOrders(quiet=true){
 if(!authRead()?.token||$('appScreen').classList.contains('hidden'))return;
 if(ordersRequest){orderRefreshPending=true;return ordersRequest;}
 const request=async()=>{
  try{
   const {orders:incoming=[],high_demand=false,demand_manual=false,demand_count=0,service_metrics={count:0,average_seconds:null}}=await api('admin-orders',null,{method:'GET',admin:true});
   if(!demandBusy){demandActive=Boolean(high_demand);demandManual=Boolean(demand_manual);demandCount=demand_count;renderDemand();}
   if(!authRead()?.token||$('appScreen').classList.contains('hidden'))return;
   serviceMetrics=service_metrics;renderServiceMetrics();
    const snapshot=JSON.stringify(incoming);
   if(ordersInitialized){for(const order of incoming){if(!knownOrders.has(order.id)){adminAnnounce('Novo pedido recebido de '+order.first_name+'.');toast('Novo pedido: '+order.first_name);}}}
   for(const order of incoming)knownOrders.add(order.id);
   if(knownOrders.size>2000)knownOrders=new Set([...knownOrders].slice(-1000));
   ordersInitialized=true;orders=incoming;lastOrdersAt=Date.now();ordersConnectionFailed=false;renderOverview();renderPreparation();
   if(snapshot!==ordersSnapshot){ordersSnapshot=snapshot;renderStats();renderOrders();}
   const pending=incoming.filter(o=>o.status==='received').length;
   $('pendingOrderBadge').textContent=String(pending);$('pendingOrderBadge').classList.toggle('hidden',!pending);
   $('orderHeartbeat').textContent='● Atualizado '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
   $('orderHeartbeat').className='pill good';
  }catch(e){ordersConnectionFailed=true;renderOverview();renderPreparation();$('orderHeartbeat').textContent='Reconectando…';$('orderHeartbeat').className='pill warn';handleRefreshError(e,quiet);}
 };
 ordersRequest=request();
 try{await ordersRequest;}finally{ordersRequest=null;if(orderRefreshPending){orderRefreshPending=false;void refreshOrders(true);}}
}
async function refreshData(quiet=false,forceCatalog=true){
 const orderPromise=refreshOrders(quiet);
 if(busy||refreshBusy){await orderPromise;return;}
 refreshBusy=true;
 try{
  if(forceCatalog||!lastCatalogAt||Date.now()-lastCatalogAt>=30000){
   const shopRevisionAtRequest=shopToggleRevision;
   const c=await api('admin-catalog',null,{method:'GET',admin:true});
   if(!authRead()?.token||$('appScreen').classList.contains('hidden'))return;
   lastCatalogAt=Date.now();products=(c.products||[]).map(normalizeProduct);drinkOptions=c.drink_options||[];drinkOptionsReady=c.drink_options_ready===true;if(c.store){const confirmed=typeof c.store.accepting_orders==='boolean'||c.store.accepting_orders===0||c.store.accepting_orders===1;const preserve=shopToggleBusy||shopRevisionAtRequest!==shopToggleRevision;shop={...shop,...c.store,...(preserve?{accepting_orders:shop.accepting_orders}:{})};if(confirmed&&!preserve)shopToggleReady=true;}setBrand(shop.name);
   render();
  }
 }catch(e){handleRefreshError(e,quiet);}finally{refreshBusy=false;await orderPromise;}
}
const paid=o=>o.payment_status==='paid';
const allItems=o=>(o.order_items||[]).map(i=>{
 const [name,...choices]=String(i.product_name||'Produto').split(' | ');
 const product=products.find(p=>p.id===i.product_id);
 const picture={id:i.product_id,name,category:i.category,image_url:i.image_url||product?.image_url};
 const src=photoFor(picture),fallback=photoFallbackFor(picture);
 const details=choices.filter(Boolean).map(s=>'<span>'+esc(s)+'</span>').join('');
 return `<li class="order-photo-item"><div class="order-photo-preview"><img src="${esc(src)}" data-fallback="${esc(fallback)}" alt="Foto de ${esc(name)}" width="84" height="84" decoding="async" onerror="if(this.dataset.fallback&&this.getAttribute('src')!==this.dataset.fallback){const f=this.dataset.fallback;delete this.dataset.fallback;this.src=f}else{this.onerror=null;this.src='/imagens/foto-pendente.webp'}"><strong class="order-photo-qty">${esc(i.quantity)}×</strong></div><span class="order-photo-name">${esc(name)}</span>${details?'<div class="order-photo-details">'+details+'</div>':''}<b class="order-photo-price">${fmt(Number(i.quantity)*Number(i.unit_price_cents))}</b></li>`;
}).join('');
function renderStats(){
  const pending=orders.filter(o=>o.status!=='delivered'&&o.status!=='cancelled');
  const p=[['Aguardando',pending.filter(o=>o.status==='received').length],['Preparando',pending.filter(o=>o.status==='preparing').length],['Prontos',pending.filter(o=>o.status==='ready').length],['Pagos em andamento',orders.filter(o=>paid(o)).length]];
  renderServiceMetrics();$('stats').innerHTML=p.map(([l,v],k)=>`<div class="stat dashboard-stat dashboard-stat-${k}"><span>${l}</span><b>${v}</b><span class="stat-indicator" aria-hidden="true"></span></div>`).join('');
}
let orderFilter='all',orderSearch='',selectedOrderId=null,initialOrderSelection=true;
let serviceMetrics={count:0,average_seconds:null};
function renderServiceMetrics(){const el=$('serviceAverage');if(!el)return;const n=Number(serviceMetrics.count)||0,seconds=serviceMetrics.average_seconds;el.textContent=n&&Number.isFinite(seconds)?Math.floor(seconds/60)+'m '+Math.round(seconds%60)+'s':'—';$('serviceSamples').textContent=n?n+' pedidos prontos hoje · do recebimento até ficar pronto':'Sem pedidos prontos hoje';}
function selectOrder(id){selectedOrderId=id;initialOrderSelection=false;renderOrders();}
function renderOrders(){
 const visible=orderedQueue(orders),root=$('ordersList');
 if(!$('orderQueueTools')){
  root.innerHTML='<div class="order-workspace"><aside class="order-queue-side" aria-label="Fila de pedidos"><div id="orderQueueTools"><input id="orderQueueSearch" type="search" placeholder="Buscar nome ou número" aria-label="Buscar pedido"><div id="orderQueueTabs"></div><button type="button" id="queueNext" class="btn btn-primary btn-wide">Selecionar próximo da fila</button><p class="tiny sub" id="orderQueueCount"></p></div><div id="orderQueueRows"></div></aside><div id="orderSelected" class="order-selected"></div></div>';
  $('orderQueueSearch').oninput=e=>{orderSearch=e.target.value;renderOrders();};
  $('orderQueueTabs').onclick=e=>{const b=e.target.closest('[data-queue]');if(!b)return;orderFilter=b.dataset.queue;renderOrders();};
  $('orderQueueRows').onclick=e=>{const b=e.target.closest('[data-select-order]');if(b){selectOrder(b.dataset.selectOrder);if(matchMedia('(max-width:800px)').matches)$('orderSelected').scrollIntoView({block:'start',behavior:'instant'});}};
  $('queueNext').onclick=()=>{const next=orderFilter==='quick'?orderedQueue(orders).find(isQuickOrder):nextOrder(orderedQueue(orders));if(next){if(orderFilter!=='quick')orderFilter='all';orderSearch='';$('orderQueueSearch').value='';selectOrder(next.id);}};
 }
 if(initialOrderSelection&&visible.length){selectedOrderId=nextOrder(visible)?.id||null;initialOrderSelection=false;}
 const selected=visible.find(o=>o.id===selectedOrderId);if(!selected)selectedOrderId=null;
 const groups=[['all','Todos'],['received','Novos'],['preparing','Em preparo'],['ready','Prontos'],['quick','⚡ Fila rápida']];
 const tabs=groups.map(([k,n])=>`<button type="button" class="btn btn-${orderFilter===k?'primary':'secondary'} btn-sm" data-queue="${k}" aria-pressed="${orderFilter===k}">${n} <b>${visible.filter(o=>k==='all'||(k==='quick'?isQuickOrder(o):o.status===k)).length}</b></button>`).join('');
 if($('orderQueueTabs').dataset.markup!==tabs){$('orderQueueTabs').innerHTML=tabs;$('orderQueueTabs').dataset.markup=tabs;}
 const filtered=queueSearch(visible,orderFilter,orderSearch);$('queueNext').disabled=orderFilter==='quick'?!visible.some(isQuickOrder):!visible.length;$('queueNext').textContent=orderFilter==='quick'?'⚡ Próximo pedido rápido':'Selecionar próximo da fila';
 $('orderQueueCount').textContent=filtered.length+' de '+visible.length+' pedidos ativos · ordem de chegada';
 const rows=filtered.map(o=>`<button type="button" data-select-order="${esc(o.id)}" aria-pressed="${o.id===selectedOrderId}" class="queue-ticket queue-${esc(o.status)}"><b>#${pad(o.order_no)}</b><span class="queue-ticket-info"><strong>${esc(o.first_name)} ${esc(o.last_name)}</strong><small>${esc(stageLabels[o.status])} · ${(o.order_items||[]).reduce((n,i)=>n+Number(i.quantity||0),0)} un. · ${fmt(o.total_cents)}</small></span><span class="queue-kind">${o.status==='ready'?'RETIRADA':needsPreparation(o)?'PREPARO':'SEPARAR'}</span></button>`).join('')||'<div class="empty">Nenhum pedido nesta lista.</div>';
 const list=$('orderQueueRows');if(list.dataset.markup!==rows){const scroll=list.scrollTop;list.innerHTML=rows;list.dataset.markup=rows;list.scrollTop=scroll;}
 const detail=$('orderSelected');
 const markup=selected?[selected].map(o=>{const cash=o.payment_method==='cash'
      ?o.cash_given_cents!==null
        ?`<div class="order-cash-summary"><div><small>PREPARAR TROCO:</small><strong>${fmt(Math.max(0,o.cash_given_cents-o.total_cents))}</strong></div><div><small>Cliente entrega:</small><b>${fmt(o.cash_given_cents)}</b></div><div><small>Total do pedido</small><b>${fmt(o.total_cents)}</b></div><span class="cash-order-note">Finalize somente após receber o dinheiro e entregar o pedido.</span></div>`
        :'<div class="notice danger" style="margin:12px 0">⚠ O cliente não informou o valor em dinheiro; confirmar no atendimento.</div>'
      :'';
    const voice=o.voice||'';
    const deadline=o.ready_at?Date.parse(o.ready_at)+900000:NaN;
    const overdue=o.status==='ready'&&Number.isFinite(deadline)&&Date.now()>=deadline;
    const stageIndex=['received','preparing','ready'].indexOf(o.status);
    const timeline=['Recebido','Preparando','Pronto'].map((label,i)=>`<span class="order-flow-step ${i<stageIndex?'done':i===stageIndex?'current':''}" ${i===stageIndex?'aria-current="step"':''}><b>${i<stageIndex?'✓':i+1}</b>${label}</span>`).join('');
    const cardAtPickup=o.payment_method==='card';
    const steps=o.status==='received'?button(needsPreparation(o)?'Iniciar preparo':'Separar itens','status',o.id,'preparing',needsPreparation(o)?'primary':'secondary')+button(needsPreparation(o)?'Marcar pronto':'Já está pronto','status',o.id,'ready',needsPreparation(o)?'secondary':'primary'):o.status==='preparing'?button('Marcar pedido pronto','status',o.id,'ready','primary'):o.payment_method==='cash'?button('Finalizar pedido','finishcash',o.id,'','primary'):cardAtPickup?button('Finalizar pedido','finishcard',o.id,'','primary'):button('Finalizar pedido','status',o.id,'delivered','primary',!paid(o)||(o.payment_method==='pix'&&!o.receipt_checked));
    const proof=o.payment_method==='pix'?`<div class="notice ${paid(o)?'':'danger'}"><b>CONFERIR COMPROVANTE NA ENTREGA</b><br>${paid(o)?o.receipt_checked?'✓ Comprovante conferido':'Compare o comprovante com a transação confirmada no gateway.':'⚠ Pix pendente: NÃO liberar entrega.'}</div>`:'';
    return `<article class="order-card premium-order order-${esc(o.status)}" data-order-card="${esc(o.id)}" tabindex="-1"><div class="order-top"><div><div class="order-kicker">PEDIDO ${pad(o.order_no)} · ${minutesAgo(o.created_at)}</div><div class="order-name">${esc(o.first_name)} ${esc(o.last_name)}</div></div><div class="order-status-stack"><span class="order-stage">${esc(stageLabels[o.status])}</span>${statusBadge(o)}</div></div>
    ${o.status==='ready'&&Number.isFinite(deadline)?`<div class="notice ${overdue?'danger':''} order-pickup-timer" data-ready-deadline="${deadline}" data-paid="${paid(o)}">${overdue?(paid(o)?'Prazo de retirada excedido · pedido pago: conferir com cliente':'Prazo de 15 minutos excedido · pode cancelar se não retirado'):'Retirada até '+new Date(deadline).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>`:''}${o.duplicate_name?'<div class="order-duplicate-warning"><strong>Atenção: nome repetido na fila</strong><span>Confira o número do pedido na TV ou no celular do cliente. Não é necessário digitar código.</span></div>':''}<div class="order-flow" aria-label="Etapas do pedido">${timeline}</div><section class="order-items-panel"><div class="order-items-caption">ITENS DO PEDIDO</div><ul class="order-item-lines order-photo-grid">${allItems(o)||'<li>Sem itens registrados</li>'}</ul><div class="order-payment-line"><div><small>Forma de pagamento</small><strong>${esc(labels[o.payment_method]||o.payment_method)}</strong></div><div><small>Total do pedido</small><b>${fmt(o.total_cents)}</b></div></div></section>${cash}
    ${proof}<div class="muted-separator"></div>
    <div class="order-bottom order-actions">${cardAtPickup?'<span class="small sub">Cobrar na maquininha antes de finalizar.</span>':''}
      
      ${o.payment_method==='pix'&&paid(o)&&!o.receipt_checked?button('📑 Comprovante conferido','receipt',o.id,'','secondary'):''}
      ${steps}${!paid(o)?button('Cancelar pedido','cancel',o.id,'','danger'):''}</div>
    <details class="order-voice-optional"><summary>Voz da TV (opcional) <small>${voice==='male'?'Masculina':voice==='female'?'Feminina':'Padrão · feminina'}</small></summary><p class="tiny sub">Não é necessário escolher uma voz para avançar. A chamada depende do áudio ativado na TV.</p><div class="order-bottom">${button(`${voice==='female'?'✓ ':''}Feminina`,'voice',o.id,'female',voice==='female'?'primary':'secondary')}${button(`${voice==='male'?'✓ ':''}Masculina`,'voice',o.id,'male',voice==='male'?'primary':'secondary')}</div></details>
    </article>`;
  }).join(''):'<div class="empty queue-empty"><strong>'+(visible.length?'Selecione um pedido na fila':'Nenhum pedido ativo')+'</strong><p>'+(visible.length?'Selecione pelo número ou use o botão da fila. Após finalizar, outro pedido não será aberto automaticamente.':'Os novos pedidos aparecerão automaticamente.')+'</p></div>';
 if(detail.dataset.markup!==markup){const opened=detail.querySelector('details[open]')&&detail.querySelector('[data-order-card]')?.dataset.orderCard===selectedOrderId;detail.innerHTML=markup;detail.dataset.markup=markup;if(opened&&detail.querySelector('details'))detail.querySelector('details').open=true;}
}
function renderInventory(){
  const threshold=shop.low_stock_threshold??5;
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const order=CATEGORIES.map(c=>c);
  const all=products.filter(p=>!isStandaloneIce(p)).sort((x,y)=>(order.indexOf(catalogCategory(x))<0?999:order.indexOf(catalogCategory(x)))-(order.indexOf(catalogCategory(y))<0?999:order.indexOf(catalogCategory(y)))||x.name.localeCompare(y.name,'pt-BR'));
  const filtered=all.filter(p=>{
    const cat=catalogCategory(p);
    return (inventoryFilter==='Todos'||cat===inventoryFilter)&&(!inventorySearch||norm(p.name+' '+cat).includes(norm(inventorySearch)))&&(inventoryStatus==='all'||(inventoryStatus==='unpriced'&&!p.price_cents)||(inventoryStatus==='paused'&&!p.active)||(inventoryStatus==='out'&&!p.unlimited&&p.stock===0)||(inventoryStatus==='low'&&p.active&&!p.unlimited&&p.stock>0&&p.stock<=threshold)||(inventoryStatus==='active'&&p.active)||(inventoryStatus==='no-photo'&&photoStatusFor(p)==='pending'));
  });
  const optionsMode=inventoryFilter==='Sabores';
  $('drinkOptionsPanel').classList.toggle('hidden',!optionsMode);
  $('inventoryList').classList.toggle('hidden',optionsMode);
  $('inventorySearchTools').classList.toggle('hidden',optionsMode);
  $('inventoryFilters').querySelectorAll('[data-inventory-filter]').forEach(el=>{el.classList.toggle('active',el.dataset.inventoryFilter===inventoryFilter);});
  if(optionsMode){renderDrinkOptions();return;}
  $('inventoryCount').textContent=filtered.length+' de '+all.length+' produtos';
  const row=p=>{
    const stock=p.unlimited?'Ilimitado':p.stock===0?'<span class="stock-badge out">Esgotado</span>':p.stock<=threshold?`<span class="stock-badge low">⚠ Só ${p.stock} restantes</span>`:`<span class="stock-badge">${p.stock} unidades</span>`;
    return `<div class="inventory-row"><div class="inventory-product-info"><img class="inventory-thumb" src="${esc(photoFor(p))}" data-fallback="${esc(photoFallbackFor(p))}" alt="Foto de ${esc(p.name)}" loading="lazy" onerror="if(this.dataset.fallback){const f=this.dataset.fallback;delete this.dataset.fallback;this.src=f}else{this.onerror=null;this.src='/imagens/foto-pendente.webp'}"><div><b>${esc(p.name)}</b><div class="tiny">${esc(catalogCategory(p))} · ${p.price_cents?fmt(p.price_cents):'Sem preço'} · ${p.active?'Ativo':'Pausado'}</div></div></div>
      <div>${stock}${p.standalone_limit!==undefined?`<div class="tiny sub">Limite avulso: ${p.standalone_limit} · saldo em Sabores: ${p.shared_stock}</div>`:''}</div><div><span class="pill ${p.active?'good':'bad'}">${p.active?'Ativo':'Pausado'}</span></div>
      <div class="controls"><button class="btn btn-secondary btn-sm" data-action="stock" data-value="5" data-id="${p.id}">+5</button><button class="btn btn-secondary btn-sm" data-action="stock" data-value="10" data-id="${p.id}">+10</button>
      <input class="stock-set" type="number" min="0" max="1000000" data-stock-input="${p.id}" placeholder="Qtd." aria-label="Nova quantidade de ${esc(p.name)}">
      ${button('Definir','setstock',p.id)}<span class="price-inline"><label for="price-${p.id}">Preço R$</label><input id="price-${p.id}" data-price-input="${p.id}" class="price-set" inputmode="decimal" value="${p.price_cents?(p.price_cents/100).toFixed(2).replace('.',','):''}" placeholder="0,00" aria-label="Preço de ${esc(p.name)} em reais">${button('Salvar preço','setprice',p.id,'','primary')}</span>${button(p.active?'Pausar':'Reativar','toggle',p.id,'',p.active?'danger':'primary')}${button('Prévia do produto','preview',p.id)}${button('Editar / foto','edit',p.id)}</div></div>`;
  };
  const groups=new Map();for(const p of filtered){const cat=catalogCategory(p);if(!groups.has(cat))groups.set(cat,[]);groups.get(cat).push(p);}
  $('inventoryList').innerHTML=filtered.length?[...groups].map(([cat,items])=>`<section class="inventory-group"><header class="inventory-group-heading"><h3>${esc(cat)}</h3><span>${items.length} itens</span></header>${items.map(row).join('')}</section>`).join(''):'<div class="empty">Nenhum produto encontrado.</div>';
}
function renderDrinkOptions(){
 const element=$('drinkOptionsList');
 if(!element)return;
 if(!drinkOptionsReady){element.innerHTML='<p class="notice danger">Sabores indisponíveis. Confira a conexão com o banco D1.</p>';return;}
 const groups=[['ice','🧊 Gelo de água e gelos saborizados'],['energy','🥤 Energético, Red Bull e Vibe']];
 element.innerHTML=groups.map(([group,title])=>{
  const options=drinkOptions.filter(o=>o.option_group===group);
  return `<section style="margin:16px 0"><h3>${title}</h3><p class="tiny sub">Ajuste o estoque e ative somente as opções disponíveis.</p>${options.map(o=>{
   const state=o.active&&(o.unlimited||o.stock>0);
   const status=!o.active?'Pausado':state?'Disponível':'Esgotado';
   return `<div class="inventory-row" style="grid-template-columns:1.4fr .7fr 1fr">
    <div><b>${esc(o.name)}</b><div class="tiny">${esc(status)}</div></div>
    <div class="controls">${o.id==='energy-99'?'<span class="pill good">Incluso na dose · sem estoque</span>':o.unlimited?'<span class="pill good">Sem estoque físico</span>':`<input class="stock-set" type="number" min="0" max="1000000" value="${o.stock}" data-option-stock-input="${esc(o.id)}" aria-label="Estoque ${esc(o.name)}">
    ${button('Salvar qtd.','optionstock',o.id)}`}</div>
    <div class="controls">${button(o.active?'Pausar sabor':'Ativar sabor','optiontoggle',o.id,'',o.active?'danger':'primary')}</div>
   </div>`;
  }).join('')}</section>`;
 }).join('');
}
let cashResetSnapshot=null;
let demandActive=false,demandManual=false,demandCount=0,demandBusy=false,cashActionKind='',cashActionBusy=false,cashActionIds=[];
function renderDemand(){const b=$('demandToggle');b.textContent=demandManual?'Voltar ao automático':'Forçar aviso';b.classList.toggle('btn-primary',demandManual);b.classList.toggle('btn-secondary',!demandManual);b.setAttribute('aria-pressed',String(demandManual));$('demandStatus').textContent=(demandActive?'Aviso ativo':'Movimento normal')+' · '+demandCount+' pedidos aguardando ou em preparo'+(demandManual?' · manual':' · automático');}
function renderCashTransactions(){
 const r=cashReport;if(!r){$('cashTransactions').innerHTML='<p class="sub">Aguardando dados...</p>';return;}
 const q=$('cashSearch').value.trim().toLocaleLowerCase('pt-BR'),m=$('cashMethod').value;
 const list=(r.transactions||[]).filter(o=>(!m||m===o.payment_method)&&(!q||(pad(o.order_no)+' '+o.first_name+' '+o.last_name).toLocaleLowerCase('pt-BR').includes(q)));
 $('cashTransactions').innerHTML='<p class="cash-pro-result">'+list.length+' vendas exibidas · '+fmt(list.reduce((n,o)=>n+o.total_cents,0))+(r.truncated?' · últimas 500 vendas':'')+'</p>'+ (list.length?list.map(o=>`<article class="cash-pro-row"><div class="cash-pro-num">#${esc(pad(o.order_no))}</div><div><strong>${esc(o.first_name+' '+o.last_name)}</strong><small>${esc(new Date(o.paid_at).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}))} · ${esc(labels[o.payment_method]||o.payment_method)}</small></div><b>${fmt(o.total_cents)}</b><span class="pill good">Pago</span></article>`).join(''):'<p class="cash-pro-empty">Nenhuma venda encontrada.</p>');
}
function renderCash(){
  if(!cashReport){
    $('cashStats').innerHTML='<div class="stat"><span>Caixa do dia</span><b>—</b></div>';
    $('cashList').innerHTML='<div class="notice">Buscando vendas confirmadas no banco de dados...</div>';
    $('itemReport').innerHTML='';$('resetCash').disabled=true;renderCashTransactions();return;
  }
  const r=cashReport;
  $('resetCash').disabled=false;
  $('closeCash').disabled=!r.paid_count||r.truncated===true;
  $('clearTestCash').disabled=!(r.transactions||[]).some(o=>o.status==='delivered'&&o.payment_method==='cash');
  $('cashArchives').innerHTML=(r.archives||[]).map(b=>`<div class="cash-archive-row"><div><strong>${b.kind==='test'?'Vendas de teste':'Caixa fechado'}</strong><p class="small sub">${esc(new Date(b.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} · ${b.qty} vendas · ${fmt(b.total_cents)}</p></div><button type="button" class="btn btn-outline btn-sm" data-cash-archive="${esc(b.id)}">CSV</button></div>`).join('')||'<p class="small sub">Nenhum relatório arquivado.</p>';
  const stats=[['Faturamento atual',fmt(r.total_cents)],['Vendas pagas',r.paid_count],['Em aberto',r.pending_count],['Itens vendidos',r.item_count],['Ticket médio',fmt(r.paid_count?Math.round(r.total_cents/r.paid_count):0)],['Fila ativa',r.active_count??r.pending_count]];
  $('cashStats').innerHTML=stats.map(([l,v],k)=>`<div class="stat dashboard-stat dashboard-stat-${k}"><span>${l}</span><b>${v}</b><span class="stat-indicator" aria-hidden="true"></span></div>`).join('');
  const methods=Object.entries(r.by_method||{}).map(([key,value])=>`<div class="cash-pro-method"><span>${esc(labels[key]||key)}</span><b>${fmt(value)}</b><div class="cash-pro-track"><i style="width:${Math.max(0,Math.min(100,r.total_cents?value/r.total_cents*100:0))}%"></i></div></div>`).join('');
  $('cashList').innerHTML=`<div class="cash-summary-header"><span>Movimento de ${esc(r.day.split('-').reverse().join('/'))}</span><small>Valores efetivamente recebidos</small></div><div class="cash-pro-methods">${methods}</div>`;
  renderCashTransactions();
  $('itemReport').innerHTML=r.products?.length?r.products.sort((a,b)=>b.quantity-a.quantity).map(i=>`<div class="order-line" style="padding:9px 0"><span>${esc(i.name)} · ${i.quantity} unidades</span><b>${fmt(i.total_cents)}</b></div>`).join(''):'<p class="sub">Sem produtos vendidos hoje.</p>';
}
async function loadReport(){
  if(reportLoading||Date.now()-reportAt<12000)return;
  reportLoading=true;
  try{cashReport=await api('admin-cash',null,{admin:true,method:'GET'});reportAt=Date.now();renderCash();}
  catch(e){toast('Caixa: '+e.message,true);}finally{reportLoading=false;}
}
function exportCash(){return downloadCash(cashReport);}
function downloadCash(cashReport){
  if(!cashReport)return toast('Abra a aba Caixa para carregar as vendas.',true);
  const csvVal=v=>{let x=String(v??'');if(/^[=+@-]/.test(x))x="'"+x;return '"'+x.replaceAll('"','""')+'"';};
  const cols=[['Pedido','Cliente','Forma','Valor (R$)','Recebido em'],...(cashReport.transactions||[]).map(o=>[pad(o.order_no),o.first_name+' '+o.last_name,labels[o.payment_method],(o.total_cents/100).toFixed(2).replace('.',','),new Date(o.paid_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})])];
  const blob=new Blob(['\uFEFF'+cols.map(row=>row.map(csvVal).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='caixa-adega-'+cashReport.day+(cashReport.batch?'-'+cashReport.batch.kind+'-'+cashReport.batch.id.slice(0,8):'')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  if(cashReport.paid_count>cashReport.transactions.length)toast('CSV com as 500 vendas mais recentes. O total e o resumo incluem todas as vendas.');
}

const defaultPickupAddress='Rua Dourado, 34 - Eldorado, Diadema - SP';
let pickupDirty=false;
const validPickupPoint=()=>{const lat=$('pickupLat').valueAsNumber,lng=$('pickupLng').valueAsNumber;return Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lng)&&Math.abs(lng)<=180;};
function renderPickupPreview(){
 const address=$('pickupAddress').value.trim(),radius=$('pickupRadius').valueAsNumber,point=validPickupPoint();
 $('pickupPreviewAddress').textContent=address||'Endereço não informado';
 $('pickupFindAddress').href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address||defaultPickupAddress);
 $('pickupViewPoint').classList.toggle('hidden',!point);
 if(point)$('pickupViewPoint').href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent($('pickupLat').value+','+$('pickupLng').value);
 $('pickupPointLabel').textContent=point?'Ponto definido':'Portão não definido';
 const r=Number.isFinite(radius)?Math.max(25,Math.min(500,radius)):50;
 $('pickupRadiusSlider').value=r;$('pickupRadiusValue').textContent=r+' m';
 const circle=Math.min(99,36+63*Math.sqrt(r/500));$('pickupRadiusCircle').setAttribute('r',circle);$('pickupRadiusLine').setAttribute('d','M160 120h'+circle);
 document.querySelectorAll('[data-pickup-radius]').forEach(b=>{const active=Number(b.dataset.pickupRadius)===radius;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 $('pickupDraftStatus').textContent=pickupDirty?'Alterações não salvas.':'As mudanças só valem após salvar.';
}
function renderPickupSettings(){
 const loc=shop.pickup_location;
 $('pickupAdminState').textContent=loc?.enabled?'Regra salva: confere GPS autorizado em até '+loc.radius+' m. Sem GPS, aceita pedidos normalmente.':'Regra desativada: confirme o ponto do portão antes de ativar.';
 $('pickupStateBadge').textContent=loc?.enabled?'Ativo':'Desativado';$('pickupStateBadge').classList.toggle('is-active',Boolean(loc?.enabled));
 if(pickupDirty)return;
 $('pickupAddress').value=shop.pickup_address||loc?.address||defaultPickupAddress;
 $('pickupLat').value=loc?.latitude??'';$('pickupLng').value=loc?.longitude??'';
 $('pickupRadius').value=loc?.radius??50;$('pickupEnabled').checked=Boolean(loc?.enabled);renderPickupPreview();
}
function renderShopControl(){
 const open=Boolean(shop.accepting_orders),ready=shopToggleReady,pending=shopToggleBusy;
 const state=$('adminShopState');state.classList.toggle('is-open',ready&&open);state.querySelector('span').textContent=!ready?'Consultando loja…':open?'Loja aberta':'Pedidos pausados';
 $('orderShopPaused').classList.toggle('hidden',!ready||open);
 $('shopControl').dataset.state=!ready?'loading':open?'open':'closed';
 const toggle=$('shopToggle');toggle.disabled=!ready||pending;toggle.setAttribute('aria-checked',String(ready&&open));toggle.setAttribute('aria-busy',String(pending));
 $('orderShopReopen').disabled=!ready||pending;
 $('shopControlTitle').textContent=!ready?'CONSULTANDO STATUS':open?'LOJA ABERTA':'LOJA FECHADA';
 $('shopControlDescription').textContent=!ready?'Aguardando a confirmação do servidor.':open?'Recebendo novos pedidos normalmente.':'Novos pedidos estão bloqueados.';
 $('shopSwitchWord').textContent=!ready?'—':open?'ON':'OFF';
 $('shopControlAction').textContent=pending?'Salvando…':!ready?'Consultando…':open?'Toque para fechar':'Toque para abrir';
}
let numberSettingsLoaded=false,numberSettingsLoading=false;
async function loadNumberSettings(){if(numberSettingsLoaded||numberSettingsLoading)return;numberSettingsLoading=true;try{const d=await api('admin-order-number',null,{admin:true,method:'GET'});$('dailyNumberEnabled').checked=Boolean(d.settings.enabled);$('dailyNumberHour').value=String(d.settings.hour);$('numberSettingsStatus').textContent='Configuração carregada. A numeração reinicia no próximo pedido após o horário, quando a fila estiver vazia.';numberSettingsLoaded=true;}catch(e){$('numberSettingsStatus').textContent=e.message;}finally{numberSettingsLoading=false;}}
function renderSettings(){if($('orderNumberForm'))void loadNumberSettings();
 renderPickupSettings();
 renderShopControl();
  if($('storeName'))$('storeName').value=shop.name;
  if($('stockAlert'))$('stockAlert').value=shop.low_stock_threshold??5;
}
function render(){renderStats();renderOrders();
  // O polling não pode sobrescrever preço/estoque enquanto o dono digita.
  const editing=document.activeElement?.matches?.('[data-price-input],[data-stock-input],[data-option-stock-input]');
  if(!(activeTab==='inventory'&&(editing||$('editModal').classList.contains('open'))))renderInventory();
  renderCash();renderSettings();renderOverview();}
let auditCursor=null,auditLoading=false,auditVersion=0;
const auditLabels={price:'Alteração de preço',stock:'Movimento de estoque',cancel:'Pedido cancelado',cash:'Movimento do caixa',product:'Cadastro / disponibilidade',store:'Funcionamento da loja'};
function auditValue(row,value){if(value===null||value===undefined)return '—';if(row.kind==='price'||row.field==='total_cents')return fmt(Number(value));if(['active','accepting_orders','unlimited'].includes(row.field))return Number(value)?'Ativado':'Desativado';return ({pending:'Pendente',paid:'Pago',closed:'Caixa fechado',test:'Vendas de teste arquivadas',received:'Recebido',preparing:'Preparando',ready:'Pronto',cancelled:'Cancelado',delivered:'Entregue'})[value]||String(value);}
async function loadAudit(append=false){
 if(append&&(auditLoading||!auditCursor))return;
 const version=++auditVersion;const filter=$('auditFilter').value;
 if(!append){auditCursor=null;$('auditMore').classList.add('hidden');$('auditList').innerHTML='<p class="sub">Carregando histórico…</p>';}
 auditLoading=true;$('auditMore').disabled=true;
 try{
  const data=await api('admin-audit',{kind:filter,before:append?auditCursor:null},{admin:true,method:'POST'});
  if(version!==auditVersion)return;
  const rows=Array.isArray(data.events)?data.events:[];
  const output=rows.map(row=>{const date=new Date(row.created_at);return '<article class="audit-row"><div class="audit-event"><span class="audit-kind">'+esc(auditLabels[row.kind]||row.kind)+'</span><strong>'+esc(row.entity)+'</strong><small>'+esc(Number.isNaN(date.getTime())?row.created_at:date.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))+'</small></div><div class="audit-change"><span>'+esc(auditValue(row,row.old_value))+'</span><b aria-hidden="true">→</b><strong>'+esc(auditValue(row,row.new_value))+'</strong></div></article>';}).join('');
  if(append)$('auditList').insertAdjacentHTML('beforeend',output);else $('auditList').innerHTML=output||'<p class="sub">Nenhum registro encontrado.</p>';
  auditCursor=data.next_cursor||null;$('auditMore').classList.toggle('hidden',!auditCursor);
 }catch(e){if(version===auditVersion){if(!append)$('auditList').textContent='Não foi possível carregar a auditoria. '+e.message;toast(e.message,true);}}
 finally{if(version===auditVersion){auditLoading=false;$('auditMore').disabled=false;}}
}
function setTab(tab){const internal=tab==='tabacaria';if(internal||tab==='inventory'){inventoryFilter=internal?'Tabacaria':'Todos';inventorySearch='';inventoryStatus='all';$('inventorySearch').value='';$('inventoryStatus').value='all';}activeTab=internal?'inventory':tab;if(tab==='cash')loadReport();if(tab==='reviews')loadAdminReviews();if(tab==='audit')loadAudit();for(const name of ['overview','orders','preparation','inventory','cash','reviews','audit','settings'])$('tab-'+name).classList.toggle('hidden',name!==activeTab);document.querySelectorAll('.side-link').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));$('pageTitle').textContent={overview:'Central de gestão',orders:'Pedidos ao vivo',preparation:'Central de preparo',inventory:'Produtos e estoque',tabacaria:'Tabacaria',cash:'Caixa e faturamento',reviews:'Avaliações dos clientes',audit:'Auditoria do sistema',settings:'Configurações da adega'}[tab];if(activeTab==='inventory')renderInventory();if(activeTab==='overview')renderOverview();if(activeTab==='preparation')renderPreparation();document.querySelectorAll('.side-link').forEach(el=>{if(el.dataset.tab===tab)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});}
let preparationMarkupKey='';
function renderPreparation(){
 const fresh=$('preparationFreshness');
 fresh.textContent=ordersConnectionFailed?'Conexão instável. Aguarde reconectar antes de preparar.':!lastOrdersAt?'Aguardando fila do servidor…':'Atualizado às '+new Date(lastOrdersAt).toLocaleTimeString('pt-BR')+' • atualização a cada 3 segundos';
 if(!lastOrdersAt||ordersConnectionFailed){$('preparationOrderCount').textContent='—';$('preparationItemCount').textContent='—';$('preparationGroups').innerHTML='<div class="empty">Aguardando conexão segura com a fila.</div>';preparationMarkupKey='';return;}
 const s=preparationSummary(orders),key=JSON.stringify(s);if(key===preparationMarkupKey)return;preparationMarkupKey=key;
 $('preparationOrderCount').textContent=s.orderCount;$('preparationItemCount').textContent=s.itemCount;
 const section=(rows,title,sub)=>'<section class="preparation-section"><header><div><h3>'+esc(title)+'</h3><p>'+esc(sub)+'</p></div><b>'+rows.reduce((n,r)=>n+r.quantity,0)+' un.</b></header>'+(rows.length?rows.map(g=>'<article class="preparation-row"><div class="preparation-row-top"><div><small>'+esc(g.category||'Conferir categoria')+'</small><h4>'+esc(g.name)+'</h4></div><strong>'+g.quantity+'×</strong></div><div class="preparation-allocations">'+g.orders.map(o=>'<button type="button" data-preparation-order="'+esc(o.id)+'" class="preparation-ticket"><b>#'+esc(pad(o.number))+'</b><span>'+esc(o.name)+'</span><small>'+esc(stageLabels[o.status]||o.status)+'</small><strong>'+o.quantity+'×</strong></button>').join('')+'</div></article>').join(''):'<p class="empty">Nenhum item nesta seção.</p>')+'</section>';
 $('preparationGroups').innerHTML=s.orderCount?section(s.sections.prepare,'Preparar','Doses, batidas e caipirinhas; respeite cada combinação.')+section(s.sections.separate,'Separar','Cervejas, refrigerantes, doces e demais produtos.')+(s.sections.review.length?section(s.sections.review,'Conferir','Itens sem categoria confirmada.'):''):'<div class="empty">Nenhum pedido em andamento. Os pedidos prontos ficam na fila de retirada.</div>';
}

let overviewMarkupKey='';
function renderOverview(){
 const m=managementMetrics(products.filter(p=>!isStandaloneIce(p)),drinkOptions,orders,shop.low_stock_threshold??5);
 const catReady=Boolean(lastCatalogAt),ordReady=Boolean(lastOrdersAt);
 const stamp=x=>x?new Date(x).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'aguardando';
 $('overviewFreshness').textContent='Pedidos: '+(ordersConnectionFailed?'reconectando (último: '+stamp(lastOrdersAt)+')':stamp(lastOrdersAt))+' · Catálogo: '+stamp(lastCatalogAt)+' · Horários da última resposta recebida.';
 const metric=[['Pedidos em andamento',ordReady?m.pending:'—','Fila aberta'],['Produtos ativos',catReady?m.active:'—','Cadastro, não disponibilidade garantida'],['Estoque baixo',catReady?m.low:'—','Produtos ativos com estoque positivo'],['Opções de dose disponíveis',catReady&&drinkOptionsReady?m.options:'—','Gelos e energéticos ativos com estoque']];
 const key=JSON.stringify([m,catReady,ordReady,drinkOptionsReady]);if(key===overviewMarkupKey)return;overviewMarkupKey=key;
 $('overviewMetrics').innerHTML=metric.map(([label,value,desc])=>'<article class="admin-central-metric"><small>'+esc(label)+'</small><b>'+esc(value)+'</b><span>'+esc(desc)+'</span></article>').join('');
 const tasks=[['Pedidos aguardando',ordReady?m.received:null,'orders','all'],['Produtos sem preço',catReady?m.unpriced:null,'inventory','unpriced'],['Produtos sem estoque',catReady?m.out:null,'inventory','out'],['Produtos pausados',catReady?m.paused:null,'inventory','paused'],['Estoque baixo em produtos ativos',catReady?m.low:null,'inventory','low'],['Fotos pendentes',catReady?m.noPhoto:null,'inventory','no-photo'],['Opções de dose indisponíveis',catReady&&drinkOptionsReady?m.optionsBlocked:null,'inventory','options']];
 $('overviewTasks').innerHTML=tasks.map(([label,n,tab,filter])=>'<button type="button" class="admin-task" data-admin-jump="'+tab+'" data-admin-filter="'+filter+'"><span>'+esc(label)+'</span><strong class="'+(n===null?'unknown':n>0?'attention':'clear')+'">'+(n===null?'—':n)+'</strong><span aria-hidden="true">›</span></button>').join('');
}
let selectedPhotoPreviewUrl=null;
function setProductPhotoPreview(src){
  $('editPhotoPreview').src=src||'/imagens/foto-pendente.webp';
}
function inventoryAvailability(p){
 const reasons=[];
 if(!p.active)reasons.push('produto pausado');
 if(!(p.price_cents>0))reasons.push('preço não definido');
 if(!p.unlimited&&!(p.stock>0))reasons.push('sem estoque');
 if(!shop.accepting_orders)reasons.push('loja com pedidos pausados');
 return reasons.length?'Indisponível: '+reasons.join(' · '):'Preço, estoque e ativação OK';
}
function updateEditAvailability(){
 const p={active:$('editActive').checked,price_cents:priceParse($('editPrice').value)||0,stock:Number($('editStock').value),unlimited:$('editUnlimited').checked};
 $('editAvailability').textContent=inventoryAvailability(p);
}
function productModal(p){
  if(selectedPhotoPreviewUrl){URL.revokeObjectURL(selectedPhotoPreviewUrl);selectedPhotoPreviewUrl=null;}
  $('editTitle').textContent=p?'Editar produto':'Cadastrar produto';$('editId').value=p?.id||'';
  $('editName').value=p?.name||'';$('editCategory').value=p?catalogCategory(p):(['Todos','Sabores'].includes(inventoryFilter)?'Doces e Salgadinhos':inventoryFilter);$('editDescription').value=p?productDescription(p):'';
  $('editPrice').value=p?.price_cents?String((p.price_cents/100).toFixed(2)).replace('.',','):'';
  $('editStock').value=p?.stock??0;$('editUnlimited').checked=Boolean(p?.unlimited);$('editActive').checked=Boolean(p?.active);updateEditAvailability();
  $('editIcon').value=p?.icon||'🥤';$('editImage').value=p?.image_url||'';$('editAge').checked=p?.age_restricted??true;
  $('editPhotoFile').value='';
  setProductPhotoPreview(p?photoFor(p):'/imagens/foto-pendente.webp');
  $('editModal').classList.add('open');
}
async function fileToOptimizedDataUrl(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Escolha uma foto JPG, PNG ou WebP.');
  if(file.size>8*1024*1024)throw Error('A foto original deve ter no máximo 8 MB.');
  const bitmap=await createImageBitmap(file);
  try{
    const maxSide=800,ratio=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    for(const quality of [.82,.7,.58,.42,.28]){
      const encoded=canvas.toDataURL('image/webp',quality);
      if(encoded.length<235000)return {mime:'image/webp',base64:encoded.split(',')[1]};
    }
    throw Error('Foto grande demais. Escolha outra imagem.');
  }finally{bitmap.close();}
}
let bulkPhotos=[];
function clearBulkPhotos(){
 for(const row of bulkPhotos)URL.revokeObjectURL(row.preview);
 bulkPhotos=[];$('bulkPhotoList').innerHTML='';$('bulkPhotoFiles').value='';
}
function renderBulkPhotos(){
 const eligible=products.filter(p=>!isStandaloneIce(p)).sort((a,b)=>catalogCategory(a).localeCompare(catalogCategory(b),'pt-BR')||a.name.localeCompare(b.name,'pt-BR'));
 $('bulkPhotoList').innerHTML=bulkPhotos.map((row,i)=>`<div class="bulk-photo-row"><img src="${esc(row.preview)}" alt="Prévia"><div><b>${esc(row.file.name)}</b><select data-bulk-index="${i}" ${busy||row.done?'disabled':''} aria-label="Produto correspondente"><option value="">Selecione o produto correto</option>${eligible.map(p=>`<option value="${esc(p.id)}" ${p.id===row.id?'selected':''}>${esc(catalogCategory(p)+' · '+p.name)}</option>`).join('')}</select><small>${esc(row.status||'Confira a foto e o produto antes de salvar.')}</small></div></div>`).join('');
 $('bulkPhotoSave').disabled=busy||!bulkPhotos.some(row=>row.id&&!row.done);
}
function loadBulkFiles(files){
 for(const row of bulkPhotos)URL.revokeObjectURL(row.preview);
 bulkPhotos=Array.from(files).filter(f=>['image/png','image/jpeg','image/webp'].includes(f.type)).slice(0,150).map(file=>{
  const stem=file.name.replace(/\.[^.]+$/,'');
  const id=stem.split('--')[0],direct=products.find(p=>p.id===id&&!isStandaloneIce(p));
  const candidates=products.filter(p=>!isStandaloneIce(p)&&photoSlug(p.name)===photoSlug(stem));
  return {file,preview:URL.createObjectURL(file),id:direct?.id||(candidates.length===1?candidates[0].id:''),done:false};
 });
 renderBulkPhotos();
}
async function saveBulkPhotos(){
 if(busy)return;
 const rows=bulkPhotos.filter(row=>row.id&&!row.done);
 if(!rows.length)return toast('Selecione as fotos e os produtos correspondentes.',true);
 if(new Set(rows.map(row=>row.id)).size!==rows.length)return toast('Selecione apenas uma foto por produto.',true);
 if(!confirm('Salvar '+rows.length+' fotos nos produtos selecionados? Preço e estoque não serão alterados.'))return;
 busy=true;$('bulkPhotoSave').disabled=true;$('bulkPhotoFiles').disabled=true;$('closeBulkPhotos').disabled=true;
 let saved=0;
 try{
  for(const row of rows){
   try{const data=await fileToOptimizedDataUrl(row.file);await api('admin-photo',{id:row.id,...data},{admin:true});row.done=true;row.status='Foto salva';saved++;}
   catch(e){row.status='Falha: '+e.message;}
   renderBulkPhotos();
  }
 }finally{
  busy=false;$('bulkPhotoFiles').disabled=false;$('closeBulkPhotos').disabled=false;renderBulkPhotos();
  toast(saved+' de '+rows.length+' fotos salvas.',saved!==rows.length);await refreshData(true);
 }
}
async function saveProduct(e){
  e.preventDefault();if(busy)return;
  let id=$('editId').value;const priceRaw=$('editPrice').value.trim();
  const price=priceRaw===''?0:priceParse(priceRaw);
  const stock=Number($('editStock').value);
  if(price===null||price>100000000||!Number.isInteger(stock)||stock<0)return toast('Informe um preço válido ou deixe vazio; confira também o estoque.',true);
  const photo=$('editPhotoFile').files?.[0];
  const entry={name:$('editName').value.trim(),category:$('editCategory').value,description:$('editDescription').value.trim(),price_cents:price,stock,unlimited:$('editUnlimited').checked,icon:$('editIcon').value.trim()||'🥤',image_url:$('editImage').value.trim(),age_restricted:$('editAge').checked,active:$('editActive').checked};
  busy=true;
  try{
    // Pré-processa antes de salvar, para evitar cadastros sem a foto pretendida.
    const photoData=photo?await fileToOptimizedDataUrl(photo):null;
    if(id){
      const {stock:_,...patch}=entry;
      await api('admin-products',{id,...patch},{admin:true,method:'PATCH'});
      if(!entry.unlimited){await api('admin-stock',{id,mode:'set',quantity:stock},{admin:true});}
    }else{
      const saved=await api('admin-products',entry,{admin:true});
      id=saved.product.id;$('editId').value=id;
      if(entry.active)await api('admin-products',{id,active:true},{admin:true,method:'PATCH'});
    }
    if(photoData){
      const uploaded=await api('admin-photo',{id,...photoData},{admin:true});
      $('editImage').value=uploaded.image_url;
    }
    inventoryFilter=catalogCategory(entry);inventoryStatus='all';inventorySearch='';$('inventorySearch').value='';$('inventoryStatus').value='all';
    $('editModal').classList.remove('open');toast('Produto salvo. '+inventoryAvailability(entry)+'.');
  }catch(err){toast(err.message,true);}finally{busy=false;await refreshData(true);}
}
function closeProductPreview(){
  const modal=$('productPreviewModal');
  if(modal?.open)modal.close();
}
function showProductPreview(p){
  if(!p)return;
  const modal=$('productPreviewModal'),body=$('productPreviewBody');
  if(!modal||!body)return;
  const stock=p.unlimited?'Estoque ilimitado':p.stock>0?p.stock+' em estoque':'Esgotado';
  const status=inventoryAvailability(p);
  body.innerHTML=`<article class="admin-preview-card"><div class="admin-preview-image"><img src="${esc(photoFor(p))}" data-fallback="${esc(photoFallbackFor(p))}" alt="${esc(p.name)}" onerror="if(this.dataset.fallback){const f=this.dataset.fallback;delete this.dataset.fallback;this.src=f}else{this.onerror=null;this.src='/imagens/foto-pendente.webp'}"></div><div class="admin-preview-content"><div class="admin-preview-state"><span class="pill ${p.active?'good':'bad'}">${p.active?'Ativo':'Pausado'}</span><span>${esc(catalogCategory(p))} · ${esc(stock)}</span></div><h3>${esc(p.name)}</h3><p>${esc(productDescription(p))}</p><strong class="admin-preview-price">${p.price_cents?fmt(p.price_cents):'Preço em breve'}</strong><p class="admin-preview-notice">${esc(status)}</p></div></article>`;
  if(typeof modal.showModal==='function'){if(!modal.open)modal.showModal();}else modal.setAttribute('open','');
}
async function performAction(btn){
  if(busy)return;
  const id=btn.dataset.id,action=btn.dataset.action,value=btn.dataset.value;
 if(btn.closest('#ordersList')&&ordersConnectionFailed)return toast('Conexão interrompida. Reconecte antes de alterar o pedido.',true);
  const p=products.find(x=>x.id===id);
  let route='',body={},method='POST';
  if(action==='optiontoggle'||action==='optionstock'){
    const option=drinkOptions.find(x=>x.id===id);
    if(!option)return toast('Sabor não encontrado.',true);
    route='admin-drink-options';method='PATCH';body={id};
    if(action==='optiontoggle')body.active=!option.active;
    else{
      const value=document.querySelector(`[data-option-stock-input="${id}"]`)?.value;
      if(value===''||!Number.isInteger(Number(value))||Number(value)<0||Number(value)>1000000)return toast('Estoque de sabor inválido.',true);
      body.stock=Number(value);
    }
  }
  else if(action==='preview'){showProductPreview(p);return;}
  else if(action==='edit'){productModal(p);return;}
  else if(action==='finishcash'||action==='finishcard'){
    const order=orders.find(o=>o.id===id);if(!order||order.status!=='ready'||order.payment_method!==(action==='finishcard'?'card':'cash'))return toast('Pedido não está pronto para finalizar.',true);
    const ageNeeded=order.age_required&&!order.age_checked;
    if(!confirm('Pedido #'+pad(order.order_no)+' — '+order.first_name+' '+order.last_name+'\nConfirme que o pedido foi entregue e o pagamento de '+fmt(order.total_cents)+' foi recebido.'+(ageNeeded?'\nDocumento conferido: cliente tem 18 anos ou mais.':'')))return;
    route='admin-order-action';body={id,action:action==='finishcard'?'finishcard':'finishcash',received:true,age_confirmed:ageNeeded};
  }
  if(action==='status'&&value==='ready'){const o=orders.find(x=>x.id===id);if(!o||!['received','preparing'].includes(o.status))return toast('Pedido já atualizado.',true);if(!confirm('Pedido #'+pad(o.order_no)+' — '+o.first_name+' '+o.last_name+'\nTodos os itens estão separados ou preparados? A TV chamará este pedido.'))return;}
 if(action==='cancel'&&!confirm('Cancelar este pedido? Esta operação encerra o atendimento.'))return;
  if(action==='paid'&&!confirm('O valor realmente foi recebido em dinheiro ou na maquininha?'))return;
  if(action==='age'&&!confirm('Você conferiu o documento e confirmou que a pessoa tem 18 anos ou mais?'))return;
  if(action==='receipt'&&!confirm('O gateway confirmou o Pix e você conferiu o comprovante na entrega?'))return;
  else if(action==='status'||['paid','age','receipt','voice'].includes(action)) {route='admin-order-action';body={id,action,value};}
  else if(action==='cancel'){const o=orders.find(x=>x.id===id);const restore=o?.status==='received'||confirm('Os produtos e ingredientes estão intactos e podem voltar ao estoque? OK = devolver ao estoque; Cancelar = não devolver (pedido será cancelado mesmo assim).');route='admin-cancel';body={id,restore_stock:restore};}
  else if(action==='toggle'){route='admin-products';body={id,active:!p.active};method='PATCH';}
  else if(action==='stock'){route='admin-stock';body={id,mode:'add',quantity:Number(value)};}
  else if(action==='setprice'){
    const raw=document.querySelector(`[data-price-input="${id}"]`)?.value;
    const price=priceParse(raw);
    if(price===null||price>100000000)return toast('Digite um preço válido, como 15,00. Para deixar sem preço, use 0.',true);
    if(!p)return toast('Produto não encontrado.',true);
    route='admin-products';body={id,price_cents:price};method='PATCH';
  }
  else if(action==='setstock'){
    const raw=document.querySelector(`[data-stock-input="${id}"]`)?.value;
    if(raw===''||!Number.isInteger(Number(raw))||Number(raw)<0)return toast('Informe uma quantidade válida.',true);
    route='admin-stock';body={id,mode:'set',quantity:Number(raw)};
  } else if(!route)return;
  busy=true;
  try{if(action==='status'&&value==='delivered'){const order=orders.find(o=>o.id===id);if(order?.age_required&&!order.age_checked){if(!confirm('Confirme que verificou o documento e que o cliente tem 18 anos ou mais antes da entrega.'))return;await api('admin-order-action',{id,action:'age'},{admin:true});}}await api(route,body,{admin:true,method});toast(['finishcash','finishcard'].includes(action)?'Pedido finalizado e pagamento registrado no caixa.':action==='status'&&value==='ready'?'Pedido pronto! TV será atualizada.':'Alteração salva.');}
  catch(e){toast(e.message,true);}finally{try{await refreshOrders(true);}finally{busy=false;}await refreshData(true);}
}
function showLogin(){ closeProductPreview();selectedOrderId=null;initialOrderSelection=true;serviceMetrics={count:0,average_seconds:null};renderServiceMetrics();orderFilter='all';orderSearch='';if($('orderQueueSearch'))$('orderQueueSearch').value='';orders=[];preparationMarkupKey='';$('preparationGroups').replaceChildren();$('preparationOrderCount').textContent='—';$('preparationItemCount').textContent='—';lastOrdersAt=0;lastCatalogAt=0;ordersConnectionFailed=false;ordersInitialized=false;knownOrders.clear();ordersSnapshot='';$('pendingOrderBadge').classList.add('hidden');$('loginScreen').classList.remove('hidden');$('appScreen').classList.add('hidden'); }
function showAdmin(){ $('loginScreen').classList.add('hidden');$('appScreen').classList.remove('hidden'); }
let reviewsBusy=false;
async function loadAdminReviews(){
 if(reviewsBusy)return;
 reviewsBusy=true;
 try{const {reviews}=await api('admin-reviews',null,{method:'GET',admin:true});$('adminReviews').innerHTML=reviews.length?reviews.map(r=>`<article class="review-card"><div class="review-stars" aria-label="${Number(r.rating)} de 5 estrelas">${'★'.repeat(Number(r.rating))+'☆'.repeat(5-Number(r.rating))}</div><strong>${esc(r.display_name)} · Pedido ${pad(r.order_no)}</strong><p class="review-copy">${esc(r.comment||'Sem comentário')}</p><small class="sub">${r.comment_hidden?'Comentário oculto; nota pública':'Avaliação pública'} · ${esc(new Date(r.created_at).toLocaleDateString('pt-BR'))}</small>${r.comment? `<button type="button" class="btn btn-secondary btn-sm" data-review-id="${esc(r.id)}" data-hide="${r.comment_hidden?'false':'true'}">${r.comment_hidden?'Restaurar comentário':'Ocultar comentário'}</button>`:''}</article>`).join(''):'<p class="sub">Nenhuma avaliação recebida.</p>';}
 catch(e){$('adminReviews').textContent=e.message;}finally{reviewsBusy=false;}
}
function openCashAction(kind){
 if(!cashReport||cashActionBusy)return;
 cashActionKind=kind;
 if(kind==='reset'){
  if(cashReport.accepting_orders)return toast('Pause a loja antes de zerar, para evitar novos pedidos.',true);
  if(cashReport.paid_active_count)return toast('Finalize os pedidos pagos que ainda estão em atendimento.',true);
  cashActionIds=[];cashResetSnapshot={paid_count:cashReport.paid_count,active_count:cashReport.active_count};
  $('cashActionTitle').textContent='Zerar caixa e reiniciar pedidos';
  $('cashActionInfo').textContent='Arquiva vendas do movimento, cancela pedidos ativos não pagos e reinicia a numeração pública em 001. O histórico é preservado. Estoque reservado de pedidos ainda recebidos retorna; produtos em preparo ou prontos não retornam automaticamente. A loja permanece pausada.';
  $('cashActionList').innerHTML='<p>'+cashReport.paid_count+' vendas arquivadas · '+fmt(cashReport.total_cents)+'</p><p>'+cashReport.active_count+' pedidos não pagos serão cancelados.</p>';
  $('cashActionConfirm').value='';$('cashActionLabel').textContent='Digite ZERAR para confirmar';
  $('cashActionModal').classList.add('open');
  return;
 }
 const rows=(cashReport.transactions||[]).filter(o=>kind==='closed'||(o.status==='delivered'&&o.payment_method==='cash'));
 cashActionIds=rows.map(o=>o.id);
 if(!rows.length)return toast('Nenhuma venda elegível.',true);
 $('cashActionTitle').textContent=kind==='test'?'Limpar vendas de teste':'Fechar caixa';
 $('cashActionInfo').textContent=kind==='test'?'Marque somente pedidos que foram simulações. Eles serão arquivados e retirados do movimento atual, sem apagar dados ou devolver estoque.':'O movimento atual será arquivado. Novas vendas entrarão em um novo movimento. O estoque não será alterado.';
 $('cashActionList').innerHTML=kind==='test'?rows.map(o=>`<label class="cash-test-row"><input type="checkbox" name="cashTestId" value="${esc(o.id)}"><span>${esc(pad(o.order_no))} · ${esc(o.first_name)} ${esc(o.last_name)}</span><strong>${fmt(o.total_cents)}</strong></label>`).join(''):`<p>${rows.length} vendas · ${fmt(cashReport.total_cents)}</p>`;
 $('cashActionConfirm').value='';$('cashActionLabel').textContent='Digite '+(kind==='test'?'TESTE':'FECHAR')+' para confirmar';
 $('cashActionModal').classList.add('open');
}
async function start(){
 $('openPreparation').onclick=()=>{setTab('preparation');window.scrollTo({top:0,behavior:'instant'});};
 $('preparationBack').onclick=()=>{setTab('orders');window.scrollTo({top:0,behavior:'instant'});};
 $('preparationGroups').addEventListener('click',e=>{const b=e.target.closest('[data-preparation-order]');if(!b)return;if(ordersConnectionFailed)return toast('Aguarde reconectar.',true);setTab('orders');orderFilter='all';orderSearch='';if($('orderQueueSearch'))$('orderQueueSearch').value='';selectOrder(b.dataset.preparationOrder);const card=[...$('ordersList').querySelectorAll('[data-order-card]')].find(el=>el.dataset.orderCard===b.dataset.preparationOrder);if(card){card.focus({preventScroll:true});card.scrollIntoView({block:'center',behavior:'instant'});}else toast('O pedido já saiu da fila.');});
 setInterval(()=>{document.querySelectorAll('[data-ready-deadline]').forEach(el=>{const left=Number(el.dataset.readyDeadline)-Date.now();if(left<=0){el.classList.add('danger');el.textContent=el.dataset.paid==='true'?'Prazo de retirada excedido · pedido pago: conferir com cliente':'Prazo de 15 minutos excedido · pode cancelar se não retirado';}else{const seconds=Math.ceil(left/1000);el.textContent='Retirada em até '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}});},1000);
 $('pickupTestSaved').onclick=()=>{const btn=$('pickupTestSaved'),out=$('pickupTestResult');if(!navigator.geolocation){out.textContent='GPS indisponível neste dispositivo.';return;}btn.disabled=true;out.textContent='Consultando localização…';navigator.geolocation.getCurrentPosition(async p=>{try{const r=await api('check-location',{position:{latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp}});out.textContent=r.message+(Number.isFinite(r.distance)?' Distância: '+r.distance+' m · precisão: '+r.accuracy+' m · raio salvo: '+r.radius+' m.':'');}catch(e){out.textContent=e.message;}finally{btn.disabled=false;}},()=>{out.textContent='Permita o GPS preciso e tente novamente.';btn.disabled=false;},{enableHighAccuracy:true,maximumAge:0,timeout:15000});};
 $('overviewRefresh').onclick=async()=>{const b=$('overviewRefresh');b.disabled=true;try{await refreshData(false,true);}finally{b.disabled=false;renderOverview();}};
 $('tab-overview').addEventListener('click',e=>{const b=e.target.closest('[data-admin-jump]');if(!b)return;setTab(b.dataset.adminJump);if(b.dataset.adminJump==='inventory'){const filter=b.dataset.adminFilter||'all';if(filter==='options'){inventoryFilter='Sabores';}else{inventoryStatus=filter;$('inventoryStatus').value=filter;}renderInventory();}window.scrollTo({top:0,behavior:'instant'});});
 $('demandToggle').onclick=async()=>{if(demandBusy)return;demandBusy=true;const b=$('demandToggle');b.disabled=true;try{const r=await api('admin-demand',{enabled:!demandManual},{admin:true,method:'PATCH'});demandActive=r.high_demand;demandManual=r.demand_manual;demandCount=r.demand_count;renderDemand();toast(demandManual?'Aviso manual enviado à TV.':'Controle automático restaurado.');}catch(e){toast(e.message,true);}finally{demandBusy=false;b.disabled=false;}};
 $('closeCash').onclick=()=>openCashAction('closed');$('clearTestCash').onclick=()=>openCashAction('test');
 $('resetCash').onclick=()=>openCashAction('reset');
 $('cashSearch').oninput=renderCashTransactions;$('cashMethod').onchange=renderCashTransactions;
 $('cashRefresh').onclick=()=>{reportAt=0;loadReport();};
 $('cashActionClose').onclick=()=>{if(!cashActionBusy)$('cashActionModal').classList.remove('open');};
 $('cashActionForm').addEventListener('submit',async e=>{
 e.preventDefault();if(cashActionBusy)return;const kind=cashActionKind,confirmation=$('cashActionConfirm').value.trim().toUpperCase(),ids=kind==='test'?[...document.querySelectorAll('[name="cashTestId"]:checked')].map(x=>x.value):cashActionIds;
 if((kind!=='reset'&&!ids.length)||confirmation!==(kind==='reset'?'ZERAR':kind==='test'?'TESTE':'FECHAR'))return toast('Confira os dados e digite a confirmação indicada.',true);
 cashActionBusy=true;const b=e.target.querySelector('[type="submit"]');b.disabled=true;
 try{if(kind==='reset'){await api('admin-cash-reset',{confirmation,...cashResetSnapshot},{admin:true});await refreshOrders(true);}else await api('admin-cash-archive',{kind,confirmation,ids},{admin:true});$('cashActionModal').classList.remove('open');cashReport=null;reportAt=0;renderCash();toast(kind==='reset'?'Caixa zerado. Próximo pedido: 001.':kind==='test'?'Vendas de teste arquivadas.':'Caixa fechado e relatório preservado.');}
 catch(err){toast(err.message,true);}finally{cashActionBusy=false;b.disabled=false;reportAt=0;if(reportLoading){setTimeout(()=>{reportAt=0;loadReport();},1500);}else await loadReport();}
 });
 $('cashArchives').addEventListener('click',async e=>{const b=e.target.closest('[data-cash-archive]');if(!b)return;b.disabled=true;try{downloadCash(await api('admin-cash-report',{id:b.dataset.cashArchive},{admin:true}));}catch(err){toast(err.message,true);}finally{b.disabled=false;}});

 $('pickupLocationForm').addEventListener('input',()=>{pickupDirty=true;renderPickupPreview();});
 $('pickupRadiusSlider').addEventListener('input',()=>{$('pickupRadius').value=$('pickupRadiusSlider').value;pickupDirty=true;renderPickupPreview();});
 document.querySelectorAll('[data-pickup-radius]').forEach(b=>b.onclick=()=>{$('pickupRadius').value=b.dataset.pickupRadius;pickupDirty=true;renderPickupPreview();});
 $('pickupApplyCoords').onclick=()=>{
  const raw=$('pickupCoords').value.trim();
  const match=raw.match(/^(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)$/);
  if(!match||Math.abs(Number(match[1]))>90||Math.abs(Number(match[2]))>180)return toast('Cole o par de coordenadas do portão no formato latitude, longitude.',true);
  $('pickupLat').value=match[1];$('pickupLng').value=match[2];pickupDirty=true;renderPickupPreview();toast('Coordenadas aplicadas. Confira o ponto no mapa antes de salvar.');
 };
 $('pickupUseGPS').onclick=()=>{
  if(!navigator.geolocation)return toast('Use o celular no portão ou informe as coordenadas.',true);
  const btn=$('pickupUseGPS');btn.disabled=true;btn.textContent='Obtendo GPS…';
  const finish=()=>{btn.disabled=false;btn.textContent='Usar GPS no portão';};
  navigator.geolocation.getCurrentPosition(p=>{
   finish();if(p.coords.accuracy>25)return toast('GPS impreciso. Ative a localização precisa e fique no portão.',true);
   pickupDirty=true;$('pickupLat').value=p.coords.latitude.toFixed(7);$('pickupLng').value=p.coords.longitude.toFixed(7);renderPickupPreview();toast('Ponto capturado. Confira o raio e ative a regra se desejar.');
  },()=>{finish();toast('Autorize o GPS ou informe as coordenadas do portão.',true);},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
 };
 $('pickupLocationForm').addEventListener('submit',async e=>{
  e.preventDefault();const btn=e.target.querySelector('[type="submit"]');if(btn.disabled)return;
  const latitude=$('pickupLat').valueAsNumber,longitude=$('pickupLng').valueAsNumber,radius=$('pickupRadius').valueAsNumber,enabled=$('pickupEnabled').checked;
  const address=$('pickupAddress').value.trim();
  if(!validPickupPoint()||!Number.isInteger(radius)||radius<25||radius>500){$('pickupAdvanced').open=true;return toast('Defina o ponto exato do portão e um raio de 25 a 500 metros.',true);}
  if(!confirm(enabled?'Conferir o raio quando o cliente autorizar o GPS? Pedidos sem localização continuarão permitidos.':'Desativar a conferência de proximidade?'))return;
  btn.disabled=true;try{const {location}=await api('admin-location',{latitude,longitude,radius,enabled,address},{admin:true,method:'PATCH'});shop={...shop,pickup_location:location,pickup_address:location.address,location_required:enabled,location_radius:radius};pickupDirty=false;renderPickupSettings();toast('Regra de localização salva.');}catch(err){toast(err.message,true);}finally{btn.disabled=false;}
 });

 $('refreshReviews')?.addEventListener('click',loadAdminReviews);
 $('adminReviews')?.addEventListener('click',async e=>{const b=e.target.closest('[data-review-id]');if(!b||reviewsBusy)return;const hide=b.dataset.hide==='true';if(hide&&!confirm('Ocultar comentário por conteúdo inadequado, spam ou dados pessoais? A nota permanecerá pública.'))return;b.disabled=true;try{await api('admin-reviews',{id:b.dataset.reviewId,comment_hidden:hide},{admin:true,method:'PATCH'});await loadAdminReviews();}catch(err){toast(err.message,true);}finally{b.disabled=false;}});

 $('orderShopReopen').onclick=()=>{if(!shop.accepting_orders)$('shopToggle').click();};




  $('editCategory').innerHTML=CATEGORIES.slice(1).filter(c=>!['Doces e Balas','Salgadinhos','Doces e Snacks','Complementos','Doses'].includes(c)).map(c=>`<option>${esc(c)}</option>`).join('');
  $('auditRefresh').onclick=()=>loadAudit();$('auditFilter').onchange=()=>loadAudit();$('auditMore').onclick=()=>loadAudit(true);
  document.querySelectorAll('.side-link').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
  $('ordersList').addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(b)performAction(b);});
  $('inventoryList').addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(b)performAction(b);});
  $('inventoryFilters').addEventListener('click',e=>{const btn=e.target.closest('[data-inventory-filter]');if(!btn)return;inventoryFilter=btn.dataset.inventoryFilter;document.querySelectorAll('.side-link').forEach(el=>el.classList.toggle('active',el.dataset.tab===(inventoryFilter==='Tabacaria'?'tabacaria':'inventory')));$('pageTitle').textContent=inventoryFilter==='Tabacaria'?'Tabacaria':'Produtos e estoque';renderInventory();});
  $('newProduct').onclick=()=>productModal(null);
  $('openBulkPhotos').onclick=()=>{if(busy)return;clearBulkPhotos();$('bulkPhotoModal').classList.add('open');renderBulkPhotos();};
  $('closeBulkPhotos').onclick=()=>{if(busy)return;clearBulkPhotos();$('bulkPhotoModal').classList.remove('open');};
  $('bulkPhotoFiles').addEventListener('change',e=>loadBulkFiles(e.target.files));
  $('bulkPhotoList').addEventListener('change',e=>{const index=e.target.dataset.bulkIndex;if(index===undefined||busy)return;const row=bulkPhotos[Number(index)];if(row){row.id=e.target.value;row.done=false;row.status='';renderBulkPhotos();}});
  $('bulkPhotoSave').onclick=saveBulkPhotos;
  $('inventorySearch').addEventListener('input',e=>{inventorySearch=e.target.value.trim();renderInventory();});
  $('inventoryStatus').addEventListener('change',e=>{inventoryStatus=e.target.value;renderInventory();});
  $('drinkOptionsList').addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(b)performAction(b);});
  $('exportCash')?.addEventListener('click',exportCash);
  $('closeEdit').onclick=()=>$('editModal').classList.remove('open');
  $('closeProductPreview')?.addEventListener('click',closeProductPreview);
  $('editForm').addEventListener('submit',saveProduct);
  for(const id of ['editPrice','editStock','editUnlimited','editActive'])$(id).addEventListener('input',updateEditAvailability);
  $('editPhotoFile').addEventListener('change',()=>{
    if(selectedPhotoPreviewUrl){URL.revokeObjectURL(selectedPhotoPreviewUrl);selectedPhotoPreviewUrl=null;}
    const f=$('editPhotoFile').files?.[0];
    if(f){selectedPhotoPreviewUrl=URL.createObjectURL(f);setProductPhotoPreview(selectedPhotoPreviewUrl);}
    else setProductPhotoPreview($('editImage').value||'/imagens/'+photoSlug($('editName').value)+'.webp');
  });
  $('editImage').addEventListener('change',()=>{if(!$('editPhotoFile').files?.length)setProductPhotoPreview($('editImage').value||'/imagens/foto-pendente.webp');});
  $('shopToggle').onclick=async()=>{
   if(!shopToggleReady||shopToggleBusy)return;
   const next=!shop.accepting_orders;
   if(!confirm(next?'Abrir a loja e voltar a receber pedidos?':'Fechar a loja para novos pedidos? Os pedidos já recebidos continuam na fila.'))return;
   shopToggleBusy=true;shopToggleRevision++;renderShopControl();
   try{
    const result=await api('admin-settings',{accepting_orders:next},{admin:true,method:'PATCH'});
    const saved=result?.store?.accepting_orders;
    if(saved!==true&&saved!==false&&saved!==0&&saved!==1)throw Error('Não foi possível confirmar o status da loja.');
    shop={...shop,accepting_orders:Boolean(saved)};
    toast(shop.accepting_orders?'Loja aberta. Novos pedidos liberados.':'Loja fechada. Novos pedidos pausados.');
   }catch(e){toast(e.message,true);lastCatalogAt=0;}
   finally{shopToggleRevision++;shopToggleBusy=false;renderShopControl();}
   await refreshData(true);
  };
  $('orderNumberForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await api('admin-order-number',{enabled:$('dailyNumberEnabled').checked,hour:Number($('dailyNumberHour').value)},{admin:true});toast('Numeração salva.');}catch(err){toast(err.message,true);}});
  if($('manualNumberReset'))$('manualNumberReset').onclick=async()=>{if(!confirm('Reiniciar somente a numeração? O próximo pedido será #0001.'))return;try{await api('admin-order-number',{action:'reset',confirmation:'REINICIAR'},{admin:true});toast('Numeração reiniciada.');}catch(err){toast(err.message,true);}};
  $('settingsForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await api('admin-settings',{name:$('storeName').value.trim(),low_stock_threshold:Number($('stockAlert').value)},{admin:true,method:'PATCH'});toast('Configurações salvas.');await refreshData(true);}catch(err){toast(err.message,true);}});
  $('soundToggle').onclick=()=>{sounds=!sounds;$('soundToggle').textContent=sounds?'🔔 Alertas ligados':'🔕 Ativar alertas';if(sounds)tone();};
  $('logoutBtn').onclick=async()=>{try{await api('admin-logout',{}, {admin:true});}catch{}finally{authClear();showLogin();lastCatalogAt=0;}};
  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();const button=$('adminLoginSubmit');if(button.disabled)return;
    $('loginError').textContent='';button.disabled=true;button.textContent='Entrando…';
    try{
      const username=$('username').value.trim().toLowerCase(),password=$('pass').value;
      if(username!=='admin')throw Error('Use o usuário admin.');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
      let d;
      try{
        const response=await fetch('/api/admin-login',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({username,password}),cache:'no-store',signal:controller.signal});
        d=await response.json().catch(()=>({error:'Resposta inválida do servidor (HTTP '+response.status+').'}));
        if(!response.ok)throw Error(d.error||'Falha no login (HTTP '+response.status+').');
      }catch(err){if(err.name==='AbortError')throw Error('Servidor demorou a responder. Tente novamente.');throw err;}
      finally{clearTimeout(timer);}
      if(!d.token)throw Error('Resposta de login inválida.');
      authSave(d);$('pass').value='';showAdmin();await refreshData();
    }catch(err){$('loginError').textContent=err.message||'Não foi possível conectar ao admin.';}
    finally{button.disabled=false;button.textContent='Entrar no painel';}
  });
  if(authRead()?.token){showAdmin();await refreshData();}else showLogin();
  setInterval(()=>{if(!$('appScreen').classList.contains('hidden'))void refreshOrders(true);},3000);
  setInterval(()=>{if(!document.hidden&&!$('appScreen').classList.contains('hidden'))void refreshData(true,false);},30000);
  window.addEventListener('focus',()=>{if(!$('appScreen').classList.contains('hidden'))void refreshOrders(true);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('appScreen').classList.contains('hidden'))void refreshOrders(true);});
  setInterval(()=>{if(!document.hidden&&!$('appScreen').classList.contains('hidden')&&activeTab==='cash')loadReport();},30000);
}
start();
