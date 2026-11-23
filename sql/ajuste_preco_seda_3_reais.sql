-- Ajuste pontual para bases já existentes: Seda R$ 3,00 por unidade.
-- Preço em centavos. Preserva estoque, pedidos existentes e demais produtos.
update public.products
set price_cents = 300
where lower(trim(name)) = 'seda'
  and lower(trim(category)) = 'tabacaria';
