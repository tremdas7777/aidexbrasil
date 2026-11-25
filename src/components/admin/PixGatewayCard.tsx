import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  deletePixBlackKeyFn,
  deleteWappiKeyFn,
  saveWappiKeyFn,
  testWappiFn,
  deleteKokuKeyFn,
  deletePaySharkKeyFn,
  deletePixgateKeyFn,
  deleteSagacePayKeyFn,
  deleteUmbrellaKeyFn,
  getPixGatewayStatus,
  savePixBlackKeyFn,
  saveKokuKeyFn,
  savePaySharkKeyFn,
  savePixgateKeyFn,
  saveSagacePayKeyFn,
  saveUmbrellaKeyFn,
  setPixGatewayFn,
  testKokuFn,
  testPixBlackFn,
  testPaySharkFn,
  testPixgateFn,
  testSagacePayFn,
  testUmbrellaFn,
} from "@/lib/pix-gateway.functions";

import { saveLegacyKeyFn, deleteLegacyKeyFn, testLegacyFn } from "@/lib/legacy.functions";

type Gateway = "pixgate" | "umbrella" | "sagacepay" | "payshark" | "koku" | "pixblack" | "wappi" | "legacy";
const GATEWAYS = ["pixgate", "umbrella", "sagacepay", "payshark", "koku", "pixblack", "wappi", "legacy"] as const;
type KeyInfo = { key: string | null; source: "admin" | "secret" | null };
type Status = {
  selected: Gateway;
  active: Gateway;
  configured: Record<Gateway, boolean>;
  keys: Record<Gateway, KeyInfo>;
};

const LABEL: Record<Gateway, string> = {
  pixgate: "PixGate",
  umbrella: "Umbrella",
  sagacepay: "SagacePay",
  payshark: "PayShark",
  koku: "Koku",
  pixblack: "Pix Black",
  wappi: "Wappi",
  legacy: "Legacy Ecom",
};
const SECRET: Record<Gateway, string> = {
  pixgate: "PIXGATE_API_KEY",
  umbrella: "UMBRELLA_API_KEY",
  sagacepay: "SAGACEPAY_API_KEY",
  payshark: "PAYSHARK_API_KEY",
  koku: "KOKU_API_KEY",
  pixblack: "PIXBLACK_API_KEY",
  wappi: "WAPPI_API_KEY",
  legacy: "LEGACY_API_KEY",
};

