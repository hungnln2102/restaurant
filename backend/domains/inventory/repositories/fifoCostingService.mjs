// FIFO costing for menu products. Used by:
//   - product orders (real consumption: subtracts remaining_quantity + balances).
//   - sales plan / portioning previews (read-only simulation: same FIFO walk
//     but never writes back; flags `isPreviewIncomplete` when current lots
//     cannot fully cover the recipe so the UI can warn the operator).
//
// Lot model (see inventory-schema.sql):
//   - stock_inbounds.input_quantity / input_unit are the raw receipt values.
//   - stock_inbounds.conversion_ratio normalizes input_unit → on_hand_unit
//     stored in stock_balances. remaining_quantity is in normalized units.
//   - lot.unit_price is per input_unit; per-normalized-unit price therefore is
//     `unit_price / coalesce(conversion_ratio, 1)`.
//   - Adjustment lots created by stockBalanceRepository have null price and
//     null conversion_ratio; we fall back to supplier_products and 0 in turn.

// Tolerance to absorb NUMERIC(18,4) ↔ JS Number drift on subtraction chains.
const EPSILON = 1e-6;

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function toFiniteNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function snapToZero(value) {
  return Math.abs(value) < EPSILON ? 0 : value;
}

// stock_unit is the lot's input_unit; processing_unit is the recipe/balance
// unit (e.g. kg → g). When equal, the ratio is implicitly 1; when no rule is
// configured, the spec asks us to fall back to 1 (treat the recipe quantity
// as already normalized) instead of throwing.
function resolveConversionRatio(conversionMap, fromUnit, toUnit) {
  if (!fromUnit || !toUnit || fromUnit === toUnit) {
    return 1;
  }
  const ratio = conversionMap.get(`${fromUnit}::${toUnit}`);
  if (Number.isFinite(ratio) && ratio > 0) {
    return ratio;
  }
  return 1;
}

function computePerNormalizedUnitPrice(lot, fallbackUnitPrice) {
  const lotUnitPrice = toFiniteNumber(lot.unit_price, null);
  const conversionRatio = (() => {
    const ratio = toFiniteNumber(lot.conversion_ratio, 1);
    return ratio > 0 ? ratio : 1;
  })();

  if (lotUnitPrice !== null) {
    return lotUnitPrice / conversionRatio;
  }

  const fallback = toFiniteNumber(fallbackUnitPrice, null);
  if (fallback !== null) {
    return fallback / conversionRatio;
  }

  return 0;
}

// Pure consumer used by both real consumption and preview. The caller passes
// in a mutable copy of the lot list when previewing so virtual consumption
// does not leak across menu products.
//
// fallbackUnitPrice is a per-product safety net used only when an individual
// lot has no `fallback_unit_price` pre-resolved (e.g. the lot's supplier has
// no supplier_products row) AND no `unit_price`. Pre-resolved lot fallback
// (filtered by lot.supplier_id) wins because it mirrors what the real FIFO
// consumption path does inside consumeFifoForOrder.
function walkLotsFifo(lots, quantityNeededNormalized, fallbackUnitPrice) {
  let remaining = quantityNeededNormalized;
  let totalCost = 0;
  let lastUnitPrice = null;
  let isPreviewIncomplete = false;
  const consumptions = [];

  for (const lot of lots) {
    if (remaining <= EPSILON) {
      break;
    }

    const lotRemaining = toFiniteNumber(lot.remaining_quantity, 0);
    if (lotRemaining <= 0) {
      continue;
    }

    const consumeNow = Math.min(lotRemaining, remaining);
    if (consumeNow <= 0) {
      continue;
    }

    // Prefer the per-lot fallback (resolved with supplier_id filtering) so a
    // lot from supplier A never inherits supplier B's price by accident. Fall
    // back to the per-product preferred price only when the lot-specific
    // lookup returned nothing (e.g. adjustment lot for a product with no
    // supplier_products row).
    const perLotFallback = toFiniteNumber(lot.fallback_unit_price, null);
    const effectiveFallback =
      perLotFallback !== null ? perLotFallback : fallbackUnitPrice;
    const perUnitPrice = computePerNormalizedUnitPrice(lot, effectiveFallback);
    totalCost += consumeNow * perUnitPrice;
    lastUnitPrice = perUnitPrice;
    remaining -= consumeNow;

    consumptions.push({
      lotId: lot.id,
      consumeNow,
      perUnitPrice,
      nextRemaining: snapToZero(lotRemaining - consumeNow),
    });
  }

  if (remaining > EPSILON) {
    // Preview path: extrapolate the missing portion using the most recently
    // consumed lot's price (or supplier fallback / 0 when nothing exists).
    isPreviewIncomplete = true;
    const extrapolated = lastUnitPrice ?? toFiniteNumber(fallbackUnitPrice, 0) ?? 0;
    totalCost += remaining * extrapolated;
  }

  return {
    totalCost,
    consumptions,
    isPreviewIncomplete,
    fifoCostPerUnit:
      quantityNeededNormalized > EPSILON
        ? totalCost / quantityNeededNormalized
        : 0,
    shortfallNormalized: remaining > EPSILON ? remaining : 0,
  };
}

