UPDATE products SET name='Fofura Presunto' WHERE id='produto-049' AND name='Fofura (embalagem azul)';
UPDATE products SET name='Fofura Churrasco' WHERE id='produto-051' AND name='Fofura (embalagem roxa)';
UPDATE products SET name='Torcida Churrasco' WHERE id='produto-053' AND name='Torcida (embalagem roxa)';
UPDATE products SET name='Bubbaloo Tutti-Frutti' WHERE id='produto-055' AND name='Bubbaloo (embalagem rosa)';
UPDATE products SET name='Bubbaloo Hortelã' WHERE id='produto-056' AND name='Bubbaloo (embalagem azul)';
UPDATE products SET name='Trident Melancia' WHERE id='produto-057' AND name='Trident (embalagem verde)';
UPDATE products SET name='Lay''s Sensações' WHERE id='produto-048' AND name='Lay''s (embalagem preta)';

-- Conferência das embalagens da loja; não altera estoque nem valores.
UPDATE products SET name='Doritos Queijo Nacho' WHERE id='produto-031' AND name='Doritos';
UPDATE products SET name='Fandangos Presunto' WHERE id='produto-047' AND name='Fandangos';
UPDATE products SET name='Fofura Queijo' WHERE id='produto-050' AND name='Fofura (embalagem vermelha)';
UPDATE products SET name='Torcida Pimenta Mexicana' WHERE id='produto-054' AND name='Torcida (embalagem verde)';
UPDATE products SET name='Trident — sabor a confirmar' WHERE id='produto-058' AND name='Trident (embalagem rosa)' AND active=0 AND stock=0;
