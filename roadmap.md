# Integração Legacy Ecom (Pix + cartão)

- [ ] Aplicar o documento atualizado enviado em 25/11: payinCard como objeto intacto, resposta completa no 3DS e nenhuma repetição automática no cartão; manter preços e outros gateways.

- [ ] 1. Chave em private_settings ("legacy_api_key", reserva LEGACY_API_KEY) + card "Legacy Ecom" no /admin (salvar com validação de formato, testar via /whoami, remover, mostrar só pk mascarada)
- [ ] 2. Servidor: src/lib/legacy.server.ts (whoami, POST /payin Pix e cartão, GET /payin/{id} com approved→paid, retry 3x em 429/5xx/PROVIDER_ERROR, PayerDataError sem fallback)
- [ ] 3. Roteamento: prefixo le_ em pix-gateway.server.ts (lista de gateways, createPix, fetchPixStatus, fallback 1x p/ próximo com chave; Legacy só com payerIp, PayShark só com endereço) + webhook ?gw=le (sem assinatura: valida id, consulta status real, sempre 200)
- [ ] 4. getCardConfig → { enabled, provider: "legacy", publicKey, sdkUrl, apiBaseUrl, pixDiscount }; sem chave Legacy: enabled=false, provider=null, pixDiscount=false
- [ ] 5. createCardCharge via Legacy (cardPrepared + antifraudSessionId, endereço completo, 3DS pending devolve threeDSecure cru; status ruim = recusado)
- [ ] 6. Frontend checkout: src/lib/legacy-sdk.ts (carrega legacy-pay.js, prepareCardPayment, handlePendingThreeDS, mensagens THREEDS_*)
- [ ] 7. Página do pedido confirma status real após 3DS (polling já existente via getPixStatus)
- [ ] 8. Upsell no mesmo cartão: token cvt_live_ + CPF no sessionStorage; payWithSavedCard no navegador, servidor repassa com parentId; sem token/chave cai no Pix
- [ ] 9. Testes unitários: mapeamento de status, prefixo le_, regra de fallback, desconto do Pix
- [ ] 10. Verificar build OK + testes passando

- [x] Adicionar gateway Pix Wappi (docs app.wappibrasil.com.br/docs)

- [x] Desligar o envio à Rotasync: interruptor "Envio de pedidos à Rotasync (rastreio)" no /admin, padrão desligado, guard em reportPaidOnce e teste src/lib/rastro-switch.test.ts
