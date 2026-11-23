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

## Conferência de imagens e atalho administrativo — 23/11/2026

- A vitrine não carrega mais automaticamente fotos de sites externos. Imagens classificadas como arte de IA no inventário aparecem como **Foto real pendente**, preservando as fotos enviadas pelo proprietário.
- A página `/conferir-fotos.html` tenta carregar o catálogo real pela API e, se necessário, usa a prévia local. Permite filtrar pendências e consultar fotos cadastradas.
- Três cliques rápidos no link **Fazer pedido** do cabeçalho levam para `/admin.html`. Um clique normal continua levando ao catálogo.
- O login administrativo continua exigindo e-mail e senha validados no Supabase. **Não armazene senhas simples como 2027 no código público** e não confunda o atalho visual com uma autenticação.
- Os pedidos exigem nome e sobrenome; o administrador vê o nome completo, e a TV passa a receber o nome completo junto ao número do pedido. A validação é feita no servidor.
- Fotos dos itens fumígenos continuam restritas ao estoque interno. Preços e quantidades não foram alterados nesta revisão.

## Login com usuário admin — sem trocar e-mail nem senha do Supabase

O endereço `/admin` permite entrar como `admin` ou com o e-mail e a senha **já existentes** do Supabase. As duas opções continuam independentes. O login com `admin` usa uma senha exclusiva que fica apenas no servidor Netlify.

Para ativar, abra o Netlify da ADEGA e configure somente a variável `ADEGA_ADMIN_PIN`, com o valor escolhido pelo proprietário, no escopo **Functions**. Não escreva o valor no código nem no GitHub. É recomendada uma senha longa e exclusiva para proteger pedidos, dados pessoais e estoque.

A função usa a conta já autorizada em `admin_users`, emite uma sessão Supabase para ela e **não modifica o e-mail nem a senha dessa conta**. Se houver mais de um registro em `admin_users`, configure também `ADEGA_ADMIN_USER_ID` com o UUID da conta que deverá ser usada, para não escolher o proprietário errado. Nenhum login é liberado sem conta previamente autorizada.

Depois de salvar as variáveis, faça um novo deploy no Netlify. O acesso antigo por e-mail continuará disponível. O endpoint `/api/admin-login` tem limite de tentativas por IP, mas isso não substitui uma senha forte.
