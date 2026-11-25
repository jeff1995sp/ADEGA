import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('./app/src/main/assets/tv-app.js',import.meta.url),'utf8');
const java=readFileSync(new URL('./app/src/main/java/br/com/horaextra/tv/MainActivity.java',import.meta.url),'utf8');
test('1 - layout: real orders, two panels, single voice indicator and fullscreen',()=>{
 assert.match(js,/makePanel\('preparingList','preparing','Em preparação'/);
 assert.match(js,/makePanel\('readyList','ready','Prontos para retirar'/);
 assert.match(js,/esc\(o.public_name\)/);
 assert.match(js,/#soundStatus,\.hora-tv-apk #tvAudioToggle/);
 assert.match(js,/sound-on:after\{content:none!important\}/);
 assert.match(js,/height:min\(100vh,56.25vw\)/);
});
test('2 - audio: neural, selectable voices, fallback, serialized queue',()=>{
 assert.match(js,/type==='santa'\?'santa':type==='male'\?'alex':'dora'/);
 assert.match(js,/voiceChoice==='order'/);assert.match(js,/voice:demandVoice/);
 assert.match(js,/if\(!soundEnabled \|\| speaking \|\| !queue.length/);
 assert.match(js,/generation!==speechGeneration/);
 assert.match(java,/setMediaPlaybackRequiresUserGesture\(false\)/);
 assert.match(java,/tts.setPitch\(1.0f\)/);
});
test('3 - data: real API, demand threshold, order transitions and reconnect',()=>{
 assert.match(js,/await api\('tv'/);assert.match(js,/setDemand\(activeCount>5\)/);
 assert.match(js,/DEMAND_INTERVAL=5\*60\*1000/);
 assert.match(js,/setInterval\(poll,3000\)/);
 assert.match(js,/o.id===item.orderId&&o.status===item.status/);
 assert.match(js,/lastOrders.length===0/);assert.match(js,/retryAt=Date.now\(\)\+15000/);
});
