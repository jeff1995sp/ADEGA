# Importar a versão da adega no GitHub

**Repositório identificado:** https://github.com/jeff1995sp/ADEGA

**Status em 23/11/2026:** o repositório foi localizado vazio. A conexão GitHub do ChatGPT permitia consulta, mas duas tentativas de escrita foram recusadas com `403 Resource not accessible by integration` (GitHub Contents API e Git Blob API). Portanto, este pacote **não foi publicado automaticamente**.

## Arquivos deste pacote

Extraia o ZIP. Os arquivos `package.json`, `netlify.toml` e as pastas `public`, `netlify`, `sql`, `tests` devem ficar diretamente na raiz do repositório ADEGA, sem uma pasta externa adicional.

No GitHub: abra `jeff1995sp/ADEGA` → **Add file** → **Upload files**. Envie **os arquivos e as pastas extraídos**, não somente o ZIP. Confirme a alteração.

Para restaurar a gravação direta do ChatGPT: acesse a instalação GitHub App em https://github.com/settings/installations/184887039, confira se **ADEGA** está selecionado e se o aplicativo possui permissão **Contents: Read and write**. Se o app só oferecer leitura, a permissão não pode ser aumentada pela tela do repositório; será necessário usar uma integração com escrita autorizada ou o envio manual. Não compartilhe token ou senha no chat.

## Mudanças nesta versão

- Foto real do Bubbaloo enviada pelo proprietário aplicada ao item existente.
- Referências visuais para 6 produtos de embalagem (Heineken, Corona, Spaten, Budweiser, Doritos, Fandangos) com imagens reais externas e fallback local. Links externos podem deixar de funcionar e exigem checagem de licença comercial.
- Página `public/conferir-fotos.html` com 8 referências e fontes para conferência. Não ativamos fotos de sabores/tamanhos duvidosos.
- Admin mantém cadastro de categoria, preço em branco, estoque, edição e foto opcional. Foto personalizada do proprietário prevalece sobre referência.
- Tabacaria e itens fumígenos permanecem apenas no inventário interno e não entram no carrinho ou no checkout online.
- Teste `npm run check`: 18/18 verificações automatizadas passaram na preparação local; não equivale a teste de implantação Supabase/Netlify.

## Publicação Netlify e Supabase

1. Selecione o repositório ADEGA no Netlify. O `netlify.toml` define a pasta `public` e as funções `netlify/functions`.
2. No Netlify configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e o código `TV_PASSCODE` seguro (ver `LEIA-ME.md`). **Não** salve chave privada no GitHub.
3. Configure o banco seguindo o SQL `sql/INSTALACAO_COMPLETA_NOVO_BANCO.sql` (instalação nova) ou `sql/01_ATUALIZAR_BANCO_EXISTENTE.sql` (base existente). Revise antes de executar.
4. Confira login, registro de produtos, foto, estoque, carrinho, pedidos e TV. Pedidos públicos só devem ser liberados após testes com dados reais.

Não foi verificada licença de uso comercial das imagens externas pesquisadas; prefira material autorizado ou próprio antes de publicar.
