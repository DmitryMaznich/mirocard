#!/usr/bin/env node

const publicUrl = (process.env.MIROCARD_PUBLIC_URL || "https://app.mironium.com").replace(/\/+$/, "");
const checks = [
  ["application", "/"],
  ["backend", "/api/version"],
  ["deck catalog", "/decks/catalog.json"],
];

for (const [label, pathname] of checks) {
  const response = await fetch(`${publicUrl}${pathname}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${label}: ${response.status} at ${pathname}`);
  console.log(`verified ${label}: ${publicUrl}${pathname}`);
}

console.log("Railway deployment endpoint is reachable.");
