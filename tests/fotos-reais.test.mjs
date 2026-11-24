import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {PHOTO_PENDING,ILLUSTRATIVE_LOCAL_PATHS,LICENSED_LOCAL_PATHS,photoFor,photoFallbackFor,photoStatusFor} from '../public/js/shared.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const products=JSON.parse(read('../public/catalogo-previa.json')).products;

test('fotos ilustrativas aparecem identificadas, sem esconder arquivos existentes',()=>{
 assert.equal(products.length,70);
 assert.ok(ILLUSTRATIVE_LOCAL_PATHS.size>=10);
 assert.ok(LICENSED_LOCAL_PATHS.size>=4);
 for(const p of products){
  assert.ok(statSync(new URL('../public'+photoFor(p),import.meta.url)).size>200,p.name);
  if(ILLUSTRATIVE_LOCAL_PATHS.has(photoFor(p)))assert.equal(photoStatusFor(p),'illustrative');
 }
 for(const name of ['Draft','Refrigerante em lata','Spaten']){
  const p=products.find(p=>p.name===name);
  assert.equal(photoFor(p),p.image_url);
  assert.equal(photoStatusFor(p),'illustrative');
 }
 assert.equal(photoFor(products.find(p=>p.id==='produto-047')),'/imagens/fandangos.webp');
 assert.equal(photoFor(products.find(p=>p.id==='produto-063')),'/imagens/rocks-com-red-bull.webp');
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

test('fotografias licenciadas salvas localmente e identificadas como referências',()=>{
 assert.ok(read('../public/conferir-fotos.html').includes('Fotografia real licenciada de referência'));
 assert.ok(read('../public/js/catalog.js').includes('Foto real ilustrativa'));
 for(const path of LICENSED_LOCAL_PATHS){
  const p=products.find(x=>x.image_url===path);
  assert.ok(p,path);
  assert.equal(photoStatusFor(p),'licensed');
  assert.equal(photoFor(p),path);
  assert.ok(statSync(new URL('../public'+path,import.meta.url)).size>10000,path);
 }
});
