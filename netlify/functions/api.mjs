import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';

const send = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store, private', 'x-content-type-options': 'nosniff' }
});
const fail = (message, status = 400) => send({ error: message }, status);
const validUuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
const validPhotoUrl = value => /^https:\/\//i.test(value) || /^\/imagens\/[a-z0-9-]+\.webp$/.test(value);
const prohibited = /(?:\b(?:vape|vapes|pod|pods|e-?cig|puff\s*bar)\b|cigarro\s*eletr[oô]nico|dispositivo\s*eletr[oô]nico\s*para\s*fumar)/i;
const allowedCats = new Set(["Cervejas","Whisky","Gin","Doses","Batidas","Caipirinhas","Vinhos","Bebidas prontas","Águas e Refrigerantes","Complementos","Doces e Snacks","Doces e Balas","Salgadinhos","Diversos","Bebidas","Águas","Combos","Tabacaria"]);
const friendly = text => {
  const dict = { ADEGA_FECHADA:'A adega está temporariamente fechada para pedidos.', PRODUTO_INDISPONIVEL:'Um produto foi pausado, esgotou ou está sem preço.', INFORME_NOME_SOBRENOME:'Informe nome e sobrenome.', PAGAMENTO_ONLINE_EM_CONFIGURACAO:'Pagamento online ainda não está integrado.', VALOR_PARA_TROCO_INSUFICIENTE:'Informe um valor para troco igual ou maior que o total.', ESTOQUE_INSUFICIENTE:'Estoque insuficiente.', OPCAO_INDISPONIVEL:'O gelo ou energético escolhido foi pausado ou esgotou. Selecione outro.', SELECIONE_GELO_ENERGETICO:'Escolha o gelo e o energético para a dose.', ENERGETICO_DA_DOSE_INCORRETO:'Escolha o energético correspondente à dose.', ENERGETICO_NAO_INCLUSO:'Esta dose avulsa não inclui Red Bull. Selecione uma dose com Red Bull.', OPCAO_NAO_PERMITIDA:'Esta opção não pertence ao produto escolhido.', ESCOLHA_VOZ_MASCULINA_OU_FEMININA:'Selecione a voz antes de marcar o pedido como pronto.', PAGAMENTO_NAO_CONFIRMADO:'Entrega bloqueada: confirme o recebimento do pagamento.', CONFIRA_COMPROVANTE_PIX:'Confira o comprovante do Pix na retirada.', CONFIRA_DOCUMENTO_MAIORIDADE:'Confirme o documento de maioridade antes de entregar.', CONFIRMACAO_ONLINE_SOMENTE_PELO_GATEWAY:'Pagamento online só pode ser confirmado pelo provedor.'};
  const key = String(text || '').split(':')[0];
  return dict[key] || String(text || 'Não foi possível concluir a operação.').replaceAll('_',' ');
};
const compareCode = (a,b) => {
  if (!a || !b) return false;
  const x=createHash('sha256').update(String(a)).digest(),y=createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(x,y);
};

