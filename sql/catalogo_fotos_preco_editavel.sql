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
