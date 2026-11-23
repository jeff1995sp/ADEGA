import {createClient} from '@supabase/supabase-js';
import {createHash,timingSafeEqual} from 'node:crypto';

// Login por nome de usuário sempre depende de credenciais privadas no Netlify.
// Nunca enviar para o navegador os segredos usados para criar a sessão.
const respond=(data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff'}
});
const fail=(message,status=400)=>respond({error:message},status);
function equalSecret(a,b){
  const left=createHash('sha256').update(a).digest();
  const right=createHash('sha256').update(b).digest();
  return timingSafeEqual(left,right);
}
export default async function handler(request){
  if(request.method!=='POST')return fail('Método não permitido.',405);
  const settings={
    url:process.env.SUPABASE_URL,
    publicKey:process.env.SUPABASE_ANON_KEY,
    serverKey:process.env.SUPABASE_SERVICE_ROLE_KEY,
    pin:process.env.ADEGA_ADMIN_PIN,
    email:process.env.ADEGA_ADMIN_EMAIL,
    password:process.env.ADEGA_ADMIN_PASSWORD
  };
  if(!settings.url||!settings.publicKey||!settings.serverKey)return fail('Conexão Supabase ainda não configurada.',503);
  if(!settings.pin||!settings.email||!settings.password)return fail('Acesso pelo usuário admin ainda não configurado no Netlify. Use seu e-mail e senha atuais.',503);
  let body;
  try{
    const raw=await request.text();
    if(raw.length>1024)return fail('Dados de login inválidos.',413);
    body=JSON.parse(raw);
  }catch{return fail('Dados de login inválidos.');}
  if(!body||typeof body!=='object'||Array.isArray(body))return fail('Dados de login inválidos.');
  const user=String(body.username||'').trim().toLowerCase();
  const candidate=String(body.password||'');
  if(user!=='admin'||candidate.length===0||candidate.length>128)return fail('Usuário ou senha incorretos.',401);
  if(!equalSecret(candidate,settings.pin))return fail('Usuário ou senha incorretos.',401);
  try{
    const opts={auth:{persistSession:false,autoRefreshToken:false}};
    const auth=createClient(settings.url,settings.publicKey,opts);
    const server=createClient(settings.url,settings.serverKey,opts);
    const {data,error}=await auth.auth.signInWithPassword({email:settings.email,password:settings.password});
    if(error||!data?.session||!data?.user?.id)return fail('Credenciais do administrador precisam ser verificadas no Netlify e Supabase.',503);
    const access=await server.from('admin_users').select('user_id').eq('user_id',data.user.id).maybeSingle();
    if(access.error||!access.data)return fail('Conta sem permissão de administrador.',403);
    return respond({token:data.session.access_token,refresh_token:data.session.refresh_token,expires_at:data.session.expires_at});
  }catch{return fail('Falha ao autenticar o administrador. Confira o servidor.',503);}
}

// Limite do Netlify: no máximo 3 tentativas a cada 180s por IP neste endpoint.
export const config={
  path:'/api/admin-login',
  rateLimit:{windowLimit:3,windowSize:180,aggregateBy:['ip','domain']}
};
