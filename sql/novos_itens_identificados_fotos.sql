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
