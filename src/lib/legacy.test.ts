import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertLegacyPreparedAmount, isLegacyOrderId, legacyKeySchema, legacyPayinCardSchema, legacyRefused, normalizeLegacyStatus, payerDataError, pickFallbackGateway, shouldFallbackToNextGateway } from "./legacy";
import { isPaidStatus } from "./pix-status";
import { checkoutTotals } from "./payment-pricing";

describe("Legacy payments", () => {
  it("only APPROVED confirms a Legacy payment", () => {
    assert.equal(isPaidStatus(normalizeLegacyStatus("APPROVED")), true);
    for (const status of ["PENDING", "REFUSED", "FAILED", "CANCELED", "REFUNDED", "CHARGEBACK", "MED", "EXPIRED"]) assert.equal(isPaidStatus(normalizeLegacyStatus(status)), false);
    assert.equal(isPaidStatus("approved"), false); // PixGate's generated Pix is not paid.
  });
  it("routes both Legacy payment methods with le_", () => {
    assert.equal(isLegacyOrderId("le_1023"), true);
    assert.equal(isLegacyOrderId("hc_1023"), false);
  });
  it("preserves pending 3DS even if the raw status is failed", () => {
    assert.equal(legacyRefused("failed", true), false);
    assert.equal(legacyRefused("failed", false), true);
  });
  it("preserves the complete prepared card but rejects raw card fields", () => {
    const card = { token: "cvt_live_test", installments: 1, threeDSecure: { transactionId: "3ds" }, device: { browser: "test" }, userAgent: "test" };
    assert.deepEqual(legacyPayinCardSchema.parse(card), card);
    assert.equal(legacyPayinCardSchema.safeParse({ ...card, cvv: "123" }).success, false);
    assert.equal(legacyPayinCardSchema.safeParse("token-string").success, false);
  });
  it("requires the same amount and installments as 3DS preparation", () => {
    assert.doesNotThrow(() => assertLegacyPreparedAmount(9790, 9790, 3, 3));
    assert.throws(() => assertLegacyPreparedAmount(9790, 9791, 3, 3));
    assert.throws(() => assertLegacyPreparedAmount(9790, 9790, 3, 1));
  });
  it("requires a public and secret key in the correct order", () => {
    assert.equal(legacyKeySchema.safeParse("pk_live_example:sk_live_example").success, true);
    assert.equal(legacyKeySchema.safeParse("sk_live_example").success, false);
    assert.equal(legacyKeySchema.safeParse("sk_live_example:pk_live_example").success, false);
  });
  it("does not switch gateways for invalid payer data or risk", () => {
    for (const code of ["INVALID_DATA", "INVALID_CVV", "REJECTED_BY_RISK", "PAYER_LIMIT_REJECTED"]) assert.equal(shouldFallbackToNextGateway(payerDataError(code, "customer.document")), false);
    assert.equal(shouldFallbackToNextGateway(new Error("provider unavailable")), true);
  });
  it("only selects eligible configured fallback gateways", () => {
    assert.equal(pickFallbackGateway("pixgate", { legacy: true, payshark: true, wappi: true }, { hasIp: false, hasAddress: false }, ["legacy", "payshark", "wappi"]), "wappi");
  });
  it("keeps Pix's 10% discount off shipping and cards at full price", () => {
    assert.equal(checkoutTotals({ products: 180, frete: 20, method: "pix", pixDiscount: true }).total, 18200);
    assert.equal(checkoutTotals({ products: 180, frete: 20, method: "card", pixDiscount: true }).total, 20000);
    assert.equal(checkoutTotals({ products: 180, frete: 20, method: "pix", pixDiscount: false }).total, 20000);
  });
});