-- ADEGA DIGITAL — Jefferson Felix
-- Rode UMA vez no SQL Editor do Supabase (projeto novo).
-- Depois: Authentication > Users > Add user e adicione o UUID do dono em admin_users.
-- Todos os pedidos são criados em transação, com reserva atômica de estoque.
create extension if not exists pgcrypto;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.store_settings (
  id integer primary key default 1 check (id = 1),
  name text not null default 'ADEGA DIGITAL',
  accepting_orders boolean not null default true,
  low_stock_threshold integer not null default 5 check (low_stock_threshold between 0 and 1000)
);
insert into public.store_settings(id) values (1);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  category text not null default 'Bebidas',
  description text not null default '',
  price_cents integer not null default 0 check (price_cents between 0 and 100000000),
  stock integer not null default 0 check (stock between 0 and 1000000),
  unlimited boolean not null default false,
  active boolean not null default true,
  icon text not null default '🥤',
  image_url text,
  age_restricted boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index products_categories_idx on public.products(category,sort_order);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated always as identity unique,
  public_token uuid not null default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 2 and 60),
  last_name text not null check (char_length(last_name) between 2 and 80),
  payment_method text not null check (payment_method in ('cash','card','pix','apple','google')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed')),
  status text not null default 'received' check (status in ('received','preparing','ready','delivered','cancelled')),
  cash_given_cents integer,
  total_cents integer not null check(total_cents between 1 and 100000000),
  receipt_checked boolean not null default false,
  age_required boolean not null default false,
  age_checked boolean not null default false,
  voice text check (voice in ('female','male')),
  payment_provider_ref text unique,
  paid_at timestamptz,
  ready_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_created_idx on public.orders(created_at desc);
create index orders_status_idx on public.orders(status);
create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  quantity integer not null check (quantity between 1 and 99),
  unit_price_cents integer not null check (unit_price_cents > 0)
);
create index order_items_order_idx on public.order_items(order_id);

alter table public.admin_users enable row level security;
alter table public.store_settings enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
-- A API da Netlify usa service_role; navegador não lê/edita tabelas diretamente.
revoke all on public.admin_users,public.store_settings,public.products,public.orders,public.order_items from anon,authenticated;
revoke all on all sequences in schema public from anon,authenticated;

create function public.place_order(p_first_name text,p_last_name text,p_payment_method text,p_cash_given_cents integer,p_items jsonb)
returns public.orders language plpgsql security definer set search_path = public,pg_temp as $$
declare v_order public.orders; v_product public.products; v_i record; v_total bigint:=0; v_age boolean:=false; v_count integer:=0;
begin
  if not (select accepting_orders from public.store_settings where id=1) then raise exception 'ADEGA_FECHADA'; end if;
  if length(trim(coalesce(p_first_name,''))) not between 2 and 60 or length(trim(coalesce(p_last_name,''))) not between 2 and 80 then raise exception 'INFORME_NOME_SOBRENOME'; end if;
  if p_payment_method not in ('cash','card') then raise exception 'PAGAMENTO_ONLINE_EM_CONFIGURACAO'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items)>30 then raise exception 'CARRINHO_INVALIDO'; end if;
  -- UUID + quantidade de cada item validados antes do cast; os IDs são bloqueados em ordem estável.
  if exists(select 1 from jsonb_array_elements(p_items) x where coalesce(x->>'id','') !~ '^[0-9a-fA-F-]{36}$' or coalesce(x->>'quantity','') !~ '^\d{1,2}$') then raise exception 'ITEM_INVALIDO'; end if;
  for v_i in select (value->>'id')::uuid id, sum((value->>'quantity')::integer)::integer qty
    from jsonb_array_elements(p_items) value group by 1 order by 1 loop
    v_count:=v_count+1;
    if v_i.qty not between 1 and 99 then raise exception 'QUANTIDADE_INVALIDA'; end if;
    select * into v_product from public.products where id=v_i.id for update;
    if not found or not v_product.active or v_product.price_cents=0 or v_product.category='Tabacaria' then raise exception 'PRODUTO_INDISPONIVEL'; end if;
    if not v_product.unlimited and v_product.stock<v_i.qty then raise exception 'ESTOQUE_INSUFICIENTE: %',v_product.name; end if;
    v_total:=v_total+v_product.price_cents::bigint*v_i.qty;
    v_age:=v_age or v_product.age_restricted;
  end loop;
  if v_total<1 or v_total>100000000 then raise exception 'VALOR_INVALIDO'; end if;
  if p_payment_method='cash' and p_cash_given_cents is not null and p_cash_given_cents<v_total then raise exception 'VALOR_PARA_TROCO_INSUFICIENTE'; end if;
  insert into public.orders(first_name,last_name,payment_method,cash_given_cents,total_cents,age_required)
    values(trim(p_first_name),trim(p_last_name),p_payment_method,case when p_payment_method='cash' then p_cash_given_cents else null end,v_total::integer,v_age) returning * into v_order;
  for v_i in select (value->>'id')::uuid id, sum((value->>'quantity')::integer)::integer qty
    from jsonb_array_elements(p_items) value group by 1 order by 1 loop
    select * into v_product from public.products where id=v_i.id;
    insert into public.order_items(order_id,product_id,product_name,quantity,unit_price_cents)
      values(v_order.id,v_product.id,v_product.name,v_i.qty,v_product.price_cents);
    if not v_product.unlimited then update public.products set stock=stock-v_i.qty where id=v_product.id; end if;
  end loop;
  return v_order;
