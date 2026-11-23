# Pesquisa de imagens — conferência

Padrão escolhido pelo proprietário: produto fotografado em fundo claro, embalagem legível, sem texto gerado artificialmente.

## Aplicadas automaticamente à vitrine e ao admin (imagem remota com foto local de reserva)

- **Heineken** — Long neck 330 ml. [Fonte](https://irmaospatrocinio.com.br/bebidas/cerveja/puro-malte/2187/cerveja-heineken-long-neck-330ml.html); imagem: https://cdn.irmaospatrocinio.com.br/img/p/1/5/7/4/9/7/157497-thickbox_default.jpg
- **Corona** — Corona Extra long neck 330 ml; imagem de marketplace. [Fonte](https://www.sondadelivery.com.br/mariacandida/produto/cerveja-corona-extra-long-neck-330ml/1000033120); imagem: https://down-br.img.susercontent.com/file/sg-11134201-824g0-mf4hq3db8irvc9
- **Spaten** — Long neck 330 ml. [Fonte](https://www.zonasul.com.br/cerveja-spaten-puro-malte-long-neck-330ml-1143859/p); imagem: https://zonasul.vtexassets.com/arquivos/ids/3665468/VF4qT-qqCUAAAAAAAAcCMw.jpg?v=638593739030970000
- **Budweiser** — Long neck 330 ml. [Fonte](https://www.bistek.com.br/cerveja-budweiser-american-lager-330ml-long-neck-1868675/p); imagem: https://bistek.vtexassets.com/arquivos/ids/209624/1868675%20Cerveja%20Budweiser%20American%20Lager%20Long%20Neck%20330ml..png?v=639016814605600000
- **Doritos** — Embalagem vermelha, sabor queijo nacho; confirmar tamanho da loja. [Fonte](https://www.precopopular.com.br/doritos-32gr-queijo-nacho/p); imagem: https://precopopular.vtexassets.com/arquivos/ids/211833/747728.jpg?v=638503540612900000
- **Fandangos** — Embalagem vermelha, sabor presunto; confirmar tamanho da loja. [Fonte](https://www.azulatacarejo.com.br/fandangos-presunto-35g-62918/p); imagem: https://tfchgi.vteximg.com.br/arquivos/ids/179464-1000-1000/62918.jpg.jpg?v=638744594880470000

## Encontradas, mas **não** aplicadas automaticamente (variedade/apresentação a confirmar)

- **Torcida Bacon** — Bacon 60 g, formato bolinha; só usar se corresponder à embalagem da loja. [Fonte](https://www.prezunic.com.br/salgadinho-torcida-bolinha-bacon-60g-1862256001/p).
- **Trident (embalagem rosa)** — Morango, embalagem vermelho-rosa; conferir se coincide com a prateleira. [Fonte](https://www.drogarianeco.com.br/trident-morango-8g).

## Bubbaloo
- Substituída a imagem local do item **Bubbaloo** pela imagem enviada pelo proprietário. Sabor não presumido.

## Funcionamento e limitações
- Ao subir estes arquivos no GitHub, a vitrine e o admin mostram as referências pesquisadas mesmo sem alterar o Supabase, desde que as fotos externas carreguem.
- Fotos cadastradas manualmente no admin (upload para Supabase ou link externo) substituem as imagens de referência.
- As referências de terceiros não foram copiadas para dentro do ZIP. Exige conexão de internet e podem ser bloqueadas pelo servidor externo.
- Se alguma referência externa falhar, usa-se a foto local da loja; se a foto local não existir, mostra foto pendente.
- Não foi confirmada licença de uso comercial das imagens de terceiros. Para publicação definitiva, obtenha autorização do titular ou use imagem própria/licenciada.
- Cigarros e tabacos continuam somente no admin; nenhuma foto remota habilita checkout desses itens.

## Ver imagens
- Abra `/conferir-fotos.html` quando publicado, ou abra `public/conferir-fotos.html` em um navegador com conexão.
