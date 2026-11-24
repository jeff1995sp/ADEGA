import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../worker/index.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const schema=read('../sql/d1/ESTRUTURA_BASE.sql')+read('../sql/d1/COMPLEMENTO_WORKER.sql');
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON;'+schema);
 sql.exec("INSERT INTO products(id,name,category,price_cents,stock,active,age_restricted) VALUES ('produto-005','Jack com Red Bull','Whisky',4500,5,1,1),('produto-061','Água','Águas e Refrigerantes',250,10,1,0),('interno-864','Sadhu Longa','Tabacaria',500,10,1,1); INSERT INTO drink_options(id,option_group,name,active,stock) VALUES ('ice-1','ice','Gelo de água',1,5),('energy-1','energy','Red Bull Original',1,5),('energy-99','energy','Vibe Original',1,5);");
 let beforeBatch=null;
 const DB={
  prepare(query){
   const statement=sql.prepare(query);
   const wrap=(args=[])=>{
    const vals=args.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);
    return {
     bind(...a){return wrap(a);},
     async first(){return statement.get(...vals)??null;},
     async all(){return {results:statement.all(...vals)};},
     async run(){return {meta:{changes:Number(statement.run(...vals).changes)}};}
    };
   };
   return wrap();
  },
  async batch(statements){
   if(beforeBatch){const f=beforeBatch;beforeBatch=null;f();}
   sql.exec('BEGIN');
   try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r;}
   catch(e){sql.exec('ROLLBACK');throw e;}
  }
 };
 const env={DB,ADEGA_ADMIN_PIN:'local-test-admin-very-long',TV_PASSCODE:'local-test-tv-very-long'};
 const call=async(route,body,auth,method=body===undefined?'GET':'POST',extra={})=>{
  const response=await worker.fetch(new Request('https://test.local/api?route='+route,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)}),env);
  return {status:response.status,data:await response.json()};
 };
 return {sql,call,env,hook:f=>{beforeBatch=f;}};
}
const payload=(over={})=>({first_name:'Teste',last_name:'Local',payment_method:'cash',cash_given_cents:5000,age_confirmed:true,items:[{id:'produto-005',quantity:1,ice_id:'ice-1',energy_id:'energy-1'},{id:'produto-061',quantity:1}],expected_total_cents:4750,request_id:crypto.randomUUID(),...over});
const login=async f=>{const r=await f.call('login',{username:'admin',password:f.env.ADEGA_ADMIN_PIN});assert.equal(r.status,200);return r.data.token;};
test('D1: login, sessões revogáveis, catálogo e pedidos fechados por padrão',async()=>{
 const f=setup();assert.equal((await f.call('health')).data.database,'D1');
 assert.equal((await f.call('admin-orders')).status,401);
 assert.equal((await f.call('login',{username:'admin',password:'wrong'})).status,401);
 const t=await login(f);
 const pubCatalog=(await f.call('catalog')).data.products;
 assert.ok(pubCatalog.some(p=>p.id==='interno-864'&&p.category==='Tabacaria'));
 assert.ok(pubCatalog.some(p=>p.id==='interno-878'&&p.price_cents===200));
 assert.ok(pubCatalog.some(p=>p.id==='interno-885'&&p.price_cents===300));
 const internal=(await f.call('admin-catalog',undefined,t)).data.products;assert.ok(internal.some(p=>p.id==='interno-877'));assert.equal(internal.find(p=>p.id==='interno-864').stock,10);assert.equal(internal.find(p=>p.id==='interno-864').price_cents,500);
 assert.equal((await f.call('create-order',payload())).status,409);
 assert.equal((await f.call('admin-logout',{},t)).status,200);
 assert.equal((await f.call('admin-orders',undefined,t)).status,401);
});
test('D1: pedido, troco, sabores, repetição segura e cancelamento sem duplicar estoque',async()=>{
 const f=setup(),t=await login(f);
 assert.equal((await f.call('admin-settings',{accepting_orders:true},t,'PATCH')).status,200);
 const p=payload(),a=await f.call('create-order',p);assert.equal(a.status,201,JSON.stringify(a.data));
 const id=a.data.order.id;assert.equal(a.data.order.total_cents,4750);
 const repeat=await f.call('create-order',p);assert.equal(repeat.data.order.id,id);
 const recover=await f.call('recover-order',{request_id:p.request_id});assert.equal(recover.data.order.id,id);
 assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM orders").get().n,1);
 assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='produto-005'").get().stock,4);
 assert.equal(f.sql.prepare("SELECT stock FROM drink_options WHERE id='energy-1'").get().stock,4);
 const admin=(await f.call('admin-orders',undefined,t)).data.orders[0];assert.equal(admin.cash_given_cents-admin.total_cents,250);assert.match(admin.order_items[0].product_name,/Gelo de água/);
 assert.equal((await f.call('admin-products',{id:'produto-005',unlimited:true},t,'PATCH')).status,200);
 assert.equal((await f.call('admin-cancel',{id},t)).status,200);
 assert.equal((await f.call('admin-cancel',{id},t)).status,409);
 assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='produto-005'").get().stock,5);
 assert.equal(f.sql.prepare("SELECT stock FROM drink_options WHERE id='energy-1'").get().stock,5);
});
test('D1: preço, estoque concorrente, pagamento e combinação incompatível bloqueados',async()=>{
 const f=setup();f.sql.exec('UPDATE store_settings SET accepting_orders=1');
 for(const p of [payload({cash_given_cents:10}),payload({expected_total_cents:4000}),payload({payment_method:'pix'}),payload({items:[{id:'produto-005',quantity:1,ice_id:'ice-1',energy_id:'energy-99'}],expected_total_cents:4500})]){
  assert.ok((await f.call('create-order',p)).status>=400);
 }
 // Simula outra operação reduzindo estoque entre leitura e transação.
 f.hook(()=>f.sql.exec("UPDATE drink_options SET stock=0 WHERE id='energy-1'"));
 const a=await f.call('create-order',payload());assert.equal(a.status,409,JSON.stringify(a.data));
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM orders').get().n,0);
 assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='produto-005'").get().stock,5);
 assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM order_items').get().n,0);
});
test('D1: TV protegida, entrega exige pagamento e maioridade, caixa soma venda real',async()=>{
 const f=setup(),t=await login(f);f.sql.exec('UPDATE store_settings SET accepting_orders=1');
 const a=await f.call('create-order',payload());assert.equal(a.status,201);const id=a.data.order.id;
 const action=(action,value)=>f.call('admin-order-action',{id,action,value},t);
 assert.equal((await action('status','ready')).status,409);
 assert.equal((await action('voice','male')).status,200);
 assert.equal((await action('status','ready')).status,200);
 assert.equal((await f.call('tv')).status,403);
 const tv=await f.call('tv',undefined,null,'GET',{'X-TV-Code':f.env.TV_PASSCODE});assert.equal(tv.data.orders[0].status,'ready');
 assert.equal((await action('status','delivered')).status,409);
 assert.equal((await action('paid')).status,200);
 assert.equal((await action('status','delivered')).status,409);
 assert.equal((await action('age')).status,200);
 assert.equal((await action('status','delivered')).status,200);
 const cash=await f.call('admin-cash',undefined,t);assert.equal(cash.data.total_cents,4750);assert.equal(cash.data.by_method.cash,4750);
 assert.equal(cash.data.item_count,2);assert.equal((await f.call('admin-cancel',{id},t)).status,409);
});
test('D1: foto autenticada e tamanho limitado, estoque e sabor editáveis',async()=>{
 const f=setup(),t=await login(f);
 const body={id:'produto-061',mime:'image/png',base64:Buffer.from([137,80,78,71,13,10,26,10,...Array(20).fill(0)]).toString('base64')};
 assert.equal((await f.call('admin-photo',body)).status,401);
 const result=await f.call('admin-photo',body,t);assert.equal(result.status,200,JSON.stringify(result.data));
 const image=await worker.fetch(new Request('https://test.local'+result.data.image_url),f.env);assert.equal(image.status,200);assert.equal(image.headers.get('Content-Type'),'image/png');
 assert.equal((await f.call('admin-stock',{id:'produto-061',mode:'add',quantity:3},t)).data.product.stock,13);
 assert.equal((await f.call('admin-drink-options',{id:'ice-1',active:false},t,'PATCH')).data.option.active,false);
});

