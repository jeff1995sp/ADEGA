# ADEGA — o que falta configurar antes de receber pedidos

Site publicado no GitHub pode ser exibido em modo **prévia**, com todos os produtos não fumígenos e suas imagens, sem criar pedidos ou cobrar nada. Essa prévia NÃO é um banco de dados e NÃO dá acesso ao admin.

## Amanhã: cadastro dos preços e estoque
1. Criar um projeto Supabase e executar `sql/INSTALACAO_COMPLETA_NOVO_BANCO.sql` **somente se o banco for novo**.
2. Criar usuário no Supabase Auth e adicionar o UUID à tabela `public.admin_users`, conforme instruções no SQL.
3. Na configuração do Netlify, adicionar `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `TV_PASSCODE`. Nunca colocar segredos no GitHub.
4. Em `/admin.html`, entrar com o usuário criado no Supabase Auth e preencher preços e quantidades reais.
5. Só depois ativar pedidos, após testar no ambiente publicado.

**Atenção:** a prévia está com pedidos desabilitados. Imagens de terceiros linkadas podem não carregar ou exigir autorização para uso comercial. Tabacaria não é exibida no catálogo público nem aceita no checkout. O backend bloqueia pedidos dessa categoria.
