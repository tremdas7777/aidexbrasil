import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertLegacyPreparedAmount,
  isLegacyOrderId,
  legacyCardErrorMessage,
  legacyCardRefusalMessage,
  legacyKeySchema,
  legacyPayinCardSchema,
  legacyRefused,
  normalizeLegacyStatus,
  payerDataError,
  pickFallbackGateway,
  shouldFallbackToNextGateway,
} from "./legacy";
import { isFailedPaymentStatus, isPaidStatus } from "./pix-status";
import { CARD_MAX_INSTALLMENTS, checkoutTotals } from "./payment-pricing";

describe("Legacy payments", () => {
  it("only APPROVED confirms a Legacy payment", () => {
    assert.equal(isPaidStatus(normalizeLegacyStatus("APPROVED")), true);
    for (const status of [
      "PENDING",
      "REFUSED",
      "FAILED",
      "CANCELED",
      "REFUNDED",
      "CHARGEBACK",
      "MED",
      "EXPIRED",
    ])
      assert.equal(isPaidStatus(normalizeLegacyStatus(status)), false);
    assert.equal(isPaidStatus("approved"), false); // PixGate's generated Pix is not paid.
  });
  it("keeps refused and failed attempts separate from pending payments", () => {
    for (const status of ["refused", "failed", "error", "canceled"]) {
      assert.equal(isFailedPaymentStatus(status), true);
      assert.equal(isPaidStatus(status), false);
    }
    assert.equal(isFailedPaymentStatus("pending"), false);
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
    const card = {
      token: "cvt_live_test",
      installments: 1,
      threeDSecure: { transactionId: "3ds" },
      device: { browser: "test" },
      userAgent: "test",
    };
    assert.deepEqual(legacyPayinCardSchema.parse(card), card);
    assert.equal(legacyPayinCardSchema.safeParse({ ...card, cvv: "123" }).success, false);
    assert.equal(legacyPayinCardSchema.safeParse({ ...card, installments: 2 }).success, false);
    assert.equal(legacyPayinCardSchema.safeParse("token-string").success, false);
  });
  it("allows card payments only in one installment", () => {
    assert.equal(CARD_MAX_INSTALLMENTS, 1);
    assert.doesNotThrow(() => assertLegacyPreparedAmount(9790, 9790, 1, 1));
    assert.throws(() => assertLegacyPreparedAmount(9790, 9790, 2, 2));
    assert.throws(() => assertLegacyPreparedAmount(9790, 9790, 1, 2));
  });
  it("requires the same amount and installments as 3DS preparation", () => {
    assert.throws(() => assertLegacyPreparedAmount(9790, 9791, 1, 1));
    assert.throws(() => assertLegacyPreparedAmount(9790, 9790, 2, 1));
  });
  it("shows safe refusal messages without exposing raw gateway details", () => {
    assert.match(legacyCardRefusalMessage("invalid cvv"), /CVV inválido/);
    assert.match(
      legacyCardRefusalMessage("issuer internal detail 4111111111111111"),
      /Pagamento recusado/,
    );
    assert.doesNotMatch(
      legacyCardRefusalMessage("issuer internal detail 4111111111111111"),
      /411111/,
    );
    assert.match(legacyCardErrorMessage(payerDataError("INVALID_CVV", "")), /CVV inválido/);
    assert.doesNotMatch(legacyCardErrorMessage(new Error("secret 4111111111111111")), /411111/);
  });
  it("requires a public and secret key in the correct order", () => {
    assert.equal(legacyKeySchema.safeParse("pk_live_example:sk_live_example").success, true);
    assert.equal(legacyKeySchema.safeParse("sk_live_example").success, false);
    assert.equal(legacyKeySchema.safeParse("sk_live_example:pk_live_example").success, false);
  });
  it("does not switch gateways for invalid payer data or risk", () => {
    for (const code of ["INVALID_DATA", "INVALID_CVV", "REJECTED_BY_RISK", "PAYER_LIMIT_REJECTED"])
      assert.equal(shouldFallbackToNextGateway(payerDataError(code, "customer.document")), false);
    assert.equal(shouldFallbackToNextGateway(new Error("provider unavailable")), true);
  });
  it("only selects eligible configured fallback gateways", () => {
    assert.equal(
      pickFallbackGateway(
        "pixgate",
        { legacy: true, payshark: true, wappi: true },
        { hasIp: false, hasAddress: false },
        ["legacy", "payshark", "wappi"],
      ),
      "wappi",
    );
  });
  it("keeps Pix's 10% discount off shipping and cards at full price", () => {
    assert.equal(
      checkoutTotals({ products: 180, frete: 20, method: "pix", pixDiscount: true }).total,
      18200,
    );
    assert.equal(
      checkoutTotals({ products: 180, frete: 20, method: "card", pixDiscount: true }).total,
      20000,
    );
    assert.equal(
      checkoutTotals({ products: 180, frete: 20, method: "pix", pixDiscount: false }).total,
      20000,
    );
  });
});
