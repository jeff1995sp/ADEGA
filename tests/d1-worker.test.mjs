import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../worker/index.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const schema=read('../sql/d1/ESTRUTURA_BASE.sql')+read('../sql/d1/COMPLEMENTO_WORKER.sql')+read('../sql/d1/BLOQUEIO_TABACARIA_INSERT.sql');
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON;'+schema);
 sql.exec("INSERT INTO products(id,name,category,price_cents,stock,active,age_restricted) VALUES ('produto-005','Jack com Red Bull','Whisky',4500,5,1,1),('produto-061','Água','Águas e Refrigerantes',250,10,1,0),('interno-800','Seda','Tabacaria',300,10,1,1); INSERT INTO drink_options(id,option_group,name,active,stock) VALUES ('ice-1','ice','Gelo de água',1,5),('energy-1','energy','Red Bull Original',1,5),('energy-99','energy','Vibe Original',1,5);");
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
 assert.equal((await f.call('catalog')).data.products.length,2);
 assert.equal((await f.call('admin-catalog',undefined,t)).data.products.length,3);
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
test('D1: preço, estoque concorrente, tabacaria, pagamento e combinação incompatível bloqueados',async()=>{
 const f=setup();f.sql.exec('UPDATE store_settings SET accepting_orders=1');
 for(const p of [payload({cash_given_cents:10}),payload({expected_total_cents:4000}),payload({payment_method:'pix'}),payload({items:[{id:'interno-800',quantity:1}],expected_total_cents:300}),payload({items:[{id:'produto-005',quantity:1,ice_id:'ice-1',energy_id:'energy-99'}],expected_total_cents:4500})]){
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
