import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('admin permite cadastro de produto com categoria, preço em branco e foto opcional',()=>{
 const html=read('../public/admin.html');const js=read('../public/js/admin.js');
 assert.ok(html.includes('id="editCategory"'));
 assert.ok(html.includes('id="editPhotoFile"'));
 assert.ok(html.includes('accept="image/jpeg,image/png,image/webp"'));
 assert.ok(html.includes('id="editPhotoPreview"'));
 assert.ok(js.includes("priceRaw===''?0:priceParse(priceRaw)"));
 assert.ok(js.includes("api('admin-photo'"));
});
test('foto só aceita imagem validada na API autenticada',()=>{
 const code=read('../netlify/functions/api.mjs');
 assert.ok(code.includes("route === 'admin-photo'"));
 assert.ok(code.includes('Buffer.from(encoded'));
 assert.ok(code.includes("const adminRoute = route.startsWith('admin-')"));
 assert.ok(code.includes("sb.storage.from(bucket).upload"));
});
test('inventário contém fotos internas das marcas identificadas nas fotos',()=>{
 const sql=read('../sql/INVENTARIO_INTERNO_TABACARIA_FOTOS.sql');
 for(const item of ['ZGY','Onix','Gift','Eight Box','Zomo','Sadhu','Acréma','Tabaquin'])assert.ok(sql.includes(item),item);
 for(const file of ['zgy-choco-menta.webp','onix-chiclete-canela.webp','gift-maco-branco.webp','seda-o2.webp']){
  assert.ok(statSync(join(new URL('../public/imagens/',import.meta.url).pathname,file)).size>200);
 }
});
