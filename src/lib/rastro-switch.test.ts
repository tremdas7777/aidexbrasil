import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldSendRastro } from "./rotasync.server";

// Regra do usuário: o envio à Rotasync fica desligado até ligar no painel.
describe("interruptor do rastreio (Rotasync)", () => {
  it("não envia quando a chave não existe no banco", () => {
    assert.equal(shouldSendRastro(undefined), false);
    assert.equal(shouldSendRastro(null), false);
  });

  it("não envia com o interruptor desligado", () => {
    assert.equal(shouldSendRastro(false), false);
  });

  it("não envia com valor escrito em texto", () => {
    assert.equal(shouldSendRastro("true"), false);
    assert.equal(shouldSendRastro(1), false);
  });

  it("só envia com o interruptor ligado", () => {
    assert.equal(shouldSendRastro(true), true);
  });
});
