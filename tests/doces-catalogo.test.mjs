import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CATEGORIES} from '../public/js/shared.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('Doces e Salgadinhos separados, Tabacaria na última categoria',()=>{
 assert.ok(CATEGORIES.includes('Doces e Balas'));
 assert.ok(CATEGORIES.includes('Salgadinhos'));
 assert.equal(CATEGORIES.at(-1),'Tabacaria');
 const api=read('../netlify/functions/api.mjs');
 assert.ok(api.includes('"Doces e Balas"'));
 assert.ok(api.includes('"Salgadinhos"'));
});
test('migração de doces é idempotente e não define preço ou estoque falso',()=>{
 const sql=read('../sql/atualizacao_doces_salgadinhos.sql');
 for(const p of ['Bubbaloo','Trident','Mentos','Bala Felicidades','Bala Te Adoro','Balas sortidas','Doritos','Fofura','Torcida'])assert.ok(sql.includes(p));
 assert.ok(sql.includes('WHERE NOT EXISTS'));
 assert.ok(sql.includes('0,0,false'));
 assert.ok(!sql.includes('price_cents=100'));
});

test('vinho continua disponível para cadastro, sem preço de venda fictício',()=>{const api=read('../netlify/functions/api.mjs');const sql=read('../sql/conferencia_draft_vinho.sql'); assert.ok(api.includes('"Vinhos"'));assert.ok(sql.includes("'Vinho','Vinhos'"));});
