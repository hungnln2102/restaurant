import { query } from "../../../db/connection.mjs";

function formatStatNumber(value) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function mapBalanceRow(row) {
  // requiredQuantity is the total ingredient demand normalized to the
  // stock_balances on_hand_unit. NULL means the ingredient is not used by any
  // active sales plan (we explicitly preserve NULL vs 0 so the UI can render
  // "Chưa có" instead of "0").
  const requiredQuantityRaw = row.required_quantity;
  let requiredQuantity = null;
  if (requiredQuantityRaw !== null && requiredQuantityRaw !== undefined) {
    const numericRequired = Number(requiredQuantityRaw);
    requiredQuantity = Number.isFinite(numericRequired) ? numericRequired : null;
  }

  return {
    id: Number(row.balance_id),
    productId: Number(row.stock_product_id),
    productName: row.product_name,
    inputQuantity: row.input_quantity === null ? null : Number(row.input_quantity),
    inputUnit: row.input_unit,
    quantity: Number(row.on_hand_quantity),
    unit: row.display_stock_unit,
    conversionRatio: row.conversion_ratio === null ? null : Number(row.conversion_ratio),
    unitPrice:
      row.unit_price === null || row.unit_price === undefined ? null : Number(row.unit_price),
    currencyCode: row.currency_code ?? "VND",
    pricingUnit: row.pricing_unit ?? null,
    requiredQuantity,
    requiredIncomplete: Boolean(row.required_incomplete),
    updatedAt: row.updated_at,
  };
}

function toNullableNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeUnit(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function mapTimelineRow(row) {
  // Snapshot fields coming from inventory.stock_inbounds.
  const inboundUnitPrice = toNullableNumber(row.unit_price);
  const inboundCurrency = row.currency_code || "VND";
  const inputUnit = row.input_unit;
  const inputQuantity = toNullableNumber(row.input_quantity);

  // Fallback levels: supplier-product matrix → supplier default.
  const supplierProductPrice = toNullableNumber(row.sp_unit_price);
  const supplierDefaultPrice = toNullableNumber(row.su_default_unit_price);

  let effectiveUnitPrice = null;
  let effectivePricingUnit = null;
  let effectiveCurrencyCode = inboundCurrency;
  let priceSource = null;

  // Only fall back when the inbound snapshot is genuinely NULL — a stored
  // value of 0 is a valid "free" price and should NOT trigger the fallback.
  if (inboundUnitPrice !== null) {
    effectiveUnitPrice = inboundUnitPrice;
    // The inbound row stores its price per input_unit by convention.
    effectivePricingUnit = inputUnit;
    effectiveCurrencyCode = inboundCurrency;
    priceSource = "inbound";
  } else if (supplierProductPrice !== null) {
    effectiveUnitPrice = supplierProductPrice;
    effectivePricingUnit = row.sp_pricing_unit ?? null;
    effectiveCurrencyCode = row.sp_currency_code || inboundCurrency;
    priceSource = "supplier_product";
  } else if (supplierDefaultPrice !== null) {
    effectiveUnitPrice = supplierDefaultPrice;
    effectivePricingUnit = row.su_pricing_unit ?? null;
    effectiveCurrencyCode = row.su_currency_code || inboundCurrency;
    priceSource = "supplier_default";
  }

  // totalAmount is computed when both factors exist. inputQuantity is NOT NULL
  // in the schema (CHECK > 0) but we stay defensive in case future rows relax
  // that constraint or arrive via a non-standard import.
  let totalAmount = null;
  if (effectiveUnitPrice !== null && inputQuantity !== null) {
    totalAmount = effectiveUnitPrice * inputQuantity;
  }

  // priceMismatch only matters when a fallback is active AND its pricing_unit
  // is set AND that unit differs from the inbound's input_unit. We compare
  // case-insensitively so "Kg" vs "kg" does not trigger a false warning.
  const fallbackUnit = normalizeUnit(effectivePricingUnit);
  const inboundUnitNormalized = normalizeUnit(inputUnit);
  const priceMismatch = Boolean(
    priceSource &&
      priceSource !== "inbound" &&
      fallbackUnit &&
      fallbackUnit !== inboundUnitNormalized,
  );

  return {
    id: Number(row.inbound_id),
    productName: row.product_name,
    inputQuantity,
    inputUnit,
    supplierId: row.supplier_id === null ? null : Number(row.supplier_id),
    supplierName: row.supplier_name,
    unitPrice: inboundUnitPrice,
    currencyCode: inboundCurrency,
    effectiveUnitPrice,
    effectivePricingUnit,
    effectiveCurrencyCode,
    priceSource,
    totalAmount,
    priceMismatch,
    createdAt: row.created_at,
  };
}

function buildStats(row) {
  return [
    {
      label: "Mặt hàng đang theo dõi",
      value: String(Number(row.tracked_items || 0)),
      note: "Đếm theo số sản phẩm đã có tồn kho thực tế.",
    },
    {
      label: "Dòng tồn kho",
      value: String(Number(row.balance_rows || 0)),
      note: "Mỗi dòng phản ánh một đơn vị tồn hiện tại của sản phẩm.",
    },
    {
      label: "Lô nhập hôm nay",
      value: String(Number(row.today_inbounds || 0)),
      note: "Số lần nhập được ghi nhận trong ngày hiện tại.",
    },
    {
      label: "Tổng lượng tồn",
      value: formatStatNumber(row.total_on_hand_quantity || 0),
      note: "Cộng tổng số lượng tồn theo đơn vị chuẩn đang lưu.",
    },
  ];
}

const STATS_QUERY = `
  with balance_stats as (
    select
      count(distinct stock_product_id) as tracked_items,
      count(*) as balance_rows,
      coalesce(sum(on_hand_quantity), 0) as total_on_hand_quantity
    from inventory.stock_balances
  ),
  inbound_stats as (
    select
      count(*) filter (where created_at >= date_trunc('day', now())
        and created_at < date_trunc('day', now()) + interval '1 day') as today_inbounds
    from inventory.stock_inbounds
  )
  select
    balance_stats.tracked_items,
    balance_stats.balance_rows,
    balance_stats.total_on_hand_quantity,
    inbound_stats.today_inbounds
  from balance_stats
  cross join inbound_stats
`;

const BALANCES_QUERY = `
  with latest_inbounds as (
    select distinct on (si.stock_product_id)
      si.id,
      si.stock_product_id,
      si.input_quantity,
      si.input_unit,
      si.unit_conversion_id,
      si.created_at
    from inventory.stock_inbounds si
    order by si.stock_product_id, si.created_at desc, si.id desc
  ),
  -- required_per_product aggregates the minimum ingredient demand per
  -- stock_product across every menu_product that currently has an ACTIVE
  -- sales plan. The math, per the product spec, is:
  --
  --   required(stock_product) = SUM_over_active_menu(
  --     component.quantity * unit_factor * sales_plan.sales_target
  --   )
  --
  -- where unit_factor is:
  --   * 1, when the component.unit matches the balance.on_hand_unit
  --     (case/whitespace-insensitive). The spec is explicit: "Đơn vị tính
  --     KHỚP rồi thì KHÔNG quy đổi" — we must NEVER multiply by a stray
  --     ratio in this case even if a (g -> g) row happens to exist in
  --     unit_conversions.
  --   * the matching inventory.unit_conversions.conversion_ratio when the
  --     units differ AND a rule is found. Rules are stored as "1 stock_unit
  --     = ratio processing_unit" (see portioningRepository.mjs ratioLabel).
  --   * 1 as a safe fallback when no rule is found. required_incomplete is
  --     raised so the FE can show a warning asterisk.
  --   * 1 (no warning) when the stock_product currently has no balance row:
  --     we cannot verify the on-hand unit, but the user's intent ("đơn vị
  --     khớp") is the common case and forcing the warning would generate
  --     a lot of false positives on freshly-created products.
  --
  -- IMPORTANT: we use LEFT JOIN inventory.stock_balances here. The previous
  -- INNER JOIN dropped any stock_product without a balance row, which made
  -- the CTE silently produce NO row for such products and the main query's
  -- LEFT JOIN turned that into required_quantity = NULL ("Chưa có" in UI)
  -- even when the math was perfectly well-defined from the component data
  -- alone. Aggregating on mpc.stock_product_id keeps the result independent
  -- of whether a balance has been recorded yet.
  --
  -- LATERAL ... LIMIT 1 protects against the (rare) case where multiple
  -- unit_conversions rows share the same (stock_unit, processing_unit)
  -- pair across portion definitions; we deterministically pick the oldest
  -- by id rather than multiplying the SUM.
  required_per_product as (
    select
      mpc.stock_product_id,
      sum(
        mpc.quantity::numeric
        * case
            when sb_inner.on_hand_unit is null then 1
            when lower(trim(coalesce(mpc.unit, ''))) = lower(trim(sb_inner.on_hand_unit)) then 1
            else coalesce(uc_lookup.conversion_ratio, 1)
          end
        * psp.sales_target::numeric
      ) as required_quantity,
      bool_or(
        sb_inner.on_hand_unit is not null
        and lower(trim(coalesce(mpc.unit, ''))) <> lower(trim(sb_inner.on_hand_unit))
        and uc_lookup.conversion_ratio is null
      ) as required_incomplete
    from inventory.product_sales_plans psp
    join inventory.menu_product_components mpc
      on mpc.menu_product_id = psp.menu_product_id
    left join inventory.stock_balances sb_inner
      on sb_inner.stock_product_id = mpc.stock_product_id
    left join lateral (
      select uc.conversion_ratio
      from inventory.unit_conversions uc
      where lower(trim(uc.stock_unit)) = lower(trim(coalesce(mpc.unit, '')))
        and lower(trim(uc.processing_unit)) = lower(trim(coalesce(sb_inner.on_hand_unit, '')))
      order by uc.id
      limit 1
    ) uc_lookup on true
    where psp.status = 'active'
    group by mpc.stock_product_id
  )
  select
    sb.id as balance_id,
    sb.stock_product_id,
    sp.product_name,
    li.input_quantity,
    li.input_unit,
    sb.on_hand_quantity,
    coalesce(uc.processing_unit, li.input_unit, sb.on_hand_unit) as display_stock_unit,
    sb.conversion_ratio,
    price.unit_price,
    price.currency_code,
    price.pricing_unit,
    rpp.required_quantity,
    coalesce(rpp.required_incomplete, false) as required_incomplete,
    sb.updated_at
  from inventory.stock_balances sb
  join inventory.stock_products sp
    on sp.id = sb.stock_product_id
  left join latest_inbounds li
    on li.stock_product_id = sb.stock_product_id
  left join inventory.unit_conversions uc
    on uc.id = li.unit_conversion_id
  left join required_per_product rpp
    on rpp.stock_product_id = sb.stock_product_id
  left join lateral (
    select
      sp_price.unit_price,
      sp_price.currency_code,
      sp_price.pricing_unit
    from inventory.supplier_products sp_price
    where sp_price.stock_product_id = sb.stock_product_id
    order by sp_price.is_preferred desc, sp_price.updated_at desc
    limit 1
  ) price on true
  order by sb.updated_at desc, sp.product_name asc
  limit 20
`;

const TIMELINE_QUERY = `
  select
    si.id as inbound_id,
    sp.product_name,
    si.input_quantity,
    si.input_unit,
    si.unit_price,
    si.currency_code,
    si.supplier_id,
    su.supplier_name,
    su.default_unit_price as su_default_unit_price,
    su.currency_code as su_currency_code,
    su.pricing_unit as su_pricing_unit,
    supplier_price.unit_price as sp_unit_price,
    supplier_price.currency_code as sp_currency_code,
    supplier_price.pricing_unit as sp_pricing_unit,
    si.created_at
  from inventory.stock_inbounds si
  join inventory.stock_products sp
    on sp.id = si.stock_product_id
  left join inventory.suppliers su
    on su.id = si.supplier_id
  left join lateral (
    select
      sp_price.unit_price,
      sp_price.currency_code,
      sp_price.pricing_unit
    from inventory.supplier_products sp_price
    where sp_price.supplier_id = si.supplier_id
      and sp_price.stock_product_id = si.stock_product_id
    order by
      case
        when lower(coalesce(sp_price.pricing_unit, '')) = lower(coalesce(si.input_unit, '')) then 0
        else 1
      end,
      sp_price.is_preferred desc,
      sp_price.updated_at desc
    limit 1
  ) supplier_price on si.supplier_id is not null
  order by si.created_at desc, si.id desc
  limit 5
`;

export async function getInventoryOverview() {
  // Run the three independent reads in parallel. They share the connection
  // pool but do not depend on each other, so total latency is bounded by the
  // slowest query rather than the sum of all three.
  const [statsResult, balancesResult, timelineResult] = await Promise.all([
    query(STATS_QUERY),
    query(BALANCES_QUERY),
    query(TIMELINE_QUERY),
  ]);

  return {
    stats: buildStats(statsResult.rows[0] || {}),
    balances: balancesResult.rows.map(mapBalanceRow),
    timeline: timelineResult.rows.map(mapTimelineRow),
  };
}
