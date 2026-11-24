const {chromium,webkit,devices}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../public');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png'};
const product={id:'produto-061',name:'Água',category:'Águas e Refrigerantes',description:'Água mineral',price_cents:250,stock:10,active:true,unlimited:false,age_restricted:false,image_url:'/imagens/agua.webp'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api'||url.pathname==='/api/admin-login'){
  if(url.searchParams.get('route')==='catalog'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({store:{name:'Hora Extra Drinks',accepting_orders:true},products:[product],drink_options:[],best_sellers:[]}));}
  if(url.searchParams.get('route')==='tv'){const ok=req.headers['x-tv-code']==='local-tv-valid-code';res.writeHead(ok?200:403,{'Content-Type':'application/json'});return res.end(JSON.stringify(ok?{orders:[]}:{error:'Código da TV incorreto.'}));}
  if(url.pathname==='/api/admin-login'||url.searchParams.get('route')==='login'){let data='';req.on('data',chunk=>data+=chunk);req.on('end',()=>{const body=JSON.parse(data);const ok=body.password==='local-admin-valid-code';res.writeHead(ok?200:401,{'Content-Type':'application/json'});res.end(JSON.stringify(ok?{token:'local-session',expires_at:Math.floor(Date.now()/1000)+3600}:{error:'Usuário ou senha incorretos.'}));});return;}
  if(url.searchParams.get('route')==='admin-orders'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({orders:[]}));}
  if(url.searchParams.get('route')==='admin-catalog'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({store:{name:'Hora Extra Drinks',accepting_orders:true,low_stock_threshold:5},products:[product],drink_options:[],drink_options_ready:true}));}
  res.writeHead(403,{'Content-Type':'application/json'});return res.end('{}');
 }
 const filename=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!filename.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 try{const b=fs.readFileSync(filename);res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end();}
});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 try{
 for(const [engine,device,width,height] of [[chromium,'Pixel 7',360,800],[webkit,'iPhone 13',390,844],[webkit,'iPhone SE',320,568]]){
  const browser=await engine.launch({headless:true});
  try{
   const ctx=await browser.newContext({...devices[device],viewport:{width,height}});
   const page=await ctx.newPage();await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
   await page.addInitScript(()=>{sessionStorage.setItem('adega_age_ok','1');sessionStorage.setItem('adega_customer_profile_v1',JSON.stringify({first:'Bruna',last:'Teste'}));});
   await page.goto(origin);await page.locator('#productGrid .product').first().waitFor();
   const dimensions=await page.evaluate(()=>({actual:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
   assert.ok(dimensions.actual<=dimensions.viewport+2,device+' catálogo '+JSON.stringify(dimensions));
   assert.equal(await page.locator('.hora-nav #cartBar').count(),1);const cartBox=await page.locator('#cartBar').boundingBox();assert.ok(cartBox.y>=0&&cartBox.y+cartBox.height<height/2);await page.locator('#helpBtn').click();await page.locator('#helpModal.open').waitFor();assert.match(await page.locator('#helpModal').innerText(),/Pix/);assert.match(await page.locator('#helpModal').innerText(),/Cartão de crédito ou débito/);assert.match(await page.locator('#helpModal').innerText(),/Apple Pay/);assert.match(await page.locator('#helpModal').innerText(),/Google Pay/);assert.match(await page.locator('#helpModal').innerText(),/QR Code ou copia e cola/);await page.locator('#closeHelp').click();
   assert.equal(await page.locator('[data-pay-now]').count(),0);await page.locator('#productGrid button[data-qty="1"]').first().click();await page.locator('[data-pay-now]').first().click();await page.locator('#cartModal.payment-direct.open').waitFor();assert.match(await page.locator('#checkoutQuickTotal').innerText(),/2,50/);await page.locator('#closeCart').click();await page.locator('#openCart').click();
   await page.locator('#cartModal.open').waitFor();
   assert.equal(await page.locator('#paymentOptions input').count(),1);assert.equal(await page.locator('#paymentOptions input').inputValue(),'cash');
   await page.locator('#cash').fill('10,00');
   assert.match(await page.locator('#cashChangePreview').innerText(),/7,50/);
   const box=await page.locator('#cartModal .modal').boundingBox();assert.ok(box.width<=width&&box.height<=height);
   await page.locator('#checkoutGoPayment').click();await page.locator('#cartModal.payment-direct').waitFor();assert.match(await page.locator('#checkoutQuickTotal').innerText(),/2,50/);assert.equal(await page.locator('#checkoutSummary').isVisible(),false);assert.equal(await page.locator('#cash').inputValue(),'10,00');await page.locator('#checkoutReviewCart').click();assert.equal(await page.locator('#checkoutSummary').isVisible(),true);
   await page.locator('#closeCart').click();await page.locator('#goPayment').click();await page.locator('#cartModal.payment-direct.open').waitFor();assert.equal(await page.locator('#paymentOptions input').inputValue(),'cash');assert.equal(await page.locator('#checkoutExtras').isVisible(),false);await page.locator('#closeCart').click();
   await page.goto(origin+'/admin.html');await page.locator('#loginScreen:not(.hidden)').waitFor();
   const dim=await page.evaluate(()=>({actual:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
   assert.ok(dim.actual<=dim.viewport+2,device+' login '+JSON.stringify(dim));
   await page.locator('#username').fill('admin');await page.locator('#pass').fill('wrong');await page.locator('#adminLoginSubmit').click();await page.locator('#loginError').filter({hasText:'Usuário ou senha incorretos.'}).waitFor();
   await page.locator('#pass').fill('local-admin-valid-code');await page.locator('#adminLoginSubmit').click();await page.locator('#appScreen:not(.hidden)').waitFor();await page.reload();await page.locator('#appScreen:not(.hidden)').waitFor();await page.locator('#adminShopState.is-open').waitFor();const adminDim=await page.evaluate(()=>({actual:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));assert.ok(adminDim.actual<=adminDim.viewport+2,device+' admin '+JSON.stringify(adminDim));
   await page.locator('[data-tab="settings"]').click();await page.locator('#pickupAddress').waitFor();assert.match(await page.locator('#pickupAddress').inputValue(),/Rua Dourado/);await page.locator('[data-pickup-radius="100"]').click();assert.equal(await page.locator('#pickupRadius').inputValue(),'100');assert.equal(await page.locator('#pickupRadiusValue').innerText(),'100 m');await page.locator('#pickupCoords').fill('-23.6, -46.6');await page.locator('#pickupApplyCoords').click();assert.equal(await page.locator('#pickupLat').inputValue(),'-23.6');assert.match(await page.locator('#pickupViewPoint').getAttribute('href'),/google.com\/maps/);const locDim=await page.evaluate(()=>({actual:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));assert.ok(locDim.actual<=locDim.viewport+2,device+' localização '+JSON.stringify(locDim));
   await page.goto(origin+'/tv.html');await page.locator('#tvAuth:not(.hidden)').waitFor();await page.locator('#tvKey').fill('wrong');await page.locator('#tvConnect').click();await page.locator('#tvLoginError').filter({hasText:'Código da TV incorreto.'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('adega_tv_code_v1')),null);
   await page.locator('#tvKey').fill('local-tv-valid-code');await page.locator('#tvConnect').click();await page.locator('#tvBoard:not(.hidden)').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('adega_tv_code_v1')),'local-tv-valid-code');
   console.log(device+' '+width+'x'+height+': catálogo, carrinho, dinheiro, troco e autenticação admin/TV OK');
  }finally{await browser.close();}
 }
 }finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
