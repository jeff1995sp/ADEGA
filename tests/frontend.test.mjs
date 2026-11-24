import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fmt,esc,pad,priceParse} from '../public/js/shared.js';

test('currency parser uses Brazilian real safely',()=>{
  assert.equal(priceParse('10,50'),1050);
  assert.equal(priceParse('R$ 1.234,56'),123456);
  assert.equal(priceParse('0'),0);
  assert.equal(priceParse('1,999'),null);
  assert.equal(priceParse('-1'),null);
  assert.equal(priceParse('texto'),null);
  assert.equal(priceParse(''),null);
  assert.match(fmt(12345),/123,45/);
});
test('HTML escaping and ticket number are safe',()=>{
  assert.equal(esc('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(pad(42),'#0042');
});
test('all three production screens load their corresponding modules',()=>{
  for(const [file,entry] of [['index.html','catalog.js'],['admin.html','admin.js'],['tv.html','tv.js']]){
    const s=readFileSync(new URL('../public/'+file,import.meta.url),'utf8');
    assert.ok(s.includes('/js/'+entry));
    assert.ok(s.includes('Jefferson Felix'));
    assert.ok(!s.includes('demo.js'));
  }
});
test('server does not manually approve pix or wallets',()=>{
  const source=readFileSync(new URL('../netlify/functions/api.mjs',import.meta.url),'utf8');
  assert.match(source,/body\.payment_method!=='cash'/);
  assert.ok(!source.includes("payment_status:'paid'"));
});

test('tabacaria permanece no controle interno e não aparece no checkout público',()=>{
  const source=readFileSync(new URL('../public/js/catalog.js',import.meta.url),'utf8');
  const backend=readFileSync(new URL('../netlify/functions/api.mjs',import.meta.url),'utf8');
  const sql=readFileSync(new URL('../sql/SEGURANCA_TABACARIA_ADMIN.sql',import.meta.url),'utf8');
  assert.ok(!source.includes('tabacaria-final'));
  assert.ok(source.includes("$('catalogo').addEventListener('click'"));
  assert.ok(backend.includes(".neq('category','Tabacaria')"));
  assert.ok(backend.includes("route === 'admin-catalog'"));
  assert.ok(sql.includes('BEFORE INSERT ON public.order_items'));
});
test('admin supports tabacaria filter and prohibits electronic smoking devices in sale fields',()=>{
  const admin=readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
  const backend=readFileSync(new URL('../netlify/functions/api.mjs',import.meta.url),'utf8');
  const setup=readFileSync(new URL('../sql/setup.sql',import.meta.url),'utf8');
  assert.ok(admin.includes('data-inventory-filter="Tabacaria"'));
  assert.ok(backend.includes("prohibited.test(String(body.description||''))"));
  assert.ok(setup.includes("('Seda','Tabacaria'"));
  assert.ok(setup.includes("('Carvão','Tabacaria'"));
});
