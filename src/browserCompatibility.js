// Older Android Chrome versions can still open the installed app, but lack
// Object.hasOwn. Language reconciliation runs after both sign-in methods.
// Install the standard equivalent before evaluating application modules.
export function ensureObjectHasOwn() {
  if (typeof Object.hasOwn === "function") return;
  Object.defineProperty(Object, "hasOwn", {
    value: function hasOwn(object, key) {
      return Object.prototype.hasOwnProperty.call(object, key);
    },
    writable: true,
    configurable: true,
  });
}

export function ensureBrowserCompatibility() {
  ensureObjectHasOwn();
  if (typeof Array.prototype.at !== "function") {
    Object.defineProperty(Array.prototype, "at", {
      value: function at(index) {
        if (this == null) throw new TypeError("Array.at called on null or undefined");
        const value = Object(this);
        const length = Math.min(Math.max(Math.trunc(+value.length) || 0, 0), Number.MAX_SAFE_INTEGER);
        const relative = Math.trunc(+index) || 0;
        const position = relative < 0 ? length + relative : relative;
        return position < 0 || position >= length ? undefined : value[position];
      },
      writable: true,
      configurable: true,
    });
  }
  const secureCrypto = globalThis.crypto;
  if (secureCrypto && typeof secureCrypto.randomUUID !== "function" && typeof secureCrypto.getRandomValues === "function") {
    Object.defineProperty(secureCrypto, "randomUUID", {
      value: function randomUUID() {
        const bytes = new Uint8Array(16);
        secureCrypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      },
      writable: true,
      configurable: true,
    });
  }
}

ensureBrowserCompatibility();
