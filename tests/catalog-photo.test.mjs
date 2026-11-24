import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CATEGORIES,priceParse,catalogCategory} from '../public/js/shared.js';
const from = path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('Categorias na ordem desejada e Tabacaria ao final',()=>{
  assert.deepEqual(CATEGORIES.slice(1,7),['Cervejas','Whisky','Gin','Vodka','Batidas','Caipirinhas']);
  assert.equal(CATEGORIES.at(-1),'Tabacaria');
});
test('Placas transcritas sem inventar preços indisponíveis',()=>{
  const sql=from('../sql/catalogo_fotos_preco_editavel.sql');
  for(const price of ['1000','800','4500','1200','1500'])assert.ok(sql.includes(price));
  assert.ok(sql.includes("'Doritos','Salgadinhos'"));
  assert.ok(sql.includes("'Caipirinha de cerveja','Caipirinhas'"));
  assert.match(sql,/NOT EXISTS/);
});
test('Admin pode salvar preço individual via API e frontend',()=>{
  const admin=from('../public/js/admin.js');
  const api=from('../netlify/functions/api.mjs');
  assert.ok(admin.includes('Salvar preço'));
  assert.ok(admin.includes("action==='setprice'"));
  assert.ok(api.includes('patch.price_cents=body.price_cents'));
  assert.equal(priceParse('R$ 15,00'),1500);
});

test('Categoria Vodka agrupa registros antigos e novos',()=>{assert.equal(catalogCategory({category:'Doses'}),'Vodka');assert.equal(catalogCategory({category:'Vodka'}),'Vodka');assert.ok(CATEGORIES.includes('Vodka'));});