test('Cloudflare: HTML navigation delegates unchanged to the assets router',async()=>{
 const config=JSON.parse(read('../wrangler.jsonc'));
 assert.equal(config.assets.html_handling,'auto-trailing-slash');
 assert.deepEqual(config.assets.run_worker_first,['/api','/api/*','/media/*']);
 for(const path of ['/','/admin','/admin.html','/tv','/tv.html']){
  const req=new Request('https://test.local'+path+'?check=1');
  const response=await worker.fetch(req,{ASSETS:{fetch(r){assert.equal(r.url,req.url);return new Response('asset');}}});
  assert.equal(await response.text(),'asset');
 }
});

test('D1: gelo avulso não aparece na vitrine nem entra em pedidos',async()=>{
 const f=setup();f.sql.exec("UPDATE store_settings SET accepting_orders=1; INSERT INTO products(id,name,category,price_cents,stock,active) VALUES ('produto-067','Gelo de água','Complementos',100,5,1);");
 const cat=await f.call('catalog');assert.ok(!cat.data.products.some(p=>p.id==='produto-067'));
 const attempt=await f.call('create-order',payload({items:[{id:'produto-067',quantity:1}],expected_total_cents:100}));
 assert.equal(attempt.status,409);
 assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='produto-067'").get().stock,5);
});
test('D1: cadastro de produto e foto aparecem no catálogo sem redeploy',async()=>{
 const f=setup(),t=await login(f);
 const saved=await f.call('admin-products',{name:'Bala teste',category:'Doces e Salgadinhos',price_cents:15,stock:20,unlimited:false,age_restricted:false},t);
 assert.equal(saved.status,201,JSON.stringify(saved.data));
 const id=saved.data.product.id;
 const body={id,mime:'image/png',base64:Buffer.from([137,80,78,71,13,10,26,10,...Array(20).fill(0)]).toString('base64')};
 const uploaded=await f.call('admin-photo',body,t);
 assert.equal(uploaded.status,200);
 const cat=await f.call('catalog');const p=cat.data.products.find(x=>x.id===id);
 assert.equal(p.image_url,uploaded.data.image_url);assert.equal(p.price_cents,15);assert.equal(p.active,false);
});

