/* global __APP_VERSION__: readonly */
// Only fixed categories: never copy messages, stacks, credentials or user data.
const stages = new WeakMap();
const errorNames = new Set([
  "TypeError", "ReferenceError", "SyntaxError", "RangeError", "AbortError",
  "QuotaExceededError", "SecurityError", "InvalidStateError", "VersionError",
  "NotFoundError", "DataError", "DataCloneError", "UnknownError", "TransactionInactiveError",
  "NotReadableError", "OperationError",
]);
const knownStages = new Set([
  "password-request", "google-exchange", "google-callback", "boot-local",
  "open-storage", "read-local-owner", "read-local-data", "prepare-local-data",
  "switch-account", "load-account", "merge-data", "save-local-data",
  "save-local-owner", "apply-account",
  "recovery-load-account", "recovery-save-copy", "recovery-activate",
]);

export function markLoginFailure(error, stage) {
  if (error && (typeof error === "object" || typeof error === "function") && knownStages.has(stage)) {
    stages.set(error, stage);
  }
}

export function loginDiagnosticCode(error, fallbackStage) {
  const stage = (error && stages.get(error)) || (knownStages.has(fallbackStage) ? fallbackStage : "unknown");
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
    ? `HTTP${error.status}` : errorNames.has(error?.name) ? error.name : "Error";
  const version = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
  return `${version}/${stage}/${status}`;
}
