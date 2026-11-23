import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('admin exibe somente usuário e senha, sem exigir e-mail',()=>{
 const html=read('../public/admin.html');
 assert.ok(html.includes('<label for="username">Usuário</label>'));
 assert.ok(html.includes('id="username" name="username" type="text"'));
 const code=read('../public/js/admin.js');
 assert.ok(code.includes("username!=='admin'"));
 assert.ok(code.includes("fetch('/api/admin-login'"));
 assert.ok(!code.includes("api('login',{email:username,password}"));
 assert.ok(!html.includes('for="email"'));
 assert.ok(!html.includes('type="email"'));
});

test('login admin usa só PIN privado, sem alterar e-mail ou senha Supabase',()=>{
 const code=read('../netlify/functions/admin-login.mjs');
 assert.ok(code.includes('ADEGA_ADMIN_PIN'));
 assert.ok(code.includes("from('admin_users')"));
 assert.ok(code.includes('timingSafeEqual'));
 assert.ok(code.includes('getUserById'));
 assert.ok(code.includes("generateLink({type:'magiclink',email})"));
 assert.ok(code.includes("verifyOtp({token_hash:hash,type:'magiclink'})"));
 assert.ok(code.includes("account.user.id!==adminId"));
 assert.ok(code.includes("sessionData?.user?.id!==adminId"));
 assert.ok(code.includes("rateLimit:{windowLimit:3,windowSize:180"));
 assert.ok(!code.includes('ADEGA_ADMIN_EMAIL'));
 assert.ok(!code.includes('ADEGA_ADMIN_PASSWORD'));
 assert.ok(!code.includes('signInWithPassword'));
 assert.ok(!read('../public/admin.html').includes('fabio@2027'));
});

test('atalho /admin permanece ativo; autenticacao Supabase segue no servidor',()=>{
 const config=read('../netlify.toml');
 assert.ok(config.includes('from = "/admin"'));
 assert.ok(config.includes('to = "/admin.html"'));
 assert.ok(config.includes('from = "/api"'));
 const api=read('../netlify/functions/api.mjs');
 assert.ok(api.includes("if (route === 'login' && method === 'POST')"));
 assert.ok(api.includes("from('admin_users')"));
});
