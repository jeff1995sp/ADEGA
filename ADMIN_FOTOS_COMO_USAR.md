# Atualização do admin — cadastrar qualquer produto + foto opcional

1. Publique os arquivos desta pasta em seu repositório do GitHub vinculado ao Netlify.
2. Execute a instalação SQL completa no Supabase novo **ou** o arquivo único `01_ATUALIZAR_BANCO_EXISTENTE.sql` no banco existente.
3. No admin, abra **Produtos e estoque** → **+ Novo produto**.
4. Digite o produto, escolha a categoria, por exemplo **Batidas**, e informe o preço ou deixe vazio.
5. Opcionalmente escolha **Foto do produto** (arquivo do celular) ou informe **URL da imagem**.
6. Salve. O sistema colocará a miniatura na lista do admin; com preço válido e estoque disponível, poderá ser exibido para clientes quando não for da Tabacaria.
7. Para trocar imagem ou preço: botão **Editar** ou **Salvar preço** ao lado do produto.

**Cigarros, tabacos e essências fumígenas:** use somente a aba **Tabacaria no admin**, sem checkout público.

**Observação:** o ZIP entrega código e scripts, mas não acessa seu banco Netlify/Supabase. Os cadastros novos só ficam ativos no painel após rodar o SQL. Fotografias sem marca legível aparecem com nome genérico ou como pendentes e devem ser confirmadas.
