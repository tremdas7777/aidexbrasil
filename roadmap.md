# Roadmap da loja

## Integrações

- [x] Integração Legacy Ecom com Pix, cartão, 3DS, webhook e upsell no mesmo cartão.
- [x] Gateway Pix Wappi.
- [x] Interruptor do envio de pedidos pagos à RastroCode, desligado por padrão.

## Correção do cartão Legacy (26/11)

- [x] Cartão somente na Legacy e sempre em 1x à vista: checkout, preparação, validação do servidor, cobrança e upsell.
- [x] Registrar recusas e erros do gateway como tentativas falhadas no painel, separadas de pagos e pendentes.
- [x] Sincronizar estados aprovado, pendente e recusado pela consulta autenticada e pelo webhook, sem antecipar conversões.
- [x] Testar regras localmente, conferir a tela e verificar o build; não publicar.
- [x] Corrigir recusa 400 da Legacy: "installments" fora do cartão (27/11).
- [ ] Validar uma aprovação e uma recusa por CVV no sandbox da Legacy — bloqueado porque não há chave sandbox; não usar produção.
