-- ADEGA DIGITAL / 2026-11-23
-- Execute UMA VEZ após INSTALACAO_COMPLETA_NOVO_BANCO.sql; idempotente em reexecução.
-- NÃO altera os preços editados no admin, nem inventa quantidades disponíveis.
-- Cada dose de Whisky/Gin/Doses exige gelo e energético compatível; estoque validado no banco.
BEGIN;
CREATE TABLE IF NOT EXISTS public.drink_options(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 option_group text NOT NULL CHECK(option_group IN ('ice','energy')),
 name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
 active boolean NOT NULL DEFAULT false,
 stock integer NOT NULL DEFAULT 0 CHECK(stock BETWEEN 0 AND 1000000),
 unlimited boolean NOT NULL DEFAULT false,
 sort_order integer NOT NULL DEFAULT 0,
 UNIQUE(option_group,name)
);
ALTER TABLE public.drink_options ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.drink_options FROM PUBLIC,anon,authenticated;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS ice_option_id uuid REFERENCES public.drink_options(id);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS energy_option_id uuid REFERENCES public.drink_options(id);
-- Valores sugeridos para sabores, todos começam pausados até o dono confirmar e cadastrar estoque.
INSERT INTO public.drink_options(option_group,name,active,stock,unlimited,sort_order) VALUES
  ('ice','Gelo de água',false,0,false,1),
  ('ice','Coco',false,0,false,2),
  ('ice','Maracujá',false,0,false,3),
  ('ice','Melancia',false,0,false,4),
  ('ice','Morango',false,0,false,5),
  ('ice','Maçã verde',false,0,false,6),
  ('energy','Red Bull Original',false,0,false,1),
  ('energy','Red Bull Sugarfree',false,0,false,2),
  ('energy','Red Bull Zero',false,0,false,3),
  ('energy','Red Bull Tropical — Frutas Tropicais',false,0,false,4),
  ('energy','Red Bull Melancia',false,0,false,5),
  ('energy','Red Bull Melão — Maracujá e Melão',false,0,false,6),
  ('energy','Red Bull Pêssego — Morango e Pêssego',false,0,false,7),
  ('energy','Red Bull Cereja — Frutas Silvestres',false,0,false,8),
  ('energy','Red Bull White Sugarfree — Cereja e Baunilha',false,0,false,9),
  ('energy','Red Bull Nectarina Sugarfree',false,0,false,10),
  ('energy','Red Bull Ice Sugarfree — Blueberry e Baunilha',false,0,false,11),
  ('energy','Red Bull Maçã Sugarfree',false,0,false,12),
  ('energy','Red Bull Amora Sugarfree — Frutas Vermelhas',false,0,false,13),
  ('energy','Red Bull Pomelo Sugarfree',false,0,false,14),
  ('energy','Vibe Original',false,0,false,99)
