# Imagens dos produtos da adega — feitas com IA

Todos os arquivos .webp ficam na pasta `public/imagens/` e carregam automaticamente por nome no catálogo, se o produto não tiver foto personalizada no admin. As fotos geradas são **ilustrações**, não fotografias oficiais das embalagens e não servem como confirmação de marcas, modelos, sabores ou tamanhos reais.

- Batidas: copos plásticos transparentes representando 700 ml, como solicitado.
- Cada foto é individual, sem valores de preço impressos. Os preços reais permanecem no Supabase e são editáveis no admin.
- `imagens-IA-inventario.csv` é o índice dos arquivos e indica os casos em que uma arte temporária ainda não corresponde ao produto.
- A pasta inclui arquivos para os produtos do cardápio atual e variantes/itens de prateleira que ainda precisam de confirmação. Embalagens duvidosas recebem arte genérica, para não mostrar foto de outra marca como se fosse a correta.
- Draft corrigido para R$ 15,00 pela placa. Vinho avulso entra inativo sem preço até identificação. Consulte `CONFERENCIA_PRODUTOS_WEB.md`.
- Para cadastrar os novos itens ainda sem preço e estoque, execute `sql/novos_itens_identificados_fotos.sql` **após** o setup ou migração anterior. Eles entram desativados.
- **Não** foram habilitados para encomenda produtos fumígenos como cigarros, tabacos, pods ou vapes.

## Observações da auditoria das fotos
Foram revisadas as imagens 195481 a 195488, além do cartaz de caipirinhas. Placas de valores: Corona, Heineken e Spaten R$ 10, Budweiser R$ 8, água R$ 2,50, batidas Açaí/Abacaxi com vinho/Céu Azul/Ferrero Rocher/Kinder Ovo/Maracujá/Morango com Nutella/Frutas Vermelhas a R$ 15, Ninho Trufado a R$ 12, caipirinha R$ 15. Os valores das doses permanecem na tabela anterior. Preços que aparecem em etiquetas pequenas, embalagens, ou textos indistintos **não** foram copiados.

## Não confundir vitrines e mercadorias
Aparecem caixas de cigarros e tabaco, produtos de aromatização, isqueiros, sedas, piteiras, pilhas, balas e salgadinhos. Cigarros e tabaco não são listados no checkout online. Nem todo objeto visto (como maquininha, tesoura, pote vazio, balança e móvel) é produto do cardápio.
