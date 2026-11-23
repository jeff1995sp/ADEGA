import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const preview=JSON.parse(readFileSync('public/catalogo-previa.json','utf8'));
test('prévia contém produtos e não aceita pedidos',()=>{assert.ok(preview.products.length>40);assert.equal(preview.store.accepting_orders,false)});
test('nenhum item de tabacaria entra na vitrine prévia',()=>{assert.ok(preview.products.every(p=>p.category!=='Tabacaria'));assert.ok(preview.products.every(p=>!p.active && p.stock===0));});
