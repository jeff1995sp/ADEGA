# Adega Jefferson — Site, catálogo, admin e TV

Projeto em português (Brasil), com fotos locais dos produtos, categorias, controle de preços, estoque e pedidos.

## Publicar o site no Netlify
1. Acesse https://app.netlify.com/start e entre na sua conta.
2. Selecione **Importar um repositório Git**, autorize o GitHub e escolha **jeff1995sp/ADEGA**.
3. Confirme a branch `main` e o arquivo `netlify.toml`: a pasta publicada é `public` e as funções ficam em `netlify/functions`.
4. Clique para publicar e copie o endereço `https://...netlify.app` gerado pelo Netlify.
5. Para **pedidos e admin funcionarem**, crie/configure o Supabase, execute o SQL adequado da pasta `sql/` e configure as variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `TV_PASSCODE` **na configuração privada do Netlify**. Nunca envie segredos ao GitHub.

Endereços do site após publicar: `/` (catálogo), `/admin.html` (gestão) e `/tv.html` (pedidos na TV).

## Situação dos itens
- Produtos sem preço ou estoque não podem ser comprados: ficam visíveis como **Indisponível**.
- O admin permite criar e editar produtos, alterar preços e quantidades, e enviar fotos.
- Produtos de tabacaria fumígena são para controle **interno** e não são disponibilizados para venda online.
- Pagamento por Pix/Apple Pay/Google Pay depende de integração real com o provedor e confirmação segura via webhook. Não há cobranças simuladas.
- Até o Supabase estar configurado, a página pública mostra o catálogo para consulta, mas não registra pedidos nem habilita o admin.

## Testar antes de abrir pedidos
```bash
npm install
npm run check
```

**Desenvolvido por Jefferson Felix.**