end;
$$;

create function public.adjust_product_stock(p_product_id uuid,p_mode text,p_quantity integer)
returns public.products language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.products;
begin
  if p_mode not in ('set','add') or p_quantity not between 0 and 1000000 then raise exception 'ESTOQUE_INVALIDO'; end if;
  update public.products set stock=case when p_mode='set' then p_quantity else stock+p_quantity end, unlimited=false
    where id=p_product_id and (p_mode='set' or stock+p_quantity<=1000000) returning * into v;
  if not found then raise exception 'PRODUTO_NAO_ENCONTRADO_OU_LIMITE'; end if;
  return v;
end;
$$;

create function public.cancel_order(p_order_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.orders; i record;
begin
  select * into v from public.orders where id=p_order_id for update;
  if not found or v.status in ('cancelled','delivered') then return false; end if;
  if v.payment_status='paid' then raise exception 'PEDIDO_PAGO_EXIGE_ESTORNO'; end if;
  for i in select product_id,quantity from public.order_items where order_id=p_order_id order by product_id loop
    update public.products set stock=stock+i.quantity where id=i.product_id and not unlimited;
  end loop;
  update public.orders set status='cancelled',updated_at=now() where id=p_order_id;
  return true;
end;
$$;

create function public.admin_order_action(p_order_id uuid,p_action text,p_value text default null)
returns public.orders language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.orders; nxt text;
begin
  select * into v from public.orders where id=p_order_id for update;
  if not found then raise exception 'PEDIDO_NAO_ENCONTRADO'; end if;
  if v.status in ('cancelled','delivered') then raise exception 'PEDIDO_ENCERRADO'; end if;
  if p_action='voice' then
    if p_value not in ('female','male') then raise exception 'VOZ_INVALIDA'; end if;
    update public.orders set voice=p_value,updated_at=now() where id=p_order_id;
  elsif p_action='age' then
    update public.orders set age_checked=true,updated_at=now() where id=p_order_id;
  elsif p_action='receipt' then
    if v.payment_method<>'pix' or v.payment_status<>'paid' then raise exception 'PIX_AINDA_NAO_CONFIRMADO'; end if;
    update public.orders set receipt_checked=true,updated_at=now() where id=p_order_id;
  elsif p_action='paid' then
    if v.payment_method not in ('cash','card') then raise exception 'CONFIRMACAO_ONLINE_SOMENTE_PELO_GATEWAY'; end if;
    update public.orders set payment_status='paid',paid_at=coalesce(paid_at,now()),updated_at=now() where id=p_order_id;
  elsif p_action='status' then
    nxt=p_value;
    if (v.status='received' and nxt not in ('preparing','ready')) or
       (v.status='preparing' and nxt<>'ready') or
       (v.status='ready' and nxt<>'delivered') then raise exception 'TRANSICAO_DE_STATUS_INVALIDA'; end if;
    if nxt='ready' and v.voice is null then raise exception 'ESCOLHA_VOZ_MASCULINA_OU_FEMININA'; end if;
    if nxt='delivered' then
      if v.payment_status<>'paid' then raise exception 'PAGAMENTO_NAO_CONFIRMADO'; end if;
      if v.payment_method='pix' and not v.receipt_checked then raise exception 'CONFIRA_COMPROVANTE_PIX'; end if;
      if v.age_required and not v.age_checked then raise exception 'CONFIRA_DOCUMENTO_MAIORIDADE'; end if;
    end if;
    update public.orders set status=nxt,ready_at=case when nxt='ready' then now() else ready_at end,updated_at=now() where id=p_order_id;
  else raise exception 'ACAO_INVALIDA'; end if;
  select * into v from public.orders where id=p_order_id;
  return v;
end;
$$;

revoke all on function public.place_order(text,text,text,integer,jsonb) from public,anon,authenticated;
revoke all on function public.adjust_product_stock(uuid,text,integer) from public,anon,authenticated;
revoke all on function public.cancel_order(uuid) from public,anon,authenticated;
revoke all on function public.admin_order_action(uuid,text,text) from public,anon,authenticated;
grant execute on function public.place_order(text,text,text,integer,jsonb) to service_role;
grant execute on function public.adjust_product_stock(uuid,text,integer) to service_role;
grant execute on function public.cancel_order(uuid) to service_role;
grant execute on function public.admin_order_action(uuid,text,text) to service_role;

-- Catálogo inicial somente com NOMES. Preço 0 = não vendável; cadastre valores reais pelo admin.
insert into public.products(name,category,price_cents,stock,icon,age_restricted,sort_order) values
 ('Água','Águas',0,0,'💧',false,1),
 ('Dose','Doses',0,0,'🥃',true,2),
 ('Batida','Batidas',0,0,'🍹',true,3),
 ('Gelo','Complementos',0,0,'🧊',false,4);

-- Seção Tabacaria no final. Seda cadastrada para testar pedido REAL em dinheiro.
-- Outros itens ficam pausados, sem valor e sem estoque.
insert into public.products(name,category,description,price_cents,stock,active,icon,age_restricted,sort_order) values
 ('Seda','Tabacaria','Papel para enrolar. Retirada no portão.',300,10,true,'📜',true,800),
 ('Carvão','Tabacaria','Aguardando tabela de preços e verificação de regularidade.',0,0,false,'🔥',true,801),
 ('Acessórios','Tabacaria','Aguardando lista definitiva dos produtos permitidos.',0,0,false,'✦',true,802);

-- ATIVAR ACESSO DO DONO (DEPOIS de criar usuário no Supabase Auth):
-- insert into public.admin_users(user_id) values ('COLE-AQUI-O-UUID-DO-USUARIO');

-- Catálogo real extraído das fotos: preço visível nas placas, demais sem preço.
-- Cuidado: caso já exista banco, execute SOMENTE sql/catalogo_fotos_preco_editavel.sql.
-- ADEGA DIGITAL | Catálogo das fotos enviado pelo proprietário | Jefferson Felix
-- Pode executar uma vez em banco existente OU junto do setup.sql em instalação nova.
-- Preços são SOMENTE os visíveis nas placas; revisar e alterar pelo admin.
-- NÃO substitui preços que o dono já alterou.
-- Todos os novos itens começam com estoque ZERO (aguardando contagem física).
-- Preço ZERO = indisponível até o dono cadastrar no admin.
-- Não inclui produtos fumígenos ou dispositivos eletrônicos proibidos para venda online.
BEGIN;
INSERT INTO public.products (name,category,description,price_cents,stock,active,icon,age_restricted,sort_order)
SELECT v.name,v.category,v.description,v.price_cents,0,true,v.icon,v.age_restricted,v.sort_order
FROM (VALUES
  ('Corona','Cervejas','Preço da placa; confira a apresentação antes de ativar o estoque.',1000,'🍺',true,1),
  ('Heineken','Cervejas','Preço da placa; confira a apresentação antes de ativar o estoque.',1000,'🍺',true,2),
  ('Spaten','Cervejas','Preço da placa; confira a apresentação antes de ativar o estoque.',1000,'🍺',true,3),
  ('Budweiser','Cervejas','Preço da placa; confira a apresentação antes de ativar o estoque.',800,'🍺',true,4),
  ('Jack com Red Bull','Doses','Dose com energético, conforme placa de preços.',4500,'🥃',true,101),
  ('Cavalo com Red Bull','Doses','Dose com energético, conforme placa de preços.',3000,'🥃',true,102),
  ('Cavalo com Vibe','Doses','Dose com energético, conforme placa de preços.',2000,'🥃',true,103),
  ('Ballantine''s com Red Bull','Doses','Dose com energético, conforme placa de preços.',3000,'🥃',true,104),
  ('Ballantine''s com Vibe','Doses','Dose com energético, conforme placa de preços.',2000,'🥃',true,105),
  ('Red Label com Red Bull','Doses','Dose com energético, conforme placa de preços.',3500,'🥃',true,106),
  ('Beefeater com Red Bull','Doses','Dose com energético, conforme placa de preços.',3000,'🥃',true,107),
  ('Bell''s com Red Bull','Doses','Dose com energético, conforme placa de preços.',2500,'🥃',true,108),
  ('Absolut com Red Bull','Doses','Dose com energético, conforme placa de preços.',2500,'🥃',true,109),
  ('Cîroc com Red Bull','Doses','Dose com energético, conforme placa de preços.',6000,'🥃',true,110),
  ('Rocks com Red Bull','Doses','Dose com energético, conforme placa de preços.',2500,'🥃',true,111),
  ('Açaí Batido','Batidas','Sabor apresentado no cardápio da adega.',1500,'🍹',true,201),
  ('Abacaxi com vinho','Batidas','Sabor apresentado no cardápio da adega.',1500,'🍹',true,202),
  ('Céu Azul','Batidas','Sabor apresentado no cardápio da adega.',1500,'🍹',true,203),
  ('Ferrero Rocher','Batidas','Sabor apresentado no cardápio da adega.',1500,'🍹',true,204),
  ('Kinder Ovo','Batidas','Sabor apresentado no cardápio da adega.',1500,'🍹',true,205),
  ('Maracujá','Batidas','Sabor apresentado no cardápio da adega.',1500,'🍹',true,206),
  ('Morango com Nutella','Batidas','Sabor apresentado no cardápio da adega.',1500,'🍹',true,207),
  ('Frutas Vermelhas','Batidas','Sabor apresentado no cardápio da adega.',1500,'🍹',true,208),
  ('Ninho Trufado','Batidas','Sabor apresentado no cardápio da adega.',1200,'🍹',true,209),
  ('Caipirinha','Caipirinhas','Consulte os sabores disponíveis com a adega.',1500,'🍋',true,301),
  ('Caipirinha de cerveja','Caipirinhas','Valor a confirmar com o proprietário.',0,'🍋',true,302),
  ('Smirnoff Ice','Bebidas prontas','Bebida pronta, conforme placa de preços.',1000,'🍾',true,401),
  ('51 Ice','Bebidas prontas','Bebida pronta, conforme placa de preços.',800,'🍾',true,402),
  ('Draft','Bebidas prontas','Preço da placa R$ 15,00; marca e embalagem a confirmar.',1500,'🍾',true,403),
  ('Refrigerante em lata','Águas e Refrigerantes','Valor indicado na placa de preços.',600,'🥤',false,501),
  ('Doritos','Salgadinhos','Salgadinho visto nas fotos. Tamanho e preço a cadastrar.',0,'🍟',false,701),
  ('Fofura','Salgadinhos','Salgadinho visto nas fotos. Sabor e preço a cadastrar.',0,'🍟',false,702),
  ('Torcida','Salgadinhos','Salgadinho visto nas fotos. Sabor e preço a cadastrar.',0,'🍟',false,703),
  ('Bubbaloo','Doces e Balas','Goma de mascar vista nas fotos. Sabor e preço a cadastrar.',0,'🍬',false,704),
  ('Trident','Doces e Balas','Goma de mascar vista nas fotos. Sabor e preço a cadastrar.',0,'🍬',false,705),
  ('Mentos','Doces e Balas','Doce visto nas fotos. Sabor e preço a cadastrar.',0,'🍬',false,706),
  ('Isqueiro BIC','Tabacaria','Acessório visto nas fotos. Preço a cadastrar.',0,'🔥',false,803),
  ('Piteira','Tabacaria','Acessório visto nas fotos. Preço a cadastrar.',0,'✦',false,804)
) AS v(name,category,description,price_cents,icon,age_restricted,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE lower(trim(p.name))=lower(trim(v.name)));
-- Água já existe nas versões antigas do projeto: só preencher se ainda sem preço.
UPDATE public.products SET price_cents=250
WHERE lower(trim(name))='água' AND price_cents=0;
-- Desativar placeholders genéricos antigos; manter históricos e estoque intactos.
UPDATE public.products SET active=false
WHERE name IN ('Dose','Batida') AND price_cents=0 AND stock=0;
COMMIT;


-- DOCES E SALGADINHOS: primeira instalação, executado junto com este setup.
-- ADEGA DIGITAL | Jefferson Felix | Atualização doces e salgadinhos
-- Aplicar APENAS em bancos já criados. É idempotente.
-- NÃO altera preços, estoque, status de produtos existentes nem registros de pedidos.
-- As linhas novas ficam INATIVAS, com preço zero e estoque zero até o dono conferir.
BEGIN;
UPDATE public.products SET category='Doces e Balas'
WHERE category='Doces e Snacks' AND lower(trim(name)) IN ('bubbaloo','trident','mentos','bala felicidades','bala te adoro','balas sortidas');
UPDATE public.products SET category='Salgadinhos'
WHERE category='Doces e Snacks' AND lower(trim(name)) IN ('doritos','fofura','torcida');
UPDATE public.products SET category='Diversos'
WHERE category='Doces e Snacks' AND lower(trim(name)) IN ('pilhas panasonic','gel kids');
INSERT INTO public.products (name,category,description,price_cents,stock,active,icon,age_restricted,sort_order)
SELECT v.* FROM (VALUES
 ('Bala Felicidades','Doces e Balas','Caixas azuis Felicidades visíveis na prateleira. Confirmar se é bala/doce e a variedade antes de ativar.',0,0,false,'🍬',false,730),
 ('Bala Te Adoro','Doces e Balas','Caixas Te Adoro visíveis na prateleira. Confirmar tipo exato e sabor antes de ativar.',0,0,false,'🍬',false,731),
 ('Balas sortidas','Doces e Balas','Potes com guloseimas na prateleira; produto exato, unidade e preço a confirmar.',0,0,false,'🍭',false,732),
 ('Gel Kids','Diversos','Embalagens coloridas identificadas na vitrine. Confirmar se é doce ou brinquedo antes de ativar.',0,0,false,'📦',false,830),
 ('Pilhas Panasonic','Diversos','Pilhas visíveis na vitrine. Modelo e unidade a confirmar.',0,0,false,'🔋',false,831)
) AS v(name,category,description,price_cents,stock,active,icon,age_restricted,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE lower(trim(p.name))=lower(trim(v.name)));
-- Se ainda não foram criados, adicionar os produtos básicos presentes nas fotos.
INSERT INTO public.products (name,category,description,price_cents,stock,active,icon,age_restricted,sort_order)
SELECT v.* FROM (VALUES
 ('Bubbaloo','Doces e Balas','Chiclete identificado na vitrine; sabor e apresentação a confirmar.',0,0,false,'🍬',false,704),
 ('Trident','Doces e Balas','Chiclete identificado na vitrine; sabor e apresentação a confirmar.',0,0,false,'🍬',false,705),
 ('Mentos','Doces e Balas','Balas/chicletes Mentos identificados na vitrine; produto exato a confirmar.',0,0,false,'🍬',false,706),
 ('Doritos','Salgadinhos','Salgadinho identificado na prateleira; peso e sabor a confirmar.',0,0,false,'🥨',false,701),
 ('Fofura','Salgadinhos','Salgadinho identificado na prateleira; peso e sabor a confirmar.',0,0,false,'🥨',false,702),
 ('Torcida','Salgadinhos','Salgadinho identificado na prateleira; peso e sabor a confirmar.',0,0,false,'🥨',false,703)
) AS v(name,category,description,price_cents,stock,active,icon,age_restricted,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE lower(trim(p.name))=lower(trim(v.name)));
COMMIT;


-- Inclusão no setup para novos bancos: novos_itens_identificados_fotos.sql
-- Itens identificados nas fotografias, sem preço comprovado.
-- Todos entram INATIVOS e sem estoque até o dono confirmar.
-- Não são adicionados cigarros ou derivados do tabaco para venda online.
BEGIN;
INSERT INTO public.products(name,category,description,price_cents,stock,active,icon,age_restricted,sort_order)
SELECT t.* FROM (VALUES
  ('Caipirinha de Limão','Caipirinhas','Sabor visto no cartaz; preço e ingredientes a confirmar.',0,0,false,'✦',false,301),
  ('Caipirinha de Morango','Caipirinhas','Sabor visto no cartaz; preço e ingredientes a confirmar.',0,0,false,'✦',false,302),
  ('Caipirinha de Maracujá','Caipirinhas','Sabor visto no cartaz; preço e ingredientes a confirmar.',0,0,false,'✦',false,303),
  ('Caipirinha de Amora','Caipirinhas','Sabor visto no cartaz; preço e ingredientes a confirmar.',0,0,false,'✦',false,304),
  ('Caipirinha de Framboesa','Caipirinhas','Sabor visto no cartaz; preço e ingredientes a confirmar.',0,0,false,'✦',false,305),
  ('Bala Felicidades','Doces e Balas','Caixas azuis Felicidades vistas na prateleira; confirmar variedade.',0,0,false,'✦',false,801),
  ('Bala Te Adoro','Doces e Balas','Caixas Te Adoro vistas na prateleira; confirmar variedade.',0,0,false,'✦',false,802),
  ('Balas sortidas','Doces e Balas','Doces em potes, sabor e formato a cadastrar.',0,0,false,'✦',false,803),
  ('Pilhas Panasonic','Diversos','Pilhas vistas na vitrine; modelo/tamanho a confirmar.',0,0,false,'✦',false,804),
  ('Gel Kids','Diversos','Produtos coloridos Gel Kids identificados na vitrine; confirmar modelo.',0,0,false,'✦',false,805)
) AS t(name,category,description,price_cents,stock,active,icon,age_restricted,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE lower(trim(p.name))=lower(trim(t.name)));
COMMIT;


-- Inclusão no setup para novos bancos: conferencia_draft_vinho.sql
-- Conferência a partir das fotografias da adega em 23/11/2026.
-- Draft R$ 15,00: preço correto na placa. Atualização SOMENTE se o preço atual
-- continuar igual ao erro de importação (R$ 13,00). Não sobrescreve preço
-- diferente que o dono já tenha definido manualmente.
BEGIN;
UPDATE public.products
SET price_cents=1500,
    description='R$ 15,00 na placa; tipo, fabricante e embalagem ainda a confirmar.'
WHERE lower(trim(name))='draft' AND price_cents=1300;
-- Vinho avulso: a foto NÃO mostra marca, garrafa nem preço.
-- O registro fica inativo e sem estoque, aguardando o proprietário.
INSERT INTO public.products(name,category,description,price_cents,stock,active,icon,age_restricted,sort_order)
SELECT 'Vinho','Vinhos','Marca, uva/tipo, volume e preço não visíveis nas fotos. Confirmar o rótulo antes de ativar.',0,0,false,'🍷',true,380
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE lower(trim(name))='vinho');
COMMIT;

