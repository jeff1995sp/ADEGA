-- Hora Extra Drinks: Gin comum, opção de energético sem marca. Estoque começa pausado.
INSERT OR IGNORE INTO drink_options(id,option_group,name,active,stock,unlimited,sort_order) VALUES ('energy-common','energy','Energético',0,0,0,0);
UPDATE products SET description='Gin de 700 ml com gelo e energético. Escolha Energético ou Red Bull.',price_cents=1000 WHERE id='produto-062' AND category='Gin';
