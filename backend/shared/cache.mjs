// Tiny in-memory TTL cache shared across requests in the same Vite dev
// server / Node process. Used to absorb the ~255ms cross-Pacific RTT to
// Neon us-east-1 for read-heavy endpoints that tolerate a few seconds of
// staleness (e.g. inventory overview). Singleton on globalThis so Vite HMR
// reloads of this module never wipe the cache.
import process from "node:process";

const STORE_KEY = "__restaurantManagementMemoryCacheStore__";

function getStore() {
  let store = globalThis[STORE_KEY];
  if (!store) {
    store = new Map();
    globalThis[STORE_KEY] = store;
  }
  return store;
}

function parseBooleanFlag(rawValue, fallback) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback;
  }
  const normalized = String(rawValue).trim().toLowerCase();
  if (["1", "on", "true", "yes", "enabled"].includes(normalized)) {
    return true;
  }
  if (["0", "off", "false", "no", "disabled"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function isCacheEnabled() {
  // Default ON. Set CACHE_ENABLED=off to disable from .env when debugging.
  return parseBooleanFlag(process.env.CACHE_ENABLED, true);
}

export function getCachedValue(key) {
  if (!isCacheEnabled()) {
    return undefined;
  }
  const entry = getStore().get(key);
  if (!entry) {
    return undefined;
  }
  if (entry.expiresAt <= Date.now()) {
    getStore().delete(key);
    return undefined;
  }
  return entry.value;
}

export function setCachedValue(key, value, ttlMs) {
  if (!isCacheEnabled()) {
    return;
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    return;
  }
  getStore().set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateCacheKey(key) {
  getStore().delete(key);
}

export function invalidateCachePrefix(prefix) {
  if (typeof prefix !== "string" || prefix.length === 0) {
    return;
  }
  const store = getStore();
  for (const key of store.keys()) {
    if (typeof key === "string" && key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

export function clearCache() {
  getStore().clear();
}

// Convenience: read-through helper. Loads via `loader` on miss, stores
// for `ttlMs`, and returns the value. Loader errors are propagated and the
// failure is NOT cached (so transient DB issues do not poison the cache).
export async function withCache(key, ttlMs, loader) {
  const cached = getCachedValue(key);
  if (cached !== undefined) {
    return cached;
  }
  const value = await loader();
  setCachedValue(key, value, ttlMs);
  return value;
}
