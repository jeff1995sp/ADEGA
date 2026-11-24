import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {photoFor,photoStatusFor} from '../public/js/shared.js';
const preview=JSON.parse(readFileSync('public/catalogo-previa.json','utf8'));
const mapping={"5":"jack-com-red-bull","6":"cavalo-com-red-bull","7":"cavalo-com-vibe","8":"ballantine-s-com-red-bull","9":"ballantine-s-com-vibe","10":"red-label-com-red-bull","11":"beefeater-com-red-bull","12":"bell-s-com-red-bull","13":"absolut-com-red-bull","14":"ciroc-com-red-bull","15":"rocks-com-red-bull","62":"gin-dose","63":"rocks-com-red-bull","64":"beefeater-com-red-bull","65":"bossa-nova-dose","66":"tanqueray-dose"};
test('Doses: imagens individuais novas, sem substituir fotos manuais',()=>{
 for(const [num,n] of Object.entries(mapping)){
  const id='produto-'+num.padStart(3,'0');const p=preview.products.find(p=>p.id===id);const path='/imagens/'+n+'-natural-v5.webp';
  assert.equal(photoFor(p),path);assert.equal(photoStatusFor(p),'illustrative');assert.ok(existsSync('public'+path));
  assert.equal(photoFor({...p,image_url:'/imagens/'+n+'.webp'}),path);
  assert.equal(photoFor({...p,image_url:'/media/12345678-1234-1234-1234-123456789012'}),'/media/12345678-1234-1234-1234-123456789012');
 }
});