ON CONFLICT (option_group,name) DO NOTHING;
-- Organizar Doses por destilado sem classificar vodka como gin/whisky.
UPDATE public.products SET category='Whisky'
WHERE category='Doses' AND name IN (
 'Jack com Red Bull','Cavalo com Red Bull','Cavalo com Vibe',
 'Ballantine''s com Red Bull','Ballantine''s com Vibe',
 'Red Label com Red Bull','Bell''s com Red Bull'
);
UPDATE public.products SET category='Gin'
WHERE category='Doses' AND name IN ('Beefeater com Red Bull','Rocks com Red Bull');
-- Valores recebidos do dono (D O S E S avulsas), NÃO presumir energético incluso.
INSERT INTO public.products(name,category,description,price_cents,stock,active,unlimited,icon,age_restricted,sort_order,image_url)
SELECT v.name,'Gin',v.description,v.price,0,false,false,'🍸',true,v.ord,'/imagens/foto-pendente.webp'
FROM (VALUES
 ('Gin (dose)','Gin com gelo e Red Bull incluídos no valor; copo 700 ml.',1000,150),
 ('Rocks (dose)','Rocks com gelo e Red Bull incluídos no valor; copo 700 ml.',2500,151),
 ('Beefeater (dose)','Beefeater com gelo e Red Bull incluídos no valor; copo 700 ml.',3000,152),
 ('Bossa Nova (dose)','Bossa Nova com gelo e Red Bull incluídos no valor; copo 700 ml.',4000,153),
 ('Tanqueray (dose)','Tanqueray com gelo e Red Bull incluídos no valor; copo 700 ml.',4000,154)
) AS v(name,description,price,ord)
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE lower(trim(p.name))=lower(trim(v.name)));
-- Gelo de água fora de doses (venda separada) aguarda preço e estoque do proprietário.
INSERT INTO public.products(name,category,description,price_cents,stock,active,unlimited,icon,age_restricted,sort_order,image_url)
SELECT 'Gelo de água','Complementos','Gelo comum. Informe preço e estoque antes de liberar venda avulsa.',0,0,false,false,'🧊',false,610,'/imagens/foto-pendente.webp'
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE lower(trim(p.name))='gelo de água');
-- Preços confirmados no WhatsApp e nos cartazes (somente onde ainda não havia preço).
-- O estoque continua zero até o dono conferir as unidades.
UPDATE public.products SET price_cents=350 WHERE category='Salgadinhos' AND name ILIKE 'Fofura%' AND price_cents=0;
UPDATE public.products SET price_cents=300 WHERE category='Salgadinhos' AND name ILIKE 'Torcida%' AND price_cents=0;
UPDATE public.products SET price_cents=300 WHERE category='Doces e Balas' AND name ILIKE 'Trident%' AND price_cents=0;
UPDATE public.products SET price_cents=50 WHERE category='Doces e Balas' AND name ILIKE 'Bubbaloo%' AND price_cents=0;
UPDATE public.products SET price_cents=250 WHERE category='Doces e Balas' AND name ILIKE 'Mentos%' AND price_cents=0;
UPDATE public.products SET price_cents=1500 WHERE category='Doces e Balas' AND name ILIKE 'Caixa de bombons%' AND price_cents=0;
INSERT INTO public.products(name,category,description,price_cents,stock,active,icon,age_restricted,sort_order,image_url)
SELECT v.name,v.category,v.description,v.price,0,false,v.icon,v.restricted,v.ord,'/imagens/foto-pendente.webp'
FROM (VALUES
 ('Halls','Doces e Balas','Valor informado pelo dono; sabores e tamanhos a confirmar.',300,'🍬',false,760),
 ('Plutonita (estoque interno)','Tabacaria','Valor informado pelo dono; manter apenas em estoque interno.',25,'📦',true,910),
 ('Saquinho de tabaco','Tabacaria','Preço final confirmado em conversa: R$ 3,00. Apenas controle interno.',300,'📦',true,911),
 ('Carvão (unidade)','Tabacaria','Unidade de carvão. Apenas controle interno.',100,'🔥',true,912),
 ('Papel alumínio (unidade)','Tabacaria','Unidade. Apenas controle interno.',50,'📦',true,913),
 ('Essência ZGY','Tabacaria','Sabores cadastrados individualmente no controle interno. R$ 12,00.',1200,'📦',true,914)
) AS v(name,category,description,price,icon,restricted,ord)
WHERE NOT EXISTS(SELECT 1 FROM public.products p WHERE lower(trim(p.name))=lower(trim(v.name)));
UPDATE public.products SET price_cents=650 WHERE category='Tabacaria' AND name IN('Eight Box','Gift (maço branco)') AND price_cents=0;
UPDATE public.products SET price_cents=1000 WHERE category='Tabacaria' AND name='Tesoura rosa para acessórios' AND price_cents=0;
UPDATE public.products SET price_cents=600 WHERE category='Tabacaria' AND name IN('Piteira','Piteira Night') AND price_cents=0;
UPDATE public.products SET price_cents=500 WHERE category='Tabacaria' AND name IN('Sadhu Longa') AND price_cents=0;
UPDATE public.products SET price_cents=300 WHERE category='Tabacaria' AND name IN('Seda Zomo') AND price_cents=0;
UPDATE public.products SET price_cents=1600 WHERE category='Tabacaria' AND name IN('Acréma Blend') AND price_cents=0;
UPDATE public.products SET price_cents=1200 WHERE category='Tabacaria' AND name ILIKE 'ZGY%' AND price_cents=0;
-- Copos de 700 ml: o preço do gelo e energético está incluído nas doses.
UPDATE public.products SET description='Dose no copo de 700 ml, com gelo de água ou saborizado e energético inclusos.'
WHERE category IN ('Whisky','Gin','Doses') AND description ILIKE 'Dose com energético%';
UPDATE public.products SET description='Batida no copo de 700 ml. Foto ilustrativa do sabor; preparação pode variar.'
WHERE category='Batidas' AND description='Sabor apresentado no cardápio da adega.';
UPDATE public.products SET description='Caipirinha no copo de 700 ml. Somente limão e morango conforme disponibilidade.'
WHERE category='Caipirinhas' AND name IN ('Caipirinha de Limão','Caipirinha de Morango')
 AND description ILIKE 'Sabor visto no cartaz%';

