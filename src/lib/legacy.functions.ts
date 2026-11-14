import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { legacyKeySchema, maskLegacyPublicKey, parseLegacyKey } from "./legacy";
import {
  deleteLegacyKey,
  getLegacyKeySource,
  saveLegacyKey,
  testLegacyKey,
} from "./legacy.server";

const pw = z.object({ password: z.string().min(1).max(200) });

function assertAdmin(password: string) {
  if (password !== process.env["ADMIN_PASSWORD"]) throw new Error("Não autorizado");
}

/** Chave da Legacy em uso, mascarada: só o início da pk (ex.: "pk_live_••••"), nunca a sk. */
export const getLegacyStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const { key, source } = await getLegacyKeySource();
    return {
      key: key ? maskLegacyPublicKey(parseLegacyKey(key).publicKey) : null,
      source,
    };
  });

export const saveLegacyKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.extend({ key: legacyKeySchema }).parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await saveLegacyKey(data.key);
    return { ok: true };
  });

export const deleteLegacyKeyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await deleteLegacyKey();
    return { ok: true };
  });

/** Valida o par de chaves sem gerar cobrança nenhuma (GET /whoami). */
export const testLegacyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pw.parse(d))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    return testLegacyKey();
  });
