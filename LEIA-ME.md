## NOVO: CARDÁPIO DAS FOTOS + PREÇOS EDITÁVEIS

- **Catálogo organizado:** Cervejas, Doses, Batidas, Caipirinhas, Bebidas prontas, Águas e Refrigerantes, Complementos, Doces e Snacks e, ao final, Tabacaria/acessórios.
- **Preços:** lançados apenas onde legíveis nas fotos; Água R$ 2,50 e Seda R$ 3,00. Os demais itens vistos nas prateleiras ficam sem preço. Veja `sql/catalogo_referencia_fotos.csv`.
- **Estoque:** novos itens estão com **0** até o dono informar quanto tem de verdade. Nenhum estoque foi inventado. Seda mantém 10 unidades no banco novo.
- **Admin → Produtos e estoque:** cada item tem campo **Preço R$** e botão **Salvar preço**, além de **Editar**, **Pausar**, **+5**, **+10** e quantidade exata. Não é necessário editar HTML para corrigir preços. O preço de pedidos antigos não muda.
- **Se o Supabase ainda não tem banco:** execute **apenas** `sql/setup.sql`, que já inclui os novos produtos.
- **Se já tem Supabase funcionando:** execute **apenas** `sql/catalogo_fotos_preco_editavel.sql` no SQL Editor. O script é idempotente: não duplica os produtos nem sobrescreve preços que o dono já alterou.
- **Atenção:** cadastrar preços não abre vendas automaticamente. Complete o estoque real no admin, configure o Supabase e teste a compra antes de divulgar.
- **Tabacaria:** itens de uso permitido como seda, carvão e acessórios; não habilitamos comercialização online de cigarros, pods ou vapes.

# ADEGA DIGITAL — IDENTIDADE VISUAL FIEL À IMAGEM APROVADA

**Desenvolvido por Jefferson Felix**

O catálogo de celular e a TV agora utilizam a própria arte que você aprovou, sem substituí-la por um layout visualmente diferente. Os pedidos, nome, número, relógio e voz da TV são HTML/JS dinâmicos sobre o cenário gráfico. Os links de fazer pedido e explorar cardápio são clicáveis e levam ao catálogo real, que continua abaixo da capa. Para leitores de tela, os links e os pedidos reais possuem textos acessíveis.

## Publicação GitHub + Netlify
1. Envie todo o conteúdo deste ZIP (e não somente o diretório `public`) para a raiz do repositório do GitHub.
2. O `netlify.toml` está na raiz e define a publicação da pasta `public` com as funções protegidas em `netlify/functions`.
3. Crie o projeto Supabase e execute `sql/setup.sql` se for uma instalação nova. Se o banco já estiver configurado na versão anterior, não execute o setup novamente indiscriminadamente.
4. Configure as variáveis de ambiente do Netlify conforme `.env.example`. **Nunca coloque segredos no HTML, GitHub ou CSS público.**
5. Abra `/index.html` para o catálogo, `/admin.html` para o dono e `/tv.html` na TV Android. Ao abrir a TV pela primeira vez, use o código de acesso configurado no Netlify e pressione "Ativar voz" uma vez.

## O que já existe no software
- Catálogo real, produtos/quantidades, carrinho, checkout com nome e sobrenome, verificação de maioridade, pagamento em dinheiro com informação de troco ou cartão na retirada.
- Admin de um dono só: pedidos, preparo, pronto, entrega, controle de estoque, +5/+10, pausar ou reativar produtos, cadastro de preços e caixa.
- TV com atualizações automáticas a cada 2,5 segundos, fila paginada de até três pedidos por lado, relógio e opção de voz por pedido. As vozes disponíveis dependem do Android TV/navegador.
- A Seda por R$ 3,00 faz parte do SQL inicial. O catálogo usa **dados reais** do Supabase, não valores fictícios de demonstração.

