import {keysFor,validSubscription,bindPush,notifyReady,removePush} from './order-push.js';
import {pickupNameKey,duplicateNames} from '../public/js/pickup-code.js';
import { isDoseProduct, energyMatchesDose, CATEGORIES, publicCatalogProduct, doseUnitPrice } from '../public/js/shared.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
class ApiError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const reject=(message,status=400)=>{throw new ApiError(message,status);};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const standaloneEnergyId=id=>typeof id==='string'&&/^redbull-(?:[1-9]|1[0-4])$/.test(id)?'energy-'+id.slice(8):null;
const idOk=v=>uuid(v)||Boolean(standaloneEnergyId(v))||['energy-common','refri-sprite','refri-fanta-laranja','refri-fanta-uva','refri-guarana','refri-coca-cola'].includes(v)||typeof v==='string'&&/^(?:produto|interno|ice|energy)-\d{1,6}$/.test(v);
const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const text=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const now=()=>new Date().toISOString();
const epoch=()=>Math.floor(Date.now()/1000);
const MAX_MONEY=100000000, MAX_STOCK=1000000;
const cats=new Set(CATEGORIES.filter(x=>x!=='Todos'));
const visible=p=>publicCatalogProduct(p);
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
 // O login administrativo não aplica bloqueio por número de tentativas; o PIN continua obrigatório.
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
// One-time owner-requested price correction. Future admin edits are never reset.
const pricePatchId='20261124-ninho-trufado-1500';
async function applyCatalogPricePatch(db){
 await run(db,'CREATE TABLE IF NOT EXISTS catalog_patches (id TEXT PRIMARY KEY NOT NULL)');
 if(await one(db,'SELECT id FROM catalog_patches WHERE id=?',pricePatchId))return;
 await db.batch([
  stmt(db,"UPDATE products SET price_cents=1500 WHERE id='produto-024' AND name='Ninho Trufado' AND category='Batidas' AND price_cents=1200 AND NOT EXISTS(SELECT 1 FROM catalog_patches WHERE id=?)",pricePatchId),
  stmt(db,"INSERT OR IGNORE INTO catalog_patches(id) VALUES (?)",pricePatchId)
 ]);
}
const internalInventoryPatch='20261124-tabacaria-interno-v1';
const internalInventorySeed="INSERT OR IGNORE INTO products (id,name,category,description,price_cents,stock,unlimited,active,icon,image_url,age_restricted,sort_order) VALUES ('interno-850','ZGY Choco Menta','Tabacaria','Narguilé e essências. Retirada no portão.',1200,0,0,0,'📦','/imagens/zgy-choco-menta.webp',1,850),('interno-851','ZGY (embalagem branca e amarela)','Tabacaria','Narguilé e essências. Retirada no portão.',1200,0,0,0,'📦','/imagens/zgy-embalagem-branca-e-amarela.webp',1,851),('interno-852','ZGY (embalagem verde)','Tabacaria','Narguilé e essências. Retirada no portão.',1200,0,0,0,'📦','/imagens/zgy-embalagem-verde.webp',1,852),('interno-853','ZGY (embalagem roxa)','Tabacaria','Narguilé e essências. Retirada no portão.',1200,0,0,0,'📦','/imagens/zgy-embalagem-roxa.webp',1,853),('interno-854','ZGY Cream','Tabacaria','Narguilé e essências. Retirada no portão.',1200,0,0,0,'📦','/imagens/zgy-cream.webp',1,854),('interno-855','ZGY (embalagem laranja)','Tabacaria','Narguilé e essências. Retirada no portão.',1200,0,0,0,'📦','/imagens/zgy-embalagem-laranja.webp',1,855),('interno-856','ZGY (embalagem rosa)','Tabacaria','Narguilé e essências. Retirada no portão.',1200,0,0,0,'📦','/imagens/zgy-embalagem-rosa.webp',1,856),('interno-857','ZGY Yellow','Tabacaria','Narguilé e essências. Retirada no portão.',1200,0,0,0,'📦','/imagens/zgy-yellow.webp',1,857),('interno-858','Onix Chiclete Canela','Tabacaria','Tabacaria (+18). Retirada no portão.',0,0,0,0,'📦','/imagens/onix-chiclete-canela.webp',1,858),('interno-859','Onix Banana','Tabacaria','Tabacaria (+18). Retirada no portão.',0,0,0,0,'📦','/imagens/onix-banana.webp',1,859),('interno-860','Gift (maço branco)','Tabacaria','Tabacaria (+18). Retirada no portão.',650,0,0,0,'📦','/imagens/gift-maco-branco.webp',1,860),('interno-861','Eight Box','Tabacaria','Tabacaria (+18). Retirada no portão.',650,0,0,0,'📦','/imagens/eight-box.webp',1,861),('interno-862','Zomo Perfect','Tabacaria','Narguilé e essências. Retirada no portão.',0,0,0,0,'📦','/imagens/zomo-perfect.webp',1,862),('interno-863','Zomo Black','Tabacaria','Narguilé e essências. Retirada no portão.',0,0,0,0,'📦','/imagens/zomo-black.webp',1,863),('interno-864','Sadhu Longa','Tabacaria','Seda, tabaco ou piteira. Retirada no portão.',0,0,0,0,'📦','/imagens/sadhu-longa.webp',1,864),('interno-865','Seda O2','Tabacaria','Seda, tabaco ou piteira. Retirada no portão.',0,0,0,0,'📦','/imagens/seda-o2.webp',1,865),('interno-866','Seda Mundial','Tabacaria','Seda, tabaco ou piteira. Retirada no portão.',0,0,0,0,'📦','/imagens/seda-mundial.webp',1,866),('interno-867','Piteira Night','Tabacaria','Seda, tabaco ou piteira. Retirada no portão.',600,0,0,0,'📦','/imagens/piteira-night.webp',1,867),('interno-868','Acréma Blend','Tabacaria','Seda, tabaco ou piteira. Retirada no portão.',1600,0,0,0,'📦','/imagens/acrema-blend.webp',1,868),('interno-869','Tabaquin','Tabacaria','Seda, tabaco ou piteira. Retirada no portão.',0,0,0,0,'📦','/imagens/tabaquin.webp',1,869),('interno-870','Isqueiro BIC Mini','Tabacaria','Acessório de tabacaria. Retirada no portão.',500,0,0,0,'📦','/imagens/bic-mini-isqueiros.webp',1,870),('interno-871','Isqueiros coloridos','Tabacaria','Acessório de tabacaria. Retirada no portão.',200,0,0,0,'📦','/imagens/isqueiros-coloridos.webp',1,871),('interno-872','Tesoura rosa para acessórios','Tabacaria','Acessório de tabacaria. Retirada no portão.',1000,0,0,0,'📦','/imagens/tesoura-rosa-para-acessorios.webp',1,872),('interno-873','Carvão Fumax Gold (unidade)','Tabacaria','Unidade de carvão Fumax Gold. Retirada no portão.',100,0,0,0,'📦','/imagens/carvao-fumax-gold-1kg.webp',1,873),('interno-877','Cuia','Tabacaria','Acessório de tabacaria. Retirada no portão.',800,0,0,0,'📦','/imagens/cuia-colorida.webp',1,877),('interno-878','Tabaco bolado','Tabacaria','Tabaco bolado pronto. Retirada no portão.',200,0,0,0,'📦','/imagens/tabaco-bolado.webp',1,878),('interno-879','Narguilé','Tabacaria','Narguilé e essências. Retirada no portão.',0,0,0,0,'📦','/imagens/narguile.webp',1,879),('interno-880','Essência para narguilé','Tabacaria','Narguilé e essências. Retirada no portão.',1200,0,0,0,'📦','/imagens/essencia-para-narguile.webp',1,880),('interno-881','Papel alumínio para narguilé','Tabacaria','Narguilé e essências. Retirada no portão.',50,0,0,0,'📦','/imagens/papel-aluminio-para-narguile.webp',1,881),('interno-882','Seda Smoking','Tabacaria','Seda, tabaco ou piteira. Retirada no portão.',0,0,0,0,'📦','/imagens/seda-smoking.webp',1,882),('interno-883','Seda Zomo','Tabacaria','Seda, tabaco ou piteira. Retirada no portão.',0,0,0,0,'📦','/imagens/seda-zomo.webp',1,883),('interno-884','Cigarro Onix (outra variedade)','Tabacaria','Tabacaria (+18). Retirada no portão.',0,0,0,0,'📦','/imagens/cigarro-onix-outra-variedade.webp',1,884),('interno-885','Saquinho de tabaco','Tabacaria','Saquinho de tabaco. Retirada no portão.',300,0,0,0,'📦','/imagens/saquinho-de-tabaco.webp',1,885)";
const unifyTabacariaPatch='20261124-unificar-tabacaria-v1';
const tabacariaPhotosPatch='20261124-tabacaria-fotos-v1';
const tabacariaDedupePricesPatch='20261124-tabacaria-dedupe-precos-v2';
const tabacariaPhotoDefaults=[['interno-878','/imagens/tabaco-bolado.webp'],['interno-879','/imagens/narguile.webp'],['interno-880','/imagens/essencia-para-narguile.webp'],['interno-881','/imagens/papel-aluminio-para-narguile.webp'],['interno-882','/imagens/seda-smoking.webp'],['interno-883','/imagens/seda-zomo.webp'],['interno-884','/imagens/cigarro-onix-outra-variedade.webp'],['interno-885','/imagens/saquinho-de-tabaco.webp']];
const tabacariaDupPairs=[['interno-801','interno-873'],['interno-806','interno-873'],['interno-804','interno-867'],['interno-803','interno-870'],['interno-807','interno-871'],['interno-805','interno-872']];
const tabacariaDupIds=['interno-800','interno-801','interno-803','interno-804','interno-805','interno-806','interno-807'];
const confirmedPrices=[['produto-041',500],['produto-037',1500],['produto-038',1500],['produto-032',350],['produto-049',350],['produto-050',350],['produto-051',350],['produto-068',300],['produto-035',300],['produto-057',300],['produto-058',300],['produto-034',50],['produto-055',50],['produto-056',50],['produto-036',250],['produto-059',250],['produto-060',250],['produto-065',4000],['produto-069',50],['produto-070',15],['interno-868',1600],['interno-870',500],['interno-871',200],['interno-877',800],['interno-861',650],['interno-860',650],['interno-850',1200],['interno-851',1200],['interno-852',1200],['interno-853',1200],['interno-854',1200],['interno-855',1200],['interno-856',1200],['interno-857',1200],['interno-880',1200],['interno-873',100],['interno-881',50],['interno-867',600],['interno-872',1000]];
const newProductsSeed="INSERT OR IGNORE INTO products (id,name,category,description,price_cents,stock,unlimited,active,icon,image_url,age_restricted,sort_order) VALUES ('interno-885','Saquinho de tabaco','Tabacaria','Saquinho de tabaco. Retirada no portão.',300,0,0,0,'📦','/imagens/saquinho-de-tabaco.webp',1,885),('produto-071','KitKat','Doces e Salgadinhos','Chocolate KitKat.',500,0,0,0,'🍫','/imagens/kitkat.webp',0,900),('produto-072','Cocada','Doces e Salgadinhos','Doce cocada.',200,0,0,0,'🍬','/imagens/cocada.webp',0,901),('produto-073','Doce de abóbora','Doces e Salgadinhos','Doce de abóbora.',200,0,0,0,'🍬','/imagens/doce-de-abobora.webp',0,902),('produto-074','Pé de moleque','Doces e Salgadinhos','Doce pé de moleque.',200,0,0,0,'🍬','/imagens/pe-de-moleque.webp',0,903),('produto-075','Salgadinho Bacon','Doces e Salgadinhos','Salgadinho sabor bacon.',400,0,0,0,'🥨','/imagens/salgadinho-bacon.webp',0,904),('produto-076','Plutonita','Doces e Salgadinhos','Chiclete Plutonita.',25,0,0,0,'🍬','/imagens/plutonita-baba-de-bruxa.webp',0,905),('produto-077','Dose Busca Brisa','Gin','Copo de 700 ml com gelo e energético inclusos.',1500,0,0,0,'🍸','/imagens/dose-busca-brisa.webp',1,155),('produto-078','Dose Malibu','Gin','Copo de 700 ml com gelo e energético inclusos.',2000,0,0,0,'🍸','/imagens/dose-malibu.webp',1,156),('produto-079','Pitú lata','Bebidas prontas','Pitú lata gelada. Retirada no portão.',800,0,0,0,'🥫','/imagens/pitu-lata.webp',1,404)";
async function ensureInternalInventory(db){
 if(!await one(db,'SELECT id FROM catalog_patches WHERE id=?',internalInventoryPatch)){
  await db.batch([stmt(db,internalInventorySeed),stmt(db,'INSERT OR IGNORE INTO catalog_patches(id) VALUES (?)',internalInventoryPatch)]);
 }
 if(!await one(db,'SELECT id FROM catalog_patches WHERE id=?',unifyTabacariaPatch)){
  await db.batch([stmt(db,"UPDATE products SET category='Tabacaria' WHERE category='Headshop'"),stmt(db,'INSERT OR IGNORE INTO catalog_patches(id) VALUES (?)',unifyTabacariaPatch)]);
 }
 if(!await one(db,'SELECT id FROM catalog_patches WHERE id=?',tabacariaPhotosPatch)){
  await db.batch([...tabacariaPhotoDefaults.map(([id,url])=>stmt(db,"UPDATE products SET image_url=? WHERE id=? AND (image_url IS NULL OR image_url='' OR image_url='/imagens/foto-pendente.webp')",url,id)),stmt(db,'INSERT OR IGNORE INTO catalog_patches(id) VALUES (?)',tabacariaPhotosPatch)]);
 }
 if(!await one(db,'SELECT id FROM catalog_patches WHERE id=?',tabacariaDedupePricesPatch)){
  const ops=[
   stmt(db,newProductsSeed),
   ...tabacariaDupPairs.map(([dupId,keepId])=>stmt(db,"UPDATE products SET price_cents=CASE WHEN price_cents=0 THEN COALESCE((SELECT price_cents FROM products WHERE id=?),0) ELSE price_cents END,stock=CASE WHEN stock=0 THEN COALESCE((SELECT stock FROM products WHERE id=?),0) ELSE stock END,active=CASE WHEN active=0 THEN COALESCE((SELECT active FROM products WHERE id=?),0) ELSE active END WHERE id=?",dupId,dupId,dupId,keepId)),
   ...tabacariaDupIds.map(dupId=>stmt(db,"DELETE FROM products WHERE id=? AND NOT EXISTS(SELECT 1 FROM order_items WHERE product_id=?)",dupId,dupId)),
   ...tabacariaDupIds.map(dupId=>stmt(db,"UPDATE products SET active=0,stock=0,unlimited=0 WHERE id=?",dupId)),
   stmt(db,"UPDATE products SET name='Carvão Fumax Gold (unidade)' WHERE id='interno-873' AND name='Carvão Fumax Gold 1kg'"),
   stmt(db,"UPDATE products SET name='Isqueiro BIC Mini' WHERE id='interno-870' AND name='BIC Mini (isqueiros)'"),
   stmt(db,"UPDATE products SET price_cents=200 WHERE id='interno-878'"),
   stmt(db,"UPDATE products SET price_cents=300 WHERE id='interno-885'"),
   ...confirmedPrices.map(([id,cents])=>stmt(db,"UPDATE products SET price_cents=? WHERE id=? AND price_cents=0",cents,id)),
   stmt(db,'INSERT OR IGNORE INTO catalog_patches(id) VALUES (?)',tabacariaDedupePricesPatch)
  ];
  await db.batch(ops);
 }
 const novosItensFotosGinPatch='20261124-novos-itens-fotos-gin-v3';
 if(!await one(db,'SELECT id FROM catalog_patches WHERE id=?',novosItensFotosGinPatch)){
  const photoRows=[['produto-071','/imagens/kitkat.webp'],['produto-072','/imagens/cocada.webp'],['produto-073','/imagens/doce-de-abobora.webp'],['produto-074','/imagens/pe-de-moleque.webp'],['produto-075','/imagens/salgadinho-bacon.webp'],['produto-076','/imagens/plutonita-baba-de-bruxa.webp'],['produto-077','/imagens/dose-busca-brisa.webp'],['produto-078','/imagens/dose-malibu.webp'],['produto-079','/imagens/pitu-lata.webp']];
  await db.batch([
   stmt(db,newProductsSeed),
   stmt(db,"UPDATE products SET category='Gin',description='Copo de 700 ml com gelo e energético inclusos.',icon='🍸',sort_order=155 WHERE id='produto-077'"),
   stmt(db,"UPDATE products SET category='Gin',description='Copo de 700 ml com gelo e energético inclusos.',icon='🍸',sort_order=156 WHERE id='produto-078'"),
   stmt(db,"UPDATE products SET sort_order=404 WHERE id='produto-079'"),
   ...photoRows.map(([id,url])=>stmt(db,"UPDATE products SET image_url=? WHERE id=? AND (image_url IS NULL OR image_url='' OR image_url='/imagens/foto-pendente.webp')",url,id)),
   stmt(db,'INSERT OR IGNORE INTO catalog_patches(id) VALUES (?)',novosItensFotosGinPatch)
  ]);
 }
 const tabacariaPodsPatch='20261126-tabacaria-pods-v1';
 if(!await one(db,'SELECT id FROM catalog_patches WHERE id=?',tabacariaPodsPatch)){
  const podsSeed="INSERT OR IGNORE INTO products (id,name,category,description,price_cents,stock,unlimited,active,icon,image_url,age_restricted,sort_order) VALUES ('interno-900','Pod EBCREATE BC PRO 40K — Abacaxi Tostado','Tabacaria','Pod descartável 40.000 puffs sabor Abacaxi Tostado (Toasted Pineapple). (+18) Retirada no portão.',8500,1,0,1,'💨','/imagens/pod-ebcreate-bc-pro-40k-abacaxi-tostado.webp',1,900),('interno-901','Pod EBCREATE BC PRO 40K — Menta Gelada','Tabacaria','Pod descartável 40.000 puffs sabor Menta Gelada (Winter Mint). (+18) Retirada no portão.',8500,1,0,1,'💨','/imagens/pod-ebcreate-bc-pro-40k-menta-gelada.webp',1,901),('interno-902','Pod EBCREATE BC PRO 40K — Morango com Kiwi','Tabacaria','Pod descartável 40.000 puffs sabor Morango com Kiwi (Strawberry Kiwi). (+18) Retirada no portão.',8500,1,0,1,'💨','/imagens/pod-ebcreate-bc-pro-40k-morango-com-kiwi.webp',1,902),('interno-903','Pod EBCREATE BC PRO 40K — Framboesa com Marshmallow','Tabacaria','Pod descartável 40.000 puffs sabor Framboesa com Marshmallow (Raspberry Mallo). (+18) Retirada no portão.',8500,1,0,1,'💨','/imagens/pod-ebcreate-bc-pro-40k-framboesa-com-marshmallow.webp',1,903),('interno-904','Pod EBCREATE BC PRO 40K — Mix Frutado Azedinho','Tabacaria','Pod descartável 40.000 puffs sabor Mix Frutado Azedinho (Sour Fcuking Fab). (+18) Retirada no portão.',8500,1,0,1,'💨','/imagens/pod-ebcreate-bc-pro-40k-mix-frutado-azedinho.webp',1,904),('interno-905','Pod EBCREATE BC PRO 40K — Limonada Rosa','Tabacaria','Pod descartável 40.000 puffs sabor Limonada Rosa (Pink Lemonade). (+18) Retirada no portão.',8500,1,0,1,'💨','/imagens/pod-ebcreate-bc-pro-40k-limonada-rosa.webp',1,905),('interno-906','Pod EBCREATE BC PRO 40K — Abacaxi com Romã','Tabacaria','Pod descartável 40.000 puffs sabor Abacaxi com Romã (Pineapple POM). (+18) Retirada no portão.',8500,1,0,1,'💨','/imagens/pod-ebcreate-bc-pro-40k-abacaxi-com-roma.webp',1,906),('interno-907','Pod EBCREATE BC PRO 40K — Mix de Frutas Vermelhas','Tabacaria','Pod descartável 40.000 puffs sabor Mix de Frutas Vermelhas (Triple Berry). (+18) Retirada no portão.',8500,1,0,1,'💨','/imagens/pod-ebcreate-bc-pro-40k-mix-de-frutas-vermelhas.webp',1,907),('interno-908','Pod EBCREATE BC PRO 40K — Framboesa Azul Gelada','Tabacaria','Pod descartável 40.000 puffs sabor Framboesa Azul Gelada (Blue Razz Ice). (+18) Retirada no portão.',8500,1,0,1,'💨','/imagens/pod-ebcreate-bc-pro-40k-framboesa-azul-gelada.webp',1,908),('interno-909','Pod EBCREATE BC PRO 40K — Frutas Amarelas','Tabacaria','Pod descartável 40.000 puffs sabor Frutas Amarelas (Golden Berry). (+18) Retirada no portão.',8500,1,0,1,'💨','/imagens/pod-ebcreate-bc-pro-40k-frutas-amarelas.webp',1,909),('interno-910','Pod Ignite V300 30K — Abacaxi com Manga','Tabacaria','Pod descartável 30.000 puffs sabor Abacaxi com Manga (Pineapple Mango). (+18) Retirada no portão.',12000,1,0,1,'💨','/imagens/pod-ignite-v300-30k-abacaxi-com-manga.webp',1,910),('interno-911','Pod Ignite V300 30K — Morango com Kiwi','Tabacaria','Pod descartável 30.000 puffs sabor Morango com Kiwi (Strawberry Kiwi). (+18) Retirada no portão.',12000,1,0,1,'💨','/imagens/pod-ignite-v300-30k-morango-com-kiwi.webp',1,911),('interno-912','Pod Ignite V300 30K — Melão com Menta','Tabacaria','Pod descartável 30.000 puffs sabor Melão com Menta (Minty Melon). (+18) Retirada no portão.',12000,1,0,1,'💨','/imagens/pod-ignite-v300-30k-melao-com-menta.webp',1,912),('interno-913','Pod Ignite Sweet — Melancia Gelada','Tabacaria','Pod descartável Ignite Boost Series Sweet sabor Melancia Gelada (Watermelon Ice). (+18) Retirada no portão.',11000,1,0,1,'💨','/imagens/pod-ignite-sweet-melancia-gelada.webp',1,913),('interno-914','Pod Ignite Sweet — Pirulito de Framboesa Azul','Tabacaria','Pod descartável Ignite Boost Series Sweet sabor Pirulito de Framboesa Azul (Blue Razz B Pop). (+18) Retirada no portão.',11000,1,0,1,'💨','/imagens/pod-ignite-sweet-pirulito-de-framboesa-azul.webp',1,914),('interno-915','Pod Ignite Sweet — Menta Miami','Tabacaria','Pod descartável Ignite Boost Series Sweet sabor Menta Miami (Miami Mint). (+18) Retirada no portão.',11000,1,0,1,'💨','/imagens/pod-ignite-sweet-menta-miami.webp',1,915),('interno-916','Pod Elfbar Ice King 40K — Melão, Uva e Mentol','Tabacaria','Pod descartável 40.000 puffs sabor Melão, Uva e Mentol (Melon Grape Menthol). (+18) Retirada no portão.',11000,1,0,1,'💨','/imagens/pod-elfbar-ice-king-40k-melao-uva-e-mentol.webp',1,916),('interno-917','Pod Elfbar Ice King 40K — Maçã Dupla Gelada','Tabacaria','Pod descartável 40.000 puffs sabor Maçã Dupla Gelada (Double Apple Ice). (+18) Retirada no portão.',11000,1,0,1,'💨','/imagens/pod-elfbar-ice-king-40k-maca-dupla-gelada.webp',1,917),('interno-918','Pod Elfbar Ice King 40K — Melancia, Morango e Coco','Tabacaria','Pod descartável 40.000 puffs sabor Melancia, Morango e Coco (Tigers Blood). (+18) Retirada no portão.',11000,1,0,1,'💨','/imagens/pod-elfbar-ice-king-40k-melancia-morango-e-coco.webp',1,918),('interno-919','Pod Elfbar Sweet King — Bubbaloo Tutti Frutti','Tabacaria','Pod descartável Elfbar Sweet King sabor Bubbaloo Tutti Frutti. (+18) Retirada no portão.',11000,1,0,1,'💨','/imagens/pod-elfbar-sweet-king-bubbaloo-tutti-frutti.webp',1,919),('interno-920','Pod Elfbar Ice King 40K — Suco de Cranberry com Abacaxi','Tabacaria','Pod descartável 40.000 puffs sabor Suco de Cranberry com Abacaxi (Cranberry Pineapple Juice). (+18) Retirada no portão.',11000,1,0,1,'💨','/imagens/pod-elfbar-ice-king-40k-cranberry-com-abacaxi.webp',1,920),('interno-921','Pod Elfbar Ice King 40K — Maçã Verde Azedinha Gelada','Tabacaria','Pod descartável 40.000 puffs sabor Maçã Verde Azedinha Gelada (Sour Apple Ice). (+18) Retirada no portão.',11000,1,0,1,'💨','/imagens/pod-elfbar-ice-king-40k-maca-verde-azedinha-gelada.webp',1,921),('interno-922','Pod Elfbar Ice King 40K — Maçã Verde Gelada','Tabacaria','Pod descartável 40.000 puffs sabor Maçã Verde Gelada (Green Apple Ice). (+18) Retirada no portão.',11000,1,0,1,'💨','/imagens/pod-elfbar-ice-king-40k-maca-verde-gelada.webp',1,922)";
  await db.batch([
   stmt(db,podsSeed),
   stmt(db,'INSERT OR IGNORE INTO catalog_patches(id) VALUES (?)',tabacariaPodsPatch)
  ]);
 }
}
const DUPLICATE_DOSE_PAIRS=[['produto-064','produto-011'],['produto-063','produto-015']];
function dedupePublicProducts(list){
 const byId=new Map(list.map(p=>[p.id,p]));
 const hidden=new Set();
 for(const [primaryId,legacyId] of DUPLICATE_DOSE_PAIRS){
  const primary=byId.get(primaryId),legacy=byId.get(legacyId);
  if(primary&&legacy)hidden.add(!primary.active&&legacy.active?primaryId:legacyId);
 }
 return hidden.size?list.filter(p=>!hidden.has(p.id)):list;
}
const coordinate=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const defaultPickupAddress='Rua Dourado, 34 - Eldorado, Diadema - SP';
async function readPickupAddress(db){
 await run(db,'CREATE TABLE IF NOT EXISTS pickup_address (id INTEGER PRIMARY KEY CHECK(id=1),address TEXT NOT NULL)');
 const row=await one(db,'SELECT address FROM pickup_address WHERE id=1');return row?.address||defaultPickupAddress;
}
async function readPickupLocation(db){
 await run(db,'CREATE TABLE IF NOT EXISTS pickup_location (id INTEGER PRIMARY KEY CHECK(id=1),latitude REAL NOT NULL,longitude REAL NOT NULL,radius INTEGER NOT NULL CHECK(radius BETWEEN 25 AND 500),enabled INTEGER NOT NULL CHECK(enabled IN (0,1)))');
 return await one(db,'SELECT latitude,longitude,radius,enabled FROM pickup_location WHERE id=1');
}
async function savePickupLocation(db,body){
 await readPickupLocation(db);
 if(!coordinate(body.latitude,-90,90)||!coordinate(body.longitude,-180,180)||!int(body.radius,25,500)||typeof body.enabled!=='boolean')reject('Informe coordenadas válidas e raio de 25 a 500 metros.');
 const previous=await readPickupAddress(db);
 const address=body.address===undefined?previous:text(body.address,251);
 if(address.length<5||address.length>250)reject('Informe o endereço completo da adega.');
 await db.batch([stmt(db,'INSERT INTO pickup_location(id,latitude,longitude,radius,enabled) VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,radius=excluded.radius,enabled=excluded.enabled',body.latitude,body.longitude,body.radius,body.enabled),stmt(db,'INSERT INTO pickup_address(id,address) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET address=excluded.address',address)]);
 return json({location:{...await readPickupLocation(db),address}});
}
function distanceMeters(a,b){
 const rad=Math.PI/180,dlat=(b.latitude-a.latitude)*rad,dlon=(b.longitude-a.longitude)*rad;
 const k=Math.sin(dlat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dlon/2)**2;
 return 6371000*2*Math.asin(Math.sqrt(Math.max(0,Math.min(1,k))));
}
async function nearbyResult(db,position){
 const location=await readPickupLocation(db);
 if(!location?.enabled)return {allowed:true,required:false,radius:location?.radius??50,message:'Regra de proximidade desativada.'};
 const radius=location.radius,result=(allowed,message,extra={})=>({allowed,required:true,radius,message,...extra});
 if(!position||!coordinate(position.latitude,-90,90)||!coordinate(position.longitude,-180,180)||!coordinate(position.accuracy,0,100000)||!Number.isFinite(position.timestamp)||position.timestamp<Date.now()-120000||position.timestamp>Date.now()+10000)return result(false,'Autorize a localização atual do celular para confirmar o pedido.');
 const distance=distanceMeters(location,position),details={distance:Math.round(distance),accuracy:Math.ceil(position.accuracy)};
 if(position.accuracy>Math.min(radius,50))return result(false,'GPS impreciso. Ative a localização precisa e tente novamente em local aberto.',details);
 if(distance>radius)return result(false,'Você está fora da área de retirada. Aproxime-se da adega.',details);
 return result(true,'Você está dentro da área de atendimento.',details);
}
async function requireNearby(db,position){if(position===undefined||position===null)return;const r=await nearbyResult(db,position);if(!r.allowed)reject(r.message,409);}
const sodaPatch='20261126-refri-sabores-v1';
async function ensureSodaFlavors(db){await run(db,'CREATE TABLE IF NOT EXISTS catalog_patches (id TEXT PRIMARY KEY NOT NULL)');if(await one(db,'SELECT id FROM catalog_patches WHERE id=?',sodaPatch))return;const rows=[["refri-sprite","Sprite — Limão (lata 350 ml)","https://static.expressodelivery.com.br/imagens/produtos/439309/180/Expresso-Delivery_4d331b252ac100d121c6107d76c37ef1.jpg"],["refri-fanta-laranja","Fanta Laranja (lata 350 ml)","https://static.expressodelivery.com.br/imagens/produtos/439276/180/Expresso-Delivery_c3801a2bf5fb6512bb34a2e95faca8b4.jpg"],["refri-fanta-uva","Fanta Uva (lata 350 ml)","https://static.expressodelivery.com.br/imagens/produtos/439277/180/Expresso-Delivery_b289f78e0ce5905bc4eb692d4aed0325.jpg"],["refri-guarana","Guaraná Antarctica (lata 350 ml)","https://static.expressodelivery.com.br/imagens/produtos/439272/180/Expresso-Delivery_7b9fd9864118bbdeef1157a8bb50edf7.jpg"]];await db.batch([...rows.map(([id,name,img],i)=>stmt(db,"INSERT OR IGNORE INTO products(id,name,category,description,price_cents,stock,unlimited,active,icon,image_url,age_restricted,sort_order) SELECT ?,?,'Águas e Refrigerantes','Lata de 350 ml. Retirada no portão.',COALESCE((SELECT NULLIF(price_cents,0) FROM products WHERE id='produto-030'),600),10,0,1,'🥤',?,0,920+? WHERE NOT EXISTS(SELECT 1 FROM catalog_patches WHERE id=?)",id,name,img,i,sodaPatch)),stmt(db,"UPDATE products SET active=0 WHERE id='produto-030' AND NOT EXISTS(SELECT 1 FROM catalog_patches WHERE id=?)",sodaPatch),stmt(db,'INSERT OR IGNORE INTO catalog_patches(id) VALUES (?)',sodaPatch)]);}
async function ensureColaAndEnergyFlavors(db){
 await run(db,'CREATE TABLE IF NOT EXISTS catalog_patches (id TEXT PRIMARY KEY NOT NULL)');
 const patch='20261126-coca-e-energeticos-v1';if(await one(db,'SELECT id FROM catalog_patches WHERE id=?',patch))return;
 await db.batch([
 stmt(db,"INSERT OR IGNORE INTO products(id,name,category,description,price_cents,stock,unlimited,active,icon,image_url,age_restricted,sort_order) SELECT 'refri-coca-cola','Coca-Cola Original (lata 350 ml)','Águas e Refrigerantes','Lata de 350 ml. Retirada no portão.',COALESCE((SELECT NULLIF(price_cents,0) FROM products WHERE id='produto-030'),600),10,0,1,'🥤','https://santaluzia.vtexassets.com/arquivos/ids/997380/556297.jpg?v=638525861586730000',0,924 WHERE NOT EXISTS(SELECT 1 FROM catalog_patches WHERE id=?)",patch),
 stmt(db,"INSERT OR IGNORE INTO drink_options(id,option_group,name,active,stock,unlimited,sort_order) VALUES ('energy-101','energy','Energético — Tropical',0,0,0,101),('energy-102','energy','Energético — Melancia',0,0,0,102)"),
 stmt(db,'INSERT OR IGNORE INTO catalog_patches(id) VALUES (?)',patch)]);
}
async function ensureIncludedVibe(db){
 await run(db,'CREATE TABLE IF NOT EXISTS catalog_patches (id TEXT PRIMARY KEY NOT NULL)');const patch='20261126-vibe-toggle-v2';if(await one(db,'SELECT id FROM catalog_patches WHERE id=?',patch))return;await db.batch([stmt(db,"INSERT INTO drink_options(id,option_group,name,active,stock,unlimited,sort_order) VALUES ('energy-99','energy','Vibe Original',1,0,1,99) ON CONFLICT(id) DO UPDATE SET active=1,unlimited=1 WHERE NOT EXISTS(SELECT 1 FROM catalog_patches WHERE id=?)",patch),stmt(db,'INSERT OR IGNORE INTO catalog_patches(id) VALUES (?)',patch)]);
}
const standaloneRedBulls=[[1,"Original","https://www.redbull.com/energydrink/v1/resources/storyblok/images/f/287059/870x2200/3695a10545/br_ed_250ml_energy-drink_country_rgb__cold_closed_front_com_25.png/m/168x0"],[2,"Sugarfree","https://www.redbull.com/energydrink/v1/resources/storyblok/images/f/287059/528x1348/8083114670/br_sf_250ml_sugarfree_country_rgb__cold_closed_front_com_full.png/m/168x0"],[3,"Zero","https://www.redbull.com/energydrink/v1/resources/storyblok/images/f/287059/528x1348/a58094ed39/br_zr_250ml_ac_zero_country_rgb_packrq-2750_cold_closed_front_com_full.png/m/168x0"],[4,"Tropical","https://www.redbull.com/energydrink/v1/resources/storyblok/images/f/287059/870x2200/635d955ea9/br_yl_250ml_the-tropical-edition_country_rgb_do238698_cold_closed_front_com_25.png/m/168x0"],[5,"Melancia","https://www.redbull.com/energydrink/v1/resources/storyblok/images/f/287059/870x2200/8c43f3f482/br_wm_250ml_the-melancia-edition_country_rgb_do238714_cold_closed_front_com_25.png/m/168x0"],[6,"Melão","https://www.redbull.com/energydrink/v1/resources/storyblok/images/f/287059/528x1348/63c692f0a6/br_ce_250ml_the-melao-edition_country_rgb_initi8-40_cold_closed_front_com_full-1.png/m/168x0"],[7,"Pêssego","https://www.redbull.com/energydrink/v1/resources/storyblok/images/f/287059/528x1348/6faa6f0f46/br_as_250ml_the-pessego-edition_country_rgb__cold_closed_front_com_full.png/m/168x0"],[8,"Cereja","https://www.redbull.com/energydrink/v1/resources/storyblok/images/f/287059/870x2200/14471adf6c/br_jb_250ml_the-cereja-edition_country_rgb_do243994_cold_closed_front_com_25.png/m/168x0"],[9,"White Sugarfree","https://www.redbull.com/energydrink/v1/resources/storyblok/images/f/287059/870x2200/97bb5a49dc/br_sf-cs_250ml_ac_the-white-edition_country_rgb_packrq-4842_cold_closed_front_com_25.png/m/168x0"],[10,"Nectarina Sugarfree","https://www.redbull.com/energydrink/v1/resources/storyblok/images/f/287059/870x2200/222e943f79/br_sf-wp_250ml_ac_the-nectarina-edition-sugarfree_country_rgb_packrq-5170_cold_closed_front_com_25.png/m/168x0"],[11,"Ice Sugarfree","https://www.redbull.com/energydrink/v1/resources/storyblok/images/f/287059/870x2200/48c7ee3693/br_sf-igb_250ml_ac_the-ice-edition-sugarfree_country_rgb_initi8-188_cold_closed_front_com_25.png/m/168x0"],[12,"Maçã Sugarfree","https://www.redbull.com/energydrink/v1/resources/storyblok/images/f/287059/528x1348/6b32a22fb3/br_sf-fai_250ml_ac_the-maca-edition-sugarfree_country_rgb_packrq-3400_cold_closed_front_com_full.png/m/168x0"],[13,"Amora Sugarfree","https://www.redbull.com/energydrink/v1/resources/storyblok/images/f/287059/528x1348/2d9f981288/new_br_sf-ff_250ml_the-amora-edition-sugarfree_country_rgb_initi8-49_cold_closed_front_com_full.png/m/168x0"],[14,"Pomelo Sugarfree","https://www.redbull.com/energydrink/v1/resources/storyblok/images/f/287059/870x2200/030bc3b020/br_sf-wpg_250ml_the-pomelo-edition-sugarfree_country_rgb_initi8-56_cold_closed_front_com_25.png/m/168x0"]];
async function ensureStandaloneRedBulls(db){await run(db,'CREATE TABLE IF NOT EXISTS catalog_patches (id TEXT PRIMARY KEY NOT NULL)');const patch='20261126-redbull-avulso-v1';if(await one(db,'SELECT id FROM catalog_patches WHERE id=?',patch))return;await db.batch([...standaloneRedBulls.map(([i,name,url])=>stmt(db,"INSERT OR IGNORE INTO products(id,name,category,description,price_cents,stock,unlimited,active,icon,image_url,age_restricted,sort_order) VALUES (?,?,'Águas e Refrigerantes','Energético avulso em lata de 250 ml. Retirada no portão.',1200,?,0,?,'🥤',?,0,?)",'redbull-'+i,'Red Bull '+name+' (250 ml)',i===1?3:0,i===1?1:0,url,930+i)),stmt(db,"INSERT OR IGNORE INTO drink_options(id,option_group,name,active,stock,unlimited,sort_order) VALUES ('energy-1','energy','Red Bull Original',1,3,0,1)"),stmt(db,"UPDATE drink_options SET active=1,stock=MAX(stock,3) WHERE id='energy-1' AND NOT EXISTS(SELECT 1 FROM catalog_patches WHERE id=?)",patch),stmt(db,'INSERT OR IGNORE INTO catalog_patches(id) VALUES (?)',patch)]);}
async function catalog(db,admin){await ensureSodaFlavors(db);await ensureColaAndEnergyFlavors(db);await ensureIncludedVibe(db);await ensureStandaloneRedBulls(db);
 await ensureCashArchive(db);
 await applyCatalogPricePatch(db);
 await ensureInternalInventory(db);
 const [store,products,drink_options,paidSales]=await Promise.all([
 one(db,'SELECT name,accepting_orders,low_stock_threshold FROM store_settings WHERE id=1'),
 many(db,'SELECT id,name,category,description,price_cents,stock,unlimited,active,icon,image_url,age_restricted,sort_order FROM products ORDER BY sort_order,name'),
 many(db,'SELECT id,option_group,name,active,stock,unlimited,sort_order FROM drink_options ORDER BY option_group,sort_order,name'),
 admin?Promise.resolve([]):many(db,"SELECT i.product_id,SUM(i.quantity) AS quantity FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.payment_status='paid' AND o.status<>'cancelled' AND o.paid_at>=? AND o.paid_at<=? AND NOT EXISTS(SELECT 1 FROM cash_archived_orders a JOIN cash_batches b ON b.id=a.batch_id WHERE a.order_id=o.id AND b.kind='test') GROUP BY i.product_id ORDER BY quantity DESC,i.product_id ASC",new Date(Date.now()-30*86400000).toISOString(),now())
 ]);
 if(!store)reject('Configuração da loja ausente.',503);
 const optionMap=new Map(drink_options.map(o=>[o.id,o]));const effectiveProducts=products.map(p=>{const id=standaloneEnergyId(p.id);if(!id)return p;const o=optionMap.get(id);return {...p,standalone_limit:p.stock,shared_stock:o?.stock??0,stock:o?.active?Math.min(p.stock,o.unlimited?p.stock:o.stock):0,unlimited:false};});
 const publicProducts=dedupePublicProducts(effectiveProducts.filter(visible));
 const readyIds=new Set(publicProducts.filter(p=>p.active&&p.price_cents>0&&(p.unlimited||p.stock>0)).map(p=>p.id));
 const best_sellers=paidSales.filter(r=>r.quantity>0&&readyIds.has(r.product_id)).slice(0,6).map(r=>r.product_id);
 const location=await readPickupLocation(db);
 const high_demand=admin?false:(await demandStatus(db)).high_demand;
 return json({high_demand,store:{...store,location_required:Boolean(location?.enabled),location_optional:true,location_radius:location?.radius??50,...(admin?{pickup_location:location,pickup_address:await readPickupAddress(db)}: {})},products:admin?effectiveProducts:publicProducts,drink_options:admin?drink_options:drink_options.filter(o=>o.active&&(o.unlimited||o.stock>0)),drink_options_ready:true,online_enabled:false,best_sellers});
}
async function ensureOrderCycles(db){await run(db,'CREATE TABLE IF NOT EXISTS cash_order_cycles (cutoff INTEGER NOT NULL UNIQUE CHECK(cutoff>=0),created_at TEXT NOT NULL)');}
const numberDay=(hour=6,at=Date.now())=>new Date(at-(3+hour)*3600000).toISOString().slice(0,10);
async function ensureNumberSettings(db){await ensureOrderCycles(db);await run(db,"CREATE TABLE IF NOT EXISTS order_number_settings(id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL CHECK(enabled IN(0,1)),hour INTEGER NOT NULL CHECK(hour IN(0,4,6)),last_day TEXT NOT NULL)");await run(db,"INSERT OR IGNORE INTO order_number_settings VALUES(1,1,6,?)",numberDay());}
const noActive="NOT EXISTS(SELECT 1 FROM orders WHERE status IN ('received','preparing','ready'))";
const cutoff="MAX(COALESCE((SELECT seq FROM sqlite_sequence WHERE name='orders'),0),COALESCE((SELECT MAX(order_no) FROM orders),0))";
const numberDue="EXISTS(SELECT 1 FROM order_number_settings WHERE id=1 AND enabled=1 AND last_day<CASE hour WHEN 0 THEN ? WHEN 4 THEN ? ELSE ? END)";
function dailyNumberStatements(db,at){const ds=[0,4,6].map(h=>numberDay(h,at));return [stmt(db,"INSERT OR IGNORE INTO cash_order_cycles(cutoff,created_at) SELECT "+cutoff+",? WHERE "+noActive+" AND "+numberDue,new Date(at).toISOString(),...ds),stmt(db,"UPDATE order_number_settings SET last_day=CASE hour WHEN 0 THEN ? WHEN 4 THEN ? ELSE ? END WHERE id=1 AND "+noActive+" AND "+numberDue,...ds,...ds)];}
async function numberSettings(db,body=null){await ensureNumberSettings(db);if(body){if(body.action==='reset'){if(body.confirmation!=='REINICIAR')reject('Confirme a reinicialização.');const settings=await one(db,'SELECT hour FROM order_number_settings WHERE id=1');const result=await db.batch([stmt(db,"INSERT OR IGNORE INTO cash_order_cycles(cutoff,created_at) SELECT "+cutoff+",? WHERE "+noActive,now()),stmt(db,"UPDATE order_number_settings SET last_day=? WHERE id=1 AND "+noActive,numberDay(settings.hour))]);if(!result[1].meta.changes)reject('Ainda existem pedidos ativos. Finalize a fila antes de reiniciar.',409);}else{if(typeof body.enabled!=='boolean'||![0,4,6].includes(body.hour))reject('Configuração inválida.');await run(db,'UPDATE order_number_settings SET enabled=?,hour=?,last_day=? WHERE id=1',Number(body.enabled),body.hour,numberDay(body.hour));}}return json({settings:await one(db,'SELECT enabled,hour,last_day FROM order_number_settings WHERE id=1')});}
async function displayOrders(db,rows,field='order_no'){
 if(!rows.length)return rows;
 await ensureOrderCycles(db);
 const cycles=await many(db,'SELECT cutoff FROM cash_order_cycles ORDER BY cutoff DESC');
 return rows.map(o=>({...o,[field]:o[field]-(cycles.find(c=>c.cutoff<o[field])?.cutoff||0)}));
}
async function orderResult(db,o){const [display]=await displayOrders(db,[o]);return json({order:{id:o.id,token:o.public_token,number:display.order_no,total_cents:o.total_cents,status:o.status}},201);}

