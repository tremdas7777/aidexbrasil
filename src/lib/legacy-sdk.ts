/**
 * SDK LegacyPay no navegador: tokeniza o cartão e roda o 3DS.
 * Os dados do cartão vão direto do navegador para a Legacy — nunca para o nosso servidor.
 * O script é carregado de {apiBaseUrl}/checkout/sdk/legacy-pay.js e expõe window.LegacyPay.
 */
export type LegacyPreparedCard = {
  payinCard: Record<string, unknown>;
  card?: { last4?: string; brand?: string; token?: string } | null;
  antifraud?: { sessionId?: string | null } | null;
};

export type LegacyPayClient = {
  prepareCardPayment(d: {
    amount: number; // centavos — o mesmo valor que o servidor vai cobrar
    installments: number;
    referenceId: string;
    card: {
      holderName: string;
      number: string;
      expirationMonth: string;
      expirationYear: string;
      cvv: string;
    };
    customer: { name: string; email: string; document: string; phone: string };
  }): Promise<LegacyPreparedCard>;
  handlePendingThreeDS(threeDSecure: unknown): Promise<unknown>;
  payWithSavedCard(d: {
    token: string;
    amount: number;
    referenceId: string;
    installments: number;
    customer: { name: string; email: string; document: string; phone: string };
  }): Promise<LegacyPreparedCard>;
};

type LegacyPayGlobal = {
  init(o: { publicKey: string; apiBaseUrl: string }): LegacyPayClient | Promise<LegacyPayClient>;
};

let ready: { publicKey: string; promise: Promise<LegacyPayClient> } | null = null;

export function loadLegacyPay(publicKey: string, apiBaseUrl: string): Promise<LegacyPayClient> {
  if (ready && ready.publicKey === publicKey) return ready.promise;
  const promise = new Promise<LegacyPayClient>((resolve, reject) => {
    const w = window as unknown as { LegacyPay?: LegacyPayGlobal };
    const init = () =>
      w.LegacyPay
        ? Promise.resolve(w.LegacyPay.init({ publicKey, apiBaseUrl })).then(resolve, reject)
        : reject(new Error("SDK de pagamento indisponível"));
    if (w.LegacyPay) return void init();
    const s = document.createElement("script");
    s.src = `${apiBaseUrl}/checkout/sdk/legacy-pay.js`;
    s.async = true;
    s.onload = init;
    s.onerror = () => reject(new Error("Falha ao carregar o SDK de pagamento"));
    document.head.appendChild(s);
  }).catch((e) => {
    if (ready?.publicKey === publicKey) ready = null; // permite tentar de novo
    throw e;
  });
  ready = { publicKey, promise };
  return promise;
}

/** Mensagens amigáveis para os erros do 3DS do SDK. */
export function threeDSErrorMessage(e: unknown): string {
  const code = String((e as { code?: string } | null)?.code ?? (e instanceof Error ? e.message : ""));
  if (code.includes("THREEDS_EXPIRED"))
    return "A autenticação do banco expirou. Tente novamente.";
  if (code.includes("THREEDS_FAILED"))
    return "O banco não conseguiu autenticar o cartão. Tente novamente ou use outro cartão.";
  if (code.includes("THREEDS_SDK_UNAVAILABLE"))
    return "Não foi possível abrir a autenticação do banco. Recarregue a página e tente novamente.";
  return "Não foi possível concluir a autenticação do banco. Tente novamente.";
}