## Pendente para operação comercial
- Enviar o cardápio real, fotografias e preços; configurar domínio, QR Code e banco Supabase.
- Integrar a API real para habilitar Pix, Apple Pay e Google Pay e verificar status e valor no servidor. **Os pagamentos online não estão funcionando nesta etapa.**
- Validar conexão internet da TV, sincronização, alertas sonoros e sistema de caixa em ambiente real antes de abrir atendimento.

A arte é o elemento visual de capa e fundo (com textos decorativos já desenhados). Por isso, você deve atualizar textos da marca no arquivo gráfico futuramente se mudar o nome da adega; as funções de pedido, botão de compra e chamadas da TV são dados vivos. A versão desktop do catálogo mantém também uma interface HTML mais flexível, e a tela da TV é otimizada para Android TV em 16:9.
# ADEGA DIGITAL — DESIGN LUXE 2.0

A identidade visual foi reconstruída para acompanhar a referência aprovada: catálogo preto/dourado com imagem premium de bebida, TV Android com destaques dourados e verdes, e painel do proprietário no mesmo estilo. **Não se trata de um print fixo:** as páginas HTML/CSS recebem os dados reais da API já existente.

## Arquivos principais
- `public/index.html` — catálogo e checkout rápido (nome + sobrenome).
- `public/tv.html` — TV com pedidos recebidos, preparando e prontos, voz e tela cheia.
- `public/admin.html` — proprietário, produtos, estoque, caixa, pedidos e pagamentos.
- `public/css/premium.css` — personalização visual da nova versão.
- `public/img/drink-premium.webp`, `public/img/tv-copo.webp`, `public/img/tv-bebidas.webp`, `public/img/crest.svg` — artes locais geradas para o tema.

O backend, SQL e controles de estoque da edição anterior foram preservados. A Seda continua **R$ 3,00**, com o estoque cadastrado na base. O checkout online por Pix/Apple Pay/Google Pay não está liberado até integrar um gateway e confirmar valores pelo servidor; pagamento em dinheiro/cartão na retirada depende de Supabase e Netlify Functions.

## Como publicar
1. Envie **o conteúdo da pasta `ADEGA_ULTRA_JEFFERSON_FELIX`** para a raiz do repositório do GitHub.
2. No Netlify, use a pasta de publicação `public` e mantenha as Functions em `netlify/functions`; a configuração já está em `netlify.toml`.
3. Execute `sql/setup.sql` num Supabase novo, ou mantenha a base existente e aplique somente as migrações necessárias de versões anteriores.
4. Preencha as variáveis de ambiente conforme `.env.example` usando os dados reais do seu Supabase e da autenticação; não coloque chaves secretas nos arquivos públicos.
5. Abra `/` no celular, `/admin.html` no computador e `/tv.html` na TV. A voz pode exigir clicar uma vez em Ativar voz conforme o navegador.

## Antes da abertura oficial
- Cadastrar cardápio real, fotos e preços (o estoque e os preços não foram inventados).
- Configurar domínio e QR Code; testar a acessibilidade da TV pela internet.
- Testar com **pagamento em dinheiro**, confirmar pedido no admin, mudar para Preparando e Pronto e conferir atualização na TV.
- Integrar gateway antes de habilitar pagamento online. Não usar comprovantes ou autorizações simuladas para liberar entrega.
- Conferir idade na retirada de bebida alcoólica.

A versão do site reproduz a **direção estética** da arte aprovada; as interfaces são construídas em HTML/CSS responsivo e adaptam-se ao tamanho da TV e do celular, portanto não são reproduções estáticas pixel a pixel.

**Desenvolvido por Jefferson Felix.**


## Imagens por IA
As imagens dos produtos ficam em `public/imagens/` e são carregadas automaticamente no catálogo. Consulte `IMAGENS-LEIA.md` e `imagens-IA-inventario.csv`. Itens de prateleira sem preços confirmados entram desativados via `sql/novos_itens_identificados_fotos.sql`.

### Ajuste de Draft e Vinho
Para banco Supabase já criado, execute `sql/conferencia_draft_vinho.sql`. O preço Draft foi corrigido para R$ 15,00 somente quando ainda estiver com o valor importado incorretamente R$ 13,00; registros de Vinho avulso entram inativos. Consulte `CONFERENCIA_PRODUTOS_WEB.md`.


