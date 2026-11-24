import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {energyMatchesDose,optionAvailable,isDoseProduct,CATEGORIES,fmt,doseUnitPrice,isHouseGin} from '../public/js/shared.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const sql=read('../sql/02_OPCOES_DOSES_WHISKY_GIN.sql');
const catalog=read('../public/js/catalog.js');
const backend=read('../netlify/functions/api.mjs');
const preview=JSON.parse(read('../public/catalogo-previa.json'));

test('as três escolhas são dose, gelo e energético, inclusos no valor',()=>{
 const page=read('../public/index.html');
 for(const id of ['doseModal','doseTitle','dosePrice','doseIce','doseEnergy','doseForm']) assert.ok(page.includes('id="'+id+'"'),id);
 assert.ok(catalog.includes("showDoseConfigurator(p)"));
 assert.ok(catalog.includes("Copo de 700 ml • Gelo e energético inclusos"));
 assert.ok(catalog.includes("const items=[...cart.values()].map(i=>({...i}))"));
 assert.ok(catalog.includes("ice_id:ice.id,energy_id:energy.id"));
 assert.ok(sql.includes("product_name,quantity,unit_price_cents,ice_option_id,energy_option_id"));
 assert.ok(sql.includes("v_product.price_cents,v_i.ice_id,v_i.energy_id"));
 assert.ok(sql.includes("SELECT * INTO v_option FROM public.drink_options WHERE id=v_i.option_id FOR UPDATE"));
 assert.ok(sql.includes("UPDATE public.drink_options SET stock=stock-v_i.qty"));
 assert.ok(sql.includes("UPDATE public.drink_options SET stock=stock+i.qty"));
 assert.ok(!sql.includes('Sem energético'));
});

test('seis opções de gelo confirmadas, sem adicionar sabores não autorizados',()=>{
 const block=sql.split('INSERT INTO public.drink_options(option_group,name,active,stock,unlimited,sort_order) VALUES')[1].split('ON CONFLICT')[0];
 const names=[...block.matchAll(/\('ice','([^']+)',false,0,false,\d+\)/g)].map(m=>m[1]);
 assert.deepEqual(names,['Gelo de água','Coco','Maracujá','Melancia','Morango','Maçã verde']);
 const redBulls=[...block.matchAll(/\('energy','(Red Bull[^']+)',false,0,false,\d+\)/g)].map(m=>m[1]);
 assert.ok(redBulls.length>=14);
 assert.ok(block.includes("('energy','Vibe Original',false,0,false,99)"));
});

test('Vibe apenas nas ofertas com Vibe e Red Bull em Whisky/Gin',()=>{
 const product={name:'Cavalo com Vibe',category:'Whisky'};
 assert.equal(isDoseProduct(product),true);
 assert.equal(energyMatchesDose(product,{name:'Vibe Original'}),true);
 assert.equal(energyMatchesDose(product,{name:'Red Bull Original'}),false);
 for(const name of ['Cavalo com Red Bull','Gin (dose)','Beefeater (dose)','Tanqueray (dose)']){
   assert.equal(energyMatchesDose({name,category:'Gin'},{name:'Red Bull Melancia'}),true,name);
   assert.equal(energyMatchesDose({name,category:'Gin'},{name:'Vibe Original'}),false,name);
 }
 assert.equal(optionAvailable({active:true,stock:0,unlimited:false}),false);
 assert.equal(optionAvailable({active:false,stock:20,unlimited:false}),false);
 assert.equal(optionAvailable({active:true,stock:2,unlimited:false}),true);
 assert.ok(CATEGORIES.includes('Whisky')&&CATEGORIES.includes('Gin'));
});

test('preços de gin corretos, administração pausa individualmente sem valores adicionais',()=>{
 const expected=new Map([
  ['Gin (dose)',1000],['Rocks (dose)',2500],['Beefeater (dose)',3000],
  ['Bossa Nova (dose)',4000],['Tanqueray (dose)',4000]]);
 for(const [name,price] of expected){
   const item=preview.products.find(p=>p.name===name);
   assert.ok(item);
   assert.equal(item.price_cents,price);
   assert.equal(item.active,false);
   assert.equal(item.stock,0);
 }
 const admin=read('../public/js/admin.js');
 assert.ok(admin.includes("action==='optiontoggle'"));
 assert.ok(admin.includes("action==='optionstock'"));
 assert.ok(admin.includes("route='admin-drink-options'"));
 assert.ok(backend.includes("route === 'admin-drink-options' && method === 'PATCH'"));
 assert.ok(backend.includes("drink_options_ready:!options.error"));
 assert.ok(sql.includes("('energy','Vibe Original',false,0,false,99)"));
 assert.match(fmt(4000),/40,00/);
});

test('Tabacaria liberada na vitrine e caipirinhas só limão/morango',()=>{
 assert.ok(catalog.includes("visibleInCatalog(p)"));
 assert.ok(catalog.includes("'Caipirinha de Limão','Caipirinha de Morango'"));
 assert.ok(catalog.includes("'Tabacaria'"));
});

test('Gin comum permite energético sem marca e Red Bull com acréscimo',()=>{
 const p={id:'produto-062',name:'Gin (dose)',category:'Gin',price_cents:1000};
 assert.equal(isHouseGin(p),true);
 assert.equal(energyMatchesDose(p,{name:'Energético'}),true);
 assert.equal(energyMatchesDose(p,{name:'Vibe Original'}),false);
 assert.equal(doseUnitPrice(p,{name:'Energético'}),1000);
 assert.equal(doseUnitPrice(p,{name:'Red Bull Original'}),2000);
});

test('Vodka e categoria legada Doses usam personalização de gelo e Red Bull',()=>{for(const category of ['Vodka','Doses']){const p={name:'Absolut com Red Bull',category};assert.equal(isDoseProduct(p),true);assert.equal(energyMatchesDose(p,{name:'Red Bull Original'}),true);assert.equal(energyMatchesDose(p,{name:'Vibe Original'}),false);}assert.equal(isDoseProduct({category:'Cervejas'}),false);assert.equal(isDoseProduct({category:'Batidas'}),false);});

test('Energético incluído é pré-selecionado; Vibe não exige escolha e gelo não apaga energético',()=>{assert.ok(catalog.includes("preferredEnergy(energies,vibe?'Vibe Original':'Red Bull Original')"));assert.ok(catalog.includes("$('doseEnergy').disabled=vibe"));assert.ok(catalog.includes("energyField.classList.toggle('hidden',vibe&&!house)"));assert.ok(catalog.includes("Vibe Original incluído no preço"));assert.ok(!catalog.includes("$('doseEnergy').disabled=!$('doseIce').value"));});