test('D1: Gin comum com energético custa 10 e com Red Bull custa 20, com estoque compartilhado',async()=>{
 const f=setup();
 f.sql.exec("UPDATE store_settings SET accepting_orders=1; INSERT INTO products(id,name,category,price_cents,stock,active,age_restricted) VALUES ('produto-062','Gin (dose)','Gin',1000,5,1,1); INSERT INTO drink_options(id,option_group,name,active,stock) VALUES ('energy-common','energy','Energético',1,5);");
 const item=(energy_id)=>({id:'produto-062',quantity:1,ice_id:'ice-1',energy_id});
 const bad=await f.call('create-order',payload({items:[item('energy-1')],expected_total_cents:1000}));assert.equal(bad.status,409);
 const good=await f.call('create-order',payload({items:[item('energy-common'),item('energy-1')],expected_total_cents:3000}));assert.equal(good.status,201,JSON.stringify(good.data));assert.equal(good.data.order.total_cents,3000);
 assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='produto-062'").get().stock,3);
 assert.deepEqual(f.sql.prepare("SELECT unit_price_cents FROM order_items ORDER BY id").all().map(x=>x.unit_price_cents),[1000,2000]);
 assert.equal(f.sql.prepare("SELECT stock FROM drink_options WHERE id='energy-common'").get().stock,4);
 assert.equal(f.sql.prepare("SELECT stock FROM drink_options WHERE id='energy-1'").get().stock,4);
});