-- Sugestões opcionais da finalização: sem inventar valores nem quantidades.
-- O admin libera cada produto somente depois de confirmar preço e estoque.
INSERT INTO public.products(name,category,description,price_cents,stock,active,unlimited,icon,age_restricted,sort_order,image_url)
SELECT v.name,'Doces e Balas',v.description,0,0,false,false,v.icon,false,v.ord,'/imagens/foto-pendente.webp'
FROM (VALUES
 ('Pirulito','Pirulito avulso; aguardar preço e estoque do proprietário.','🍭',766),
 ('Bala (unidade)','Bala avulsa; aguardar preço e estoque do proprietário.','🍬',767)
) AS v(name,description,icon,ord)
WHERE NOT EXISTS(SELECT 1 FROM public.products p WHERE lower(trim(p.name))=lower(trim(v.name)));

-- Conferência do cartaz: draft foi cadastrado como R$ 13,00 no JSON antigo, placa R$ 15,00.
UPDATE public.products SET price_cents=1500 WHERE lower(trim(name))='draft' AND price_cents=1300;
-- Somente limão e morango conforme dono; demais sabores antigos permanecem no histórico, pausados.
UPDATE public.products SET active=false WHERE category='Caipirinhas'
 AND name NOT IN ('Caipirinha de Limão','Caipirinha de Morango');
UPDATE public.products SET price_cents=1500 WHERE name IN('Caipirinha de Limão','Caipirinha de Morango')
 AND price_cents=0;

CREATE OR REPLACE FUNCTION public.place_order(
 p_first_name text,p_last_name text,p_payment_method text,p_cash_given_cents integer,p_items jsonb
) RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_order public.orders;
 v_product public.products;
 v_option public.drink_options;
 v_ice public.drink_options;
 v_energy public.drink_options;
 v_i record;
 v_total bigint := 0;
 v_age boolean := false;
