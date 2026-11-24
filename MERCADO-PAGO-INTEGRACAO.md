# Mercado Pago — implantação planejada

Demonstração: /demonstracao-pagamento.html (sem API, dados bancários, QR válido ou pedidos reais).

Produção segue desligada no catálogo e backend. Antes da integração: criar aplicação na conta receptora autorizada, confirmar atividade e credenciamento, cadastrar chave Pix, obter credenciais de teste e configurar segredos no Worker (nunca no GitHub), validar domínio e certificados Apple conforme https://www.mercadopago.com.br/developers/pt/docs/apple-pay/obtain-apple-developer-certificates .

Implementação a validar: Pix dinâmico com valor calculado no servidor, idempotência e expiração; Apple Pay via SDK oficial e tokenização; webhook com assinatura verificada e consulta do pagamento no Mercado Pago, conferir valor, moeda, recebedor e referência do pedido; impedir duplicidade de caixa, liberar preparação somente conforme regras de chegada e pagamento. Testar rejeição, expiração, reembolso e atualização do pedido. Crédito/débito e dinheiro presencial continuam como estão. Sem Google Pay. Não habilitar produção antes da homologação.