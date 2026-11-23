-- Adega Jefferson: corrige produtos identificados pela embalagem nas fotos da loja.
-- Executar após a instalação ou atualização do banco, com autorização do proprietário.
-- Mantém preço, estoque, status e foto existentes.
BEGIN;
UPDATE public.products p
 SET name='Caixa de bombons Lacta Felicidades',
     description='Caixa de bombons sortidos Lacta Felicidades. Conferir a gramatura antes de ativar.'
 WHERE lower(trim(p.name))='bala felicidades'
   AND NOT EXISTS (SELECT 1 FROM public.products q WHERE lower(trim(q.name))='caixa de bombons lacta felicidades');
UPDATE public.products p
 SET name='Caixa de bombons Lacta Te Adoro',
     description='Caixa Lacta Te Adoro com Sonho de Valsa e Ouro Branco. Conferir a gramatura antes de ativar.'
 WHERE lower(trim(p.name))='bala te adoro'
   AND NOT EXISTS (SELECT 1 FROM public.products q WHERE lower(trim(q.name))='caixa de bombons lacta te adoro');
COMMIT;
