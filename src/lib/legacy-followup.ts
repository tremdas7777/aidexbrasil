import { createCardFollowUpCharge, getCardConfig } from "./pix.functions";
import type { PixSession } from "./pix-session";
import type { UpsellProduct } from "./upsell";

/** Prepare a saved Legacy card in the browser; never open another 3DS challenge for an upsell. */
export async function legacyFollowUp(session: PixSession, products: UpsellProduct[], amount: number, installments: number) {
  if (!session.cardToken || !session.cpf || !session.phone) throw new Error("Cartão indisponível. Pague essa oferta com Pix.");
  const config = await getCardConfig({ data: {} });
  if (!config.enabled || !config.publicKey || !config.apiBaseUrl) throw new Error("Cartão indisponível. Pague essa oferta com Pix.");
  const { loadLegacyPay } = await import("./legacy-sdk");
  const client = await loadLegacyPay(config.publicKey, config.apiBaseUrl);
  const prepared = await client.payWithSavedCard({
    token: session.cardToken, amount, installments, referenceId: crypto.randomUUID(),
    customer: { name: session.name, email: session.email, document: session.cpf.replace(/\D/g, ""), phone: session.phone.replace(/\D/g, "") },
  });
  return createCardFollowUpCharge({ data: { parentId: session.id, origin: window.location.origin, products,
    cardPrepared: prepared.payinCard, preparedAmount: amount, antifraudSessionId: prepared.antifraud?.sessionId ?? null,
  } });
}