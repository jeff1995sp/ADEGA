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

## Login com usuário admin — configuração privada no Netlify

A tela `/admin` (ou `/admin.html`) aceita **usuário `admin`** ou **e-mail cadastrado no Supabase**. O login antigo por e-mail permanece funcionando. O login rápido utiliza a função `/api/admin-login`, que tem limitação de tentativas por IP e cria uma sessão Supabase real. Não são aceitas senhas configuradas em arquivos públicos.

Para habilitar o nome de usuário `admin`, abra o Netlify da ADEGA em **Project configuration > Environment variables**, crie estas três variáveis com escopo **Functions**:

- `ADEGA_ADMIN_PIN`: PIN privado escolhido pelo proprietário (por segurança, prefira uma senha longa; um PIN de apenas quatro dígitos é vulnerável a tentativas de adivinhação).
- `ADEGA_ADMIN_EMAIL`: e-mail de login da conta administrativa **existente no Supabase**.
- `ADEGA_ADMIN_PASSWORD`: senha real da mesma conta no Supabase (deve ser forte).

A conta precisa estar autorizada na tabela `admin_users`. Depois de configurar as variáveis, **faça um novo deploy** para elas valerem. Não compartilhe essas variáveis por mensagens nem as grave no GitHub. Se não configurar, o acesso `admin` retornará uma mensagem informativa; o acesso por e-mail continuará funcionando.

Limitação: a restrição de três tentativas por 180 segundos por IP é uma proteção auxiliar do Netlify, não substitui senha forte ou MFA. Recomendamos usar uma senha longa, e não PIN curto, para um painel com dados de clientes e pedidos.
