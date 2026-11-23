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