async function loadConversionMap(runner) {
  const result = await runner.query(
    `
      select stock_unit, processing_unit, conversion_ratio
      from inventory.unit_conversions
    `,
  );
  const map = new Map();
  for (const row of result.rows) {
    const ratio = toFiniteNumber(row.conversion_ratio, null);
    if (ratio !== null && ratio > 0) {
      map.set(`${row.stock_unit}::${row.processing_unit}`, ratio);
    }
  }
  return map;
}

async function loadOpenLotsByProduct(runner) {
  // The LATERAL-style subquery here mirrors what consumeFifoForOrder runs
  // inside the order transaction so preview costing stays in lock-step with
  // real consumption. For every lot we resolve a fallback price using the
  // lot's own supplier_id (when set) instead of any preferred supplier of the
  // product — otherwise a lot from supplier A without unit_price would be
  // priced using supplier B's preferred price, which is the latent bug the
  // FIFO audit called out.
  const result = await runner.query(
    `
      select
        si.id,
        si.stock_product_id,
        si.input_unit,
        si.unit_price,
        si.conversion_ratio,
        si.remaining_quantity,
        si.supplier_id,
        si.created_at,
        (
          select sp_inner.unit_price
          from inventory.supplier_products sp_inner
          where sp_inner.stock_product_id = si.stock_product_id
            and (
              si.supplier_id is null
              or sp_inner.supplier_id = si.supplier_id
            )
          order by sp_inner.is_preferred desc, sp_inner.updated_at desc
          limit 1
        ) as fallback_unit_price
      from inventory.stock_inbounds si
      where si.remaining_quantity > 0
      order by si.stock_product_id asc, si.created_at asc, si.id asc
    `,
  );

  const map = new Map();
  for (const row of result.rows) {
    const productId = Number(row.stock_product_id);
    const list = map.get(productId) ?? [];
    list.push({
      id: Number(row.id),
      stock_product_id: productId,
      input_unit: row.input_unit,
      unit_price: row.unit_price,
      conversion_ratio: row.conversion_ratio,
      remaining_quantity: Number(row.remaining_quantity || 0),
      supplier_id: row.supplier_id === null ? null : Number(row.supplier_id),
      fallback_unit_price: toFiniteNumber(row.fallback_unit_price, null),
    });
    map.set(productId, list);
  }
  return map;
}

