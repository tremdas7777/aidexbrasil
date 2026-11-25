import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLegacyStatusFn, testLegacyFn } from "@/lib/legacy.functions";
import { getSiteSettings, setCardEnabled } from "@/lib/site-settings.functions";

type LegacyStatus = { key: string | null; source: "admin" | "secret" | null };

/** O checkout actual processa novos cartões através da Legacy Ecom e do desafio 3DS. */
export function LegacyCard({ password }: { password: string }) {
  const statusFn = useServerFn(getLegacyStatusFn);
  const settingsFn = useServerFn(getSiteSettings);
  const toggleFn = useServerFn(setCardEnabled);
  const testFn = useServerFn(testLegacyFn);

  const [legacy, setLegacy] = useState<LegacyStatus | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () => {
    statusFn({ data: { password } })
      .then(setLegacy)
      .catch(() => setLegacy({ key: null, source: null }));
    settingsFn()
      .then((settings) => setEnabled(settings.cardEnabled))
      .catch(() => undefined);
  };

  useEffect(() => {
    if (password) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const toggle = () =>
    run(async () => {
      const result = await toggleFn({ data: { password, enabled: !enabled } });
      return result.enabled
        ? "Cartão Legacy activado no checkout."
        : "Cartão Legacy desactivado; o checkout apresenta apenas Pix.";
    });

  const test = () =>
    run(async () => {
      const result = await testFn({ data: { password } });
      return result.ok
        ? "Conexão Legacy validada. Nenhuma cobrança foi criada."
        : `A validação falhou${result.status ? ` (HTTP ${result.status})` : ""}: ${result.error ?? "sem detalhes"}`;
    });

  const configured = !!legacy?.key;
  const active = enabled === true && configured;
  const source =
    legacy?.source === "admin"
      ? "Chave do painel"
      : legacy?.source === "secret"
        ? "Secret do Lovable"
        : "Sem chave";

  return (
    <Card className="mt-3 flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden />
          <div>
            <div className="font-medium">Pagamento com cartão (Legacy Ecom)</div>
            <div className="text-xs text-muted-foreground">
              Usa o SDK LegacyPay e autenticação 3DS. As chaves são as mesmas da Legacy em “Gateway
              do Pix”; seleccionar Legacy como gateway Pix não activa o cartão automaticamente.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {enabled === null || legacy === null
              ? "A verificar…"
              : active
                ? "Activo"
                : !configured
                  ? "Sem chave Legacy"
                  : "Desactivado"}
          </span>
          <Button
            size="sm"
            variant={enabled ? "destructive" : "default"}
            disabled={busy || enabled === null || (!enabled && !configured)}
            onClick={toggle}
          >
            {busy ? "A processar…" : enabled ? "Desactivar cartão Legacy" : "Activar cartão Legacy"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="text-xs text-muted-foreground">
          Chave Legacy em uso:{" "}
          <span className="font-medium text-foreground">
            {legacy === null ? "…" : configured ? `${source} (${legacy.key})` : source}
          </span>
        </div>
        <Button size="sm" variant="outline" disabled={!configured || busy} onClick={test}>
          {busy ? "A verificar…" : "Testar chaves Legacy"}
        </Button>
      </div>
      {!configured && (
        <p className="text-xs text-muted-foreground">
          Primeiro configure o par de chaves pk:sk na secção “Gateway do Pix”. A chave secreta nunca
          é enviada ao navegador.
        </p>
      )}
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </Card>
  );
}
