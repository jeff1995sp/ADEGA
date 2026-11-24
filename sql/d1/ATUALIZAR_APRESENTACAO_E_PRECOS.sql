-- ADEGA DIGITAL / D1. Execute no Console do banco adega-digital.
-- Atualiza preços somente quando ainda estão zerados; preserva estoque, status e fotos do proprietário.
UPDATE products SET category='Doces e Salgadinhos' WHERE category IN ('Doces e Balas','Salgadinhos','Doces e Snacks');
UPDATE products SET description='Caipirinha de limão no copo de 700 ml.' WHERE name='Caipirinha de Limão';
UPDATE products SET description='Caipirinha de morango no copo de 700 ml.' WHERE name='Caipirinha de Morango';
UPDATE products SET active=0 WHERE id='produto-067';
UPDATE products SET description='Cerveja gelada.' WHERE category='Cervejas' AND description LIKE 'Imagem ilustrativa para conferência%';
UPDATE products SET price_cents=CASE id
 WHEN 'produto-069' THEN 50 WHEN 'produto-070' THEN 15
 WHEN 'interno-868' THEN 1600 WHEN 'interno-877' THEN 800
 WHEN 'interno-870' THEN 500 WHEN 'interno-871' THEN 200
 WHEN 'interno-803' THEN 500 WHEN 'interno-807' THEN 200
 WHEN 'interno-801' THEN 100 WHEN 'interno-881' THEN 50
 WHEN 'interno-878' THEN 200 WHEN 'interno-860' THEN 650 WHEN 'interno-861' THEN 650
 WHEN 'interno-867' THEN 600 WHEN 'interno-804' THEN 600
 WHEN 'interno-872' THEN 1000 WHEN 'interno-805' THEN 1000
 WHEN 'interno-883' THEN 300 ELSE price_cents END
WHERE price_cents=0 AND id IN ('produto-069','produto-070','interno-868','interno-877','interno-870','interno-871','interno-803','interno-807','interno-801','interno-881','interno-878','interno-860','interno-861','interno-867','interno-804','interno-872','interno-805','interno-883');
-- Pilhas: valor informado como provável (R$ 5), manter pendente para confirmação.
-- Caipirinhas: apenas limão e morango no catálogo público.
-- Saquinho de tabaco e tabaco bolado são itens distintos, inventário interno.
INSERT OR IGNORE INTO products(id,name,category,description,price_cents,stock,active,age_restricted,image_url,sort_order)
VALUES
('produto-071','KitKat','Doces e Salgadinhos','Chocolate KitKat.',500,0,0,0,'/imagens/foto-pendente.webp',900),
('produto-072','Cocada','Doces e Salgadinhos','Doce de coco.',200,0,0,0,'/imagens/foto-pendente.webp',901),
('produto-073','Doce de abóbora','Doces e Salgadinhos','Doce de abóbora.',200,0,0,0,'/imagens/foto-pendente.webp',902),
('produto-074','Pé de moleque','Doces e Salgadinhos','Doce de amendoim.',200,0,0,0,'/imagens/foto-pendente.webp',903),
('produto-075','Salgadinho Bacon','Doces e Salgadinhos','Marca a confirmar.',400,0,0,0,'/imagens/foto-pendente.webp',904),
('produto-076','Plutonita','Doces e Salgadinhos','Chiclete.',25,0,0,0,'/imagens/plutonita-baba-de-bruxa.webp',905),
('interno-885','Saquinho de tabaco','Tabacaria','Somente controle interno.',300,0,0,1,'/imagens/foto-pendente.webp',906),
('interno-886','Seda Sadhu Slim','Tabacaria','Somente controle interno; embalagem a conferir.',500,0,0,1,'/imagens/foto-pendente.webp',907);
-- Não liberar automaticamente nenhum produto nem alterar valores não confirmados.
SELECT category,COUNT(*) AS quantidade FROM products GROUP BY category ORDER BY category;

UPDATE products SET category='Vodka' WHERE category='Doses';

UPDATE store_settings SET name='Hora Extra Drinks' WHERE id=1 AND lower(trim(name))='adega digital';
