import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {PHOTO_PENDING,ILLUSTRATIVE_LOCAL_PATHS,photoFor,photoFallbackFor,photoStatusFor} from '../public/js/shared.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const products=JSON.parse(read('../public/catalogo-previa.json')).products;

test('fotos provisórias do catálogo aparecem como pendentes',()=>{
 assert.equal(products.length,61);
 assert.ok(ILLUSTRATIVE_LOCAL_PATHS.size>=30);
 assert.equal(products.filter(p=>photoStatusFor(p)==='pending').length,products.filter(p=>ILLUSTRATIVE_LOCAL_PATHS.has(p.image_url)).length);
 assert.equal(products.filter(p=>photoStatusFor(p)==='local').length,products.filter(p=>!ILLUSTRATIVE_LOCAL_PATHS.has(p.image_url)).length);
 for(const p of products)assert.ok(statSync(new URL('../public'+p.image_url,import.meta.url)).size>200,p.name);
 for(const name of ['Draft','Refrigerante em lata']){
  const p=products.find(p=>p.name===name);
  assert.equal(photoFor(p),PHOTO_PENDING);
  assert.equal(photoFallbackFor(p),PHOTO_PENDING);
 }
 // Quando a importação licencia uma foto e a salva localmente, ela deixa de ser pendente.
 for(const name of ['Heineken','Caipirinha de Morango','Corona','Budweiser']){
  const p=products.find(p=>p.name===name);
  if(!ILLUSTRATIVE_LOCAL_PATHS.has(p.image_url)){
   assert.equal(photoFor(p),p.image_url);
   assert.equal(photoFallbackFor(p),p.image_url);
  }
 }
 assert.equal(photoFor(products.find(p=>p.name==='Fandangos')),'/imagens/fandangos.webp');
});

test('foto personalizada salva no admin tem prioridade',()=>{
 const p={name:'Heineken',image_url:'https://example.test/foto-propria.webp'};
 assert.equal(photoFor(p),p.image_url);
 assert.equal(photoStatusFor(p),'custom');
 assert.equal(photoFallbackFor(p),ILLUSTRATIVE_LOCAL_PATHS.has('/imagens/heineken.webp')?PHOTO_PENDING:'/imagens/heineken.webp');
 assert.ok(!read('../public/js/shared.js').includes('REAL_PRODUCT_PHOTOS'));
});

test('galeria usa API e mostra fotos pendentes',()=>{
 const page=read('../public/conferir-fotos.html');
 assert.ok(page.includes('/api?route=catalog'));
 assert.ok(page.includes('/catalogo-previa.json'));
 assert.ok(page.includes('Foto real pendente'));
});

test('três cliques abrem login do admin, sem senha exposta no código público',()=>{
 const index=read('../public/index.html');
 const shortcut=read('../public/js/admin-shortcut.js');
 assert.ok(index.includes('/js/admin-shortcut.js'));
 assert.ok(shortcut.includes('count!==3'));
 assert.ok(shortcut.includes('/admin.html'));
 assert.ok(!shortcut.includes('2027'));
 assert.ok(read('../public/js/admin.js').includes("fetch('/api/admin-login'"));
});

test('pedido exige nome e sobrenome e identifica cliente em admin e TV',()=>{
 const api=read('../netlify/functions/api.mjs');
 const admin=read('../public/js/admin.js');
 const catalog=read('../public/js/catalog.js');
 const tv=read('../public/js/tv.js');
 assert.ok(api.includes('p_first_name:first,p_last_name:last'));
 assert.ok(api.includes('last.length<2'));
 assert.ok(api.includes('public_name:'));
 assert.ok(api.includes('last_name:o.last_name'));
 assert.ok(admin.includes('esc(o.first_name)'));
 assert.ok(admin.includes('esc(o.last_name)'));
 assert.ok(catalog.includes('first_name:first,last_name:last'));
 assert.ok(tv.includes('o.public_name'));
});
