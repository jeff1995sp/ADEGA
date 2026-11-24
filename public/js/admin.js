import {api,authSave,authRead,authClear,CATEGORIES,fmt,esc,pad,priceParse,toast,setBrand,minutesAgo,labels,stageLabels,photoFor,photoFallbackFor,photoStatusFor,catalogCategory,isStandaloneIce,productDescription,normalizeProduct} from './shared.js?v=20261124-12';
const $=id=>document.getElementById(id);
const photoSlug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
let cashReport=null,reportAt=0,reportLoading=false;
let orders=[],products=[],drinkOptions=[],drinkOptionsReady=false,shop={name:'Hora Extra Drinks',accepting_orders:true,low_stock_threshold:5},activeTab='orders',inventoryFilter='Todos',inventorySearch='',inventoryStatus='all',busy=false,lastFirst=null,sounds=false,audioContext;
const button=(label,action,id,value='',type='secondary',disabled=false)=>`<button class="btn btn-${type} btn-sm" data-action="${action}" data-id="${id}" data-value="${value}" ${disabled?'disabled':''}>${label}</button>`;
const statusBadge=o=>`<span class="pill ${o.payment_status==='paid'?'good':'warn'}">${o.payment_status==='paid'?'● Pago':'◷ Pagamento pendente'}</span>`;
function tone(){if(!sounds)return;try{audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();const t=audioContext.currentTime;[780,1040].forEach((hz,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=hz;g.gain.setValueAtTime(.0001,t+i*.17);g.gain.exponentialRampToValueAtTime(.11,t+i*.17+.02);g.gain.exponentialRampToValueAtTime(.0001,t+i*.17+.15);o.connect(g);g.connect(audioContext.destination);o.start(t+i*.17);o.stop(t+i*.17+.16);});}catch{}}
let refreshBusy=false,lastCatalogAt=0,ordersInitialized=false,knownOrders=new Set();
function adminAnnounce(message){
 if(!sounds)return;
 tone();
 if('speechSynthesis' in window){try{const u=new SpeechSynthesisUtterance(message);u.lang='pt-BR';u.rate=.95;window.speechSynthesis.speak(u);}catch{}}
}
let demoStep=0;
const demoMessages=['Novo pedido recebido de Bruna.','Bruna, seu pedido está sendo preparado.','Bruna, seu pedido está pronto! Aguarde a entrega no portão.'];
function renderOrderDemo(){const status=['Novo pedido · Bruna','Em preparação · Bruna','Pronto para retirada · Bruna'][demoStep];$('orderDemoStatus').textContent=status;$('orderDemoMessage').textContent=demoMessages[demoStep];$('orderDemoNext').disabled=demoStep===2;adminAnnounce(demoMessages[demoStep]);}

