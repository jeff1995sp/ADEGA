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