## Doces, balas e salgadinhos (atualização 23/11/2026)
A seção `Doces e Balas` contém Bubbaloo, Trident, Mentos e cadastros de conferência das caixas Felicidades, Te Adoro e balas em potes. A seção `Salgadinhos` contém Doritos, Fofura e Torcida. Gel Kids e Pilhas Panasonic foram colocados em `Diversos`, sem assumir que Gel Kids é comestível. 
Todos os novos itens sem valor verificado ficam sem preço e sem estoque; os itens existentes têm suas quantidades e preços preservados. Os sabores exatos e o conteúdo das caixas precisam ser confirmados pelo dono. 
- **Banco novo:** execute somente `sql/setup.sql` (já contém a atualização dos doces); evite repetir migrações de setup sobre banco existente.
- **Banco existente:** execute somente `sql/atualizacao_doces_salgadinhos.sql` para separar categorias e incluir itens faltantes.
- **Admin:** use `Produtos e Estoque` para salvar preços, ativar, informar quantidades e repor +5 ou +10.
- A foto do item pode ser uma imagem ilustrativa, não necessariamente sua embalagem real.

**Instalação nova:** o setup.sql deste pacote já incorpora as adições de doces, outras variedades das fotos e Vinho inativo; não rode as migrações adicionais novamente para popular itens, elas são para bancos existentes.

## Fotos individuais dos itens
Veja `FOTOS-ATUALIZADAS-LEIA.md`. Pasta `public/imagens/` com fotos por produto, incluindo itens identificados nas fotos ampliadas. Para instalação nova, há `sql/INSTALACAO_COMPLETA_NOVO_BANCO.sql`.


## Atualização: cadastro livre e foto pelo celular (23/11/2026)

No painel **admin.html → Produtos e estoque → + Novo produto**, é possível:

1. Digitar o nome do item e selecionar a **categoria** (inclusive **Batidas**).
2. Deixar o **preço vazio**. O sistema grava R$ 0,00 como **pendente**, sem oferecer de graça. Depois preencha pelo botão **Salvar preço**.
3. Informar estoque, descrição e selecionar **foto opcional** na galeria do celular (JPG/PNG/WebP). O navegador reduz a foto e o servidor a envia ao **Supabase Storage**, associando automaticamente ao produto. Também pode usar uma URL HTTPS ou arquivo `/imagens/nome.webp`.
4. Editar nome, categoria, foto, preço, estoque e ativação quando quiser. Produtos sem valor ou quantidade não entram no pedido.

A categoria **Tabacaria** fica disponível **somente para gerenciamento interno no admin**, inclusive registros de cigarro e tabaco. **Não é exibida no catálogo público nem aceita em pedidos online**; há bloqueios tanto na API quanto no banco de dados.

**Banco Supabase novo:** execute `sql/INSTALACAO_COMPLETA_NOVO_BANCO.sql` no SQL Editor após configurar o projeto Supabase. Esse script contém os novos cadastros e os bloqueios.

**Banco Supabase já existente:** execute no SQL Editor, nesta ordem, `sql/01_ATUALIZAR_BANCO_EXISTENTE.sql`. Se ainda não fez as atualizações anteriores, execute também `sql/atualizacao_fotos_individuais.sql` (e demais migrações necessárias conforme as versões já instaladas).

A API criará automaticamente o bucket público `adega-produtos` no primeiro upload, usando a chave `SUPABASE_SERVICE_ROLE_KEY` **apenas no servidor Netlify**, jamais no navegador. O usuário só consegue enviar imagens autenticado no admin e com permissão em `admin_users`.

A inspeção fotográfica é conservadora: quando não foi possível identificar a variedade exata, o item é rotulado por **cor/embalagem** ou marcado como pendente. As fotos de tabacaria foram recortadas das fotografias originais da prateleira; algumas apresentam reflexos do vidro e podem precisar ser substituídas por fotos mais nítidas.