test('D1: batidas com e sem álcool são escolhas obrigatórias e chegam separadas ao admin',async()=>{
 const f=setup(),token=await login(f);
 f.sql.exec("UPDATE store_settings SET accepting_orders=1; INSERT INTO products(id,name,category,price_cents,stock,active,age_restricted) VALUES ('produto-016','Açaí Batido','Batidas',1500,5,1,1)");
 const item={id:'produto-016',quantity:1};
 const req=(items,total=1500)=>payload({items,expected_total_cents:total});
 assert.equal((await f.call('create-order',req([item]))).status,409);
 assert.equal((await f.call('create-order',req([{...item,shake_alcohol:'invalido'}]))).status,400);
 const response=await f.call('create-order',req([{...item,shake_alcohol:'com'},{...item,shake_alcohol:'sem'}],3000));
 assert.equal(response.status,201,JSON.stringify(response.data));
 const order=(await f.call('admin-orders',undefined,token)).data.orders[0];
 assert.deepEqual(order.order_items.map(i=>i.product_name).sort(),['Açaí Batido | Com álcool','Açaí Batido | Sem álcool']);
 assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='produto-016'").get().stock,3);
});

test('D1: mais vendidos usa quantidade paga recente e disponível, não pedidos pendentes',async()=>{
 const f=setup();f.sql.exec('UPDATE store_settings SET accepting_orders=1');
 const pending=await f.call('create-order',payload({items:[{id:'produto-061',quantity:3}],expected_total_cents:750}));assert.equal(pending.status,201);
 assert.deepEqual((await f.call('catalog')).data.best_sellers,[]);
 const paid=await f.call('create-order',payload());assert.equal(paid.status,201);
 f.sql.prepare("UPDATE orders SET payment_status='paid',paid_at=? WHERE id=?").run(new Date().toISOString(),paid.data.order.id);
 const paid2=await f.call('create-order',payload({items:[{id:'produto-061',quantity:2}],expected_total_cents:500}));assert.equal(paid2.status,201);
 f.sql.prepare("UPDATE orders SET payment_status='paid',paid_at=? WHERE id=?").run(new Date().toISOString(),paid2.data.order.id);
 assert.deepEqual((await f.call('catalog')).data.best_sellers,['produto-061','produto-005']);
 f.sql.exec("UPDATE products SET active=0 WHERE id='produto-061'");
 assert.deepEqual((await f.call('catalog')).data.best_sellers,['produto-005']);
 f.sql.exec("UPDATE orders SET paid_at='2020-01-01T00:00:00.000Z' WHERE payment_status='paid'");
 assert.deepEqual((await f.call('catalog')).data.best_sellers,[]);
});

test('D1: preço Ninho Trufado atualizado uma vez, caipirinha de cerveja visível',async()=>{
 const f=setup();f.sql.exec("INSERT INTO products(id,name,category,price_cents,stock,active,age_restricted) VALUES ('produto-024','Ninho Trufado','Batidas',1200,5,1,1),('produto-026','Caipirinha de cerveja','Caipirinhas',0,0,0,1)");
 const a=await f.call('catalog');assert.equal(a.status,200);assert.equal(a.data.products.find(p=>p.id==='produto-024').price_cents,1500);assert.ok(a.data.products.some(p=>p.id==='produto-026'));
 f.sql.exec("UPDATE products SET price_cents=1700 WHERE id='produto-024'");
 assert.equal((await f.call('catalog')).data.products.find(p=>p.id==='produto-024').price_cents,1700);
 assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='produto-024'").get().stock,5);
});

