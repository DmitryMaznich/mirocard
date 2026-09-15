import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAN_CATALOG, applyDiscount } from "../lib/billing-plans.mjs";

test("PLAN_CATALOG matches the live landing page prices", () => {
  assert.equal(PLAN_CATALOG.monthly.amountMinor, 990);
  assert.equal(PLAN_CATALOG.half_year.amountMinor, 4990);
  assert.equal(PLAN_CATALOG.annual.amountMinor, 8990);
  assert.equal(PLAN_CATALOG.monthly.currency, "EUR");
});

test("applyDiscount with percent_off rounds to the nearest cent", () => {
  assert.equal(applyDiscount(8990, { kind: "percent_off", value: 10 }), 8091);
});

test("applyDiscount with fixed_off subtracts a flat amount", () => {
  assert.equal(applyDiscount(8990, { kind: "fixed_off", value: 1000 }), 7990);
});

test("applyDiscount never goes below zero", () => {
  assert.equal(applyDiscount(500, { kind: "fixed_off", value: 10000 }), 0);
  assert.equal(applyDiscount(500, { kind: "percent_off", value: 100 }), 0);
});

test("applyDiscount with an unrecognized kind returns the amount unchanged", () => {
  assert.equal(applyDiscount(990, { kind: "free_grant", value: null }), 990);
});
