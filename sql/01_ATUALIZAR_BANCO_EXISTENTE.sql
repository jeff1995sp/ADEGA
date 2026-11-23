-- UMA AÇÃO PARA QUEM JÁ TEM SUPABASE CRIADO
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