async function loadFallbackPriceMap(runner) {
  // Per-product preferred-supplier price used as the LAST-RESORT fallback in
  // two cases only:
  //   1) Extrapolation tail in walkLotsFifo when the recipe exceeds available
  //      lots and `lastUnitPrice` is still null (no lots existed at all).
  //   2) A lot whose pre-resolved `fallback_unit_price` is also null because
  //      its supplier has no supplier_products row.
  // Per-lot fallback (loadOpenLotsByProduct) takes priority and correctly
  // filters by supplier_id so previews stay consistent with the real FIFO
  // consumption path.
  const result = await runner.query(
    `
      select distinct on (stock_product_id)
        stock_product_id,
        unit_price,
        pricing_unit
      from inventory.supplier_products
      order by stock_product_id, is_preferred desc, updated_at desc
    `,
  );

  const map = new Map();
  for (const row of result.rows) {
    map.set(Number(row.stock_product_id), {
      unitPrice: toFiniteNumber(row.unit_price, null),
      pricingUnit: row.pricing_unit ?? null,
    });
  }
  return map;
}

async function loadStockBalanceUnits(runner) {
  const result = await runner.query(
    `
      select stock_product_id, on_hand_unit
      from inventory.stock_balances
    `,
  );

  const map = new Map();
  for (const row of result.rows) {
    map.set(Number(row.stock_product_id), row.on_hand_unit);
  }
  return map;
}

async function loadComponentsForMenu(runner, menuProductId) {
  const result = await runner.query(
    `
      select
        mpc.stock_product_id,
        mpc.quantity as quantity_needed,
        mpc.unit as recipe_unit,
        sp.product_name,
        sb.on_hand_unit
      from inventory.menu_product_components mpc
      join inventory.stock_products sp on sp.id = mpc.stock_product_id
      left join inventory.stock_balances sb on sb.stock_product_id = mpc.stock_product_id
      where mpc.menu_product_id = $1
      order by mpc.sort_order asc, mpc.id asc
    `,
    [menuProductId],
  );

  return result.rows.map((row) => ({
    stockProductId: Number(row.stock_product_id),
    quantityNeeded: Number(row.quantity_needed || 0),
    recipeUnit: row.recipe_unit,
    productName: row.product_name,
    onHandUnit: row.on_hand_unit,
  }));
}

async function loadAllComponents(runner) {
  const result = await runner.query(
    `
      select
        mpc.menu_product_id,
        mpc.stock_product_id,
        mpc.quantity as quantity_needed,
        mpc.unit as recipe_unit,
        sp.product_name,
        sb.on_hand_unit
      from inventory.menu_product_components mpc
      join inventory.stock_products sp on sp.id = mpc.stock_product_id
      left join inventory.stock_balances sb on sb.stock_product_id = mpc.stock_product_id
      order by mpc.menu_product_id asc, mpc.sort_order asc, mpc.id asc
    `,
  );

  return result.rows.map((row) => ({
    menuProductId: Number(row.menu_product_id),
    stockProductId: Number(row.stock_product_id),
    quantityNeeded: Number(row.quantity_needed || 0),
    recipeUnit: row.recipe_unit,
    productName: row.product_name,
    onHandUnit: row.on_hand_unit,
  }));
}

// Expose the in-memory walker for tests / future hot paths that already have
// the lot list loaded.
export { walkLotsFifo, EPSILON };

