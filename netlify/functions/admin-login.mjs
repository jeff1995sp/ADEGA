import {createClient} from '@supabase/supabase-js';
import {createHash,timingSafeEqual} from 'node:crypto';

// Login alternativo do proprietário. O e-mail e a senha atuais do Supabase NÃO são alterados.
// A senha do atalho 'admin' só existe como segredo privado ADEGA_ADMIN_PIN no Netlify.
const send=(data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff'}
});
const fail=(message,status=400)=>send({error:message},status);
const equalSecret=(a,b)=>{
  const aHash=createHash('sha256').update(a).digest();
  const bHash=createHash('sha256').update(b).digest();
  return timingSafeEqual(aHash,bHash);
};
export default async function handler(request){
  if(request.method!=='POST')return fail('Método não permitido.',405);
  const {SUPABASE_URL:url,SUPABASE_ANON_KEY:publicKey,SUPABASE_SERVICE_ROLE_KEY:serviceKey,
         ADEGA_ADMIN_PIN:adminPin,ADEGA_ADMIN_USER_ID:chosenId}=process.env;
  if(!url||!publicKey||!serviceKey)return fail('Conexão Supabase não configurada.',503);
  if(!adminPin)return fail('Configure ADEGA_ADMIN_PIN no Netlify para ativar o usuário admin.',503);
  let body;
  try {
    const text=await request.text();
    if(text.length>1024)return fail('Dados de acesso inválidos.',413);
    body=JSON.parse(text);
  }catch{return fail('Dados de acesso inválidos.');}
  if(!body||typeof body!=='object'||Array.isArray(body))return fail('Dados de acesso inválidos.');
  const user=String(body.username||'').trim().toLowerCase();
  const password=String(body.password||'');
  if(user!=='admin'||password.length===0||password.length>128||!equalSecret(password,adminPin)){
    return fail('Usuário ou senha incorretos.',401);
  }
  try {
    const options={auth:{persistSession:false,autoRefreshToken:false}};
    const service=createClient(url,serviceKey,options);
    const auth=createClient(url,publicKey,options);
    const q=service.from('admin_users').select('user_id').limit(2);
    const {data:admins,error:lookupError}=chosenId
      ?await q.eq('user_id',chosenId)
      :await q;
    if(lookupError||!admins||admins.length!==1){
      return fail('Acesso admin requer uma conta autorizada única. Confira admin_users ou configure ADEGA_ADMIN_USER_ID.',503);
    }
    const adminId=admins[0].user_id;
    const {data:account,error:accountError}=await service.auth.admin.getUserById(adminId);
    const email=account?.user?.email;
    if(accountError||!email||account.user.id!==adminId)return fail('Conta do administrador não encontrada no Supabase.',503);
    // Gera um token de uso único para a conta existente, sem consultar nem alterar a senha dela.
    const {data:link,error:linkError}=await service.auth.admin.generateLink({type:'magiclink',email});
    const hash=link?.properties?.hashed_token;
    if(linkError||link?.user?.id!==adminId||!hash)return fail('Não foi possível criar a sessão administrativa.',503);
    const {data:sessionData,error:sessionError}=await auth.auth.verifyOtp({token_hash:hash,type:'magiclink'});
    const session=sessionData?.session;
    if(sessionError||!session||sessionData?.user?.id!==adminId)return fail('Não foi possível validar a sessão administrativa.',503);
    return send({token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at});
  }catch{
    return fail('Falha ao autenticar o administrador.',503);
  }
}
// A limitação por IP no Netlify complementa a validação privada do PIN.
export const config={
  path:'/api/admin-login',
  rateLimit:{windowLimit:3,windowSize:180,aggregateBy:['ip','domain']}
};
