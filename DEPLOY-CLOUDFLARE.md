# ADEGA DIGITAL — publicação Cloudflare

- Worker: `adega-digital`; branch: `main`; diretório raiz: `/`.
- Build: `npm run build` (Node.js 22 ou superior com suporte a node:sqlite).
- Deploy: `npx wrangler deploy`.
- Binding D1: `DB`, banco `adega-digital`, conforme `wrangler.jsonc`.
- Segredos de produção: `ADEGA_ADMIN_PIN` e `TV_PASSCODE`. Não salvar os valores no GitHub.
- Manter preview builds desativados para evitar acesso ao banco de produção.

## Verificação após deploy

1. Abrir `/api?route=health` e confirmar `ok: true`, `database: D1`.
2. Conferir o catálogo em `/`, login em `/admin.html` e acesso protegido à `/tv.html`.
3. Manter pedidos fechados durante a revisão de preços, estoque e disponibilidade.
4. Em teste controlado, verificar pedido, troco, pagamento na retirada, baixa de estoque, sabores, cancelamento e chamada na TV. Conferir também que a Tabacaria fica somente no inventário interno.
5. Fechar pedidos novamente até a aprovação do proprietário. Pix e carteiras digitais permanecem desativados até a integração real com o gateway.

Os testes SQLite automatizados não substituem a validação do Worker publicado e do banco D1 real.
