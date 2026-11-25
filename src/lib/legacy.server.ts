// Gateway Legacy Ecom (Pix e cartão). Somente servidor. Docs: https://developers.legacyecombrasil.com
// Par de chaves "pk_...:sk_..." (painel da Legacy → Integrações) cadastrado no /admin
// (private_settings, só service role). O secret LEGACY_API_KEY do Lovable serve de reserva.
// A sk fica só no servidor; no navegador vai apenas a pk (via getCardConfig).
// Dado de cartão (número, CVV, validade) NUNCA passa por aqui: o cartão é tokenizado no
// navegador pelo SDK LegacyPay e o servidor só recebe o payinCard preparado.
import {
  legacyKeySchema,
  normalizeLegacyStatus,
  parseLegacyKey,
  payerDataError,
  type LegacyJsonObject,
} from "@/lib/legacy";

export const LEGACY_API = "https://api.legacyecom.com.br";
export const LEGACY_SDK_URL = `${LEGACY_API}/checkout/sdk/legacy-pay.js`;

const KEY = "legacy_api_key";
// A tela do pedido consulta o status a cada poucos segundos: guarda a chave por 1 minuto.
const CACHE_MS = 60_000;
let cache: { value: string | null; at: number } | null = null;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Chave salva no /admin (se houver). */
async function savedKey(): Promise<string | null> {
  const { data } = await (
    await db()
  )
    .from("private_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  return (data?.value as string | null) || null;
}

/** Par em uso: o do /admin ou, sem ele, o secret do Lovable. */
export async function getLegacyKey(): Promise<string | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = (await savedKey()) || process.env["LEGACY_API_KEY"] || null;
  cache = { value, at: Date.now() };
  return value;
}

/** De onde vem a chave em uso (para mostrar no /admin). */
export async function getLegacyKeySource(): Promise<{
  key: string | null;
  source: "admin" | "secret" | null;
}> {
  const saved = await savedKey();
  if (saved) return { key: saved, source: "admin" };
  const env = process.env["LEGACY_API_KEY"] || null;
  return { key: env, source: env ? "secret" : null };
}

