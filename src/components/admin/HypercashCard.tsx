import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  deleteHypercashKeysFn,
  getHypercashStatus,
  saveHypercashKeysFn,
  testHypercashFn,
} from "@/lib/hypercash.functions";

/** Credenciais HyperCash mantidas para consultar/finalizar pedidos antigos desse gateway. */
export function HypercashCard({ password }: { password: string }) {
  const statusFn = useServerFn(getHypercashStatus);
  const saveFn = useServerFn(saveHypercashKeysFn);
  const deleteFn = useServerFn(deleteHypercashKeysFn);
  const testFn = useServerFn(testHypercashFn);
  const [masked, setMasked] = useState<{ secret: string | null; public: string | null } | null>(
    null,
  );
  const [secret, setSecret] = useState("");
  const [pub, setPub] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => {
    statusFn({ data: { password } })
      .then(setMasked)
      .catch(() => setMasked({ secret: null, public: null }));
  };

  useEffect(() => {
    if (password) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    setMsg(null);
    try {
      setMsg(await fn());
    } catch {
      setMsg("Algo deu errado. Tente de novo.");
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const save = () =>
    run("save", async () => {
      await saveFn({
        data: {
          password,
          ...(secret.trim() ? { secret: secret.trim() } : {}),
          ...(pub.trim() ? { public: pub.trim() } : {}),
        },
      });
      setSecret("");
      setPub("");
      return "Chaves salvas.";
    });

  const remove = () =>
    run("delete", async () => {
      await deleteFn({ data: { password } });
      return "Chaves HyperCash apagadas. Pedidos antigos ou upsells que dependam desse gateway podem deixar de funcionar.";
    });

  const test = () =>
    run("test", async () => {
      const r = await testFn({ data: { password } });
      return r.ok
        ? "Conexão OK: a HyperCash aceitou a chave secreta. (Nenhuma cobrança foi criada.)"
        : `Falhou${r.status ? ` (HTTP ${r.status})` : ""}: ${r.error ?? "sem detalhes"}`;
    });

  return (
    <Card className="mt-3 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-muted-foreground" aria-hidden />
          <div>
            <div className="font-medium">HyperCash — credenciais para pedidos antigos</div>
            <div className="text-xs text-muted-foreground">
              Novas cobranças de cartão no checkout usam a Legacy Ecom. Estas credenciais ficam
              disponíveis para acompanhar pedidos ou upsells criados anteriormente pela HyperCash.
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          type="password"
          autoComplete="off"
          placeholder={
            masked?.public ? `Chave pública salva (${masked.public})` : "Chave pública (pk_…)"
          }
          value={pub}
          onChange={(e) => setPub(e.target.value)}
        />
        <Input
          type="password"
          autoComplete="off"
          placeholder={masked?.secret ? `Chave secreta salva (${masked.secret})` : "Chave secreta"}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={(!secret.trim() && !pub.trim()) || !!busy} onClick={save}>
          {busy === "save" ? "Salvando…" : "Salvar chaves"}
        </Button>
        <Button size="sm" variant="outline" disabled={!masked?.secret || !!busy} onClick={test}>
          {busy === "test" ? "Testando…" : "Testar conexão"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={(!masked?.secret && !masked?.public) || !!busy}
          onClick={remove}
        >
          {busy === "delete" ? "Apagando…" : "Apagar chaves"}
        </Button>
      </div>
      {msg && <p className="text-xs">{msg}</p>}
    </Card>
  );
}
