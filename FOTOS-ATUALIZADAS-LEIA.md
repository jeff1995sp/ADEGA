# Fotos individuais dos produtos — Adega Digital

As imagens estão na pasta **`public/imagens/`**. Cada produto do catálogo recebe automaticamente a imagem que corresponde ao seu nome (mesmo sem preencher a URL no Supabase). O admin também exibe as miniaturas e aceita caminhos locais como `/imagens/cu ia.webp` (sem espaços; exemplo real: `/imagens/cuia.webp`).

- **Fotografias originais recortadas**: embalagens e acessórios que aparecem nas fotos ampliadas enviadas pelo proprietário, como Fandangos, Torcida, Fofura, Trident, Bubbaloo, Mentos, Cuia, tesoura, isqueiros, carvão e outros.
- **Fotos ilustrativas feitas por IA**: bebidas e batidas em copos plásticos transparentes de 700 ml, doses e outros produtos já existentes. Podem ter diferenças das embalagens reais.
- **Imagem neutra**: se ainda não há foto identificável, aparecerá "FOTO DO PRODUTO A CONFIRMAR", nunca a foto de outro produto por engano.
- **Preços e quantidades**: foram preservados; nenhum preço novo foi inventado. Os novos produtos entram inativos, preço zero e estoque zero até conferência.
- **Itens fumígenos**: imagens/vitrines usadas apenas para identificação e estoque interno, não integradas ao checkout pela internet.

### Como instalar
- Para Supabase novo: execute o arquivo `sql/INSTALACAO_COMPLETA_NOVO_BANCO.sql`.
- Para banco existente que já recebeu as migrações anteriores: execute apenas `sql/atualizacao_fotos_individuais.sql`.
- Suba toda a pasta do projeto no GitHub conectado ao Netlify, sem esquecer `public/imagens/`.
- No admin, editar um produto e preencher "URL da imagem" com `/imagens/nome-do-produto.webp`, se desejar escolher um arquivo manualmente. O caminho padrão já funciona automaticamente.

**Nota:** o sistema só funciona em tempo real após as credenciais do Netlify e do Supabase serem configuradas. Pagamentos Pix e carteiras continuam aguardando integração real com o provedor.
