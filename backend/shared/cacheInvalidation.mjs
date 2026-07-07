// Centralized cache-invalidation helper. Every write path calls ONE function
// here instead of scattering invalidation logic across routes & use-cases.
//
// The cache-key prefixes must match what each use-case/route stores. When a
// new cache key is introduced the corresponding prefix should be added below.

import { invalidateCachePrefix } from "./cache.mjs";

// ── prefix registry ─────────────────────────────────────────────────────────
const PREFIX = {
  inventory: "inventory:",
  dashboard: "dashboard:",
  salesPlans: "salesPlans:",
  portioning: "portioning:",
  suppliers: "suppliers:",
  menuProducts: "menuProducts:",
};

// ── low-level helpers ────────────────────────────────────────────────────────
function drop(...prefixes) {
  for (const prefix of prefixes) {
    invalidateCachePrefix(prefix);
  }
}

// ── public cascade functions ─────────────────────────────────────────────────

/** After a stock receipt is created (nhập kho). */
export function invalidateAfterStockReceipt() {
  drop(
    PREFIX.inventory,
    PREFIX.dashboard,
    PREFIX.salesPlans,
    PREFIX.portioning,
  );
}

/** After a stock balance is updated or deleted. */
export function invalidateAfterBalanceChange() {
  drop(
    PREFIX.inventory,
    PREFIX.salesPlans,
    PREFIX.portioning,
  );
}

/** After a stock inbound row is updated or deleted. */
export function invalidateAfterInboundChange() {
  drop(
    PREFIX.inventory,
    PREFIX.dashboard,
    PREFIX.salesPlans,
    PREFIX.portioning,
  );
}

/** After a product order is created. */
export function invalidateAfterOrderCreated() {
  drop(
    PREFIX.dashboard,
    PREFIX.salesPlans,
    PREFIX.inventory,
  );
}

/** After a menu product is created, updated, or deleted. */
export function invalidateAfterMenuProductChange() {
  drop(
    PREFIX.menuProducts,
    PREFIX.portioning,
    PREFIX.salesPlans,
  );
}

/** After a supplier is created or updated. */
export function invalidateAfterSupplierChange() {
  drop(PREFIX.suppliers);
}

/** After a portioning rule is created or updated. */
export function invalidateAfterPortioningRuleChange() {
  drop(
    PREFIX.inventory,
    PREFIX.portioning,
    PREFIX.salesPlans,
  );
}

/** After a sales plan is created, updated, or deleted. */
export function invalidateAfterSalesPlanChange() {
  drop(
    PREFIX.salesPlans,
    PREFIX.inventory,
  );
}
