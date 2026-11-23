import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {REAL_PRODUCT_PHOTOS,photoFor,photoFallbackFor} from '../public/js/shared.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('imagens reais pesquisadas para produtos identificados',()=>{
 for(const name of ['Heineken','Corona','Spaten','Budweiser','Doritos','Fandangos'])assert.ok(REAL_PRODUCT_PHOTOS[name]?.startsWith('https://'),name);
});
test('foto enviada no admin prevalece e imagens locais permanecem como fallback',()=>{
 const item={name:'Heineken',image_url:'/imagens/heineken.webp'};
 assert.equal(photoFor(item),REAL_PRODUCT_PHOTOS.Heineken);
 assert.equal(photoFallbackFor(item),'/imagens/heineken.webp');
 assert.equal(photoFor({...item,image_url:'https://meu-site.com/foto.webp'}),'https://meu-site.com/foto.webp');
 assert.equal(photoFor({name:'Produto desconhecido',image_url:'/imagens/real.webp'}),'/imagens/real.webp');
});
test('Bubbaloo usa imagem fornecida pelo proprietário; conferência documentada',()=>{
 assert.ok(statSync(new URL('../public/imagens/bubbaloo.webp',import.meta.url)).size>20000);
 assert.match(read('../FOTOS_REAIS_PESQUISA_E_CONFERENCIA.md'),/licença de uso comercial/);
 assert.match(read('../public/conferir-fotos.html'),/Conferir fonte da imagem/);
});
