import process from "node:process";
import { getInventoryOverview as getInventoryOverviewInRepository } from "../repositories/inventoryOverviewRepository.mjs";
import {
  invalidateCachePrefix,
  withCache,
} from "../../../shared/cache.mjs";

// Short TTL: tolerable staleness for the dashboard, but long enough to
// absorb the ~250ms cross-Pacific RTT to Neon for repeated views (refresh,
// tab switches, etc.). Tunable via INVENTORY_OVERVIEW_CACHE_TTL_MS.
const DEFAULT_TTL_MS = 15_000;

function getTtlMs() {
  const raw = process.env.INVENTORY_OVERVIEW_CACHE_TTL_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_TTL_MS;
  }
  return parsed;
}

const CACHE_KEY = "inventory:overview:v1";
const CACHE_PREFIX = "inventory:";

export async function getInventoryOverview() {
  return withCache(CACHE_KEY, getTtlMs(), () => getInventoryOverviewInRepository());
}

// Exported so write paths (stock receipts, balance/inbound mutations) can
// drop the cache after a mutation, ensuring the next read reflects the
// fresh state instead of waiting up to TTL seconds.
export function invalidateInventoryOverviewCache() {
  invalidateCachePrefix(CACHE_PREFIX);
}
