import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('admin permite digitar usuário ou e-mail sem exigir formato de e-mail',()=>{
 const html=read('../public/admin.html');
 assert.ok(html.includes('Usuário ou e-mail'));
 assert.ok(html.includes('id="email" type="text"'));
 const code=read('../public/js/admin.js');
 assert.ok(code.includes("username.toLowerCase()==='admin'"));
 assert.ok(code.includes("fetch('/api/admin-login'"));
 assert.ok(code.includes("api('login',{email:username,password}"));
});

test('acesso por PIN somente se configurado no servidor, com validação de conta Supabase',()=>{
 const code=read('../netlify/functions/admin-login.mjs');
 for(const env of ['ADEGA_ADMIN_PIN','ADEGA_ADMIN_EMAIL','ADEGA_ADMIN_PASSWORD'])assert.ok(code.includes(env),env);
 assert.ok(code.includes('timingSafeEqual'));
 assert.ok(code.includes("signInWithPassword"));
 assert.ok(code.includes("from('admin_users')"));
 assert.ok(code.includes("rateLimit:{windowLimit:3,windowSize:180"));
 assert.ok(!code.includes("'2027'"));
 assert.ok(!read('../public/admin.html').includes('2027'));
});

test('atalho /admin funciona sem alterar /api e login e-mail original',()=>{
 const config=read('../netlify.toml');
 assert.ok(config.includes('from = "/admin"'));
 assert.ok(config.includes('to = "/admin.html"'));
 assert.ok(config.includes('from = "/api"'));
 const api=read('../netlify/functions/api.mjs');
 assert.ok(api.includes("if (route === 'login' && method === 'POST')"));
 assert.ok(api.includes("from('admin_users')"));
});