// Real FIFO consumption: must run inside a withTransaction callback so the
// FOR UPDATE locks survive the whole order insert. Throws 400 if any
// component runs out of stock so the parent transaction rolls back.
export async function consumeFifoForOrder(client, { menuProductId, orderQuantity }) {
  if (!Number.isInteger(orderQuantity) || orderQuantity <= 0) {
    throw badRequest("Số lượng đơn phải là số nguyên dương.");
  }

  const components = await loadComponentsForMenu(client, menuProductId);

  if (components.length === 0) {
    return { totalCost: 0, perComponent: [] };
  }

  const conversionMap = await loadConversionMap(client);

  let totalCost = 0;
  const perComponent = [];

  for (const component of components) {
    const onHandUnit = component.onHandUnit ?? component.recipeUnit;
    const conversionRatio = resolveConversionRatio(
      conversionMap,
      component.recipeUnit,
      onHandUnit,
    );
    const neededNormalized = component.quantityNeeded * orderQuantity * conversionRatio;

    if (neededNormalized <= EPSILON) {
      perComponent.push({
        stockProductId: component.stockProductId,
        productName: component.productName,
        consumedNormalized: 0,
        componentCost: 0,
      });
      continue;
    }

    // Lock balance row first so concurrent orders for the same ingredient
    // serialize on this row before they queue up on individual lots.
    const balanceLock = await client.query(
      `
        select id, on_hand_quantity, on_hand_unit
        from inventory.stock_balances
        where stock_product_id = $1
        for update
      `,
      [component.stockProductId],
    );

    if (balanceLock.rows.length === 0) {
      throw badRequest(
        `Không đủ tồn cho nguyên liệu "${component.productName}" — chưa có dòng tồn kho.`,
      );
    }

    const balanceRow = balanceLock.rows[0];
    const currentBalance = toFiniteNumber(balanceRow.on_hand_quantity, 0);

    if (currentBalance + EPSILON < neededNormalized) {
      throw badRequest(
        `Không đủ tồn cho nguyên liệu "${component.productName}" (cần ${neededNormalized.toFixed(
          4,
        )} ${onHandUnit}, còn ${currentBalance.toFixed(4)} ${onHandUnit}).`,
      );
    }

    const lotsResult = await client.query(
      `
        select
          si.id,
          si.input_unit,
          si.unit_price,
          si.conversion_ratio,
          si.remaining_quantity,
          si.supplier_id,
          (
            select sp_inner.unit_price
            from inventory.supplier_products sp_inner
            where sp_inner.stock_product_id = si.stock_product_id
              and (
                si.supplier_id is null
                or sp_inner.supplier_id = si.supplier_id
              )
            order by sp_inner.is_preferred desc, sp_inner.updated_at desc
            limit 1
          ) as fallback_unit_price
        from inventory.stock_inbounds si
        where si.stock_product_id = $1
          and si.remaining_quantity > 0
        order by si.created_at asc, si.id asc
        for update
      `,
      [component.stockProductId],
    );

    let remaining = neededNormalized;
    let componentCost = 0;

    for (const lot of lotsResult.rows) {
      if (remaining <= EPSILON) {
        break;
      }

      const lotRemaining = toFiniteNumber(lot.remaining_quantity, 0);
      if (lotRemaining <= 0) {
        continue;
      }

      const consumeNow = Math.min(lotRemaining, remaining);
      const perUnitPrice = computePerNormalizedUnitPrice(
        lot,
        lot.fallback_unit_price,
      );

      if (lot.unit_price === null && lot.fallback_unit_price === null) {
        // Adjustment lot with no supplier fallback — log so the operator can
        // backfill prices later, but do not fail the order.
        console.warn(
          `[fifo] Lô #${lot.id} (stock_product ${component.stockProductId}) không có giá lô và không có giá nhà cung ứng — coi cost = 0.`,
        );
      }

      componentCost += consumeNow * perUnitPrice;
      const nextRemaining = snapToZero(lotRemaining - consumeNow);

      await client.query(
        `
          update inventory.stock_inbounds
          set remaining_quantity = $1, updated_at = now()
          where id = $2
        `,
        [nextRemaining, lot.id],
      );

      remaining -= consumeNow;
    }

    if (remaining > EPSILON) {
      // Defensive: balance check already passed, but a desync between
      // sum(remaining_quantity) and on_hand_quantity could still leave
      // residue. Surface it instead of silently under-billing the order.
      throw badRequest(
        `Không đủ tồn lô cho nguyên liệu "${component.productName}" — thiếu ${remaining.toFixed(
          4,
        )} ${onHandUnit}.`,
      );
    }

    const nextBalance = snapToZero(currentBalance - neededNormalized);
    if (nextBalance < -EPSILON) {
      throw badRequest(
        `Tồn kho âm sau khi trừ cho nguyên liệu "${component.productName}".`,
      );
    }

    await client.query(
      `
        update inventory.stock_balances
        set on_hand_quantity = $1, updated_at = now()
        where id = $2
      `,
      [nextBalance < 0 ? 0 : nextBalance, balanceRow.id],
    );

    totalCost += componentCost;
    perComponent.push({
      stockProductId: component.stockProductId,
      productName: component.productName,
      consumedNormalized: neededNormalized,
      componentCost,
    });
  }

  return {
    totalCost: Number(totalCost.toFixed(2)),
    perComponent,
  };
}

