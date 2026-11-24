// Gateway Pix Wappi. Somente servidor. Docs: https://app.wappibrasil.com.br/docs
// Credencial no formato "PUBLIC_KEY:SECRET_KEY", salva no /admin (private_settings) ou no
// secret WAPPI_API_KEY. Autenticação Basic Base64(PUBLIC_KEY:SECRET_KEY).
export const WAPPI_API = "https://api.wappibrasil.com.br/v1";
const KEY = "wappi_api_key";
const CACHE_MS = 60_000;
let cache: { value: string | null; at: number } | null = null;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function savedKey(): Promise<string | null> {
  const { data } = await (await db())
    .from("private_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  return (data?.value as string | null) || null;
}

export async function getWappiKey(): Promise<string | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = (await savedKey()) || process.env["WAPPI_API_KEY"] || null;
  cache = { value, at: Date.now() };
  return value;
}

export async function getWappiKeySource(): Promise<{
  key: string | null;
  source: "admin" | "secret" | null;
}> {
  const saved = await savedKey();
  if (saved) return { key: saved, source: "admin" };
  const env = process.env["WAPPI_API_KEY"] || null;
  return { key: env, source: env ? "secret" : null };
}

export async function saveWappiKey(value: string): Promise<void> {
  if (!/^[^:\s]+:[^:\s]+$/.test(value)) {
    throw new Error("Use o formato CHAVE_PUBLICA:CHAVE_SECRETA (as duas da tela Credenciais API).");
  }
  const { error } = await (await db())
    .from("private_settings")
    .upsert({ key: KEY, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  cache = null;
}

export async function deleteWappiKey(): Promise<void> {
  const { error } = await (await db()).from("private_settings").delete().eq("key", KEY);
  if (error) throw new Error(error.message);
  cache = null;
}

const auth = (key: string) => `Basic ${btoa(key)}`;

async function headers(): Promise<Record<string, string>> {
  const key = await getWappiKey();
  if (!key) throw new Error("Pagamento indisponível no momento.");
  return { authorization: auth(key), "Content-Type": "application/json", Accept: "application/json" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta do gateway sem tipo
type Json = any;
const unwrap = (j: Json) => (j?.data && typeof j.data === "object" ? j.data : j);
const errMsg = (j: Json, status: number) =>
  String(
    (Array.isArray(j?.error_messages) && j.error_messages.length
      ? j.error_messages.map((m: Json) => (typeof m === "string" ? m : (m?.message ?? JSON.stringify(m)))).join("; ")
      : (j?.message ?? j?.error)) || `Wappi HTTP ${status}`,
  ).slice(0, 300);

/** Gera o Pix (POST /payment-transaction/create). Valor em centavos. */
export async function wappiCashin(o: {
  amountCents: number;
  customer: { name: string; cpf: string; email: string; phone: string };
  description: string;
  postbackUrl: string;
  externalRef: string;
  ip?: string | null | undefined;
}): Promise<{ id: string; qrcode: string; status: string }> {
  const phone = o.customer.phone.replace(/\D/g, "");
  const res = await fetch(`${WAPPI_API}/payment-transaction/create`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({
      amount: o.amountCents,
      payment_method: "pix",
      postback_url: o.postbackUrl,
      customer: {
        name: o.customer.name.slice(0, 120),
        email: o.customer.email,
        document: { type: "cpf", number: o.customer.cpf.replace(/\D/g, "") },
        phone: phone.startsWith("55") ? phone : `55${phone}`,
      },
      items: [
        { title: o.description, unit_price: o.amountCents, quantity: 1, tangible: false, external_ref: o.externalRef },
      ],
      pix: { expires_in_days: 1 },
      ...(o.ip ? { ip: o.ip } : {}),
    }),
  });
  const json = (await res.json().catch(() => null)) as Json;
  const tx = unwrap(json);
  const qrcode = tx?.pix?.qr_code;
  if (!res.ok || !tx?.id || !qrcode) {
    console.error("Wappi create error", res.status, JSON.stringify(json)?.slice(0, 1000));
    throw new Error(`Não foi possível gerar o Pix (Wappi: ${errMsg(json, res.status)}).`);
  }
  return { id: String(tx.id), qrcode: String(qrcode), status: String(tx.status ?? "pending").toLowerCase() };
}

/** Status real (GET /payment-transaction/info/{id}). Valor em centavos. */
export async function wappiStatus(id: string): Promise<{ status: string; amount: number }> {
  const res = await fetch(`${WAPPI_API}/payment-transaction/info/${encodeURIComponent(id)}`, {
    headers: await headers(),
  });
  const json = (await res.json().catch(() => null)) as Json;
  if (!res.ok) throw new Error(`Wappi HTTP ${res.status}: ${errMsg(json, res.status)}`);
  const tx = unwrap(json);
  return {
    status: String(tx?.status ?? "pending").toLowerCase(),
    amount: Math.round(Number(tx?.amount ?? 0)),
  };
}

/** Consulta um id inexistente: 404 confirma a chave sem criar cobrança; 401 = chave errada. */
export async function testWappiKey(): Promise<{ ok: boolean; status?: number; error?: string }> {
  const key = await getWappiKey();
  if (!key) return { ok: false, error: "Nenhuma chave cadastrada" };
  try {
    const res = await fetch(`${WAPPI_API}/payment-transaction/info/00000000000000000000000000000000`, {
      headers: { authorization: auth(key), Accept: "application/json" },
    });
    if (res.status === 404 || res.ok) return { ok: true, status: res.status };
    const json = (await res.json().catch(() => null)) as Json;
    return { ok: false, status: res.status, error: errMsg(json, res.status) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha de conexão" };
  }
}
