import { isDoseProduct, energyMatchesDose, CATEGORIES, publicCatalogProduct } from '../public/js/shared.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
class ApiError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const reject=(message,status=400)=>{throw new ApiError(message,status);};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const idOk=v=>uuid(v)||typeof v==='string'&&/^(?:produto|interno|ice|energy)-\d{1,6}$/.test(v);
const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const text=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const now=()=>new Date().toISOString();
const epoch=()=>Math.floor(Date.now()/1000);
const MAX_MONEY=100000000, MAX_STOCK=1000000;
const cats=new Set(CATEGORIES.filter(x=>x!=='Todos'));
const prohibited=/\b(?:vape|vapes|pod|pods|e-?cig|puff\s*bar)\b|cigarro\s*eletr[oô]nico|dispositivo\s*eletr[oô]nico\s*para\s*fumar/i;
const internalName=/\b(?:cigarros?|tabacos?|narguil[eé]|piteiras?|zgy|seda|tabaquin)\b/i;
const visible=p=>publicCatalogProduct(p)&&!prohibited.test(p.name)&&!internalName.test(p.name);
const boolKeys=['active','unlimited','age_restricted','age_required','age_checked','receipt_checked','accepting_orders'];
const normalize=r=>r?Object.fromEntries(Object.entries(r).map(([k,v])=>[k,boolKeys.includes(k)?Boolean(v):v])):r;
const stmt=(db,s,...v)=>db.prepare(s).bind(...v.map(x=>typeof x==='boolean'?Number(x):x));
const one=async(db,s,...v)=>normalize(await stmt(db,s,...v).first());
const many=async(db,s,...v)=>(await stmt(db,s,...v).all()).results.map(normalize);
const run=(db,s,...v)=>stmt(db,s,...v).run();
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
async function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||!a||!b||a.length>512)return false;const [x,y]=await Promise.all([hash(a),hash(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x.charCodeAt(i)^y.charCodeAt(i);return diff===0;}
const token=()=>crypto.randomUUID()+crypto.randomUUID();
const validPhoto=v=>/^https:\/\/[^\s]+$/i.test(v)||/^\/imagens\/[a-z0-9-]+\.webp$/.test(v)||/^\/media\/[a-f0-9-]{36}$/.test(v);
const missing=()=>reject('Registro não encontrado.',404);
const ready=()=>reject('Configure uma senha de pelo menos 12 caracteres nos segredos do Worker.',503);
async function rate(db,request,kind,max,seconds){
 const ip=request.headers.get('CF-Connecting-IP')||'local';
 const key=await hash(kind+':'+ip), slot=Math.floor(epoch()/seconds);
 const r=await one(db,'INSERT INTO rate_limits (key,slot,attempts) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN slot=excluded.slot THEN attempts+1 ELSE 1 END,slot=excluded.slot RETURNING attempts',key,slot);
 if(r.attempts>max)reject('Muitas tentativas. Aguarde alguns minutos e tente novamente.',429);
}
async function login(db,env,request,body){
 if(!env.ADEGA_ADMIN_PIN||env.ADEGA_ADMIN_PIN.length<12)ready();
 await rate(db,request,'admin',5,300);
 if(body.username!=='admin'||!await equal(body.password,env.ADEGA_ADMIN_PIN))reject('Usuário ou senha incorretos.',401);
 const value=token(),t=epoch();
 await db.batch([stmt(db,'DELETE FROM admin_sessions WHERE expires_at<=?',t),stmt(db,'INSERT INTO admin_sessions(token_hash,created_at,expires_at) VALUES (?,?,?)',await hash(value),t,t+43200),stmt(db,'DELETE FROM rate_limits WHERE slot < ?',Math.floor(t/300)-576)]);
 return json({token:value,expires_at:t+43200});
}
async function auth(db,request){
 const b=request.headers.get('Authorization')||'';
 if(!/^Bearer [a-f0-9-]{72}$/i.test(b))reject('Faça login no admin.',401);
 const h=await hash(b.slice(7));
 if(!await one(db,'SELECT token_hash FROM admin_sessions WHERE token_hash=? AND expires_at>?',h,epoch()))reject('Sessão expirada. Faça login novamente.',401);
 return h;
}
async function catalog(db,admin){
 const [store,products,drink_options]=await Promise.all([
 one(db,'SELECT name,accepting_orders,low_stock_threshold FROM store_settings WHERE id=1'),
 many(db,'SELECT id,name,category,description,price_cents,stock,unlimited,active,icon,image_url,age_restricted,sort_order FROM products '+(admin?'':"WHERE category<>'Tabacaria'")+' ORDER BY sort_order,name'),
 many(db,'SELECT id,option_group,name,active,stock,unlimited,sort_order FROM drink_options ORDER BY option_group,sort_order,name')
 ]);
 if(!store)reject('Configuração da loja ausente.',503);
 return json({store,products:admin?products:products.filter(visible),drink_options,drink_options_ready:true,online_enabled:false});
}
const orderResult=o=>json({order:{id:o.id,token:o.public_token,number:o.order_no,total_cents:o.total_cents,status:o.status}},201);
const aggregate=(items,key)=>{const m=new Map();for(const i of items){const k=i[key];if(k)m.set(k,(m.get(k)||0)+i.quantity);}return m;};
async function createOrder(db,body){
 if(body.honeypot||body.age_confirmed!==true)reject('Confirme ter pelo menos 18 anos.');
 const first=text(body.first_name,60),last=text(body.last_name,80),method=body.payment_method;
 if(first.length<2||last.length<2)reject('Informe nome e sobrenome.');
 if(!['cash','card'].includes(method))reject('Pagamento online ainda não integrado.',409);
 const cash=method==='cash'?body.cash_given_cents:null;
 if(method==='cash'&&!int(cash,1,MAX_MONEY))reject('Informe quanto vai pagar em dinheiro.');
 if(!uuid(body.request_id)||!int(body.expected_total_cents,1,MAX_MONEY))reject('Atualize o cardápio antes de confirmar.');
 const raw=body.items;
 if(!Array.isArray(raw)||raw.length<1||raw.length>30||!raw.every(i=>i&&idOk(i.id)&&int(i.quantity,1,99)&&(i.ice_id==null||idOk(i.ice_id))&&(i.energy_id==null||idOk(i.energy_id))))reject('Carrinho inválido.');
 const items=raw.map(i=>({id:i.id,quantity:i.quantity,ice_id:i.ice_id??null,energy_id:i.energy_id??null}));
 const fingerprint=await hash(JSON.stringify([first,last,method,cash,body.expected_total_cents,items]));
 const prior=async()=>{const o=await one(db,'SELECT o.*,r.fingerprint FROM order_requests r JOIN orders o ON o.id=r.order_id WHERE r.request_id=?',body.request_id);if(o&&o.fingerprint!==fingerprint)reject('Pedido já utilizado. Confira o acompanhamento.',409);return o;};
 const existing=await prior();if(existing)return orderResult(existing);
 const store=await one(db,'SELECT accepting_orders FROM store_settings WHERE id=1');
 if(!store?.accepting_orders)reject('A adega está temporariamente fechada para pedidos.',409);
 const quantities=aggregate(items,'id'),ice=aggregate(items,'ice_id'),energy=aggregate(items,'energy_id');
 const ids=[...quantities.keys()],opts=[...new Set([...ice.keys(),...energy.keys()])];
 const placeholders=a=>a.map(()=>'?').join(',');
 const [pp,oo]=await Promise.all([many(db,'SELECT * FROM products WHERE id IN ('+placeholders(ids)+')',...ids),opts.length?many(db,'SELECT * FROM drink_options WHERE id IN ('+placeholders(opts)+')',...opts):[]]);
 const products=new Map(pp.map(p=>[p.id,p])),options=new Map(oo.map(p=>[p.id,p]));
 let total=0,age=false;
 for(const [id,qty] of quantities){const p=products.get(id);if(!p||!visible(p)||!p.active||!int(p.price_cents,1,MAX_MONEY)||qty>99||(!p.unlimited&&p.stock<qty))reject('Produto indisponível ou estoque insuficiente.',409);total+=p.price_cents*qty;age||=p.age_restricted;}
 if(!int(total,1,MAX_MONEY)||total!==body.expected_total_cents)reject('O preço mudou. Atualize o carrinho e confira o total.',409);
 if(method==='cash'&&cash<total)reject('O valor em dinheiro deve cobrir o total do pedido.',409);
 for(const [id,qty] of [...ice,...energy]){const o=options.get(id);if(!o?.active||(!o.unlimited&&o.stock<qty))reject('Gelo ou energético indisponível.',409);}
 const lines=items.map(i=>{
 const p=products.get(i.id),a=options.get(i.ice_id),b=options.get(i.energy_id);
 if(isDoseProduct(p)){if(a?.option_group!=='ice'||b?.option_group!=='energy'||!energyMatchesDose(p,b))reject('Escolha gelo e energético compatíveis.',409);}
 else if(i.ice_id||i.energy_id)reject('Sabores não pertencem ao produto.',409);
 return {...i,name:p.name+(a?' | Gelo: '+a.name+' | Energético: '+b.name:''),base_name:p.name,category:p.category,price:p.price_cents,age:Number(p.age_restricted),product_unlimited:Number(p.unlimited),ice_name:a?.name??null,energy_name:b?.name??null,ice_unlimited:a?Number(a.unlimited):null,energy_unlimited:b?Number(b.unlimited):null};
 });
 const oid=crypto.randomUUID(),publicToken=crypto.randomUUID(),date=now(),payload=JSON.stringify(lines);
 const sqlItems="INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price_cents,ice_option_id,energy_option_id) SELECT ?,CASE WHEN p.id IS NOT NULL AND p.active=1 AND p.category<>'Tabacaria' AND p.category=json_extract(j.value,'$.category') AND p.name=json_extract(j.value,'$.base_name') AND p.price_cents=json_extract(j.value,'$.price') AND p.age_restricted=json_extract(j.value,'$.age') AND p.unlimited=json_extract(j.value,'$.product_unlimited') AND (json_extract(j.value,'$.ice_id') IS NULL OR (a.active=1 AND a.option_group='ice' AND a.name=json_extract(j.value,'$.ice_name') AND a.unlimited=json_extract(j.value,'$.ice_unlimited'))) AND (json_extract(j.value,'$.energy_id') IS NULL OR (b.active=1 AND b.option_group='energy' AND b.name=json_extract(j.value,'$.energy_name') AND b.unlimited=json_extract(j.value,'$.energy_unlimited'))) THEN p.id ELSE NULL END,json_extract(j.value,'$.name'),json_extract(j.value,'$.quantity'),json_extract(j.value,'$.price'),json_extract(j.value,'$.ice_id'),json_extract(j.value,'$.energy_id') FROM json_each(?) j LEFT JOIN products p ON p.id=json_extract(j.value,'$.id') LEFT JOIN drink_options a ON a.id=json_extract(j.value,'$.ice_id') LEFT JOIN drink_options b ON b.id=json_extract(j.value,'$.energy_id')";
 const stockRows=[...quantities].map(([id,qty])=>({id,qty}));
 const optionRows=[...ice,...energy].map(([id,qty])=>({id,qty}));
 const stockSql=table=>"UPDATE "+table+" SET stock=CASE WHEN unlimited=1 THEN stock ELSE stock-(SELECT SUM(json_extract(j.value,'$.qty')) FROM json_each(?) j WHERE json_extract(j.value,'$.id')="+table+".id) END WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(?))";
 const stocks=JSON.stringify(stockRows),opstocks=JSON.stringify(optionRows);
 try{
 await db.batch([
 stmt(db,"INSERT INTO orders(id,public_token,first_name,last_name,payment_method,cash_given_cents,total_cents,age_required,created_at,updated_at) VALUES(CASE WHEN (SELECT accepting_orders FROM store_settings WHERE id=1)=1 THEN ? ELSE NULL END,?,?,?,?,?,?,?,?,?)",oid,publicToken,first,last,method,cash,total,Number(age),date,date),
 stmt(db,sqlItems,oid,payload),
 stmt(db,"INSERT INTO stock_reservations(order_id,kind,item_id,quantity) SELECT ?,'product',p.id,SUM(json_extract(j.value,'$.qty')) FROM json_each(?) j JOIN products p ON p.id=json_extract(j.value,'$.id') WHERE p.unlimited=0 GROUP BY p.id UNION ALL SELECT ?,'option',o.id,SUM(json_extract(j.value,'$.qty')) FROM json_each(?) j JOIN drink_options o ON o.id=json_extract(j.value,'$.id') WHERE o.unlimited=0 GROUP BY o.id",oid,stocks,oid,opstocks),
 stmt(db,stockSql('products'),stocks,stocks),
 stmt(db,stockSql('drink_options'),opstocks,opstocks),
 stmt(db,"INSERT INTO order_requests(request_id,fingerprint,order_id) VALUES(?,?,?)",body.request_id,fingerprint,oid)
 ]);
 }catch(e){const duplicate=await prior();if(duplicate)return orderResult(duplicate);if(/constraint|PRODUTO_INDISPONIVEL/i.test(String(e.message)))reject('Preço, estoque ou disponibilidade mudou. Atualize o carrinho.',409);throw e;}
 const saved=await one(db,'SELECT * FROM orders WHERE id=?',oid);if(!saved)throw Error('order missing');
 return orderResult(saved);
}
async function cancel(db,id){
 if(!uuid(id))reject('Pedido inválido.');
 const eligible="EXISTS(SELECT 1 FROM orders WHERE id=? AND status IN ('received','preparing','ready') AND payment_status<>'paid')";
 const a=stmt(db,"UPDATE products SET stock=stock+(SELECT quantity FROM stock_reservations WHERE order_id=? AND kind='product' AND item_id=products.id) WHERE id IN (SELECT item_id FROM stock_reservations WHERE order_id=? AND kind='product') AND "+eligible,id,id,id);
 const b=stmt(db,"UPDATE drink_options SET stock=stock+(SELECT quantity FROM stock_reservations WHERE order_id=? AND kind='option' AND item_id=drink_options.id) WHERE id IN (SELECT item_id FROM stock_reservations WHERE order_id=? AND kind='option') AND "+eligible,id,id,id);
 const c=stmt(db,"UPDATE orders SET status='cancelled',updated_at=? WHERE id=? AND status IN ('received','preparing','ready') AND payment_status<>'paid'",now(),id);
 const result=await db.batch([a,b,c]);
 if(!result[2].meta.changes)reject('Pedido encerrado ou pago. Pedido pago exige estorno.',409);
 return json({ok:true});
}
async function orderAction(db,body){
 if(!uuid(body.id))reject('Pedido inválido.');
 const date=now(),open=" AND status IN ('received','preparing','ready')";
 let sql,args;
 switch(body.action){
 case 'voice':if(!['female','male'].includes(body.value))reject('Voz inválida.');sql='voice=?,updated_at=? WHERE id=?'+open;args=[body.value,date,body.id];break;
 case 'age':sql='age_checked=1,updated_at=? WHERE id=?'+open;args=[date,body.id];break;
 case 'receipt':sql="receipt_checked=1,updated_at=? WHERE id=? AND payment_method='pix' AND payment_status='paid'"+open;args=[date,body.id];break;
 case 'paid':sql="payment_status='paid',paid_at=COALESCE(paid_at,?),updated_at=? WHERE id=? AND payment_method IN ('cash','card')"+open;args=[date,date,body.id];break;
 case 'status':
 if(body.value==='preparing'){sql="status='preparing',updated_at=? WHERE id=? AND status='received'";args=[date,body.id];}
 else if(body.value==='ready'){sql="status='ready',ready_at=?,updated_at=? WHERE id=? AND status IN ('received','preparing') AND voice IN ('female','male')";args=[date,date,body.id];}
 else if(body.value==='delivered'){sql="status='delivered',updated_at=? WHERE id=? AND status='ready' AND payment_status='paid' AND (age_required=0 OR age_checked=1) AND (payment_method<>'pix' OR receipt_checked=1)";args=[date,body.id];}
 else reject('Status inválido.');break;
 default:reject('Ação inválida.');
 }
 const order=await one(db,'UPDATE orders SET '+sql+' RETURNING *',...args);
 if(!order)reject('Ação bloqueada. Confira pagamento, documento, voz e situação do pedido.',409);
 return json({order});
}
async function orders(db){
 const list=await many(db,"SELECT * FROM orders WHERE status IN ('received','preparing','ready') ORDER BY created_at DESC,order_no DESC LIMIT 250");
 if(!list.length)return json({orders:[]});
 const ids=JSON.stringify(list.map(o=>o.id));
 const lines=await many(db,'SELECT order_id,product_name,quantity,unit_price_cents FROM order_items WHERE order_id IN (SELECT value FROM json_each(?)) ORDER BY id',ids);
 const groups=new Map();for(const i of lines){if(!groups.has(i.order_id))groups.set(i.order_id,[]);groups.get(i.order_id).push(i);}
 return json({orders:list.map(({public_token,...o})=>({...o,order_items:groups.get(o.id)||[]}))});
}
async function cashReport(db){
 const day=new Date(Date.now()-3*3600000).toISOString().slice(0,10),start=day+'T03:00:00.000Z',end=new Date(Date.parse(start)+86400000).toISOString();
 const filter="payment_status='paid' AND paid_at>=? AND paid_at<?";
 const [methods,items,transactions,pending]=await Promise.all([
 many(db,'SELECT payment_method,COUNT(*) AS qty,SUM(total_cents) AS total FROM orders WHERE '+filter+' GROUP BY payment_method',start,end),
 many(db,'SELECT i.product_name AS name,SUM(i.quantity) AS quantity,SUM(i.quantity*i.unit_price_cents) AS total_cents FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.payment_status=\'paid\' AND o.paid_at>=? AND o.paid_at<? GROUP BY i.product_name ORDER BY quantity DESC',start,end),
 many(db,'SELECT id,order_no,first_name,last_name,payment_method,total_cents,paid_at FROM orders WHERE '+filter+' ORDER BY paid_at DESC LIMIT 500',start,end),
 one(db,"SELECT COUNT(*) AS qty FROM orders WHERE payment_status='pending' AND status<>'cancelled' AND created_at>=? AND created_at<?",start,end)
 ]);
 const totals={cash:0,card:0,pix:0,apple:0,google:0};let paid_count=0,total_cents=0;for(const m of methods){totals[m.payment_method]=m.total;paid_count+=m.qty;total_cents+=m.total;}
 return json({day,paid_count,pending_count:pending.qty,total_cents,item_count:items.reduce((n,i)=>n+i.quantity,0),by_method:totals,products:items,transactions,truncated:paid_count>500});
}
async function patchRow(db,table,id,patch){
 const fields=Object.keys(patch);if(!fields.length)reject('Nenhuma alteração informada.');
 const r=await one(db,'UPDATE '+table+' SET '+fields.map(k=>k+'=?').join(',')+' WHERE id=? RETURNING *',...fields.map(k=>patch[k]),id);if(!r)missing();return r;
}
function productPatch(body,creating=false){
 const p={};
 if(creating||body.name!==undefined){const n=text(body.name,121);if(n.length<2||n.length>120||prohibited.test(n))reject('Nome inválido ou produto não permitido.');p.name=n;}
 if(creating||body.category!==undefined){if(!cats.has(body.category))reject('Categoria inválida.');p.category=body.category;}
 if(creating||body.price_cents!==undefined){if(!int(body.price_cents,0,MAX_MONEY))reject('Preço inválido.');p.price_cents=body.price_cents;}
 for(const k of ['active','unlimited','age_restricted'])if(body[k]!==undefined){if(typeof body[k]!=='boolean')reject('Configuração inválida.');p[k]=body[k];}
 if(body.description!==undefined){p.description=text(body.description,450);if(prohibited.test(p.description))reject('Descrição inválida.');}
 if(body.icon!==undefined)p.icon=text(body.icon,6);
 if(body.image_url!==undefined){const v=text(body.image_url,1201);if(v&&(v.length>1200||!validPhoto(v)))reject('URL da foto inválida.');p.image_url=v||null;}
 if(body.sort_order!==undefined){if(!int(body.sort_order,-100000,100000))reject('Ordem inválida.');p.sort_order=body.sort_order;}
 return p;
}
async function productsAdmin(db,body,method){
 const p=productPatch(body,method==='POST');
 if(method==='POST'){
 if(!int(body.stock,0,MAX_STOCK))reject('Estoque inválido.');
 if(internalName.test(p.name)&&p.category!=='Tabacaria')reject('Produto de inventário interno.');
 const data={...p,id:crypto.randomUUID(),stock:body.stock,active:false,created_at:now()};
 const keys=Object.keys(data),saved=await one(db,'INSERT INTO products('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+') RETURNING *',...keys.map(k=>data[k]));
 return json({product:saved},201);
 }
 if(!idOk(body.id))reject('Produto inválido.');
 const old=await one(db,'SELECT name,category FROM products WHERE id=?',body.id);if(!old)missing();
 if((old.category==='Tabacaria'||internalName.test(p.name??old.name))&&(p.category??old.category)!=='Tabacaria')reject('Produto interno não pode entrar no cardápio.');
 return json({product:await patchRow(db,'products',body.id,p)});
}
async function photo(db,body){
 if(!idOk(body.id)||!['image/webp','image/jpeg','image/png'].includes(body.mime)||typeof body.base64!=='string'||body.base64.length>250000||!/^[A-Za-z0-9+/]+={0,2}$/.test(body.base64))reject('Foto inválida ou muito grande.',413);
 let bytes;try{bytes=Uint8Array.from(atob(body.base64),c=>c.charCodeAt(0));}catch{reject('Foto inválida.');}
 if(bytes.length<20||bytes.length>180000)reject('Foto deve ter até 180 KB.',413);
 const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10;
 const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!(body.mime==='image/png'&&png||body.mime==='image/jpeg'&&jpg||body.mime==='image/webp'&&webp))reject('Formato de foto inválido.');
 if(!await one(db,'SELECT id FROM products WHERE id=?',body.id))missing();
 const id=crypto.randomUUID(),url='/media/'+id;
 try{await db.batch([
 stmt(db,"INSERT INTO product_photos(id,product_id,mime,bytes,size_bytes) VALUES(CASE WHEN COALESCE((SELECT SUM(size_bytes) FROM product_photos WHERE product_id<>?),0)+?<=20000000 THEN ? ELSE NULL END,?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET id=excluded.id,mime=excluded.mime,bytes=excluded.bytes,size_bytes=excluded.size_bytes",body.id,bytes.length,id,body.id,body.mime,bytes.buffer,bytes.length),
 stmt(db,'UPDATE products SET image_url=? WHERE id=?',url,body.id)
 ]);}catch(e){if(/constraint/i.test(e.message))reject('Limite de fotos do banco atingido. Use imagens locais do GitHub.',409);throw e;}
 return json({image_url:url,product:{id:body.id,image_url:url}});
}
async function handler(request,env){
 const url=new URL(request.url),method=request.method.toUpperCase(),db=env.DB;
 if(url.pathname.startsWith('/media/')){
 if(method!=='GET'||!uuid(url.pathname.slice(7))||!db)return new Response('Not found',{status:404});
 const p=await db.prepare('SELECT mime,bytes FROM product_photos WHERE id=?').bind(url.pathname.slice(7)).first();
 if(!p)return new Response('Not found',{status:404});
 return new Response(new Uint8Array(p.bytes),{headers:{'Content-Type':p.mime,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
 }
 if(url.pathname!=='/api'&&url.pathname!=='/api/admin-login'){
 if(url.pathname.startsWith('/api/'))return json({error:'Rota não encontrada.'},404);
 if(!env.ASSETS)return new Response('Site aguardando publicação.',{status:503});
 // Cloudflare resolves extensionless HTML paths itself. Never rewrite /admin to /admin.html.
 return env.ASSETS.fetch(request);
 }
 if(!db)reject('Banco D1 não conectado.',503);
 const route=url.pathname==='/api/admin-login'?'login':url.searchParams.get('route')||'health';
 let body={};
 if(['POST','PATCH'].includes(method)){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))reject('Envie JSON.',415);
 const max=route==='admin-photo'?260000:30000;
 if(Number(request.headers.get('Content-Length'))>max)reject('Requisição muito grande.',413);
 const raw=await request.text();if(raw.length>max)reject('Requisição muito grande.',413);
 try{body=JSON.parse(raw);}catch{reject('JSON inválido.');}
 if(!body||typeof body!=='object'||Array.isArray(body))reject('Dados inválidos.');
 }
 if(route==='login'&&method==='POST')return login(db,env,request,body);
 const admin=route.startsWith('admin-');const session=admin?await auth(db,request):null;
 if(route==='admin-logout'&&method==='POST'){await run(db,'DELETE FROM admin_sessions WHERE token_hash=?',session);return json({ok:true});}
 if(route==='health'&&method==='GET'){const row=await one(db,'SELECT id FROM store_settings WHERE id=1');if(!row)reject('Banco não inicializado.',503);await one(db,'SELECT COUNT(*) AS n FROM sqlite_master WHERE type=\'table\' AND name IN (\'order_requests\',\'stock_reservations\',\'rate_limits\',\'product_photos\')').then(x=>{if(x.n!==4)reject('Complete a instalação do banco D1.',503);});return json({ok:true,database:'D1',online_enabled:false});}
 if(route==='catalog'&&method==='GET')return catalog(db,false);
 if(route==='admin-catalog'&&method==='GET')return catalog(db,true);
 if(route==='track'&&method==='POST'){
 if(!uuid(body.id)||!uuid(body.token))reject('Acompanhamento inválido.');
 const order=await one(db,'SELECT id,order_no,first_name,last_name,status,payment_status,total_cents,payment_method,created_at,updated_at FROM orders WHERE id=? AND public_token=?',body.id,body.token);if(!order)missing();return json({order});
 }
 if(route==='tv'&&method==='GET'){
 if(!env.TV_PASSCODE||env.TV_PASSCODE.length<12)reject('Configure TV_PASSCODE.',503);
 if(!await equal(request.headers.get('X-TV-Code'),env.TV_PASSCODE)){await rate(db,request,'tv',10,300);reject('Código da TV incorreto.',403);}
 const orders=await many(db,"SELECT id,order_no AS number,first_name,last_name,status,voice,ready_at,created_at FROM orders WHERE status IN ('received','preparing','ready') ORDER BY created_at DESC,order_no DESC LIMIT 60");
 return json({orders:orders.map(o=>({...o,public_name:o.first_name+' '+o.last_name}))});
 }
 if(route==='recover-order'&&method==='POST'){if(!uuid(body.request_id))reject('Pedido inválido.');const order=await one(db,'SELECT o.* FROM order_requests r JOIN orders o ON o.id=r.order_id WHERE r.request_id=?',body.request_id);if(!order)return json({order:null});return orderResult(order);}
 if(route==='create-order'&&method==='POST'){await rate(db,request,'order',30,300);return createOrder(db,body);}
 if(route==='admin-orders'&&method==='GET')return orders(db);
 if(route==='admin-cash'&&method==='GET')return cashReport(db);
 if(route==='admin-products'&&['POST','PATCH'].includes(method))return productsAdmin(db,body,method);
 if(route==='admin-photo'&&method==='POST')return photo(db,body);
 if(route==='admin-drink-options'&&method==='PATCH'){
 if(!idOk(body.id))reject('Sabor inválido.');const p={};
 if(body.active!==undefined){if(typeof body.active!=='boolean')reject('Status inválido.');p.active=body.active;}
 if(body.stock!==undefined){if(!int(body.stock,0,MAX_STOCK))reject('Estoque inválido.');p.stock=body.stock;}
 return json({option:await patchRow(db,'drink_options',body.id,p)});
 }
 if(route==='admin-stock'&&method==='POST'){
 if(!idOk(body.id)||!['set','add'].includes(body.mode)||!int(body.quantity,0,MAX_STOCK))reject('Estoque inválido.');
 const product=await one(db,'UPDATE products SET stock='+ (body.mode==='add'?'stock+?':'?')+' WHERE id=? AND '+(body.mode==='add'?'stock+?<=1000000':'1=1')+' RETURNING *',...([body.quantity,body.id,...(body.mode==='add'?[body.quantity]:[])]));if(!product)reject('Produto inexistente ou limite de estoque.',409);return json({product});
 }
 if(route==='admin-settings'&&method==='PATCH'){
 const p={};if(body.name!==undefined){p.name=text(body.name,101);if(p.name.length<3||p.name.length>100)reject('Nome inválido.');}
 if(body.accepting_orders!==undefined){if(typeof body.accepting_orders!=='boolean')reject('Status inválido.');p.accepting_orders=body.accepting_orders;}
 if(body.low_stock_threshold!==undefined){if(!int(body.low_stock_threshold,0,1000))reject('Limite inválido.');p.low_stock_threshold=body.low_stock_threshold;}
 return json({store:await patchRow(db,'store_settings',1,p)});
 }
 if(route==='admin-order-action'&&method==='POST')return orderAction(db,body);
 if(route==='admin-cancel'&&method==='POST')return cancel(db,body.id);
 return json({error:'Rota não encontrada.'},404);
}
export default {async fetch(request,env){try{return await handler(request,env);}catch(e){if(e instanceof ApiError)return json({error:e.message},e.status);console.error('ADEGA D1:',String(e?.message||e));return json({error:'Falha no servidor. Tente novamente sem repetir o pedido.'},503);}}};