test('D1: tabacaria aparece no admin e na vitrine, importação única sem sobrescrever estoque',async()=>{const f=setup(),token=await login(f);const first=await f.call('admin-catalog',undefined,token);assert.equal(first.status,200);assert.ok(first.data.products.some(p=>p.id==='interno-877'&&p.category==='Tabacaria'&&p.stock===0&&!p.active));f.sql.exec("UPDATE products SET stock=4,price_cents=500 WHERE id='interno-877'");const again=await f.call('admin-catalog',undefined,token);assert.equal(again.data.products.find(p=>p.id==='interno-877').stock,4);assert.equal(again.data.products.find(p=>p.id==='interno-877').price_cents,500);assert.ok((await f.call('catalog')).data.products.some(p=>p.id==='interno-877'&&p.category==='Tabacaria'));});

test('D1: vodka antiga Doses e categoria Vodka exigem gelo e energético; baixa correta de estoque',async()=>{const f=setup(),token=await login(f);f.sql.exec("UPDATE store_settings SET accepting_orders=1; INSERT INTO products(id,name,category,price_cents,stock,active,age_restricted) VALUES ('produto-013','Absolut com Red Bull','Doses',2500,5,1,1),('produto-014','Cîroc com Red Bull','Vodka',6000,5,1,1)");const req=(items,total)=>payload({items,expected_total_cents:total,cash_given_cents:10000});for(const [id,price] of [['produto-013',2500],['produto-014',6000]]){assert.equal((await f.call('create-order',req([{id,quantity:1}],price))).status,409);assert.equal((await f.call('create-order',req([{id,quantity:1,ice_id:'ice-1',energy_id:'energy-99'}],price))).status,409);assert.equal((await f.call('create-order',req([{id,quantity:1,ice_id:'ice-1',energy_id:'energy-1'}],price))).status,201);assert.equal(f.sql.prepare('SELECT stock FROM products WHERE id=?').get(id).stock,4);}assert.equal(f.sql.prepare("SELECT stock FROM drink_options WHERE id='ice-1'").get().stock,3);assert.equal(f.sql.prepare("SELECT stock FROM drink_options WHERE id='energy-1'").get().stock,3);const orders=(await f.call('admin-orders',undefined,token)).data.orders;assert.equal(orders.length,2);assert.ok(orders.every(o=>o.order_items[0].product_name.includes('Red Bull Original')));});

test('D1: doses duplicadas não aparecem juntas; preserva estoque e ambos os registros no admin',async()=>{const f=setup(),token=await login(f);f.sql.exec("INSERT INTO products(id,name,category,price_cents,stock,active,age_restricted) VALUES ('produto-011','Beefeater com Red Bull','Gin',3000,4,1,1),('produto-064','Beefeater (dose)','Gin',3000,3,1,1)");let rows=(await f.call('catalog')).data.products;assert.ok(rows.some(p=>p.id==='produto-064'));assert.ok(!rows.some(p=>p.id==='produto-011'));f.sql.exec("UPDATE products SET active=0 WHERE id='produto-064'");rows=(await f.call('catalog')).data.products;assert.ok(rows.some(p=>p.id==='produto-011'));assert.ok(!rows.some(p=>p.id==='produto-064'));const admin=(await f.call('admin-catalog',undefined,token)).data.products;assert.equal(admin.find(p=>p.id==='produto-011').stock,4);assert.equal(admin.find(p=>p.id==='produto-064').stock,3);});