const aggregate=(items,key)=>{const m=new Map();for(const i of items){const k=i[key];if(k)m.set(k,(m.get(k)||0)+i.quantity);}return m;};
async function createOrder(db,body){
 await ensureSodaFlavors(db);await ensureColaAndEnergyFlavors(db);await ensureIncludedVibe(db);await ensureStandaloneRedBulls(db);await ensureNumberSettings(db);
 await applyCatalogPricePatch(db);
 await ensureInternalInventory(db);
 if(body.honeypot||body.age_confirmed!==true)reject('Confirme ter pelo menos 18 anos.');
 const first=text(body.first_name,60),last=text(body.last_name,80),method=body.payment_method;
 if(first.length<2||last.length<2)reject('Informe nome e sobrenome.');
 if(!['cash','card'].includes(method))reject('Pagamento em dinheiro ou cartão na retirada.',409);
 const cash=method==='cash'?body.cash_given_cents:null;
 if(method==='cash'&&!int(cash,1,MAX_MONEY))reject('Informe quanto vai pagar em dinheiro.');
 if(!uuid(body.request_id)||!int(body.expected_total_cents,1,MAX_MONEY))reject('Atualize o cardápio antes de confirmar.');
 const raw=body.items;
 if(!Array.isArray(raw)||raw.length<1||raw.length>30||!raw.every(i=>i&&idOk(i.id)&&int(i.quantity,1,99)&&(i.ice_id==null||idOk(i.ice_id))&&(i.energy_id==null||idOk(i.energy_id))&&(i.shake_alcohol==null||['com','sem'].includes(i.shake_alcohol))))reject('Carrinho inválido.');
 const items=raw.map(i=>({id:i.id,quantity:i.quantity,ice_id:i.ice_id??null,energy_id:i.energy_id??null,...(i.shake_alcohol!=null?{shake_alcohol:i.shake_alcohol}:{})}));
 const fingerprint=await hash(JSON.stringify([first,last,method,cash,body.expected_total_cents,items]));
 const prior=async()=>{const o=await one(db,'SELECT o.*,r.fingerprint FROM order_requests r JOIN orders o ON o.id=r.order_id WHERE r.request_id=?',body.request_id);if(o&&o.fingerprint!==fingerprint)reject('Pedido já utilizado. Confira o acompanhamento.',409);return o;};
 const existing=await prior();if(existing)return orderResult(db,existing);
 const store=await one(db,'SELECT accepting_orders FROM store_settings WHERE id=1');
 if(!store?.accepting_orders)reject('A adega está temporariamente fechada para pedidos.',409);
 await requireNearby(db,body.position);
 const quantities=aggregate(items,'id'),ice=aggregate(items,'ice_id'),energy=aggregate(items,'energy_id');
 for(const [id,qty] of quantities){const opt=standaloneEnergyId(id);if(opt)energy.set(opt,(energy.get(opt)||0)+qty);}
 const ids=[...quantities.keys()],opts=[...new Set([...ice.keys(),...energy.keys()])];
 const placeholders=a=>a.map(()=>'?').join(',');
 const [pp,oo]=await Promise.all([many(db,'SELECT * FROM products WHERE id IN ('+placeholders(ids)+')',...ids),opts.length?many(db,'SELECT * FROM drink_options WHERE id IN ('+placeholders(opts)+')',...opts):[]]);
 const products=new Map(pp.map(p=>[p.id,p])),options=new Map(oo.map(p=>[p.id,p]));
 let total=0,age=false;
 for(const [id,qty] of quantities){const p=products.get(id);if(!p||!visible(p)||!p.active||!int(p.price_cents,1,MAX_MONEY)||qty>99||(!p.unlimited&&p.stock<qty))reject('Produto indisponível ou estoque insuficiente.',409);age||=p.age_restricted;}

 for(const [id,qty] of [...ice,...energy]){const o=options.get(id);if(!o?.active||(!o.unlimited&&o.stock<qty))reject('Gelo ou energético indisponível.',409);}
 const lines=items.map(i=>{
 const p=products.get(i.id),a=options.get(i.ice_id),b=options.get(i.energy_id);
 if(isDoseProduct(p)){if(a?.option_group!=='ice'||b?.option_group!=='energy'||!energyMatchesDose(p,b))reject('Escolha gelo e energético compatíveis.',409);}
 else if(i.ice_id||i.energy_id)reject('Sabores não pertencem ao produto.',409);
 if(p.category==='Batidas'){if(!['com','sem'].includes(i.shake_alcohol))reject('Escolha com ou sem álcool para a batida.',409);}else if(i.shake_alcohol!=null)reject('Preparo inválido para este produto.',409);
 return {...i,name:p.name+(i.shake_alcohol?' | '+(i.shake_alcohol==='com'?'Com álcool':'Sem álcool'):'')+(a?' | Gelo: '+a.name+' | Energético: '+b.name:''),base_name:p.name,category:p.category,base_price:p.price_cents,price:doseUnitPrice(p,b),age:Number(p.age_restricted),product_unlimited:Number(p.unlimited),ice_name:a?.name??null,energy_name:b?.name??null,ice_unlimited:a?Number(a.unlimited):null,energy_unlimited:b?Number(b.unlimited):null};
 });
 total=lines.reduce((sum,line)=>sum+line.price*line.quantity,0);
 if(!int(total,1,MAX_MONEY)||total!==body.expected_total_cents)reject('O preço mudou. Atualize o carrinho e confira o total.',409);
 if(method==='cash'&&cash<total)reject('O valor em dinheiro deve cobrir o total do pedido.',409);
 const oid=crypto.randomUUID(),publicToken=crypto.randomUUID(),date=now(),payload=JSON.stringify(lines);
 const sqlItems="INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price_cents,ice_option_id,energy_option_id) SELECT ?,CASE WHEN p.id IS NOT NULL AND p.active=1 AND p.category=json_extract(j.value,'$.category') AND p.name=json_extract(j.value,'$.base_name') AND p.price_cents=json_extract(j.value,'$.base_price') AND p.age_restricted=json_extract(j.value,'$.age') AND p.unlimited=json_extract(j.value,'$.product_unlimited') AND (p.id NOT LIKE 'redbull-%' OR EXISTS(SELECT 1 FROM drink_options ro WHERE ro.id='energy-'||substr(p.id,9) AND ro.active=1 AND ro.option_group='energy')) AND (json_extract(j.value,'$.ice_id') IS NULL OR (a.active=1 AND a.option_group='ice' AND a.name=json_extract(j.value,'$.ice_name') AND a.unlimited=json_extract(j.value,'$.ice_unlimited'))) AND (json_extract(j.value,'$.energy_id') IS NULL OR (b.active=1 AND b.option_group='energy' AND b.name=json_extract(j.value,'$.energy_name') AND b.unlimited=json_extract(j.value,'$.energy_unlimited'))) THEN p.id ELSE NULL END,json_extract(j.value,'$.name'),json_extract(j.value,'$.quantity'),json_extract(j.value,'$.price'),json_extract(j.value,'$.ice_id'),json_extract(j.value,'$.energy_id') FROM json_each(?) j LEFT JOIN products p ON p.id=json_extract(j.value,'$.id') LEFT JOIN drink_options a ON a.id=json_extract(j.value,'$.ice_id') LEFT JOIN drink_options b ON b.id=json_extract(j.value,'$.energy_id')";
 const stockRows=[...quantities].map(([id,qty])=>({id,qty}));
 const optionRows=[...ice,...energy].map(([id,qty])=>({id,qty}));
 const stockSql=table=>"UPDATE "+table+" SET stock=CASE WHEN unlimited=1 THEN stock ELSE stock-(SELECT SUM(json_extract(j.value,'$.qty')) FROM json_each(?) j WHERE json_extract(j.value,'$.id')="+table+".id) END WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(?))";
 const stocks=JSON.stringify(stockRows),opstocks=JSON.stringify(optionRows);
 try{
 await db.batch([
 ...dailyNumberStatements(db,Date.parse(date)),
 stmt(db,"INSERT INTO orders(id,public_token,first_name,last_name,payment_method,cash_given_cents,total_cents,age_required,created_at,updated_at) VALUES(CASE WHEN (SELECT accepting_orders FROM store_settings WHERE id=1)=1 THEN ? ELSE NULL END,?,?,?,?,?,?,?,?,?)",oid,publicToken,first,last,method,cash,total,Number(age),date,date),
 stmt(db,sqlItems,oid,payload),
 stmt(db,"INSERT INTO stock_reservations(order_id,kind,item_id,quantity) SELECT ?,'product',p.id,SUM(json_extract(j.value,'$.qty')) FROM json_each(?) j JOIN products p ON p.id=json_extract(j.value,'$.id') WHERE p.unlimited=0 GROUP BY p.id UNION ALL SELECT ?,'option',o.id,SUM(json_extract(j.value,'$.qty')) FROM json_each(?) j JOIN drink_options o ON o.id=json_extract(j.value,'$.id') WHERE o.unlimited=0 GROUP BY o.id",oid,stocks,oid,opstocks),
 stmt(db,stockSql('products'),stocks,stocks),
 stmt(db,stockSql('drink_options'),opstocks,opstocks),
 stmt(db,"INSERT INTO order_requests(request_id,fingerprint,order_id) VALUES(?,?,?)",body.request_id,fingerprint,oid)
 ]);
 }catch(e){const duplicate=await prior();if(duplicate)return orderResult(db,duplicate);if(/constraint|PRODUTO_INDISPONIVEL/i.test(String(e.message)))reject('Preço, estoque ou disponibilidade mudou. Atualize o carrinho.',409);throw e;}
 const saved=await one(db,'SELECT * FROM orders WHERE id=?',oid);if(!saved)throw Error('order missing');
 return orderResult(db,saved);
}
async function cancel(db,id,restoreStock=true,customerToken=null){
 if(!uuid(id))reject('Pedido inválido.');
 const customer=customerToken!==null;
 const condition=customer?"id=? AND public_token=? AND status='received' AND payment_status='pending'":"id=? AND status IN ('received','preparing','ready') AND payment_status<>'paid'";
 const args=customer?[id,customerToken]:[id];
 const eligible="EXISTS(SELECT 1 FROM orders WHERE "+condition+")";
 const a=stmt(db,"UPDATE products SET stock=stock+(SELECT quantity FROM stock_reservations WHERE order_id=? AND kind='product' AND item_id=products.id) WHERE id IN (SELECT item_id FROM stock_reservations WHERE order_id=? AND kind='product') AND "+eligible,id,id,...args);
 const b=stmt(db,"UPDATE drink_options SET stock=stock+(SELECT quantity FROM stock_reservations WHERE order_id=? AND kind='option' AND item_id=drink_options.id) WHERE id IN (SELECT item_id FROM stock_reservations WHERE order_id=? AND kind='option') AND "+eligible,id,id,...args);
 const c=stmt(db,"UPDATE orders SET status='cancelled',updated_at=? WHERE "+condition,now(),...args);
 const result=await db.batch(restoreStock?[a,b,c]:[c]);
 if(!result[result.length-1].meta.changes)reject(customer?'O pedido já começou a ser preparado, foi pago ou encerrado. Fale com o atendente.':'Pedido encerrado ou pago. Pedido pago exige estorno.',409);
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
 case 'finishcash':
 case 'finishcard':
 if(body.received!==true)reject('Confirme o recebimento do pagamento e a entrega.');
 sql="status='delivered',payment_status='paid',paid_at=COALESCE(paid_at,?),age_checked=CASE WHEN age_required=1 AND ?=1 THEN 1 ELSE age_checked END,updated_at=? WHERE id=? AND status='ready' AND payment_method=? AND payment_status IN ('pending','paid') AND (age_required=0 OR age_checked=1 OR ?=1)";
 args=[date,body.age_confirmed===true,date,body.id,body.action==='finishcard'?'card':'cash',body.age_confirmed===true];break;
 case 'status':
 if(body.value==='preparing'){sql="status='preparing',updated_at=? WHERE id=? AND status='received'";if(body.solo===true)sql+=" AND (payment_method IN ('cash','card') OR payment_status='paid') AND NOT EXISTS (SELECT 1 FROM orders AS active WHERE active.status='preparing')";args=[date,body.id];}
 else if(body.value==='ready'){sql="status='ready',ready_at=?,updated_at=? WHERE id=? AND status IN ('received','preparing')";args=[date,date,body.id];}
 else if(body.value==='delivered'){sql="status='delivered',updated_at=? WHERE id=? AND status='ready' AND payment_status='paid' AND (age_required=0 OR age_checked=1) AND (payment_method<>'pix' OR receipt_checked=1)";args=[date,body.id];}
 else reject('Status inválido.');break;
 default:reject('Ação inválida.');
 }
 const order=await one(db,'UPDATE orders SET '+sql+' RETURNING *',...args);
 if(!order)reject('Ação bloqueada. Confira pagamento, documento e situação do pedido.',409);
 const [display]=await displayOrders(db,[order]);return json({order:display});
}
async function orders(db){
 const list=await many(db,"SELECT * FROM orders WHERE status IN ('received','preparing','ready') ORDER BY created_at DESC,order_no DESC LIMIT 250");
 const demand=await demandStatus(db);
 await ensureCashArchive(db);
 const {start,end}=cashDay();
 const service_metrics=await one(db,"SELECT COUNT(*) AS count,AVG((julianday(ready_at)-julianday(created_at))*86400) AS average_seconds FROM orders o WHERE status IN ('ready','delivered') AND ready_at>=? AND ready_at<? AND julianday(ready_at)>=julianday(created_at) AND NOT EXISTS(SELECT 1 FROM cash_archived_orders a JOIN cash_batches b ON b.id=a.batch_id WHERE a.order_id=o.id AND b.kind='test')",start,end);
 if(!list.length)return json({orders:[],...demand,service_metrics});
 const ids=JSON.stringify(list.map(o=>o.id));
 const lines=await many(db,'SELECT i.order_id,i.product_id,i.product_name,i.quantity,i.unit_price_cents,i.ice_option_id,i.energy_option_id,p.category,p.image_url FROM order_items i LEFT JOIN products p ON p.id=i.product_id WHERE i.order_id IN (SELECT value FROM json_each(?)) ORDER BY i.id',ids);
 const groups=new Map();for(const i of lines){if(!groups.has(i.order_id))groups.set(i.order_id,[]);groups.get(i.order_id).push(i);}
 const same=duplicateNames(list);return json({orders:(await displayOrders(db,list)).map(({public_token,...o})=>({...o,duplicate_name:same.has(pickupNameKey(o)),order_items:groups.get(o.id)||[]})),...demand,service_metrics});
}
async function ensureCashArchive(db){
 await run(db,"CREATE TABLE IF NOT EXISTS cash_batches (id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('closed','test')),created_at TEXT NOT NULL)");
 await run(db,"CREATE TABLE IF NOT EXISTS cash_archived_orders (order_id TEXT PRIMARY KEY REFERENCES orders(id),batch_id TEXT NOT NULL REFERENCES cash_batches(id))");
 await run(db,'CREATE INDEX IF NOT EXISTS idx_cash_archive_batch ON cash_archived_orders(batch_id)');
}
const cashDay=()=>{const day=new Date(Date.now()-3*3600000).toISOString().slice(0,10),start=day+'T03:00:00.000Z';return {day,start,end:new Date(Date.parse(start)+86400000).toISOString()};};
const activeCashFilter="payment_status='paid' AND paid_at>=? AND paid_at<? AND NOT EXISTS(SELECT 1 FROM cash_archived_orders a WHERE a.order_id=orders.id)";
async function archiveCash(db,body){
 await ensureCashArchive(db);
 const kind=body.kind;
 if(!['closed','test'].includes(kind)||body.confirmation!==(kind==='test'?'TESTE':'FECHAR'))reject('Confirme a operação.');
 if(!Array.isArray(body.ids)||!body.ids.length||body.ids.length>500||!body.ids.every(uuid)||new Set(body.ids).size!==body.ids.length)reject('Selecione pedidos válidos do movimento atual.');
 const {start,end}=cashDay(),ids=JSON.stringify(body.ids);
 const filter=activeCashFilter+" AND id IN (SELECT value FROM json_each(?))"+(kind==='test'?" AND status='delivered' AND payment_method='cash'":"");
 const eligible=await one(db,'SELECT COUNT(*) AS n FROM orders WHERE '+filter,start,end,ids);
 if(eligible.n!==body.ids.length)reject('O movimento mudou ou há pedidos não elegíveis. Atualize o caixa.',409);
 const id=crypto.randomUUID(),date=now(),guard=kind==='closed'?' AND (SELECT COUNT(*) FROM orders WHERE '+activeCashFilter+')=?':'';
 try{
 await db.batch([
 stmt(db,'INSERT INTO cash_batches(id,kind,created_at) VALUES(?,?,?)',id,kind,date),
 stmt(db,'INSERT INTO cash_archived_orders(order_id,batch_id) SELECT value,CASE WHEN (SELECT COUNT(*) FROM orders WHERE '+filter+')=?'+guard+' THEN ? ELSE NULL END FROM json_each(?)',start,end,ids,body.ids.length,...(kind==='closed'?[start,end,body.ids.length]:[]),id,ids)
 ]);
 }catch(e){reject('O movimento mudou. Atualize o caixa e tente novamente.',409);}
 return json({ok:true,batch_id:id,count:body.ids.length});
}
async function resetCash(db,body){
 if(body.confirmation!=='ZERAR'||!int(body.paid_count,0,100000000)||!int(body.active_count,0,100000000))reject('Confirme os valores exibidos antes de zerar.');
 await ensureCashArchive(db);await ensureOrderCycles(db);
 const {start,end}=cashDay(),date=now(),id=crypto.randomUUID();
 const active="status IN ('received','preparing','ready')";
 const pending=active+" AND payment_status<>'paid'";
 const received="o.status='received' AND o.payment_status<>'paid'";
 const valid="(SELECT accepting_orders FROM store_settings WHERE id=1)=0 AND NOT EXISTS(SELECT 1 FROM orders WHERE "+active+" AND payment_status='paid') AND (SELECT COUNT(*) FROM orders WHERE "+pending+")=? AND (SELECT COUNT(*) FROM orders WHERE "+activeCashFilter+")=?";
 const restore=(table,kind)=>stmt(db,"UPDATE "+table+" SET stock=stock+(SELECT SUM(r.quantity) FROM stock_reservations r JOIN orders o ON o.id=r.order_id WHERE r.kind=? AND r.item_id="+table+".id AND "+received+") WHERE id IN (SELECT r.item_id FROM stock_reservations r JOIN orders o ON o.id=r.order_id WHERE r.kind=? AND "+received+")",kind,kind);
 try{
 await db.batch([
 stmt(db,"INSERT OR REPLACE INTO cash_order_cycles(cutoff,created_at) VALUES(CASE WHEN "+valid+" THEN MAX(COALESCE((SELECT seq FROM sqlite_sequence WHERE name='orders'),0),COALESCE((SELECT MAX(order_no) FROM orders),0)) ELSE NULL END,?)",body.active_count,start,end,body.paid_count,date),
 stmt(db,"INSERT INTO cash_batches(id,kind,created_at) SELECT ?,'closed',? WHERE EXISTS(SELECT 1 FROM orders WHERE "+activeCashFilter+")",id,date,start,end),
 stmt(db,"INSERT INTO cash_archived_orders(order_id,batch_id) SELECT id,? FROM orders WHERE "+activeCashFilter,id,start,end),
 restore('products','product'),restore('drink_options','option'),
 stmt(db,"UPDATE orders SET status='cancelled',updated_at=? WHERE "+pending,date)
 ]);
 }catch(e){reject('Não foi possível zerar. Pause a loja, finalize os pedidos pagos e atualize o caixa antes de tentar novamente.',409);}
 return json({ok:true,archived:body.paid_count,cancelled:body.active_count,next_number:1});
}
async function cashArchive(db,body){
 if(!uuid(body.id))reject('Relatório inválido.');
 await ensureCashArchive(db);
 const batch=await one(db,'SELECT * FROM cash_batches WHERE id=?',body.id);if(!batch)missing();
 const transactions=await many(db,'SELECT o.id,o.order_no,o.first_name,o.last_name,o.payment_method,o.total_cents,o.paid_at FROM orders o JOIN cash_archived_orders a ON a.order_id=o.id WHERE a.batch_id=? ORDER BY o.paid_at DESC',batch.id);
 return json({batch,transactions:await displayOrders(db,transactions),day:batch.created_at.slice(0,10),paid_count:transactions.length});
}
async function readDemand(db){
 await run(db,'CREATE TABLE IF NOT EXISTS tv_demand (id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL CHECK(enabled IN (0,1)))');
 return Boolean((await one(db,'SELECT enabled FROM tv_demand WHERE id=1'))?.enabled);
}
async function demandStatus(db){
 const manual=await readDemand(db);
 const {qty}=await one(db,"SELECT COUNT(*) AS qty FROM orders WHERE status IN ('received','preparing')");
 return {high_demand:manual||qty>5,demand_manual:manual,demand_count:qty};
}
async function saveDemand(db,body){
 if(typeof body.enabled!=='boolean')reject('Informe o estado do aviso.');
 await readDemand(db);
 await run(db,'INSERT INTO tv_demand(id,enabled) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled',body.enabled);
 return json(await demandStatus(db));
}
async function cashReport(db){
 await ensureCashArchive(db);
 const {day,start,end}=cashDay();
 const filter=activeCashFilter;
 const [methods,items,transactions,pending,active,store]=await Promise.all([
 many(db,'SELECT payment_method,COUNT(*) AS qty,SUM(total_cents) AS total FROM orders WHERE '+filter+' GROUP BY payment_method',start,end),
 many(db,'SELECT i.product_name AS name,SUM(i.quantity) AS quantity,SUM(i.quantity*i.unit_price_cents) AS total_cents FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.payment_status=\'paid\' AND o.paid_at>=? AND o.paid_at<? AND NOT EXISTS(SELECT 1 FROM cash_archived_orders a WHERE a.order_id=o.id) GROUP BY i.product_name ORDER BY quantity DESC',start,end),
 many(db,'SELECT id,order_no,first_name,last_name,payment_method,total_cents,paid_at,status FROM orders WHERE '+filter+' ORDER BY paid_at DESC LIMIT 500',start,end),
 one(db,"SELECT COUNT(*) AS qty FROM orders WHERE payment_status='pending' AND status<>'cancelled' AND created_at>=? AND created_at<?",start,end),
 one(db,"SELECT COUNT(*) AS qty,COALESCE(SUM(CASE WHEN payment_status='paid' THEN 1 ELSE 0 END),0) AS paid FROM orders WHERE status IN ('received','preparing','ready')"),
 one(db,'SELECT accepting_orders FROM store_settings WHERE id=1')
 ]);
 const totals={cash:0,card:0,pix:0,apple:0,google:0};let paid_count=0,total_cents=0;for(const m of methods){totals[m.payment_method]=m.total;paid_count+=m.qty;total_cents+=m.total;}
 const archives=await many(db,'SELECT b.id,b.kind,b.created_at,COUNT(*) AS qty,SUM(o.total_cents) AS total_cents FROM cash_batches b JOIN cash_archived_orders a ON a.batch_id=b.id JOIN orders o ON o.id=a.order_id GROUP BY b.id,b.kind,b.created_at ORDER BY b.created_at DESC,b.id DESC LIMIT 100');
 return json({day,paid_count,pending_count:pending.qty,total_cents,item_count:items.reduce((n,i)=>n+i.quantity,0),by_method:totals,products:items,transactions:await displayOrders(db,transactions),archives,truncated:paid_count>500,active_count:active.qty,paid_active_count:active.paid,accepting_orders:Boolean(store?.accepting_orders)});
}
async function patchRow(db,table,id,patch){
 const fields=Object.keys(patch);if(!fields.length)reject('Nenhuma alteração informada.');
 const r=await one(db,'UPDATE '+table+' SET '+fields.map(k=>k+'=?').join(',')+' WHERE id=? RETURNING *',...fields.map(k=>patch[k]),id);if(!r)missing();return r;
}
function productPatch(body,creating=false){
 const p={};
 if(creating||body.name!==undefined){const n=text(body.name,121);if(n.length<2||n.length>120)reject('Nome inválido.');p.name=n;}
 if(creating||body.category!==undefined){if(!cats.has(body.category))reject('Categoria inválida.');p.category=body.category;}
 if(creating||body.price_cents!==undefined){if(!int(body.price_cents,0,MAX_MONEY))reject('Preço inválido.');p.price_cents=body.price_cents;}
 for(const k of ['active','unlimited','age_restricted'])if(body[k]!==undefined){if(typeof body[k]!=='boolean')reject('Configuração inválida.');p[k]=body[k];}
 if(body.description!==undefined){p.description=text(body.description,450);}
 if(body.icon!==undefined)p.icon=text(body.icon,6);
 if(body.image_url!==undefined){const v=text(body.image_url,1201);if(v&&(v.length>1200||!validPhoto(v)))reject('URL da foto inválida.');p.image_url=v||null;}
 if(body.sort_order!==undefined){if(!int(body.sort_order,-100000,100000))reject('Ordem inválida.');p.sort_order=body.sort_order;}
 return p;
}
async function productsAdmin(db,body,method){
 const p=productPatch(body,method==='POST');
 if(method==='POST'){
 if(!int(body.stock,0,MAX_STOCK))reject('Estoque inválido.');
 const data={...p,id:crypto.randomUUID(),stock:body.stock,active:false,created_at:now()};
 const keys=Object.keys(data),saved=await one(db,'INSERT INTO products('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+') RETURNING *',...keys.map(k=>data[k]));
 return json({product:saved},201);
 }
 if(!idOk(body.id))reject('Produto inválido.');
 const old=await one(db,'SELECT name,category FROM products WHERE id=?',body.id);if(!old)missing();if(standaloneEnergyId(body.id)&&p.unlimited===true)reject('Red Bull avulso utiliza estoque físico compartilhado.',409);
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
async function ensureReviews(db){
 await run(db,"CREATE TABLE IF NOT EXISTS store_reviews (id TEXT PRIMARY KEY,order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),comment TEXT NOT NULL DEFAULT '',display_name TEXT NOT NULL DEFAULT 'Cliente',comment_hidden INTEGER NOT NULL DEFAULT 0 CHECK(comment_hidden IN (0,1)),created_at TEXT NOT NULL)");
}
async function publicReviews(db){
 await ensureReviews(db);
 const summary=await one(db,'SELECT COUNT(*) AS count,COALESCE(AVG(rating),0) AS average FROM store_reviews');
 const reviews=await many(db,"SELECT display_name,rating,CASE WHEN comment_hidden=1 THEN '' ELSE comment END AS comment,created_at FROM store_reviews ORDER BY created_at DESC,id DESC LIMIT 24");
 return json({summary,reviews});
}
async function submitReview(db,body){
 if(!uuid(body.id)||!uuid(body.token)||!int(body.rating,1,5)||typeof body.comment!=='string'||body.comment.length>500||typeof body.share_name!=='boolean')reject('Avaliação inválida. Confira as estrelas e o comentário.');
 const order=await one(db,'SELECT id,first_name,status,payment_status FROM orders WHERE id=? AND public_token=?',body.id,body.token);
 if(!order)missing();
 if(order.status!=='delivered'||order.payment_status!=='paid')reject('Avalie após a finalização do pedido.',409);
 await ensureReviews(db);
 const result=await run(db,'INSERT INTO store_reviews(id,order_id,rating,comment,display_name,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(order_id) DO NOTHING',crypto.randomUUID(),order.id,body.rating,body.comment.trim(),body.share_name?order.first_name:'Cliente',now());
 if(!result.meta.changes)reject('Este pedido já foi avaliado.',409);
 return json({ok:true},201);
}

const auditSchema=[
 "CREATE TABLE IF NOT EXISTS audit_events (id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,entity TEXT NOT NULL,field TEXT NOT NULL,old_value TEXT,new_value TEXT,created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))",
 "CREATE INDEX IF NOT EXISTS idx_audit_kind_id ON audit_events(kind,id)",
 "CREATE TRIGGER IF NOT EXISTS audit_price AFTER UPDATE OF price_cents ON products WHEN OLD.price_cents IS NOT NEW.price_cents BEGIN INSERT INTO audit_events(kind,entity,field,old_value,new_value) VALUES('price',NEW.name,'price_cents',OLD.price_cents,NEW.price_cents); END",
 "CREATE TRIGGER IF NOT EXISTS audit_stock AFTER UPDATE OF stock ON products WHEN OLD.stock IS NOT NEW.stock BEGIN INSERT INTO audit_events(kind,entity,field,old_value,new_value) VALUES('stock',NEW.name,'stock',OLD.stock,NEW.stock); END",
 "CREATE TRIGGER IF NOT EXISTS audit_option_stock AFTER UPDATE OF stock ON drink_options WHEN OLD.stock IS NOT NEW.stock BEGIN INSERT INTO audit_events(kind,entity,field,old_value,new_value) VALUES('stock',NEW.name,'stock',OLD.stock,NEW.stock); END",
 "CREATE TRIGGER IF NOT EXISTS audit_active AFTER UPDATE OF active ON products WHEN OLD.active IS NOT NEW.active BEGIN INSERT INTO audit_events(kind,entity,field,old_value,new_value) VALUES('product',NEW.name,'active',OLD.active,NEW.active); END",
 "CREATE TRIGGER IF NOT EXISTS audit_unlimited AFTER UPDATE OF unlimited ON products WHEN OLD.unlimited IS NOT NEW.unlimited BEGIN INSERT INTO audit_events(kind,entity,field,old_value,new_value) VALUES('product',NEW.name,'unlimited',OLD.unlimited,NEW.unlimited); END",
 "CREATE TRIGGER IF NOT EXISTS audit_option_active AFTER UPDATE OF active ON drink_options WHEN OLD.active IS NOT NEW.active BEGIN INSERT INTO audit_events(kind,entity,field,old_value,new_value) VALUES('product',NEW.name,'active',OLD.active,NEW.active); END",
 "CREATE TRIGGER IF NOT EXISTS audit_store AFTER UPDATE OF accepting_orders ON store_settings WHEN OLD.accepting_orders IS NOT NEW.accepting_orders BEGIN INSERT INTO audit_events(kind,entity,field,old_value,new_value) VALUES('store',NEW.name,'accepting_orders',OLD.accepting_orders,NEW.accepting_orders); END",
 "CREATE TRIGGER IF NOT EXISTS audit_cancel AFTER UPDATE OF status ON orders WHEN OLD.status IS NOT NEW.status AND NEW.status='cancelled' BEGIN INSERT INTO audit_events(kind,entity,field,old_value,new_value) VALUES('cancel','Pedido #' || NEW.order_no,'status',OLD.status,NEW.status); END",
 "CREATE TRIGGER IF NOT EXISTS audit_paid AFTER UPDATE OF payment_status ON orders WHEN OLD.payment_status IS NOT NEW.payment_status BEGIN INSERT INTO audit_events(kind,entity,field,old_value,new_value) VALUES('cash','Pedido #' || NEW.order_no,'payment_status',OLD.payment_status,NEW.payment_status); END",
 "CREATE TRIGGER IF NOT EXISTS audit_delivered AFTER UPDATE OF status ON orders WHEN OLD.status IS NOT NEW.status AND NEW.status='delivered' BEGIN INSERT INTO audit_events(kind,entity,field,old_value,new_value) VALUES('cash','Pedido #' || NEW.order_no,'status',OLD.status,NEW.status); END",
 "CREATE TRIGGER IF NOT EXISTS audit_product_created AFTER INSERT ON products BEGIN INSERT INTO audit_events(kind,entity,field,new_value) VALUES('product',NEW.name,'cadastro','Produto cadastrado'); END",
 "CREATE TRIGGER IF NOT EXISTS audit_cash_archive AFTER INSERT ON cash_batches BEGIN INSERT INTO audit_events(kind,entity,field,new_value) VALUES('cash','Movimento ' || substr(NEW.id,1,8),'archive',NEW.kind); END"
];
const auditReady=new WeakMap();
async function ensureAudit(db){
 if(auditReady.has(db))return auditReady.get(db);
 const promise=(async()=>{await ensureCashArchive(db);for(const sql of auditSchema)await run(db,sql);})();
 auditReady.set(db,promise);try{await promise;}catch(e){auditReady.delete(db);throw e;}
}
async function auditList(db,body){
 const kind=body.kind||'',before=body.before;
 if(!['','price','stock','cancel','cash','product','store'].includes(kind)||(before!==null&&before!==undefined&&!int(before,1,Number.MAX_SAFE_INTEGER)))reject('Filtro inválido.');
 await ensureAudit(db);
 const conditions=[],args=[];if(kind){conditions.push('kind=?');args.push(kind);}if(before){conditions.push('id<?');args.push(before);}
 const events=await many(db,'SELECT id,kind,entity,field,old_value,new_value,created_at FROM audit_events'+(conditions.length?' WHERE '+conditions.join(' AND '):'')+' ORDER BY id DESC LIMIT 51',...args);
 const more=events.length>50;const rows=events.slice(0,50);
 return json({events:rows,next_cursor:more?rows[rows.length-1].id:null});
}

async function handler(request,env,ctx){
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
 if(route==='admin-audit'&&method==='POST')return auditList(db,body);
 if((route==='create-order'&&method==='POST')||(['admin-products','admin-stock','admin-drink-options','admin-cancel','admin-order-action','admin-cash-archive','admin-cash-reset','admin-settings'].includes(route)&&['POST','PATCH'].includes(method)))await ensureAudit(db);
 if(route==='admin-logout'&&method==='POST'){await run(db,'DELETE FROM admin_sessions WHERE token_hash=?',session);return json({ok:true});}
 if(route==='health'&&method==='GET'){const row=await one(db,'SELECT id FROM store_settings WHERE id=1');if(!row)reject('Banco não inicializado.',503);await one(db,'SELECT COUNT(*) AS n FROM sqlite_master WHERE type=\'table\' AND name IN (\'order_requests\',\'stock_reservations\',\'rate_limits\',\'product_photos\')').then(x=>{if(x.n!==4)reject('Complete a instalação do banco D1.',503);});return json({ok:true,database:'D1',online_enabled:false});}
 if(route==='catalog'&&method==='GET')return catalog(db,false);
 if(route==='check-location'&&method==='POST'){await rate(db,request,'location',60,300);return json(await nearbyResult(db,body.position));}
 if(route==='push-key'&&method==='GET'){await rate(db,request,'push-key',60,300);return json({public_key:(await keysFor(db)).publicKey});}
 if(route==='order-push'&&method==='POST'){if(!uuid(body.id)||!uuid(body.token)||!validSubscription(body.subscription))reject('Permissão inválida.');await rate(db,request,'order-push',60,300);const o=await one(db,"SELECT id,status FROM orders WHERE id=? AND public_token=?",body.id,body.token);if(!o)missing();if(!['received','preparing','ready'].includes(o.status))return json({registered:false});await bindPush(db,o.id,body.subscription);const task=notifyReady(db,o.id,new URL(request.url).origin).catch(()=>false);if(ctx?.waitUntil)ctx.waitUntil(task);else await task;return json({registered:true});}
 if(route==='admin-catalog'&&method==='GET')return catalog(db,true);
 if(route==='reviews'&&method==='GET')return publicReviews(db);
 if(route==='review'&&method==='POST'){await rate(db,request,'review',20,300);return submitReview(db,body);}
 if(route==='admin-reviews'&&method==='GET'){await ensureReviews(db);return json({reviews:await displayOrders(db,await many(db,'SELECT r.id,r.rating,r.comment,r.display_name,r.comment_hidden,r.created_at,o.order_no FROM store_reviews r JOIN orders o ON o.id=r.order_id ORDER BY r.created_at DESC,r.id DESC LIMIT 200'))});}
 if(route==='admin-reviews'&&method==='PATCH'){
  if(!uuid(body.id)||typeof body.comment_hidden!=='boolean')reject('Avaliação inválida.');
  await ensureReviews(db);
  const review=await one(db,'UPDATE store_reviews SET comment_hidden=? WHERE id=? RETURNING id',body.comment_hidden,body.id);
  if(!review)missing();return json({ok:true});
 }
 if(route==='cancel-order'&&method==='POST'){
 if(!uuid(body.id)||!uuid(body.token))reject('Pedido inválido.');
 await rate(db,request,'customer-cancel',30,300);
 const o=await one(db,'SELECT id,status FROM orders WHERE id=? AND public_token=?',body.id,body.token);
 if(!o)missing();
 if(o.status==='cancelled')return json({ok:true});
 await ensureAudit(db);
 const r=await cancel(db,body.id,true,body.token);
 const task=removePush(db,body.id).catch(()=>{});if(ctx?.waitUntil)ctx.waitUntil(task);else await task;
 return r;
 }
 if(route==='track'&&method==='POST'){
 if(!uuid(body.id)||!uuid(body.token))reject('Acompanhamento inválido.');
 const order=await one(db,'SELECT id,order_no,first_name,last_name,status,payment_status,total_cents,payment_method,created_at,updated_at,ready_at FROM orders WHERE id=? AND public_token=?',body.id,body.token);if(!order)missing();let reviewed=false;if(order.status==='delivered'){await ensureReviews(db);reviewed=Boolean(await one(db,'SELECT id FROM store_reviews WHERE order_id=?',order.id));}if(order.status==='ready'){const task=notifyReady(db,order.id,url.origin).catch(()=>false);if(ctx?.waitUntil)ctx.waitUntil(task);else await task;}const [display]=await displayOrders(db,[order]);const repeat_items=order.status==='delivered'?await many(db,"SELECT product_id AS id,quantity,ice_option_id AS ice_id,energy_option_id AS energy_id,CASE WHEN product_name LIKE '% | Com álcool' THEN 'com' WHEN product_name LIKE '% | Sem álcool' THEN 'sem' ELSE NULL END AS shake_alcohol FROM order_items WHERE order_id=? ORDER BY id",order.id):[];return json({high_demand:['received','preparing'].includes(order.status)?(await demandStatus(db)).high_demand:false,order:{...display,reviewed,repeat_items}});
 }
 if(route==='tv'&&method==='GET'){
 if(!env.TV_PASSCODE||env.TV_PASSCODE.length<12)reject('Configure TV_PASSCODE.',503);
 if(!await equal(request.headers.get('X-TV-Code'),env.TV_PASSCODE)){await rate(db,request,'tv',10,300);reject('Código da TV incorreto.',403);}
 const orders=await many(db,"SELECT id,order_no AS number,first_name,last_name,status,voice,ready_at,created_at FROM orders WHERE status IN ('received','preparing','ready') ORDER BY created_at ASC,order_no ASC LIMIT 250");
 const outOfSequence=await one(db,"SELECT EXISTS(SELECT 1 FROM orders newer WHERE newer.status IN ('ready','delivered') AND newer.order_no>(SELECT MIN(order_no) FROM orders WHERE status IN ('received','preparing'))) AS active");
 return json({orders:(await displayOrders(db,orders,'number')).map(o=>({...o,public_name:o.first_name+' '+o.last_name})),out_of_sequence:Boolean(outOfSequence?.active),...await demandStatus(db)});
 }
 if(route==='recover-order'&&method==='POST'){if(!uuid(body.request_id))reject('Pedido inválido.');const order=await one(db,'SELECT o.* FROM order_requests r JOIN orders o ON o.id=r.order_id WHERE r.request_id=?',body.request_id);if(!order)return json({order:null});return orderResult(db,order);}
 if(route==='create-order'&&method==='POST'){await rate(db,request,'order',30,300);const result=await createOrder(db,body);if(validSubscription(body.subscription)){try{const {order}=await result.clone().json();await bindPush(db,order.id,body.subscription);}catch{/* The order is already saved; notifications are optional. */}}return result;}
 if(route==='admin-order-number'&&method==='GET')return numberSettings(db);
 if(route==='admin-order-number'&&method==='POST')return numberSettings(db,body);
 if(route==='admin-orders'&&method==='GET')return orders(db);
 if(route==='admin-cash'&&method==='GET')return cashReport(db);
 if(route==='admin-cash-archive'&&method==='POST')return archiveCash(db,body);
 if(route==='admin-cash-reset'&&method==='POST')return resetCash(db,body);
 if(route==='admin-cash-report'&&method==='POST')return cashArchive(db,body);
 if(route==='admin-demand'&&method==='PATCH')return saveDemand(db,body);
 if(route==='admin-products'&&['POST','PATCH'].includes(method)){await applyCatalogPricePatch(db);await ensureInternalInventory(db);return productsAdmin(db,body,method);}
 if(route==='admin-photo'&&method==='POST')return photo(db,body);
 if(route==='admin-drink-options'&&method==='PATCH'){
 if(!idOk(body.id))reject('Sabor inválido.');if(body.id==='energy-99'){await ensureIncludedVibe(db);if(body.stock!==undefined)reject('Vibe não possui controle individual de estoque.',409);}const p={};
 if(body.active!==undefined){if(typeof body.active!=='boolean')reject('Status inválido.');p.active=body.active;}
 if(body.stock!==undefined){if(!int(body.stock,0,MAX_STOCK))reject('Estoque inválido.');p.stock=body.stock;}
 return json({option:await patchRow(db,'drink_options',body.id,p)});
 }
 if(route==='admin-stock'&&method==='POST'){
 if(!idOk(body.id)||!['set','add'].includes(body.mode)||!int(body.quantity,0,MAX_STOCK))reject('Estoque inválido.');
 const product=await one(db,'UPDATE products SET stock='+ (body.mode==='add'?'stock+?':'?')+' WHERE id=? AND '+(body.mode==='add'?'stock+?<=1000000':'1=1')+' RETURNING *',...([body.quantity,body.id,...(body.mode==='add'?[body.quantity]:[])]));if(!product)reject('Produto inexistente ou limite de estoque.',409);return json({product});
 }
 if(route==='admin-location'&&method==='PATCH')return savePickupLocation(db,body);
 if(route==='admin-settings'&&method==='PATCH'){
 const p={};if(body.name!==undefined){p.name=text(body.name,101);if(p.name.length<3||p.name.length>100)reject('Nome inválido.');}
 if(body.accepting_orders!==undefined){if(typeof body.accepting_orders!=='boolean')reject('Status inválido.');p.accepting_orders=body.accepting_orders;}
 if(body.low_stock_threshold!==undefined){if(!int(body.low_stock_threshold,0,1000))reject('Limite inválido.');p.low_stock_threshold=body.low_stock_threshold;}
 return json({store:await patchRow(db,'store_settings',1,p)});
 }
 if(route==='admin-order-action'&&method==='POST'){const r=await orderAction(db,body);const ready=body.action==='status'&&body.value==='ready',done=['finishcash','finishcard'].includes(body.action)||(body.action==='status'&&body.value==='delivered');if(ready||done){const task=(ready?notifyReady(db,body.id,new URL(request.url).origin):removePush(db,body.id)).catch(()=>{});if(ctx?.waitUntil)ctx.waitUntil(task);else await task;}return r;}
 if(route==='admin-cancel'&&method==='POST'){if(body.restore_stock!==undefined&&typeof body.restore_stock!=='boolean')reject('Informe se o estoque deve ser devolvido.');const r=await cancel(db,body.id,body.restore_stock!==false);const task=removePush(db,body.id).catch(()=>{});if(ctx?.waitUntil)ctx.waitUntil(task);else await task;return r;}
 return json({error:'Rota não encontrada.'},404);
}
export default {async fetch(request,env,ctx){try{return await handler(request,env,ctx);}catch(e){if(e instanceof ApiError)return json({error:e.message},e.status);console.error('ADEGA D1:',String(e?.message||e));return json({error:'Falha no servidor. Tente novamente sem repetir o pedido.'},503);}}};