-- BLOQUEIO DE TABACARIA EM PEDIDOS ONLINE
-- RODE no SQL Editor do Supabase JÁ EXISTENTE uma vez.
-- Protege a gestão de Tabacaria: não permite incluir produtos dessa categoria em pedidos online.
-- A verificação acontece no banco de dados mesmo que alguém tente forçar IDs pela API.
CREATE OR REPLACE FUNCTION public.adega_bloquear_tabacaria_online()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.products WHERE id=NEW.product_id AND category='Tabacaria') THEN
    RAISE EXCEPTION 'PRODUTO_INDISPONIVEL';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_adega_bloquear_tabacaria_online ON public.order_items;
CREATE TRIGGER trg_adega_bloquear_tabacaria_online
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.adega_bloquear_tabacaria_online();
REVOKE ALL ON FUNCTION public.adega_bloquear_tabacaria_online() FROM PUBLIC,anon,authenticated;

-- INVENTARIO TABACARIA - SOMENTE ADMIN
-- INVENTÁRIO INTERNO de Tabacaria — marca/foto confirmadas onde legíveis.
-- Todos os produtos abaixo são visíveis apenas no ADMIN, nunca em pedidos online.
-- ZERO centavos = preço pendente, não produto grátis. Estoque ZERO e produto inativo.
-- Fotos recortadas das fotografias enviadas pelo proprietário, sem inventar embalagens.
BEGIN;
INSERT INTO public.products(name,category,description,price_cents,stock,active,icon,image_url,age_restricted,sort_order)
SELECT v.name,'Tabacaria',v.description,0,0,false,'📷',v.image_url,true,v.sort_order
FROM (VALUES
 ('ZGY Choco Menta', 'Tabaco ZGY, variedade Choco Menta legível na foto', '/imagens/zgy-choco-menta.webp', 850),
 ('ZGY (embalagem branca e amarela)', 'Embalagem da marca ZGY, sabor a confirmar', '/imagens/zgy-embalagem-branca-e-amarela.webp', 851),
 ('ZGY (embalagem verde)', 'Embalagem ZGY verde, sabor a confirmar', '/imagens/zgy-embalagem-verde.webp', 852),
 ('ZGY (embalagem roxa)', 'Embalagem ZGY roxa, sabor a confirmar', '/imagens/zgy-embalagem-roxa.webp', 853),
 ('ZGY Cream', 'Embalagem ZGY Cream, rótulo visto na foto', '/imagens/zgy-cream.webp', 854),
 ('ZGY (embalagem laranja)', 'Embalagem ZGY laranja, sabor a confirmar', '/imagens/zgy-embalagem-laranja.webp', 855),
 ('ZGY (embalagem rosa)', 'Embalagem ZGY rosa, sabor a confirmar', '/imagens/zgy-embalagem-rosa.webp', 856),
 ('ZGY Yellow', 'Embalagem ZGY Yellow', '/imagens/zgy-yellow.webp', 857),
 ('Onix Chiclete Canela', 'Embalagem Onix Chiclete Canela', '/imagens/onix-chiclete-canela.webp', 858),
 ('Onix Banana', 'Embalagem Onix Banana', '/imagens/onix-banana.webp', 859),
 ('Gift (maço branco)', 'Cigarro Gift; apresentação exata a confirmar', '/imagens/gift-maco-branco.webp', 860),
 ('Eight Box', 'Cigarro Eight Box, caixa identificada na foto', '/imagens/eight-box.webp', 861),
 ('Zomo Perfect', 'Produto Zomo Perfect; confirmar apresentação do pacote', '/imagens/zomo-perfect.webp', 862),
 ('Zomo Black', 'Produto Zomo Black; confirmar apresentação do pacote', '/imagens/zomo-black.webp', 863),
 ('Sadhu Longa', 'Seda Sadhu Longa, embalagem identificada', '/imagens/sadhu-longa.webp', 864),
 ('Seda O2', 'Seda O2, embalagem verde visível', '/imagens/seda-o2.webp', 865),
 ('Seda Mundial', 'Sedas Mundial, variações de cor; confirmar apresentação', '/imagens/seda-mundial.webp', 866),
 ('Piteira Night', 'Piteira Night visível na prateleira', '/imagens/piteira-night.webp', 867),
 ('Acréma Blend', 'Acréma Blend, variedade a confirmar', '/imagens/acrema-blend.webp', 868),
 ('Tabaquin', 'Tabaco Tabaquin, embalagem visível', '/imagens/tabaquin.webp', 869),
 ('BIC Mini (isqueiros)', 'Isqueiros BIC Mini, cores sortidas', '/imagens/bic-mini-isqueiros.webp', 870),
 ('Isqueiros coloridos', 'Isqueiros coloridos na vitrine', '/imagens/isqueiros-coloridos.webp', 871),
 ('Tesoura rosa para acessórios', 'Tesoura rosa exibida em embalagem transparente', '/imagens/tesoura-rosa-para-acessorios.webp', 872),
 ('Carvão Fumax Gold 1kg', 'Carvão Fumax Gold 1 kg, conforme embalagem', '/imagens/carvao-fumax-gold-1kg.webp', 873),
 ('Plutonita Baba de Bruxa', 'Embalagem Plutonita Baba de Bruxa, conferir tipo de produto', '/imagens/plutonita-baba-de-bruxa.webp', 874),
 ('Plutonita Abraço Congelante', 'Embalagem Plutonita Abraço Congelante, conferir tipo de produto', '/imagens/plutonita-abraco-congelante.webp', 875),
 ('Terror Zone', 'Embalagem Terror Zone, conferir tipo de produto', '/imagens/terror-zone.webp', 876),
 ('Cuia colorida', 'Cuia em cores variadas, fotografada pelo proprietário', '/imagens/cuia-colorida.webp', 877),
 ('Tabaco bolado', 'Tipo solicitado pelo proprietário; marca e embalagem a confirmar', '/imagens/foto-pendente.webp', 878),
 ('Narguilé', 'Modelo e foto a cadastrar pelo dono', '/imagens/foto-pendente.webp', 879),
 ('Essência para narguilé', 'Marca, sabor e foto a confirmar', '/imagens/foto-pendente.webp', 880),
 ('Papel alumínio para narguilé', 'Marca e apresentação a confirmar', '/imagens/foto-pendente.webp', 881),
 ('Seda Smoking', 'Marca informada no inventário; modelo e foto a confirmar', '/imagens/foto-pendente.webp', 882),
 ('Seda Zomo', 'Marca informada no inventário; modelo e foto a confirmar', '/imagens/foto-pendente.webp', 883),
 ('Cigarro Onix (outra variedade)', 'Variedade não identificada com segurança; atualizar marca e foto depois', '/imagens/foto-pendente.webp', 884)
) AS v(name,description,image_url,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE lower(trim(p.name))=lower(trim(v.name)));
-- Para Acréma Blend original, que já existia mas não possuía foto associada.
UPDATE public.products SET image_url='/imagens/acrema-blend.webp'
WHERE lower(trim(name))='acréma blend' AND (image_url IS NULL OR image_url='');
COMMIT;