test('D1: duplicados de Tabacaria são removidos, Tabaco bolado R$2 e Saquinho R$3 funcionam em pedidos',async()=>{const f=setup(),token=await login(f);f.sql.exec("UPDATE store_settings SET accepting_orders=1; INSERT INTO products(id,name,category,price_cents,stock,active,age_restricted) VALUES ('interno-803','Isqueiro BIC','Headshop',700,3,1,0),('interno-801','Carvão','Tabacaria',0,0,0,1),('interno-804','Piteira','Tabacaria',0,0,0,1)");const pub=(await f.call('catalog')).data.products;for(const dup of ['interno-800','interno-801','interno-803','interno-804','interno-805','interno-806','interno-807'])assert.ok(!pub.some(p=>p.id===dup),dup);assert.ok(pub.some(p=>p.id==='interno-870'&&p.category==='Tabacaria'&&p.stock===3));assert.ok(pub.some(p=>p.id==='interno-873'&&p.price_cents===100));assert.ok(pub.some(p=>p.id==='interno-867'&&p.price_cents===600));assert.ok(pub.some(p=>p.id==='interno-878'&&p.price_cents===200));assert.ok(pub.some(p=>p.id==='interno-885'&&p.price_cents===300));const order=await f.call('create-order',payload({items:[{id:'interno-864',quantity:1}],expected_total_cents:500,cash_given_cents:1000}));assert.equal(order.status,201,JSON.stringify(order.data));assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='interno-864'").get().stock,9);assert.equal((await f.call('admin-products',{id:'interno-885',stock:5,active:true},token,'PATCH')).status,200);});

test('D1: Dose Busca Brisa e Dose Malibu ficam em Gin e novos itens têm imagens locais',async()=>{const f=setup();f.sql.exec("INSERT INTO products(id,name,category,description,price_cents,stock,active,image_url,age_restricted) VALUES ('produto-077','Dose Busca Brisa','Bebidas','Dose Busca Brisa. Retirada no portão.',1500,5,1,'/imagens/foto-pendente.webp',1),('produto-078','Dose Malibu','Bebidas','Dose Malibu. Retirada no portão.',2000,5,1,'/imagens/foto-pendente.webp',1)");const pub=(await f.call('catalog')).data.products;const busca=pub.find(p=>p.id==='produto-077'),malibu=pub.find(p=>p.id==='produto-078'),kitkat=pub.find(p=>p.id==='produto-071'),pitu=pub.find(p=>p.id==='produto-079');assert.equal(busca.category,'Gin');assert.equal(busca.image_url,'/imagens/dose-busca-brisa.webp');assert.equal(busca.stock,5);assert.equal(malibu.category,'Gin');assert.equal(malibu.image_url,'/imagens/dose-malibu.webp');assert.equal(malibu.stock,5);assert.equal(kitkat.image_url,'/imagens/kitkat.webp');assert.equal(pitu.image_url,'/imagens/pitu-lata.webp');});

test('D1: novos pedidos só em dinheiro, rejeita outros métodos antes de reservar estoque',async()=>{const f=setup();f.sql.exec('UPDATE store_settings SET accepting_orders=1');for(const method of ['card','pix','apple','google'])assert.equal((await f.call('create-order',payload({payment_method:method}))).status,409,method);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM orders').get().n,0);assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='produto-005'").get().stock,5);assert.equal((await f.call('create-order',payload())).status,201);});


test('D1: simulação removida; TV segue consultando fila real',async()=>{const f=setup(),token=await login(f);assert.equal((await f.call('admin-tv-demo',{action:'start'},token)).status,404);const tv=await f.call('tv',undefined,undefined,'GET',{'X-TV-Code':f.env.TV_PASSCODE});assert.equal(tv.status,200);assert.deepEqual(tv.data.orders,[]);assert.ok(!('demo' in tv.data));});

test('D1: finalização em dinheiro registra entrega e recebimento atomicamente e não duplica caixa',async()=>{const f=setup(),token=await login(f);f.sql.exec('UPDATE store_settings SET accepting_orders=1');const o=await f.call('create-order',payload());assert.equal(o.status,201);const id=o.data.order.id;const act=(extra)=>f.call('admin-order-action',{id,...extra},token);assert.equal((await act({action:'finishcash',received:true,age_confirmed:true})).status,409);assert.equal((await act({action:'voice',value:'female'})).status,200);assert.equal((await act({action:'status',value:'ready'})).status,200);assert.equal((await act({action:'finishcash',received:true})).status,409);assert.equal((await act({action:'finishcash',received:false,age_confirmed:true})).status,400);assert.equal(f.sql.prepare('SELECT payment_status FROM orders WHERE id=?').get(id).payment_status,'pending');assert.equal((await act({action:'finishcash',received:true,age_confirmed:true})).status,200);const row=f.sql.prepare('SELECT status,payment_status,paid_at,age_checked FROM orders WHERE id=?').get(id);assert.equal(row.status,'delivered');assert.equal(row.payment_status,'paid');assert.equal(row.age_checked,1);assert.ok(row.paid_at);assert.equal((await act({action:'finishcash',received:true,age_confirmed:true})).status,409);assert.equal((await f.call('admin-cash',undefined,token)).data.total_cents,4750);assert.equal((await f.call('admin-orders',undefined,token)).data.orders.length,0);});

test('D1: avaliações apenas de compras finalizadas, uma por pedido, privadas por padrão e notas preservadas na moderação',async()=>{const f=setup(),token=await login(f);f.sql.exec('UPDATE store_settings SET accepting_orders=1');const o=(await f.call('create-order',payload())).data.order;const input={id:o.id,token:o.token,rating:4,comment:'Muito bom!',share_name:false};assert.equal((await f.call('review',input)).status,409);assert.equal((await f.call('admin-order-action',{id:o.id,action:'voice',value:'female'},token)).status,200);assert.equal((await f.call('admin-order-action',{id:o.id,action:'status',value:'ready'},token)).status,200);assert.equal((await f.call('admin-order-action',{id:o.id,action:'finishcash',received:true,age_confirmed:true},token)).status,200);assert.equal((await f.call('review',{...input,rating:6})).status,400);assert.equal((await f.call('review',{...input,token:crypto.randomUUID()})).status,404);assert.equal((await f.call('review',input)).status,201);assert.equal((await f.call('review',input)).status,409);assert.equal((await f.call('track',{id:o.id,token:o.token})).data.order.reviewed,true);let pub=(await f.call('reviews')).data;assert.equal(pub.summary.count,1);assert.equal(pub.summary.average,4);assert.equal(pub.reviews[0].display_name,'Cliente');assert.equal(pub.reviews[0].comment,'Muito bom!');assert.ok(!('order_id' in pub.reviews[0]));assert.equal((await f.call('admin-reviews')).status,401);const row=(await f.call('admin-reviews',undefined,token)).data.reviews[0];assert.equal((await f.call('admin-reviews',{id:row.id,comment_hidden:true},token,'PATCH')).status,200);pub=(await f.call('reviews')).data;assert.equal(pub.reviews[0].comment,'');assert.equal(pub.summary.average,4);assert.equal(pub.summary.count,1);});

test('D1: proximidade configurada só pelo admin, bloqueia pedidos distantes e não registra posição do cliente',async()=>{const f=setup(),t=await login(f);f.sql.exec('UPDATE store_settings SET accepting_orders=1');const loc={latitude:-23.6,longitude:-46.6,radius:50,enabled:true};assert.equal((await f.call('admin-location',loc,undefined,'PATCH')).status,401);assert.equal((await f.call('admin-location',{...loc,radius:0},t,'PATCH')).status,400);assert.equal((await f.call('admin-location',loc,t,'PATCH')).status,200);const pub=(await f.call('catalog')).data.store;assert.equal(pub.location_required,true);assert.equal(pub.location_radius,50);assert.ok(!('pickup_location' in pub));const position={latitude:loc.latitude,longitude:loc.longitude,accuracy:10,timestamp:Date.now()};for(const pos of [undefined,{...position,latitude:-23.61},{...position,accuracy:100},{...position,timestamp:Date.now()-180000},{...position,latitude:loc.latitude+0.0004,accuracy:20}])assert.equal((await f.call('create-order',payload({position:pos}))).status,409);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM orders').get().n,0);assert.equal(f.sql.prepare("SELECT stock FROM products WHERE id='produto-005'").get().stock,5);const body=payload({position});assert.equal((await f.call('create-order',body)).status,201);assert.equal((await f.call('create-order',{...body,position:undefined})).status,201);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM orders').get().n,1);assert.ok(!('position' in f.sql.prepare('SELECT * FROM orders').get()));});
