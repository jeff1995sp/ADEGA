-- ADEGA DIGITAL — Complemento de catálogo Tabacaria (para banco já existente)
-- Só cria entradas base se ainda não existirem.
-- Seda: R$ 3,00 e estoque inicial de 10 unidades para teste de pedido REAL em dinheiro.
-- Os demais itens começam pausados e sem preço/estoque.
insert into public.products (name,category,description,price_cents,stock,active,icon,age_restricted,sort_order)
select v.name,'Tabacaria',v.description,v.price_cents,v.stock,v.active,v.icon,true,v.sort_order
from (values
  ('Seda','Papel para enrolar. Retirada no portão.','📜',800,300,10,true),
  ('Carvão','Aguardando tabela de preços e verificação de regularidade.','🔥',801,0,0,false),
  ('Acessórios','Aguardando lista definitiva dos produtos permitidos.','✦',802,0,0,false)
) as v(name,description,icon,sort_order,price_cents,stock,active)
where not exists (select 1 from public.products p where lower(p.name)=lower(v.name) and p.category='Tabacaria');