export async function saveLegacyKey(value: string): Promise<void> {
  const parsed = legacyKeySchema.parse(value);
  const { error } = await (
    await db()
  )
    .from("private_settings")
    .upsert({ key: KEY, value: parsed, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  cache = null;
}

export async function deleteLegacyKey(): Promise<void> {
  const { error } = await (await db()).from("private_settings").delete().eq("key", KEY);
  if (error) throw new Error(error.message);
  cache = null;
}

/** Basic auth com o par "pk:sk" em base64. */
async function auth(pair?: string | null): Promise<string> {
  const k = pair ?? (await getLegacyKey());
  if (!k) throw new Error("Pagamento indisponível no momento.");
  return `Basic ${btoa(k)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
type LegacyReply = { res: Response; json: any };

/**
 * POST com retry: até 3 tentativas com espera crescente, só em 429, 5xx ou
 * code PROVIDER_ERROR. Erro de dado do cliente (4xx) volta na hora.
 */
async function legacyPost(path: string, body: unknown, retry = true): Promise<LegacyReply> {
  let last: LegacyReply | null = null;
  for (let attempt = 0; attempt < (retry ? 3 : 1); attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt));
    const res = await fetch(`${LEGACY_API}${path}`, {
      method: "POST",
      headers: {
        Authorization: await auth(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
    const json = (await res.json().catch(() => null)) as any;
    last = { res, json };
    const code = String(json?.code ?? json?.error?.code ?? "");
    const retryable = res.status === 429 || res.status >= 500 || code === "PROVIDER_ERROR";
    if (!retryable) return last;
  }
  if (!last) throw new Error("Pagamento indisponível no momento.");
  return last;
}

/** Erro da Legacy: dado do pagador vira PayerDataError (sem fallback); o resto é erro do gateway. */
function throwLegacyError(res: Response, json: LegacyReply["json"]): never {
  const code = String(json?.code ?? json?.error?.code ?? "");
  const field =
    JSON.stringify(
      json?.fields ??
        json?.field ??
        json?.error?.field ??
        json?.details?.field ??
        json?.message ??
        "",
    ) || null;
  const payer = payerDataError(code, field);
  if (payer) throw payer;
  // Log só com status HTTP e código/mensagem do gateway — nunca dado do cliente ou do cartão.
  console.error("Legacy error", res.status, code);
  throw new Error("Não foi possível processar o pagamento. Confira os dados e tente novamente.");
}

export type LegacyCustomer = { name: string; email: string; phone: string; cpf: string };
export type LegacyAddress = {
  street: string;
  number: string;
  complement?: string | undefined;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
};

/** Endereço no formato da Legacy: CEP só dígitos, UF em maiúscula. */
const legacyAddress = (a: LegacyAddress) => ({
  street: a.street,
  number: a.number,
  ...(a.complement ? { complement: a.complement } : {}),
  neighborhood: a.neighborhood,
  city: a.city,
  state: a.state.toUpperCase(),
  zipCode: a.zipcode.replace(/\D/g, ""),
});

const legacyCustomer = (c: LegacyCustomer, address?: LegacyAddress) => ({
  name: c.name,
  document: c.cpf.replace(/\D/g, ""),
  email: c.email,
  phone: c.phone.replace(/\D/g, ""),
  ...(address ? { address: legacyAddress(address) } : {}),
});

export type LegacyTx = {
  id: string;
  status: string;
  amount: number;
  qrcode?: string;
  threeDSecurePending?: boolean;
  threeDSecure?: LegacyJsonObject | null;
  card?: { last4?: string; brand?: string } | null;
  refusedReason?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
const txOf = (json: any) => (json?.id ? json : (json?.data ?? json));

/**
 * Cobrança Pix (POST /payin, paymentMethod "PIX"). Valor em centavos. payerIp é obrigatório.
 * A resposta traz id e pix.qrcode — sem os dois, é erro.
 */
export async function createLegacyPix(o: {
  amount: number;
  customer: LegacyCustomer;
  address?: LegacyAddress | undefined;
  /** Nome genérico enviado ao gateway — sem detalhes do produto real. */
  description: string;
  webhookUrl: string;
  ip?: string | null | undefined;
}): Promise<LegacyTx> {
  if (!o.ip) throw new Error("Pagamento indisponível no momento.");
  const { res, json } = await legacyPost("/payin", {
    paymentMethod: "PIX",
    amount: o.amount,
    referenceId: crypto.randomUUID(),
    isPhysicalProduct: true,
    payerIp: o.ip,
    webhookUrl: o.webhookUrl,
    customer: legacyCustomer(o.customer, o.address),
    items: [{ title: o.description.slice(0, 200), unitPrice: o.amount, quantity: 1 }],
  });
  const tx = txOf(json);
  const id = tx?.id;
  const qrcode = tx?.pix?.qrcode ?? tx?.pix?.qrCode ?? tx?.qrcode;
  if (!res.ok || !id || !qrcode) throwLegacyError(res, json);
  console.log("legacy-create-pix", id, tx?.status);
  return {
    id: String(id),
    status: normalizeLegacyStatus(tx?.status),
    amount: Math.round(Number(tx?.amount ?? o.amount)),
    qrcode: String(qrcode),
  };
}

/**
 * Cobrança no cartão (POST /payin, paymentMethod "CREDIT_CARD"). O cartão chega já tokenizado
 * pelo SDK LegacyPay no navegador (cardPrepared) — o número nunca passa pelo nosso servidor.
 * Cartão sem endereço completo ou sem payerIp não passa.
 */
export async function createLegacyCard(o: {
  amount: number;
  cardPrepared: Record<string, unknown>;
  referenceId: string;
  antifraudSessionId?: string | undefined;
  installments: number;
  customer: LegacyCustomer;
  address: LegacyAddress;
  /** Nome genérico enviado ao gateway — sem detalhes do produto real na fatura. */
  description: string;
  webhookUrl: string;
  ip?: string | null | undefined;
  /** Upsell no mesmo cartão: id do pedido original na Legacy (sem o prefixo le_). */
  parentId?: string | undefined;
}): Promise<LegacyTx> {
  if (!o.ip) throw new Error("Pagamento indisponível no momento.");
  const { res, json } = await legacyPost(
    "/payin",
    {
      paymentMethod: "CREDIT_CARD",
      amount: o.amount,
      referenceId: o.referenceId,
      isPhysicalProduct: true,
      payerIp: o.ip,
      webhookUrl: o.webhookUrl,
      card: o.cardPrepared,
      ...(o.antifraudSessionId ? { antifraud: { sessionId: o.antifraudSessionId } } : {}),
      ...(o.parentId ? { parentId: o.parentId } : {}),
      installments: o.installments,
      customer: legacyCustomer(o.customer, o.address),
      items: [{ title: o.description.slice(0, 200), unitPrice: o.amount, quantity: 1 }],
    },
    false,
  );
  const tx = txOf(json);
  if (!res.ok || !tx?.id) throwLegacyError(res, json);
  // Log só com id e status — nunca dado do cartão.
  console.log("legacy-create-card", tx.id, tx?.status);
  return {
    id: String(tx.id),
    status: normalizeLegacyStatus(tx?.status),
    amount: Math.round(Number(tx?.amount ?? o.amount)),
    threeDSecurePending: tx?.threeDSecurePending === true,
    threeDSecure: json as LegacyJsonObject,
    card: tx?.card ? { last4: tx.card.last4, brand: tx.card.brand } : null,
    refusedReason:
      typeof tx?.refusedReason === "string"
        ? tx.refusedReason
        : typeof tx?.message === "string"
          ? tx.message
          : null,
  };
}

/**
 * Status real do pagamento (GET /payin/{id}). Valor em centavos.
 * "approved" vira "paid"; o resto fica como veio (a regra única de "pago" fica em pix-status.ts).
 */
export async function legacyStatus(id: string): Promise<{ status: string; amount: number }> {
  const res = await fetch(`${LEGACY_API}/payin/${encodeURIComponent(id)}`, {
    headers: { Authorization: await auth(), Accept: "application/json" },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
  const json = (await res.json().catch(() => null)) as any;
  const tx = txOf(json);
  // Só status no log (sem dados pessoais) para auditar a regra de "pago".
  console.log("legacy-status", id, res.status, JSON.stringify(tx?.status));
  if (!res.ok) throw new Error(`Legacy HTTP ${res.status}`);
  return {
    status: normalizeLegacyStatus(tx?.status),
    amount: Math.round(Number(tx?.amount ?? 0)),
  };
}

/**
 * Valida o par de chaves sem criar cobrança (GET /whoami).
 * 401/403 = chave recusada; canTransact=false = conta sem KYC aprovado.
 */
export async function testLegacyKey(): Promise<{
  ok: boolean;
  status?: number | undefined;
  error?: string | undefined;
}> {
  const key = await getLegacyKey();
  if (!key) return { ok: false, error: "Nenhuma chave cadastrada" };
  try {
    const res = await fetch(`${LEGACY_API}/whoami`, {
      headers: { Authorization: await auth(key), Accept: "application/json" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
    const json = (await res.json().catch(() => null)) as any;
    if (res.status === 401 || res.status === 403)
      return { ok: false, status: res.status, error: "Chave recusada pela Legacy" };
    if (!res.ok) return { ok: false, status: res.status, error: `Erro ${res.status} na Legacy` };
    const canTransact = json?.canTransact ?? json?.data?.canTransact;
    if (canTransact === false)
      return { ok: false, status: res.status, error: "Conta sem KYC aprovado (canTransact=false)" };
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha de conexão" };
  }
}

/** Chave pública (pk) do par em uso — única parte que pode ir para o navegador. */
export async function getLegacyPublicKey(): Promise<string | null> {
  const pair = await getLegacyKey();
  return pair ? parseLegacyKey(pair).publicKey : null;
}