BEGIN
 IF NOT coalesce((SELECT accepting_orders FROM public.store_settings WHERE id=1),false) THEN RAISE EXCEPTION 'ADEGA_FECHADA'; END IF;
 IF length(trim(coalesce(p_first_name,''))) NOT BETWEEN 2 AND 60
    OR length(trim(coalesce(p_last_name,''))) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'INFORME_NOME_SOBRENOME'; END IF;
 IF p_payment_method NOT IN ('cash','card') THEN RAISE EXCEPTION 'PAGAMENTO_ONLINE_EM_CONFIGURACAO'; END IF;
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 30 THEN
   RAISE EXCEPTION 'CARRINHO_INVALIDO';
 END IF;
 IF EXISTS(
   SELECT 1 FROM jsonb_array_elements(p_items) x
   WHERE coalesce(x->>'id','') !~ '^[0-9a-fA-F-]{36}$'
      OR coalesce(x->>'quantity','') !~ '^\d{1,2}$'
      OR (coalesce(x->>'ice_id','')<>'' AND x->>'ice_id' !~ '^[0-9a-fA-F-]{36}$')
      OR (coalesce(x->>'energy_id','')<>'' AND x->>'energy_id' !~ '^[0-9a-fA-F-]{36}$')
 ) THEN RAISE EXCEPTION 'ITEM_INVALIDO'; END IF;
 -- Primeiro bloquear os produtos (ordem consistente), somando as variações.
 FOR v_i IN SELECT (value->>'id')::uuid id, sum((value->>'quantity')::integer)::integer qty
  FROM jsonb_array_elements(p_items) value GROUP BY 1 ORDER BY 1 LOOP
   IF v_i.qty NOT BETWEEN 1 AND 99 THEN RAISE EXCEPTION 'QUANTIDADE_INVALIDA'; END IF;
   SELECT * INTO v_product FROM public.products WHERE id=v_i.id FOR UPDATE;
   IF NOT FOUND OR NOT v_product.active OR v_product.price_cents<=0
      OR v_product.category='Tabacaria' THEN RAISE EXCEPTION 'PRODUTO_INDISPONIVEL'; END IF;
   IF NOT v_product.unlimited AND v_product.stock < v_i.qty THEN RAISE EXCEPTION 'ESTOQUE_INSUFICIENTE: %',v_product.name; END IF;
   v_total:=v_total+v_product.price_cents::bigint*v_i.qty;
   v_age:=v_age OR v_product.age_restricted;
 END LOOP;
 -- Depois bloquear os sabores por ID, somando todas as doses, contra estoque ultrapassado.
 FOR v_i IN
  SELECT option_id, opt_group, sum(qty)::integer qty FROM (
   SELECT nullif(value->>'ice_id','')::uuid option_id,'ice'::text opt_group,(value->>'quantity')::integer qty
   FROM jsonb_array_elements(p_items) value
   UNION ALL
   SELECT nullif(value->>'energy_id','')::uuid option_id,'energy'::text opt_group,(value->>'quantity')::integer qty
   FROM jsonb_array_elements(p_items) value
  ) a WHERE option_id IS NOT NULL
  GROUP BY option_id,opt_group ORDER BY option_id,opt_group
 LOOP
   SELECT * INTO v_option FROM public.drink_options WHERE id=v_i.option_id FOR UPDATE;
   IF NOT FOUND OR v_option.option_group<>v_i.opt_group OR NOT v_option.active
       OR (NOT v_option.unlimited AND v_option.stock < v_i.qty) THEN RAISE EXCEPTION 'OPCAO_INDISPONIVEL'; END IF;
 END LOOP;
 IF v_total NOT BETWEEN 1 AND 100000000 THEN RAISE EXCEPTION 'VALOR_INVALIDO'; END IF;
 IF p_payment_method='cash' AND (p_cash_given_cents IS NULL OR p_cash_given_cents<v_total)
 THEN RAISE EXCEPTION 'VALOR_PARA_TROCO_INSUFICIENTE'; END IF;
 -- Validar todas as combinações ANTES de criar pedido.
 FOR v_i IN
  SELECT (value->>'id')::uuid id,nullif(value->>'ice_id','')::uuid ice_id,
    nullif(value->>'energy_id','')::uuid energy_id,sum((value->>'quantity')::integer)::integer qty
  FROM jsonb_array_elements(p_items) value GROUP BY 1,2,3 ORDER BY 1,2,3
 LOOP
   SELECT * INTO v_product FROM public.products WHERE id=v_i.id;
   IF v_product.category IN ('Doses','Whisky','Gin') THEN
     IF v_i.ice_id IS NULL OR v_i.energy_id IS NULL THEN RAISE EXCEPTION 'SELECIONE_GELO_ENERGETICO'; END IF;
     SELECT * INTO v_ice FROM public.drink_options WHERE id=v_i.ice_id;
     SELECT * INTO v_energy FROM public.drink_options WHERE id=v_i.energy_id;
     IF v_ice.option_group<>'ice' OR v_energy.option_group<>'energy' THEN RAISE EXCEPTION 'OPCAO_INDISPONIVEL'; END IF;
     IF position('com red bull' IN lower(v_product.name))>0 THEN
       IF left(v_energy.name,8)<>'Red Bull' THEN RAISE EXCEPTION 'ENERGETICO_DA_DOSE_INCORRETO'; END IF;
     ELSIF position('com vibe' IN lower(v_product.name))>0 THEN
       IF v_energy.name<>'Vibe Original' THEN RAISE EXCEPTION 'ENERGETICO_DA_DOSE_INCORRETO'; END IF;
     ELSE
       -- Nas doses de whisky e gin o Red Bull e o gelo já estão INCLUSOS.
       IF left(v_energy.name,8)<>'Red Bull' THEN RAISE EXCEPTION 'ENERGETICO_DA_DOSE_INCORRETO'; END IF;
     END IF;
   ELSIF v_i.ice_id IS NOT NULL OR v_i.energy_id IS NOT NULL THEN
     RAISE EXCEPTION 'OPCAO_NAO_PERMITIDA';
   END IF;
 END LOOP;
 INSERT INTO public.orders(first_name,last_name,payment_method,cash_given_cents,total_cents,age_required)
 VALUES(trim(p_first_name),trim(p_last_name),p_payment_method,
 CASE WHEN p_payment_method='cash' THEN p_cash_given_cents ELSE NULL END,v_total::integer,v_age)
 RETURNING * INTO v_order;
 FOR v_i IN
  SELECT (value->>'id')::uuid id,nullif(value->>'ice_id','')::uuid ice_id,
    nullif(value->>'energy_id','')::uuid energy_id,sum((value->>'quantity')::integer)::integer qty
  FROM jsonb_array_elements(p_items) value GROUP BY 1,2,3 ORDER BY 1,2,3
 LOOP
   SELECT * INTO v_product FROM public.products WHERE id=v_i.id;
   IF v_i.ice_id IS NOT NULL THEN
     SELECT * INTO v_ice FROM public.drink_options WHERE id=v_i.ice_id;
     SELECT * INTO v_energy FROM public.drink_options WHERE id=v_i.energy_id;
   END IF;
   INSERT INTO public.order_items(order_id,product_id,product_name,quantity,unit_price_cents,ice_option_id,energy_option_id)
   VALUES (v_order.id,v_product.id,
    CASE WHEN v_i.ice_id IS NULL THEN v_product.name
    ELSE v_product.name || ' — Gelo: ' || v_ice.name || ' — Energético: ' || v_energy.name END,
    v_i.qty,v_product.price_cents,v_i.ice_id,v_i.energy_id);
   IF NOT v_product.unlimited THEN UPDATE public.products SET stock=stock-v_i.qty WHERE id=v_product.id; END IF;
 END LOOP;
 FOR v_i IN
  SELECT option_id,sum(qty)::integer qty FROM (
    SELECT nullif(value->>'ice_id','')::uuid option_id,(value->>'quantity')::integer qty FROM jsonb_array_elements(p_items) value
    UNION ALL
    SELECT nullif(value->>'energy_id','')::uuid option_id,(value->>'quantity')::integer qty FROM jsonb_array_elements(p_items) value
  ) o WHERE option_id IS NOT NULL GROUP BY option_id ORDER BY option_id
 LOOP
  UPDATE public.drink_options SET stock=stock-v_i.qty WHERE id=v_i.option_id AND NOT unlimited;
 END LOOP;
 RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.orders; i record;