export default async function handler(request) {
  const url = new URL(request.url);
  const route = url.searchParams.get('route') || 'health';
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return fail('Método não permitido.',405);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail('Configure as variáveis SUPABASE no Netlify. Veja LEIA-ME.md.',503);
  }
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false,autoRefreshToken:false } });
  const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession:false,autoRefreshToken:false } });
  let body = {};
  if (['POST','PATCH','PUT'].includes(method)) {
    const raw = await request.text();
    if (raw.length > (route==='admin-photo' ? 2900000 : 30000)) return fail('Requisição muito grande.',413);
    try { body = raw ? JSON.parse(raw) : {}; } catch { return fail('Dados JSON inválidos.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Formato de dados inválido.');
  }
  try {
    const adminRoute = route.startsWith('admin-');
    if (adminRoute) {
      const bearer = request.headers.get('authorization') || '';
      if (!bearer.startsWith('Bearer ')) return fail('Faça login no admin.',401);
      const { data, error } = await auth.auth.getUser(bearer.substring(7));
      if (error || !data?.user?.id) return fail('Sessão expirada. Entre novamente.',401);
      const q = await sb.from('admin_users').select('user_id').eq('user_id',data.user.id).maybeSingle();
      if (q.error || !q.data) return fail('Esta conta não está autorizada.',403);
    }
    if (route === 'health' && method === 'GET') return send({ok:true,online_enabled:false, gateway_status:'Aguardando API de pagamentos'});
    if (route === 'catalog' && method === 'GET') {
      const [settings,products,options] = await Promise.all([
        sb.from('store_settings').select('name,accepting_orders,low_stock_threshold').eq('id',1).single(),
        sb.from('products').select('id,name,category,description,price_cents,stock,unlimited,active,icon,image_url,age_restricted,sort_order').neq('category','Tabacaria').order('sort_order').order('name'),
        sb.from('drink_options').select('id,option_group,name,active,stock,unlimited,sort_order').order('sort_order').order('name')
      ]);
      if(settings.error || products.error) throw settings.error || products.error;
      return send({store:settings.data,products:products.data,drink_options:options.error?[]:options.data,drink_options_ready:!options.error,online_enabled:false});
    }
    if (route === 'admin-catalog' && method === 'GET') {
      const [settings,products,options] = await Promise.all([
        sb.from('store_settings').select('name,accepting_orders,low_stock_threshold').eq('id',1).single(),
        sb.from('products').select('id,name,category,description,price_cents,stock,unlimited,active,icon,image_url,age_restricted,sort_order').order('sort_order').order('name'),
        sb.from('drink_options').select('id,option_group,name,active,stock,unlimited,sort_order').order('option_group').order('sort_order')
      ]);
      if(settings.error || products.error) throw settings.error || products.error;
      return send({store:settings.data,products:products.data,drink_options:options.error?[]:options.data,drink_options_ready:!options.error,online_enabled:false});
    }
    if (route === 'login' && method === 'POST') {
      const email=String(body.email||'').trim(),password=String(body.password||'');
      if (!email || !password) return fail('Informe e-mail e senha.');
      const {data,error}=await auth.auth.signInWithPassword({email,password});
      if (error || !data?.session) return fail('E-mail ou senha incorretos.',401);
      const q=await sb.from('admin_users').select('user_id').eq('user_id',data.user.id).maybeSingle();
      if(q.error || !q.data) return fail('Usuário sem acesso ao admin.',403);
      return send({token:data.session.access_token,refresh_token:data.session.refresh_token,expires_at:data.session.expires_at});
    }
    if (route === 'refresh' && method === 'POST') {
      const token=String(body.refresh_token||'');
      if(!token) return fail('Sessão inválida.',401);
      const {data,error}=await auth.auth.refreshSession({refresh_token:token});
      if (error || !data?.session) return fail('Sessão expirada. Faça login novamente.',401);
      const q=await sb.from('admin_users').select('user_id').eq('user_id',data.user.id).maybeSingle();
      if(q.error || !q.data) return fail('Usuário sem acesso ao admin.',403);
      return send({token:data.session.access_token,refresh_token:data.session.refresh_token,expires_at:data.session.expires_at});
    }
    if (route === 'track' && method === 'POST') {
      if (!validUuid(body.id) || !validUuid(body.token)) return fail('Link de acompanhamento inválido.');
      const q=await sb.from('orders').select('id,order_no,first_name,last_name,status,payment_status,total_cents,payment_method,created_at,updated_at')
        .eq('id',body.id).eq('public_token',body.token).maybeSingle();
      if(q.error) throw q.error;
      return q.data?send({order:q.data}):fail('Pedido não encontrado.',404);
    }
    if (route === 'tv' && method === 'GET') {
      const configured=process.env.TV_PASSCODE || '';
      if (configured.length < 12) return fail('Configure TV_PASSCODE com no mínimo 12 caracteres.',503);
      if (!compareCode(request.headers.get('x-tv-code'),configured)) return fail('Código da TV incorreto.',403);
      const q=await sb.from('orders').select('id,order_no,first_name,last_name,status,voice,ready_at,created_at')
        .in('status',['received','preparing','ready']).order('created_at',{ascending:false}).limit(60);
      if(q.error) throw q.error;
      return send({orders:q.data.map(o=>({id:o.id,number:o.order_no,first_name:o.first_name,last_name:o.last_name,public_name:`${o.first_name} ${o.last_name}`,status:o.status,voice:o.voice,ready_at:o.ready_at,created_at:o.created_at}))});
    }
    if (route === 'create-order' && method === 'POST') {
      if(body.honeypot) return fail('Pedido não aceito.',429);
      if(body.age_confirmed!==true) return fail('É necessário confirmar ter pelo menos 18 anos.');
      const first=String(body.first_name||'').trim(),last=String(body.last_name||'').trim();
      if(first.length<2 || first.length>60 || last.length<2 || last.length>80) return fail('Informe nome e sobrenome.');
      const items=Array.isArray(body.items)?body.items:[];
      if(items.length<1 || items.length>30 || !items.every(i=>validUuid(i.id) && Number.isInteger(i.quantity) && i.quantity>=1 && i.quantity<=99
        && (i.ice_id==null || validUuid(i.ice_id)) && (i.energy_id==null || validUuid(i.energy_id)))) return fail('Carrinho inválido.');
      const cash=body.cash_given_cents===null || body.cash_given_cents===undefined ? null:Number(body.cash_given_cents);
      if(cash!==null && (!Number.isInteger(cash) || cash<0 || cash>100000000)) return fail('Valor em dinheiro inválido.');
      if(body.payment_method==='cash' && cash===null) return fail('Informe com quanto vai pagar em dinheiro para calcular o troco.');
      if(body.payment_method!=='cash') return fail('Pagamento somente em dinheiro na retirada.',409);
      const {data,error}=await sb.rpc('place_order',{p_first_name:first,p_last_name:last,p_payment_method:body.payment_method,p_cash_given_cents:cash,p_items:items});
      if(error) return fail(friendly(error.message),409);
      return send({order:{id:data.id,token:data.public_token,number:data.order_no,total_cents:data.total_cents,status:data.status}},201);
    }
    if (route === 'admin-cash' && method === 'GET') {
      // O caixa acompanha o dia de recebimento, não apenas o dia de criação do pedido.
      const day=new Date(Date.now()-3*3600000).toISOString().slice(0,10);
      const start=day+'T03:00:00.000Z';
      const end=new Date(new Date(start).getTime()+86400000).toISOString();
      const allPaid=[];let from=0;
      for(let pages=0;pages<20;pages++){
        const q=await sb.from('orders').select('id,order_no,first_name,last_name,payment_method,total_cents,paid_at,order_items(product_name,quantity,unit_price_cents)')
          .eq('payment_status','paid').gte('paid_at',start).lt('paid_at',end)
          .order('paid_at',{ascending:false}).range(from,from+999);
        if(q.error)throw q.error;
        allPaid.push(...q.data);if(q.data.length<1000)break;from+=1000;
      }
      const pendingQ=await sb.from('orders').select('id',{count:'exact',head:true}).eq('payment_status','pending')
        .neq('status','cancelled').gte('created_at',start).lt('created_at',end);
      if(pendingQ.error)throw pendingQ.error;
      const totals={cash:0,card:0,pix:0,apple:0,google:0},products=new Map();
      let items=0;
      for(const o of allPaid){totals[o.payment_method]=(totals[o.payment_method]||0)+o.total_cents;
        for(const i of o.order_items||[]){items+=i.quantity;
          const prev=products.get(i.product_name)||{quantity:0,total_cents:0};
          prev.quantity+=i.quantity;prev.total_cents+=i.quantity*i.unit_price_cents;
          products.set(i.product_name,prev);
        }
      }
      return send({day,paid_count:allPaid.length,pending_count:pendingQ.count||0,
        total_cents:allPaid.reduce((n,o)=>n+o.total_cents,0),item_count:items,
        by_method:totals,products:[...products.entries()].map(([name,v])=>({name,...v})),
        transactions:allPaid.slice(0,500),truncated:allPaid.length>=20000});
    }
    if (route === 'admin-orders' && method === 'GET') {
      const q=await sb.from('orders')
        .select('id,order_no,first_name,last_name,payment_method,payment_status,status,cash_given_cents,total_cents,receipt_checked,age_checked,age_required,voice,ready_at,paid_at,created_at,order_items(product_name,quantity,unit_price_cents)')
        .order('created_at',{ascending:false}).limit(250);
      if(q.error) throw q.error;
      return send({orders:q.data});
    }
    if (route === 'admin-photo' && method === 'POST') {
      if(!validUuid(body.id)) return fail('Selecione um produto válido.');
      if(!['image/webp','image/jpeg','image/png'].includes(body.mime)) return fail('Envie JPG, PNG ou WebP.');
      const encoded=String(body.base64||'');
      if(!encoded || encoded.length>2400000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))return fail('Foto inválida ou muito grande.',413);
      const data=Buffer.from(encoded,'base64');
      if(data.length>1750000 || data.length<20)return fail('Foto inválida ou muito grande.',413);
      const png=data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpg=data[0]===255 && data[1]===216 && data[2]===255;
      const webp=data.toString('ascii',0,4)==='RIFF' && data.toString('ascii',8,12)==='WEBP';
      if(!((body.mime==='image/png'&&png)||(body.mime==='image/jpeg'&&jpg)||(body.mime==='image/webp'&&webp)))return fail('Formato da imagem não corresponde ao arquivo.');
      const found=await sb.from('products').select('id').eq('id',body.id).maybeSingle();
      if(found.error || !found.data)return fail('Produto não encontrado.',404);
      const bucket='adega-produtos';
      const existing=await sb.storage.getBucket(bucket);
      if(existing.error){
        const created=await sb.storage.createBucket(bucket,{public:true,fileSizeLimit:2097152,allowedMimeTypes:['image/jpeg','image/png','image/webp']});
        if(created.error && !/exist|duplicate|already/i.test(created.error.message||''))throw created.error;
      }
      const ext=body.mime==='image/png'?'png':body.mime==='image/jpeg'?'jpg':'webp';
      const path=`${body.id}/${randomUUID()}.${ext}`;
      const uploaded=await sb.storage.from(bucket).upload(path,data,{contentType:body.mime,cacheControl:'3600',upsert:false});
      if(uploaded.error)throw uploaded.error;
      const image_url=sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      const changed=await sb.from('products').update({image_url}).eq('id',body.id).select('id,image_url').single();
      if(changed.error)throw changed.error;
      return send({image_url,product:changed.data});
    }
    if (route === 'admin-products' && method === 'POST') {
      const name=String(body.name||'').trim(),category=String(body.category||'Bebidas');
      if(name.length<2 || name.length>120 || prohibited.test(name) || prohibited.test(String(body.description||''))) return fail('Produto não permitido ou nome inválido.');
      if(!allowedCats.has(category)) return fail('Categoria inválida.');
      const price=Number(body.price_cents),stock=Number(body.stock);
      if(!Number.isInteger(price) || price<0 || price>100000000 || !Number.isInteger(stock) || stock<0 || stock>1000000) return fail('Preço ou quantidade inválidos.');
      const icon=String(body.icon||'🥤').slice(0,6),image=String(body.image_url||'').trim();
      if(image && (!validPhotoUrl(image) || image.length>1200)) return fail('A foto deve usar link HTTPS.');
      const q=await sb.from('products').insert({name,category,price_cents:price,stock,active:body.active!==false,unlimited:Boolean(body.unlimited),description:String(body.description||'').slice(0,450),icon,image_url:image||null,age_restricted:Boolean(body.age_restricted),sort_order:Number.isInteger(body.sort_order)?body.sort_order:0}).select().single();
      if(q.error) throw q.error;
      return send({product:q.data},201);
    }
    if (route === 'admin-products' && method === 'PATCH') {
      if(!validUuid(body.id)) return fail('Produto inválido.');
      const patch={};
      if(body.name!==undefined){const n=String(body.name).trim();if(n.length<2||n.length>120||prohibited.test(n))return fail('Nome inválido ou produto não permitido.');patch.name=n;}
      if(body.category!==undefined){if(!allowedCats.has(body.category))return fail('Categoria inválida.');patch.category=body.category;}
      if(body.price_cents!==undefined){if(!Number.isInteger(body.price_cents)||body.price_cents<0||body.price_cents>100000000)return fail('Preço inválido.');patch.price_cents=body.price_cents;}
      if(body.active!==undefined)patch.active=Boolean(body.active);
      if(body.unlimited!==undefined)patch.unlimited=Boolean(body.unlimited);
      if(body.age_restricted!==undefined)patch.age_restricted=Boolean(body.age_restricted);
      if(body.description!==undefined){const description=String(body.description).slice(0,450);if(prohibited.test(description))return fail('Descrição de produto não permitido.');patch.description=description;}
      if(body.icon!==undefined)patch.icon=String(body.icon).slice(0,6);
      if(body.image_url!==undefined){const val=String(body.image_url||'').trim();if(val&&(!validPhotoUrl(val)||val.length>1200))return fail('URL da foto inválida.');patch.image_url=val||null;}
      if(body.sort_order!==undefined){if(!Number.isInteger(body.sort_order))return fail('Ordem inválida.');patch.sort_order=body.sort_order;}
      if(!Object.keys(patch).length)return fail('Nenhuma alteração informada.');
      const q=await sb.from('products').update(patch).eq('id',body.id).select().single();
      if(q.error) throw q.error;
      return send({product:q.data});
    }
    if (route === 'admin-drink-options' && method === 'PATCH') {
      if(!validUuid(body.id))return fail('Sabor inválido.');
      const patch={};
      if(body.active!==undefined){
        if(typeof body.active!=='boolean')return fail('Status inválido.');
        patch.active=body.active;
      }
      if(body.stock!==undefined){
        if(!Number.isInteger(body.stock)||body.stock<0||body.stock>1000000)return fail('Estoque de sabor inválido.');
        patch.stock=body.stock;
      }
      if(!Object.keys(patch).length)return fail('Nenhuma alteração informada.');
      const q=await sb.from('drink_options').update(patch).eq('id',body.id)
        .select('id,option_group,name,active,stock,unlimited').single();
      if(q.error)throw q.error;
      return send({option:q.data});
    }
    if (route === 'admin-stock' && method === 'POST') {
      if(!validUuid(body.id)||!['set','add'].includes(body.mode)||!Number.isInteger(body.quantity)||body.quantity<0||body.quantity>1000000)return fail('Estoque inválido.');
      const q=await sb.rpc('adjust_product_stock',{p_product_id:body.id,p_mode:body.mode,p_quantity:body.quantity});
      if(q.error)return fail(friendly(q.error.message),409);
      return send({product:q.data});
    }
    if (route === 'admin-settings' && method === 'PATCH') {
      const patch={};
      if(body.name!==undefined){const n=String(body.name).trim();if(n.length<3||n.length>100)return fail('Nome da adega inválido.');patch.name=n;}
      if(body.accepting_orders!==undefined)patch.accepting_orders=Boolean(body.accepting_orders);
      if(body.low_stock_threshold!==undefined){if(!Number.isInteger(body.low_stock_threshold)||body.low_stock_threshold<0||body.low_stock_threshold>1000)return fail('Limite de estoque inválido.');patch.low_stock_threshold=body.low_stock_threshold;}
      if(!Object.keys(patch).length)return fail('Nenhuma alteração.');
      const q=await sb.from('store_settings').update(patch).eq('id',1).select().single();
      if(q.error) throw q.error;
      return send({store:q.data});
    }
    if(route==='admin-order-action' && method==='POST') {
      if(!validUuid(body.id)||!['status','paid','age','receipt','voice'].includes(body.action))return fail('Operação inválida.');
      const q=await sb.rpc('admin_order_action',{p_order_id:body.id,p_action:body.action,p_value:body.value===undefined?null:String(body.value)});
      if(q.error)return fail(friendly(q.error.message),409);
      return send({order:q.data});
    }
    if(route==='admin-cancel' && method==='POST') {
      if(!validUuid(body.id))return fail('Pedido inválido.');
      const q=await sb.rpc('cancel_order',{p_order_id:body.id});
      if(q.error)return fail(friendly(q.error.message),409);
      return q.data?send({ok:true}):fail('Este pedido já foi encerrado.',409);
    }
    return fail('Rota não encontrada.',404);
  } catch(e) {
    console.error('Adega API error',e?.message || e);
    return fail('Falha no servidor. Confira o banco de dados e tente novamente.',500);
  }
}
