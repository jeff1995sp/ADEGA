import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
test('Hora Extra: tema local nas três interfaces e controles de pedidos mantidos',()=>{
 for(const file of ['index.html','admin.html','tv.html']){const s=read(file);assert.match(s,/hora-extra\.css/);assert.match(s,/hora-extra-logo\.webp/);}
 assert.match(read('index.html'),/id="checkoutForm"/);
 assert.match(read('admin.html'),/id="newProduct"/);
 for(const id of ['activateSound','preparingList','readyList','tvClock'])assert.ok(read('tv.html').includes('id="'+id+'"'));
 assert.match(read('css/hora-extra.css'),/comunidade-urbana\.svg/);
 assert.match(read('img/comunidade-urbana.svg'),/<svg/);
 assert.ok(readFileSync(new URL('../public/img/hora-extra-logo.webp',import.meta.url)).length>1000);
});