/** Escolha do gateway do Pix (PixGate, Umbrella, SagacePay ou PayShark) + chave de cada um. */
export function PixGatewayCard({ password }: { password: string }) {
  const statusFn = useServerFn(getPixGatewayStatus);
  const setFn = useServerFn(setPixGatewayFn);
  const savePixgateFn = useServerFn(savePixgateKeyFn);
  const deletePixgateFn = useServerFn(deletePixgateKeyFn);
  const saveUmbrellaFn = useServerFn(saveUmbrellaKeyFn);
  const deleteUmbrellaFn = useServerFn(deleteUmbrellaKeyFn);
  const testPixgate = useServerFn(testPixgateFn);
  const testUmbrella = useServerFn(testUmbrellaFn);
  const saveSagaceFn = useServerFn(saveSagacePayKeyFn);
  const deleteSagaceFn = useServerFn(deleteSagacePayKeyFn);
  const testSagace = useServerFn(testSagacePayFn);
  const savePaySharkFn = useServerFn(savePaySharkKeyFn);
  const saveKokuFn = useServerFn(saveKokuKeyFn);
  const savePixBlackFn = useServerFn(savePixBlackKeyFn);
  const deletePaySharkFn = useServerFn(deletePaySharkKeyFn);
  const deleteKokuFn = useServerFn(deleteKokuKeyFn);
  const deletePixBlackFn = useServerFn(deletePixBlackKeyFn);
  const testPayShark = useServerFn(testPaySharkFn);
  const testKoku = useServerFn(testKokuFn);
  const testPixBlack = useServerFn(testPixBlackFn);
  const saveWappi = useServerFn(saveWappiKeyFn);
  const deleteWappi = useServerFn(deleteWappiKeyFn);
  const testWappi = useServerFn(testWappiFn);
  const saveLegacy = useServerFn(saveLegacyKeyFn);
  const deleteLegacy = useServerFn(deleteLegacyKeyFn);
  const testLegacy = useServerFn(testLegacyFn);
  const keyFns = {
    pixgate: { save: savePixgateFn, remove: deletePixgateFn, test: testPixgate },
    umbrella: { save: saveUmbrellaFn, remove: deleteUmbrellaFn, test: testUmbrella },
    sagacepay: { save: saveSagaceFn, remove: deleteSagaceFn, test: testSagace },
    payshark: { save: savePaySharkFn, remove: deletePaySharkFn, test: testPayShark },
    koku: { save: saveKokuFn, remove: deleteKokuFn, test: testKoku },
    pixblack: { save: savePixBlackFn, remove: deletePixBlackFn, test: testPixBlack },
    legacy: { save: saveLegacy, remove: deleteLegacy, test: testLegacy },
    wappi: { save: saveWappi, remove: deleteWappi, test: testWappi },
  };

  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => {
    statusFn({ data: { password } })
      .then(setStatus)
      .catch(() => setStatus(null));
  };

  useEffect(() => {
    if (password) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  /** Executa a ação e mostra o resultado; devolve se deu certo. */
  const run = async (label: string, fn: () => Promise<string>): Promise<boolean> => {
    setBusy(label);
    setMsg(null);
    try {
      setMsg(await fn());
      return true;
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "Algo deu errado. Tente de novo.");
      return false;
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const choose = (gateway: Gateway) =>
    run(`set-${gateway}`, async () => {
      await setFn({ data: { password, gateway } });
      return `Pronto: os próximos Pix saem pela ${LABEL[gateway]}. Pedidos já gerados continuam no gateway de origem.`;
    });

  const saveKey = (gateway: Gateway, key: string) =>
    run(`save-${gateway}`, async () => {
      await keyFns[gateway].save({ data: { password, key } });
      return `Chave da ${LABEL[gateway]} salva. Os próximos Pix da ${LABEL[gateway]} já usam esta chave.`;
    });

  const deleteKey = (gateway: Gateway) =>
    run(`delete-${gateway}`, async () => {
      await keyFns[gateway].remove({ data: { password } });
      return `Chave da ${LABEL[gateway]} apagada do painel.`;
    });

  /** Consulta o gateway com a chave em uso, sem gerar Pix nem pedido. */
  const testKey = (gateway: Gateway) =>
    run(`test-${gateway}`, async () => {
      const r = await keyFns[gateway].test({ data: { password } });
      return r.ok
        ? `Chave da ${LABEL[gateway]} aceita (teste sem gerar pedido).`
        : `Chave da ${LABEL[gateway]} com problema: ${r.error ?? `erro ${r.status ?? ""}`}`;
    });

  return (
    <Card className="mt-3 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ArrowLeftRight className="w-5 h-5 text-muted-foreground" aria-hidden />
          <div>
            <div className="font-medium">Gateway do Pix</div>
            <div className="text-xs text-muted-foreground">
              Escolha quem gera os próximos Pix (padrão: PixGate). A troca vale na hora; pedidos já
              gerados continuam sendo confirmados pelo gateway em que foram criados.
            </div>
          </div>
        </div>
        <span className="text-xs whitespace-nowrap text-emerald-600">
          {status ? `Em uso: ${LABEL[status.active]}` : "…"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {GATEWAYS.map((g) => (
          <Button
            key={g}
            size="sm"
            variant={status?.selected === g ? "default" : "outline"}
            disabled={!status || !!busy || status.selected === g}
            onClick={() => choose(g)}
          >
            {busy === `set-${g}` ? "Salvando…" : LABEL[g]}
            {status && !status.configured[g] ? " (sem chave)" : ""}
          </Button>
        ))}
      </div>

      {status && status.active !== status.selected && (
        <p className="text-xs text-destructive">
          A {LABEL[status.selected]} está escolhida mas sem chave, então o checkout está usando a{" "}
          {LABEL[status.active]}. Cadastre a chave para ela entrar em uso.
        </p>
      )}

      {GATEWAYS.map((g) => (
        <KeySection
          key={g}
          gateway={g}
          info={status?.keys[g] ?? null}
          loading={status === null}
          busy={busy}
          onSave={(key) => saveKey(g, key)}
          onDelete={() => deleteKey(g)}
          onTest={() => testKey(g)}
        />
      ))}
      {msg && <p className="text-xs">{msg}</p>}
    </Card>
  );
}

function KeySection({
  gateway,
  info,
  loading,
  busy,
  onSave,
  onDelete,
  onTest,
}: {
  gateway: Gateway;
  info: KeyInfo | null;
  loading: boolean;
  busy: string | null;
  onSave: (key: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onTest: () => Promise<boolean>;
}) {
  const [key, setKeyRaw] = useState("");
  const [pub, setPub] = useState("");
  const [sec, setSec] = useState("");
  const isPair = gateway === "wappi" || gateway === "legacy";
  const finalKey = isPair ? (pub.trim() && sec.trim() ? `${pub.trim()}:${sec.trim()}` : "") : key.trim();
  const setKey = (v: string) => { setKeyRaw(v); setPub(""); setSec(""); };
  const label = loading
    ? "…"
    : info?.source === "admin"
      ? "Chave do painel"
      : info?.source === "secret"
        ? "Secret do Lovable"
        : "Sem chave";

  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium">Chave da API {LABEL[gateway]}</div>
        <span
          className={`text-xs whitespace-nowrap ${info?.source ? "text-emerald-600" : "text-destructive"}`}
        >
          {label}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        {isPair && "Cole a chave pública e a chave secreta nos campos separados. "}
        A chave salva aqui tem prioridade. Sem ela, vale o secret {SECRET[gateway]} do Lovable.
      </div>
      {isPair ? (
        <>
          <Input autoComplete="off" aria-label={`Chave pública ${LABEL[gateway]}`} placeholder={info?.key ? `Chave em uso (${info.key}) — chave pública` : "Chave pública"} value={pub} onChange={(e) => setPub(e.target.value)} />
          <Input type="password" autoComplete="off" aria-label={`Chave secreta ${LABEL[gateway]}`} placeholder="Chave secreta" value={sec} onChange={(e) => setSec(e.target.value)} />
        </>
      ) : (
      <Input
        type="password"
        autoComplete="off"
        aria-label={`Chave da API ${LABEL[gateway]}`}
        placeholder={info?.key ? `Chave em uso (${info.key})` : `Chave da API ${LABEL[gateway]}`}
        value={key}
        onChange={(e) => setKeyRaw(e.target.value)}
      />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={finalKey.length < 10 || !!busy}
          onClick={() => onSave(finalKey).then((ok) => ok && setKey(""))}
        >
          {busy === `save-${gateway}` ? "Salvando…" : `Salvar chave ${LABEL[gateway]}`}
        </Button>
        <Button size="sm" variant="outline" disabled={!info?.source || !!busy} onClick={onTest}>
          {busy === `test-${gateway}` ? "Testando…" : `Testar chave ${LABEL[gateway]}`}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={info?.source !== "admin" || !!busy}
          onClick={onDelete}
        >
          {busy === `delete-${gateway}` ? "Apagando…" : "Apagar chave do painel"}
        </Button>
      </div>
    </div>
  );
}
