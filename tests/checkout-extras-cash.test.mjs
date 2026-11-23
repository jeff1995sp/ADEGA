import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const frontend=read('../public/js/catalog.js');
const markup=read('../public/index.html');
const admin=read('../public/js/admin.js');
const backend=read('../netlify/functions/api.mjs');
const setup=read('../sql/INSTALACAO_COMPLETA_NOVO_BANCO.sql');
const migrate=read('../sql/02_OPCOES_DOSES_WHISKY_GIN.sql');
const preview=JSON.parse(read('../public/catalogo-previa.json'));

test('sugestões de pirulito, bala e água ficam no checkout e são opcionais',()=>{
 assert.ok(markup.includes('Quer adicionar pirulito, bala ou água?'));
 for(const id of ['checkoutExtras','checkoutExtrasList','checkoutExtrasDismiss']) assert.ok(markup.includes('id="'+id+'"'));
 for(const key of ["key:'pirulito'","key:'bala'","key:'agua'"]) assert.ok(frontend.includes(key));
 assert.ok(frontend.includes('extrasDismissed=true'));
 assert.ok(frontend.includes("data-checkout-extra"));
 assert.ok(frontend.includes("p.category!=='Tabacaria'"));
 assert.ok(frontend.includes("const usable=Boolean(p&&available(p)"));
 assert.ok(frontend.includes("cart.set(p.id,{id:p.id,quantity:q+1})"));
 for(const name of ['Pirulito','Bala (unidade)']){
   const p=preview.products.find(p=>p.name===name);
   assert.ok(p);
   assert.equal(p.price_cents,0);
   assert.equal(p.stock,0);
   assert.equal(p.active,false);
 }
 assert.ok(migrate.includes("('Pirulito'"));
 assert.ok(migrate.includes("('Bala (unidade)'"));
});

test('dinheiro exige valor informado e mostra troco atualizado com total do carrinho',()=>{
 assert.ok(markup.includes('Vai pagar com quanto em dinheiro?'));
 assert.ok(markup.includes('id="cashChangePreview"'));
 assert.ok(frontend.includes("function updateCashPreview()"));
 assert.ok(frontend.includes("const value=$('cash').value.trim(),given=priceParse(value)"));
 assert.ok(frontend.includes("given-total()"));
 assert.ok(frontend.includes('renderCheckoutSummary();renderCheckoutExtras();renderProducts();'));
 assert.ok(frontend.includes("$('cash').required=method==='cash'"));
 assert.ok(frontend.includes("cash===null||cash<total()"));
 assert.ok(frontend.includes("$('cash').addEventListener('input',updateCashPreview)"));
 assert.ok(backend.includes("if(body.payment_method==='cash' && cash===null)"));
 assert.ok(setup.includes('p_cash_given_cents is null or p_cash_given_cents<v_total'));
 assert.ok(migrate.includes('p_cash_given_cents IS NULL OR p_cash_given_cents<v_total'));
});

test('o admin vê o troco e o pagamento permanece pendente até receber',()=>{
 assert.ok(admin.includes('PREPARAR TROCO:'));
 assert.ok(admin.includes('o.cash_given_cents-o.total_cents'));
 assert.ok(admin.includes('Cliente entrega:'));
 assert.ok(admin.includes('Marque como pago somente após receber.'));
 assert.ok(backend.includes("sb.rpc('place_order'"));
 assert.ok(backend.includes('p_cash_given_cents:cash'));
 assert.ok(migrate.includes('p_payment_method'));
});