async function refreshData(quiet=false,forceCatalog=true){
  if(busy||refreshBusy)return;
  refreshBusy=true;
  try{
    const shouldCatalog=forceCatalog||!lastCatalogAt||Date.now()-lastCatalogAt>=30000;
    const [o,c]=await Promise.all([api('admin-orders',null,{method:'GET',admin:true}),shouldCatalog?api('admin-catalog',null,{method:'GET',admin:true}):null]);
    if(c)lastCatalogAt=Date.now();
    const incoming=o.orders||[];
    if(ordersInitialized){for(const order of incoming){if(!knownOrders.has(order.id)){adminAnnounce('Novo pedido recebido de '+order.first_name+'.');toast('🔔 Novo pedido recebido: '+order.first_name);}}}
    for(const order of incoming)knownOrders.add(order.id);
    if(knownOrders.size>2000)knownOrders=new Set([...knownOrders].slice(-1000));
    ordersInitialized=true;orders=incoming;if(c){products=(c.products||[]).map(normalizeProduct);drinkOptions=c.drink_options||[];drinkOptionsReady=c.drink_options_ready===true;shop=c.store||shop;setBrand(shop.name);}
    render();$('orderHeartbeat').textContent='● Atualizado '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }catch(e){if(/sessão|login|autorizada|expirada/i.test(e.message)){authClear();showLogin();return;}if(!quiet)toast(e.message,true);}finally{refreshBusy=false;}
}
const paid=o=>o.payment_status==='paid';
const allItems=o=>(o.order_items||[]).map(i=>`<strong>${i.quantity}x</strong> ${esc(i.product_name)}`).join(' · ');
function renderStats(){
  const pending=orders.filter(o=>o.status!=='delivered'&&o.status!=='cancelled');
  const p=[['Aguardando',pending.filter(o=>o.status==='received').length],['Preparando',pending.filter(o=>o.status==='preparing').length],['Prontos',pending.filter(o=>o.status==='ready').length],['Pagos em andamento',orders.filter(o=>paid(o)).length]];
  $('stats').innerHTML=p.map(([l,v])=>`<div class="stat"><span>${l}</span><b>${v}</b></div>`).join('');
}
function renderOrders(){
  const visible=orders.filter(o=>!['delivered','cancelled'].includes(o.status));
  $('ordersList').innerHTML=visible.length?visible.map(o=>{
    const cash=o.payment_method==='cash'
      ?o.cash_given_cents!==null
        ?`<div class="notice ok" style="margin:12px 0"><strong>💵 PREPARAR TROCO: ${fmt(Math.max(0,o.cash_given_cents-o.total_cents))}</strong><div>Cliente entrega: ${fmt(o.cash_given_cents)} · Total do pedido: ${fmt(o.total_cents)}</div><small>Pagamento em dinheiro na retirada. Marque como pago somente após receber.</small></div>`
        :'<div class="notice danger" style="margin:12px 0">⚠ O cliente não informou o valor em dinheiro; confirmar no atendimento.</div>'
      :'';
    const voice=o.voice||'';
    const showPay=!paid(o)&&['cash','card'].includes(o.payment_method);
    const steps=o.status==='received'?button('▶ Preparando','status',o.id,'preparing','primary')+button('✓ Pronto','status',o.id,'ready','secondary',!voice):o.status==='preparing'?button('✓ Pedido pronto','status',o.id,'ready','primary',!voice):button('📦 Entregar','status',o.id,'delivered','primary',!paid(o)||(o.payment_method==='pix'&&!o.receipt_checked)||(o.age_required&&!o.age_checked));
    const proof=o.payment_method==='pix'?`<div class="notice ${paid(o)?'':'danger'}"><b>CONFERIR COMPROVANTE NA ENTREGA</b><br>${paid(o)?o.receipt_checked?'✓ Comprovante conferido':'Compare o comprovante com a transação confirmada no gateway.':'⚠ Pix pendente: NÃO liberar entrega.'}</div>`:'';
    return `<article class="order-card"><div class="order-top"><div><div class="order-name">${esc(o.first_name)} ${esc(o.last_name)} <span class="tiny">${pad(o.order_no)}</span></div><div class="tiny">${minutesAgo(o.created_at)} · ${esc(stageLabels[o.status])}</div></div>${statusBadge(o)}</div>
    <div class="order-details"><span>${allItems(o)}</span><span>${fmt(o.total_cents)}</span><span>Pagamento: ${esc(labels[o.payment_method]||o.payment_method)}</span></div>${cash}
    ${proof}<div class="muted-separator"></div>
    <div class="small sub">Voz que a TV usará ao chamar:</div><div class="order-bottom">${button(`${voice==='female'?'✓ ':''}♀ Feminina`,'voice',o.id,'female',voice==='female'?'primary':'secondary')}${button(`${voice==='male'?'✓ ':''}♂ Masculina`,'voice',o.id,'male',voice==='male'?'primary':'secondary')}</div>
    <div class="order-bottom">${showPay?button('💰 Confirmar pagamento recebido','paid',o.id,'','secondary'):''}
      ${o.age_required&&!o.age_checked?button('🪪 Documento 18+ conferido','age',o.id,'','secondary'):o.age_required?'<span class="pill good">✓ Maioridade conferida</span>':''}
      ${o.payment_method==='pix'&&paid(o)&&!o.receipt_checked?button('📑 Comprovante conferido','receipt',o.id,'','secondary'):''}
      ${steps}${!paid(o)?button('Cancelar pedido','cancel',o.id,'','danger'):''}</div>
    </article>`;
  }).join(''):'<div class="empty">Nenhum pedido aguardando. Os novos pedidos aparecerão aqui automaticamente.</div>';
}
function renderInventory(){
  const threshold=shop.low_stock_threshold??5;
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const order=CATEGORIES.map(c=>c);
  const all=products.filter(p=>!isStandaloneIce(p)).sort((x,y)=>(order.indexOf(catalogCategory(x))<0?999:order.indexOf(catalogCategory(x)))-(order.indexOf(catalogCategory(y))<0?999:order.indexOf(catalogCategory(y)))||x.name.localeCompare(y.name,'pt-BR'));
  const filtered=all.filter(p=>{
    const cat=catalogCategory(p);
    return (inventoryFilter==='Todos'||cat===inventoryFilter)&&(!inventorySearch||norm(p.name+' '+cat).includes(norm(inventorySearch)))&&(inventoryStatus==='all'||(inventoryStatus==='unpriced'&&!p.price_cents)||(inventoryStatus==='paused'&&!p.active)||(inventoryStatus==='out'&&!p.unlimited&&p.stock===0)||(inventoryStatus==='active'&&p.active)||(inventoryStatus==='no-photo'&&photoStatusFor(p)==='pending'));
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
      <div>${stock}</div><div><span class="pill ${p.active?'good':'bad'}">${p.active?'Ativo':'Pausado'}</span></div>
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
    <div class="controls">${o.unlimited?'<span class="pill good">Sem estoque físico</span>':`<input class="stock-set" type="number" min="0" max="1000000" value="${o.stock}" data-option-stock-input="${esc(o.id)}" aria-label="Estoque ${esc(o.name)}">
    ${button('Salvar qtd.','optionstock',o.id)}`}</div>
    <div class="controls">${button(o.active?'Pausar sabor':'Ativar sabor','optiontoggle',o.id,'',o.active?'danger':'primary')}</div>
   </div>`;
  }).join('')}</section>`;
 }).join('');
}
function renderCash(){
  if(!cashReport){
    $('cashStats').innerHTML='<div class="stat"><span>Caixa do dia</span><b>—</b></div>';
    $('cashList').innerHTML='<div class="notice">Buscando vendas confirmadas no banco de dados...</div>';
    $('itemReport').innerHTML='';return;
  }
  const r=cashReport;
  const stats=[['Faturamento do dia',fmt(r.total_cents)],['Vendas pagas',r.paid_count],['Em aberto',r.pending_count],['Itens vendidos',r.item_count]];
  $('cashStats').innerHTML=stats.map(([l,v])=>`<div class="stat"><span>${l}</span><b>${v}</b></div>`).join('');
  const methods=Object.entries(r.by_method||{}).map(([key,value])=>`<span>${esc(labels[key]||key)}: ${fmt(value)}</span>`).join('');
  $('cashList').innerHTML=`<div class="notice ok">Relatório real do dia ${esc(r.day.split('-').reverse().join('/'))}, por data de recebimento. ${r.truncated?'Volume muito alto: peça exportação ampliada.':''}</div><div class="order-details">${methods}</div><div class="order-items">`+
    (r.transactions?.length?r.transactions.map(o=>`<div class="order-line"><span>${esc(o.first_name)} ${esc(o.last_name)} · ${pad(o.order_no)} · ${esc(labels[o.payment_method])}</span><b>${fmt(o.total_cents)}</b></div>`).join(''):'<p class="sub small">Nenhuma venda paga hoje.</p>')+'</div>';
  $('itemReport').innerHTML=r.products?.length?r.products.sort((a,b)=>b.quantity-a.quantity).map(i=>`<div class="order-line" style="padding:9px 0"><span>${esc(i.name)} · ${i.quantity} unidades</span><b>${fmt(i.total_cents)}</b></div>`).join(''):'<p class="sub">Sem produtos vendidos hoje.</p>';
}
async function loadReport(){
  if(reportLoading||Date.now()-reportAt<12000)return;
  reportLoading=true;
  try{cashReport=await api('admin-cash',null,{admin:true,method:'GET'});reportAt=Date.now();renderCash();}
  catch(e){toast('Caixa: '+e.message,true);}finally{reportLoading=false;}
}
function exportCash(){
  if(!cashReport)return toast('Abra a aba Caixa para carregar as vendas.',true);
  const csvVal=v=>{let x=String(v??'');if(/^[=+@-]/.test(x))x="'"+x;return '"'+x.replaceAll('"','""')+'"';};
  const cols=[['Pedido','Cliente','Forma','Valor (R$)','Recebido em'],...(cashReport.transactions||[]).map(o=>[pad(o.order_no),o.first_name+' '+o.last_name,labels[o.payment_method],(o.total_cents/100).toFixed(2).replace('.',','),new Date(o.paid_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})])];
  const blob=new Blob(['\uFEFF'+cols.map(row=>row.map(csvVal).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='caixa-adega-'+cashReport.day+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  if(cashReport.paid_count>cashReport.transactions.length)toast('CSV com as 500 vendas mais recentes. O total e o resumo incluem todas as vendas.');
}

function renderSettings(){
  $('shopToggle').textContent=shop.accepting_orders?'● Aceitando pedidos — Pausar loja':'⏸ Pedidos pausados — Reabrir loja';
  $('shopToggle').className='btn '+(shop.accepting_orders?'btn-danger':'btn-primary');
  if($('storeName'))$('storeName').value=shop.name;
  if($('stockAlert'))$('stockAlert').value=shop.low_stock_threshold??5;
}
function render(){renderStats();renderOrders();
  // O polling não pode sobrescrever preço/estoque enquanto o dono digita.
  const editing=document.activeElement?.matches?.('[data-price-input],[data-stock-input],[data-option-stock-input]');
  if(!(activeTab==='inventory'&&(editing||$('editModal').classList.contains('open'))))renderInventory();
  renderCash();renderSettings();}
function setTab(tab){const internal=tab==='tabacaria';if(internal||tab==='inventory'){inventoryFilter=internal?'Tabacaria':'Todos';inventorySearch='';inventoryStatus='all';$('inventorySearch').value='';$('inventoryStatus').value='all';}activeTab=internal?'inventory':tab;if(tab==='cash')loadReport();for(const name of ['orders','inventory','cash','settings'])$('tab-'+name).classList.toggle('hidden',name!==activeTab);document.querySelectorAll('.side-link').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));$('pageTitle').textContent={orders:'Pedidos ao vivo',inventory:'Produtos e estoque',tabacaria:'Tabacaria',cash:'Caixa e faturamento',settings:'Configurações da adega'}[tab];if(activeTab==='inventory')renderInventory();}
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
  if(action==='cancel'&&!confirm('Cancelar este pedido e devolver os itens ao estoque?'))return;
  if(action==='paid'&&!confirm('O valor realmente foi recebido em dinheiro ou na maquininha?'))return;
  if(action==='age'&&!confirm('Você conferiu o documento e confirmou que a pessoa tem 18 anos ou mais?'))return;
  if(action==='receipt'&&!confirm('O gateway confirmou o Pix e você conferiu o comprovante na entrega?'))return;
  else if(action==='status'||['paid','age','receipt','voice'].includes(action)) {route='admin-order-action';body={id,action,value};}
  else if(action==='cancel'){route='admin-cancel';body={id};}
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
  try{await api(route,body,{admin:true,method});toast(action==='status'&&value==='ready'?'Pedido pronto! TV será atualizada.':'Alteração salva.');}
  catch(e){toast(e.message,true);}finally{busy=false;await refreshData(true);}
}
function showLogin(){ closeProductPreview();ordersInitialized=false;knownOrders.clear();$('orderDemo').classList.add('hidden');$('loginScreen').classList.remove('hidden');$('appScreen').classList.add('hidden'); }
function showAdmin(){ $('loginScreen').classList.add('hidden');$('appScreen').classList.remove('hidden'); }
async function start(){
 $('testNewOrder').onclick=()=>{if(!sounds){sounds=true;$('soundToggle').textContent='🔔 Alertas ligados';}demoStep=0;$('orderDemo').classList.remove('hidden');renderOrderDemo();};
 $('orderDemoNext').onclick=()=>{if(demoStep<2){demoStep++;renderOrderDemo();}};
 $('orderDemoClose').onclick=()=>{$('orderDemo').classList.add('hidden');};

  $('editCategory').innerHTML=CATEGORIES.slice(1).filter(c=>!['Doces e Balas','Salgadinhos','Doces e Snacks','Complementos','Doses'].includes(c)).map(c=>`<option>${esc(c)}</option>`).join('');
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
  $('shopToggle').onclick=async()=>{if(!confirm(shop.accepting_orders?'Pausar novos pedidos?':'Reabrir pedidos?'))return;try{await api('admin-settings',{accepting_orders:!shop.accepting_orders},{admin:true,method:'PATCH'});await refreshData(true);}catch(e){toast(e.message,true);}};
  $('settingsForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await api('admin-settings',{name:$('storeName').value.trim(),low_stock_threshold:Number($('stockAlert').value)},{admin:true,method:'PATCH'});toast('Configurações salvas.');await refreshData(true);}catch(err){toast(err.message,true);}});
  $('soundToggle').onclick=()=>{sounds=!sounds;$('soundToggle').textContent=sounds?'🔔 Alertas ligados':'🔕 Ativar alertas';if(sounds)tone();};
  $('logoutBtn').onclick=async()=>{try{await api('admin-logout',{}, {admin:true});}catch{}finally{authClear();showLogin();lastCatalogAt=0;}};
  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();$('loginError').textContent='';
    try{
      const username=$('username').value.trim().toLowerCase(),password=$('pass').value;
      if(username!=='admin')throw Error('Use o usuário admin.');
      const response=await fetch('/api/admin-login',{
        method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({username,password}),cache:'no-store'
      });
      const d=await response.json().catch(()=>({error:'Resposta inválida do servidor.'}));
      if(!response.ok)throw Error(d.error||'Falha ao entrar no painel.');
      authSave(d);$('pass').value='';showAdmin();await refreshData();
    }
    catch(err){$('loginError').textContent=err.message;}
  });
  if(authRead()?.token){showAdmin();await refreshData();}else showLogin();
  setInterval(()=>{if(!document.hidden&&!$('appScreen').classList.contains('hidden')){refreshData(true,false);}},8000);
  setInterval(()=>{if(!document.hidden&&!$('appScreen').classList.contains('hidden')&&activeTab==='cash')loadReport();},30000);
}
start();
