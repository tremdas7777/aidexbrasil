/**
 * Legacy Ecom — helpers puros (sem banco, env ou fetch): seguros para testes e para o navegador.
 * Regras da integração: https://developers.legacyecombrasil.com
 */
import { z } from "zod";

export type LegacyJsonValue =
  | string
  | number
  | boolean
  | null
  | LegacyJsonValue[]
  | { [key: string]: LegacyJsonValue };
export type LegacyJsonObject = { [key: string]: LegacyJsonValue };

/** Pedidos da Legacy (Pix e cartão) são guardados com este prefixo — é ele que roteia status e webhook. */
export const LEGACY_ORDER_PREFIX = "le_";
export const isLegacyOrderId = (id: string) => id.startsWith(LEGACY_ORDER_PREFIX);

/** Par de chaves gerado no painel da Legacy (Integrações), no formato "pk_live_xxx:sk_live_yyy". */
export const legacyKeySchema = z
  .string()
  .trim()
  .min(10)
  .max(500)
  .regex(/^pk_[A-Za-z0-9_]+:sk_[A-Za-z0-9_]+$/, "Cole o par completo no formato pk_...:sk_...");

export const LEGACY_BAD_STATUSES = [
  "refused",
  "failed",
  "canceled",
  "cancelled",
  "refunded",
  "chargeback",
  "med",
  "expired",
];
export const legacyRefused = (status: string, pending = false) =>
  !pending && LEGACY_BAD_STATUSES.includes(status);
export const legacyPayinCardSchema = z
  .object({
    token: z.string().min(5).max(300),
    installments: z.literal(1),
  })
  .passthrough()
  .refine(
    (c) =>
      !["number", "cvv", "holderName", "expirationMonth", "expirationYear"].some((key) => key in c),
    "Envie somente o cartão preparado pelo SDK.",
  );

export function assertLegacyPreparedAmount(
  prepared: number,
  actual: number,
  cardInstallments: number,
  installments: number,
) {
  if (cardInstallments !== 1 || installments !== 1)
    throw new Error("O pagamento no cartão está disponível somente em 1x à vista.");
  if (prepared !== actual || cardInstallments !== installments)
    throw new Error("O valor ou as parcelas mudaram. Confira e tente novamente.");
}

export function parseLegacyKey(pair: string): { publicKey: string; secretKey: string } {
  const i = pair.indexOf(":");
  return { publicKey: pair.slice(0, i), secretKey: pair.slice(i + 1) };
}

/** No painel só aparece o início da pk (ex.: "pk_live_••••") — a sk nunca é exibida. */
export const maskLegacyPublicKey = (pk: string) => `${pk.slice(0, 8)}••••`;

/**
 * Status da Legacy: "approved" vira "paid" (a regra única de "pago" fica em pix-status.ts);
 * o resto fica como veio, em minúscula (PENDING, REFUSED, FAILED, CANCELED, REFUNDED,
 * CHARGEBACK, MED, EXPIRED).
 */
export function normalizeLegacyStatus(raw: unknown): string {
  const s = String(raw ?? "pending")
    .trim()
    .toLowerCase();
  return s === "approved" ? "paid" : s;
}

/**
 * Erro de dado do pagador (CPF, telefone, e-mail, nome, limite ou risco): o cliente precisa
 * corrigir o dado, então esse erro NÃO troca de gateway no fallback.
 */
export class PayerDataError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PayerDataError";
    this.code = code;
  }
}

const PAYER_FIELD_MESSAGE: Record<string, string> = {
  document: "CPF inválido. Confira o CPF e tente novamente.",
  phone: "Telefone inválido. Confira o número com DDD e tente novamente.",
  email: "E-mail inválido. Confira o endereço e tente novamente.",
  name: "Nome inválido. Informe o nome completo, como no documento.",
};

/** Devolve o PayerDataError quando o código/campo é de dado do cliente; senão null (erro do gateway). */
export function payerDataError(code: string, field?: string | null): PayerDataError | null {
  const c = code.toUpperCase();
  if (c === "PAYER_LIMIT_REJECTED")
    return new PayerDataError(
      c,
      "Pagamento não aprovado para estes dados. Confira as informações e tente novamente.",
    );
  if (c === "REJECTED_BY_RISK")
    return new PayerDataError(
      c,
      "Pagamento não aprovado pela análise de segurança. Tente outra forma de pagamento.",
    );
  if (c === "INVALID_DATA" || c === "INVALID_CVV") {
    const details = (field ?? "").toLowerCase();
    const key = details.includes("cpf")
      ? "document"
      : details.includes("celular")
        ? "phone"
        : details.includes("nome")
          ? "name"
          : Object.keys(PAYER_FIELD_MESSAGE).find((k) => details.includes(k));
    const message = key ? PAYER_FIELD_MESSAGE[key] : null;
    if (message) return new PayerDataError(c, message);
    if (c === "INVALID_CVV")
      return new PayerDataError(c, "CVV inválido. Confira o código de segurança do cartão.");
    return new PayerDataError(c, "Confira os dados do pagamento e tente novamente.");
  }
  return null;
}

/** Mensagem segura de recusa: não guarda nem devolve textos brutos que possam conter dado do cartão. */
export function legacyCardRefusalMessage(reason?: string | null): string {
  return /cvv|c[oó]digo de seguran[cç]a|security code/i.test(reason ?? "")
    ? "CVV inválido. Confira o código de segurança do cartão ou pague com Pix."
    : "Pagamento recusado pelo banco. Confira os dados do cartão ou pague com Pix.";
}

/** Erros conhecidos do pagador já são seguros; falhas técnicas viram uma mensagem genérica. */
export function legacyCardErrorMessage(error: unknown): string {
  return error instanceof PayerDataError
    ? error.message
    : "Não foi possível processar o cartão. Confira os dados e tente novamente ou pague com Pix.";
}

/** Só falha do GATEWAY permite tentar o próximo; dado errado do cliente volta para ele corrigir. */
export const shouldFallbackToNextGateway = (e: unknown) => !(e instanceof PayerDataError);

/**
 * Próximo gateway com chave para o fallback do Pix (uma tentativa só). A Legacy só serve de
 * reserva se o pedido tiver o IP do pagador; a PayShark só se tiver endereço (produto físico).
 */
export function pickFallbackGateway(
  failed: string,
  configured: Record<string, boolean>,
  opts: { hasIp: boolean; hasAddress: boolean },
  order: readonly string[],
): string | null {
  for (const g of order) {
    if (g === failed || !configured[g]) continue;
    if (g === "legacy" && !opts.hasIp) continue;
    if (g === "payshark" && !opts.hasAddress) continue;
    return g;
  }
  return null;
}
