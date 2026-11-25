import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { brand } from "@/lib/brand";

export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabase
    .from("site_settings")
    .select("key,value")
    .in("key", [
      "whatsapp_enabled",
      "whatsapp_phone",
      "card_enabled",
      "store_closed",
      "rastro_enabled",
    ]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  return {
    whatsappEnabled: map.get("whatsapp_enabled") === true,
    whatsappPhone:
      typeof map.get("whatsapp_phone") === "string"
        ? (map.get("whatsapp_phone") as string)
        : brand.whatsapp.phoneE164,
    // Cartão começa desligado; só aparece para os clientes depois de ativado no admin.
    cardEnabled: map.get("card_enabled") === true,
    // Loja fechada no painel: ninguém consegue gerar cobrança nova.
    storeClosed: map.get("store_closed") === true,
    // Envio de pedidos pagos à Rotasync: desligado por padrão, só manda com o interruptor do painel ligado.
    rastroEnabled: map.get("rastro_enabled") === true,
  };
});

/** Status público da loja (o checkout consulta para saber se pode vender). */
export const getStoreStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "store_closed")
    .maybeSingle();
  return { closed: data?.value === true };
});

export const setStoreClosed = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ password: z.string().min(1).max(200), closed: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.password !== process.env.ADMIN_PASSWORD) {
      throw new Error("Unauthorized");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      key: "store_closed",
      value: data.closed,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true, closed: data.closed };
  });

export const setCardEnabled = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ password: z.string().min(1).max(200), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.password !== process.env.ADMIN_PASSWORD) {
      throw new Error("Unauthorized");
    }
    if (data.enabled) {
      const { getLegacyPublicKey } = await import("@/lib/legacy.server");
      if (!(await getLegacyPublicKey())) {
        throw new Error("Configure primeiro o par de chaves da Legacy Ecom.");
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: "card_enabled", value: data.enabled, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true, enabled: data.enabled };
  });

/**
 * Liga/desliga o envio de pedidos pagos à Rotasync (rastreio).
 * Desligado, a loja não manda pedido nenhum para lá — nem na primeira tentativa nem em reenvio.
 */
export const setRastroEnabled = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ password: z.string().min(1).max(200), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.password !== process.env.ADMIN_PASSWORD) {
      throw new Error("Unauthorized");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: "rastro_enabled", value: data.enabled, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true, enabled: data.enabled };
  });

export const setWhatsappEnabled = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ password: z.string().min(1).max(200), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.password !== process.env.ADMIN_PASSWORD) {
      throw new Error("Unauthorized");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      key: "whatsapp_enabled",
      value: data.enabled,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true, enabled: data.enabled };
  });

export const setWhatsappPhone = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        password: z.string().min(1).max(200),
        phone: z
          .string()
          .trim()
          .regex(/^\+?[0-9\s().-]{10,20}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (data.password !== process.env.ADMIN_PASSWORD) {
      throw new Error("Unauthorized");
    }
    const phone = data.phone.replace(/\D/g, "");
    if (!/^[1-9]\d{9,14}$/.test(phone)) {
      throw new Error("Informe um número válido com DDI e DDD, apenas com 10 a 15 dígitos.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_settings").upsert({
      key: "whatsapp_phone",
      value: phone,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true, phone };
  });