BEGIN
 SELECT * INTO v FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v.status IN ('cancelled','delivered') THEN RETURN false; END IF;
 IF v.payment_status='paid' THEN RAISE EXCEPTION 'PEDIDO_PAGO_EXIGE_ESTORNO'; END IF;
 FOR i IN SELECT product_id,sum(quantity)::integer qty FROM public.order_items WHERE order_id=p_order_id
  GROUP BY product_id ORDER BY product_id LOOP
  UPDATE public.products SET stock=stock+i.qty WHERE id=i.product_id AND NOT unlimited;
 END LOOP;
 FOR i IN SELECT option_id,sum(quantity)::integer qty FROM (
   SELECT ice_option_id option_id,quantity FROM public.order_items WHERE order_id=p_order_id
   UNION ALL
   SELECT energy_option_id option_id,quantity FROM public.order_items WHERE order_id=p_order_id
 ) x WHERE option_id IS NOT NULL GROUP BY option_id ORDER BY option_id LOOP
  UPDATE public.drink_options SET stock=stock+i.qty WHERE id=i.option_id AND NOT unlimited;
 END LOOP;
 UPDATE public.orders SET status='cancelled',updated_at=now() WHERE id=p_order_id;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.place_order(text,text,text,integer,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cancel_order(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(text,text,text,integer,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO service_role;
COMMIT;
