import { test } from "node:test";
import assert from "node:assert/strict";
import { columnLabel } from "./column_label.mjs";

test("columnLabel starts at А for column 0", () => {
  assert.equal(columnLabel(0), "А");
});

test("columnLabel skips Ё between Д and Ж", () => {
  assert.equal(columnLabel(4), "Д");
  assert.equal(columnLabel(5), "Е");
  assert.equal(columnLabel(6), "Ж");
});

test("columnLabel skips Й between И and К", () => {
  assert.equal(columnLabel(8), "И");
  assert.equal(columnLabel(9), "К");
});

test("columnLabel covers columns 0-12 with unique, defined letters", () => {
  const letters = Array.from({ length: 13 }, (_, i) => columnLabel(i));
  assert.equal(letters.every((letter) => typeof letter === "string" && letter.length === 1), true);
  assert.equal(new Set(letters).size, 13);
});