// Bulk preview helper used by listing endpoints (sales plan + portioning).
// Pre-loads everything in 5 queries and exposes a per-menu-product helper so
// callers can avoid N+M queries.
export async function buildFifoPreviewContext(runner) {
  const [conversionMap, lotsByProduct, fallbackByProduct, balanceUnitMap, components] =
    await Promise.all([
      loadConversionMap(runner),
      loadOpenLotsByProduct(runner),
      loadFallbackPriceMap(runner),
      loadStockBalanceUnits(runner),
      loadAllComponents(runner),
    ]);

  const componentsByMenu = new Map();
  for (const component of components) {
    const list = componentsByMenu.get(component.menuProductId) ?? [];
    list.push(component);
    componentsByMenu.set(component.menuProductId, list);
  }

  function getFallbackPrice(stockProductId) {
    const entry = fallbackByProduct.get(stockProductId);
    if (!entry) {
      return null;
    }
    return entry.unitPrice;
  }

  // Return a deep-copied lot list per call so virtual consumption inside one
  // computation never leaks into another menu_product's preview.
  function cloneLots(stockProductId) {
    const original = lotsByProduct.get(stockProductId) ?? [];
    return original.map((lot) => ({ ...lot }));
  }

  function previewComponentCost({ stockProductId, quantityNeeded, recipeUnit, productName }) {
    const onHandUnit = balanceUnitMap.get(stockProductId) ?? recipeUnit;
    const conversionRatio = resolveConversionRatio(
      conversionMap,
      recipeUnit,
      onHandUnit,
    );
    const neededNormalized = quantityNeeded * conversionRatio;

    if (neededNormalized <= EPSILON) {
      return {
        stockProductId,
        productName,
        quantityNeeded,
        recipeUnit,
        onHandUnit,
        componentCost: 0,
        fifoCostPerUnit: 0,
        previewIncomplete: false,
      };
    }

    const lots = cloneLots(stockProductId);
    const fallback = getFallbackPrice(stockProductId);
    const result = walkLotsFifo(lots, neededNormalized, fallback);

    return {
      stockProductId,
      productName,
      quantityNeeded,
      recipeUnit,
      onHandUnit,
      componentCost: result.totalCost,
      fifoCostPerUnit: quantityNeeded > 0 ? result.totalCost / quantityNeeded : 0,
      previewIncomplete: result.isPreviewIncomplete,
    };
  }

  function previewMenuProductCost(menuProductId) {
    const list = componentsByMenu.get(menuProductId) ?? [];
    let totalCost = 0;
    let previewIncomplete = false;
    const perComponent = list.map((component) => {
      const componentResult = previewComponentCost(component);
      totalCost += componentResult.componentCost;
      if (componentResult.previewIncomplete) {
        previewIncomplete = true;
      }
      return componentResult;
    });

    return {
      menuProductId,
      totalCost,
      previewIncomplete,
      perComponent,
    };
  }

  return {
    previewMenuProductCost,
    previewComponentCost,
    componentsByMenu,
  };
}

// Bump sales_actual after a successful FIFO consumption. Sales plans that do
// not exist or are paused/limited still get incremented per the spec — only
// missing rows are silently ignored so orders without a configured plan still
// succeed.
export async function bumpSalesPlanActual(client, menuProductId, quantity) {
  await client.query(
    `
      update inventory.product_sales_plans
      set sales_actual = sales_actual + $1, updated_at = now()
      where menu_product_id = $2
    `,
    [quantity, menuProductId],
  );
}
