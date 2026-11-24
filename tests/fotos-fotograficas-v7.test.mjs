import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ILLUSTRATIVE_LOCAL_PATHS} from '../public/js/shared.js';
const names=["smirnoff-ice","51-ice","draft","spaten","pitu-lata","acai-batido","abacaxi-com-vinho","ferrero-rocher","ninho-trufado","maracuja","cocada","pe-de-moleque"];
test('Novas referências fotográficas são WebP válidos e permanecem identificadas como ilustrativas',()=>{for(const n of names){const path='/imagens/'+n+'.webp';const b=readFileSync('public'+path);assert.equal(b.toString('ascii',0,4),'RIFF',n);assert.equal(b.toString('ascii',8,12),'WEBP',n);assert.equal(b.readUInt32LE(4)+8,b.length,n);assert.ok(b.length>1000,n);assert.ok(ILLUSTRATIVE_LOCAL_PATHS.has(path),n);}});
