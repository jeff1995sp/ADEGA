-- Novos produtos confirmados nas fotos ampliadas. Sem inventar preços.
-- Todos ficam PAUSADOS com estoque ZERO até conferência do dono.
-- Não inclui tabaco, cigarros, vapes, pods ou essências fumígenas à venda no site.
BEGIN;
INSERT INTO public.products (name,category,description,price_cents,stock,active,icon,age_restricted,sort_order)
SELECT v.* FROM (VALUES
  ('Fandangos','Salgadinhos','Produto visto na foto; sabor, peso e preço a confirmar',0,0,false,'📷',false,710),
  ('Lay''s (embalagem preta)','Salgadinhos','Produto visível na prateleira; sabor, peso e preço a confirmar',0,0,false,'📷',false,711),
  ('Fofura (embalagem azul)','Salgadinhos','Embalagem azul na foto; sabor e peso a confirmar',0,0,false,'📷',false,712),
  ('Fofura (embalagem vermelha)','Salgadinhos','Embalagem vermelha na foto; sabor e peso a confirmar',0,0,false,'📷',false,713),
  ('Fofura (embalagem roxa)','Salgadinhos','Embalagem roxa na foto; sabor e peso a confirmar',0,0,false,'📷',false,714),
  ('Torcida Bacon','Salgadinhos','Sabor bacon visível na embalagem; preço e peso a confirmar',0,0,false,'📷',false,715),
  ('Torcida (embalagem roxa)','Salgadinhos','Variante roxa visível; sabor e peso a confirmar',0,0,false,'📷',false,716),
  ('Torcida (embalagem verde)','Salgadinhos','Variante verde visível; sabor e peso a confirmar',0,0,false,'📷',false,717),
  ('Bubbaloo (embalagem rosa)','Doces e Balas','Embalagem rosa na foto; sabor e preço a confirmar',0,0,false,'📷',false,740),
  ('Bubbaloo (embalagem azul)','Doces e Balas','Embalagem azul na foto; sabor e preço a confirmar',0,0,false,'📷',false,741),
  ('Trident (embalagem verde)','Doces e Balas','Embalagem verde na foto; sabor e preço a confirmar',0,0,false,'📷',false,742),
  ('Trident (embalagem rosa)','Doces e Balas','Embalagem rosa na foto; sabor e preço a confirmar',0,0,false,'📷',false,743),
  ('Mentos Mint','Doces e Balas','Embalagem azul Mint na vitrine; apresentação e preço a confirmar',0,0,false,'📷',false,744),
  ('Mentos Wild','Doces e Balas','Embalagem verde Wild na vitrine; apresentação e preço a confirmar',0,0,false,'📷',false,745),
  ('Cuia','Tabacaria','Acessório colorido identificado pelo proprietário na foto',0,0,false,'📷',true,852),
  ('Tesoura','Tabacaria','Tesoura de cabo colorido vista em embalagem na vitrine',0,0,false,'📷',true,853),
  ('Carvão Fumax','Tabacaria','Carvão Fumax visto na vitrine; quantidade e preço a confirmar',0,0,false,'📷',true,854),
  ('Isqueiros sortidos','Tabacaria','Isqueiros sortidos vistos na vitrine; marcas e preço a confirmar',0,0,false,'📷',true,855)
) AS v(name,category,description,price_cents,stock,active,icon,age_restricted,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE lower(trim(p.name))=lower(trim(v.name)));
COMMIT;
