import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeProduct} from '../public/js/shared.js';
const read=p=>readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
test('Vitrine urbana mantém busca, navegação, carrinho e formulários existentes',()=>{
 const h=read('index.html'),c=read('js/catalog.js');
 for(const id of ['menuToggle','categorySidebar','categorySideLinks','productSearch','headerCart','categoryTabs','productGrid','checkoutForm','doseForm','trackingModal','trackBtn','openCart'])assert.equal(h.split('id="'+id+'"').length-1,1,id);
 assert.match(h,/hora-vitrine\.css/);assert.match(c,/productSearch.*addEventListener/);assert.match(c,/Chicletes/);
 assert.match(c,/p\.category!==['"]Tabacaria['"]/);
});
test('Corrigir nomes não altera IDs nem os nomes personalizados pelo proprietário',()=>{
 const p={id:'produto-049',name:'Fofura (embalagem azul)',price_cents:350};
 assert.deepEqual(normalizeProduct(p),{...p,name:'Fofura Presunto'});
 assert.equal(normalizeProduct({...p,name:'Fofura personalizada'}).name,'Fofura personalizada');
});
test('Batidas e Caipirinhas juntas; atalho de estoque interno',()=>{const c=read('js/catalog.js');assert.ok(c.includes("['Todos','Batidas','Caipirinhas','Whisky'"));assert.match(read('admin.html'),/data-tab="tabacaria"/);});
