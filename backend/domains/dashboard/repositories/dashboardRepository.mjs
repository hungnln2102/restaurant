import { query } from "../../../db/connection.mjs";

// Edge cases handled here:
//   * No orders / no inbounds in window           -> stats default to 0,
//                                                    series get filled with 0
//                                                    so charts still render.
//   * NULL product_category                       -> kept as NULL in payload,
//                                                    UI shows "Chưa phân loại".
//   * Empty previous period (delta divide-by-0)   -> deltaPercent = null,
//                                                    UI renders "—".
//   * Very large numbers                          -> always returned as
//                                                    finite Numbers; FE uses
//                                                    Intl.NumberFormat.
//   * SQL injection                               -> all user input flows
//                                                    through $1 parameter
//                                                    (rangeDays integer).

const ALLOWED_RANGE_DAYS = new Set([1, 7, 30]);

function clampRangeDays(rawValue) {
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) {
    return 7;
  }
  const intVal = Math.trunc(numeric);
  return ALLOWED_RANGE_DAYS.has(intVal) ? intVal : 7;
}

function toFiniteNumber(value, fallback = 0) {
  if (value === null || value === undefined) {
    return fallback;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

// Compute delta% with explicit null-on-empty-base semantics. Returning null
// (not Infinity / not NaN) lets the UI render "—" instead of "↑ Infinity%".
function computeDeltaPercent(current, previous) {
  const prev = toFiniteNumber(previous, 0);
  const curr = toFiniteNumber(current, 0);

  if (prev === 0) {
    return null;
  }

  return ((curr - prev) / prev) * 100;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

// Local-timezone YYYY-MM-DD. We intentionally avoid toISOString() because it
// would shift dates around for users in non-UTC zones (e.g. UTC+7 in VN).
function formatLocalDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function buildDateKeys(rangeDays) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const keys = [];
  for (let offset = rangeDays - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    keys.push(formatLocalDateKey(day));
  }
  return keys;
}

// Day strings come back from PG as either a "YYYY-MM-DD" string (when we
// to_char them) or as a JS Date when we ::date-cast. We normalize to a
// stable "YYYY-MM-DD" key here so series merging always uses the same value.
function normalizeDayKey(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }
  if (typeof rawValue === "string") {
    return rawValue.slice(0, 10);
  }
  if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
    return formatLocalDateKey(rawValue);
  }
  return null;
}

const STATS_QUERY = `
  select
    coalesce(sum(total_amount), 0) as revenue,
    coalesce(sum(profit_amount), 0) as profit,
    coalesce(sum(cost_amount), 0) as cost,
    count(*) as orders_count
  from inventory.product_orders
  where ordered_at >= (current_date - ($1::int - 1))::timestamptz
`;

const PREV_STATS_QUERY = `
  select
    coalesce(sum(total_amount), 0) as revenue,
    coalesce(sum(profit_amount), 0) as profit,
    count(*) as orders_count
  from inventory.product_orders
  where ordered_at >= (current_date - (2 * $1::int - 1))::timestamptz
    and ordered_at <  (current_date - ($1::int - 1))::timestamptz
`;

const INBOUND_COST_QUERY = `
  select coalesce(sum(input_quantity * coalesce(unit_price, 0)), 0) as inbound_cost
  from inventory.stock_inbounds
  where created_at >= (current_date - ($1::int - 1))::timestamptz
`;

const PREV_INBOUND_COST_QUERY = `
  select coalesce(sum(input_quantity * coalesce(unit_price, 0)), 0) as inbound_cost
  from inventory.stock_inbounds
  where created_at >= (current_date - (2 * $1::int - 1))::timestamptz
    and created_at <  (current_date - ($1::int - 1))::timestamptz
`;

const REVENUE_SERIES_QUERY = `
  select
    to_char(date_trunc('day', ordered_at), 'YYYY-MM-DD') as day,
    coalesce(sum(total_amount), 0) as revenue,
    coalesce(sum(profit_amount), 0) as profit,
    count(*) as orders_count
  from inventory.product_orders
  where ordered_at >= (current_date - ($1::int - 1))::timestamptz
  group by day
  order by day
`;

const INBOUND_SERIES_QUERY = `
  select
    to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
    coalesce(sum(input_quantity * coalesce(unit_price, 0)), 0) as inbound_cost
  from inventory.stock_inbounds
  where created_at >= (current_date - ($1::int - 1))::timestamptz
  group by day
  order by day
`;

const CATEGORY_BREAKDOWN_QUERY = `
  select
    mp.product_category,
    coalesce(sum(po.total_amount), 0) as revenue,
    coalesce(sum(po.profit_amount), 0) as profit,
    count(*) as order_count
  from inventory.product_orders po
  join inventory.menu_products mp on mp.id = po.menu_product_id
  where po.ordered_at >= (current_date - ($1::int - 1))::timestamptz
  group by mp.product_category
  order by revenue desc nulls last
`;

// DISTINCT ON picks the highest-revenue product per category. NULLS LAST
// keeps categories with all-null revenue at the bottom rather than letting
// a NULL silently win.
const TOP_PRODUCT_QUERY = `
  select distinct on (sub.product_category)
    sub.product_category,
    sub.product_name as top_product,
    sub.product_revenue
  from (
    select
      mp.product_category,
      mp.id,
      mp.product_name,
      sum(po.total_amount) as product_revenue
    from inventory.product_orders po
    join inventory.menu_products mp on mp.id = po.menu_product_id
    where po.ordered_at >= (current_date - ($1::int - 1))::timestamptz
    group by mp.product_category, mp.id, mp.product_name
  ) sub
  order by sub.product_category, sub.product_revenue desc nulls last
`;

const CATEGORY_SERIES_QUERY = `
  select
    mp.product_category,
    to_char(date_trunc('day', po.ordered_at), 'YYYY-MM-DD') as day,
    coalesce(sum(po.total_amount), 0) as revenue
  from inventory.product_orders po
  join inventory.menu_products mp on mp.id = po.menu_product_id
  where po.ordered_at >= (current_date - ($1::int - 1))::timestamptz
  group by mp.product_category, day
  order by mp.product_category, day
`;

function buildRevenueSeries(dateKeys, orderRows, inboundRows) {
  // Build O(1) lookup tables from DB rows so the merge step is O(rangeDays).
  const orderByDay = new Map();
  for (const row of orderRows) {
    const key = normalizeDayKey(row.day);
    if (!key) continue;
    orderByDay.set(key, {
      revenue: toFiniteNumber(row.revenue, 0),
      profit: toFiniteNumber(row.profit, 0),
      ordersCount: toFiniteNumber(row.orders_count, 0),
    });
  }

  const inboundByDay = new Map();
  for (const row of inboundRows) {
    const key = normalizeDayKey(row.day);
    if (!key) continue;
    inboundByDay.set(key, toFiniteNumber(row.inbound_cost, 0));
  }

  return dateKeys.map((date) => {
    const order = orderByDay.get(date) || { revenue: 0, profit: 0, ordersCount: 0 };
    const inboundCost = inboundByDay.get(date) ?? 0;

    return {
      date,
      revenue: order.revenue,
      profit: order.profit,
      inboundCost,
      ordersCount: order.ordersCount,
    };
  });
}

function buildCategoryBreakdown(dateKeys, breakdownRows, topProductRows, categorySeriesRows) {
  // Index helpers. We use a dedicated NULL_KEY string so JS Map keys remain
  // primitive (Maps treat undefined/null differently from string keys).
  const NULL_KEY = "__NULL_CATEGORY__";
  const keyOf = (category) => (category === null || category === undefined ? NULL_KEY : category);

  const topByCategory = new Map();
  for (const row of topProductRows) {
    topByCategory.set(keyOf(row.product_category), row.top_product || null);
  }

  // Group "category, day" rows under category for fast per-category fill.
  const seriesByCategory = new Map();
  for (const row of categorySeriesRows) {
    const k = keyOf(row.product_category);
    const dayKey = normalizeDayKey(row.day);
    if (!dayKey) continue;
    if (!seriesByCategory.has(k)) {
      seriesByCategory.set(k, new Map());
    }
    seriesByCategory.get(k).set(dayKey, toFiniteNumber(row.revenue, 0));
  }

  return breakdownRows.map((row) => {
    const k = keyOf(row.product_category);
    const dayMap = seriesByCategory.get(k) || new Map();

    const series = dateKeys.map((date) => ({
      date,
      revenue: dayMap.get(date) ?? 0,
    }));

    return {
      category: row.product_category ?? null,
      revenue: toFiniteNumber(row.revenue, 0),
      profit: toFiniteNumber(row.profit, 0),
      orderCount: toFiniteNumber(row.order_count, 0),
      topProduct: topByCategory.get(k) || null,
      series,
    };
  });
}

export async function getDashboardOverview({ rangeDays }) {
  const safeRange = clampRangeDays(rangeDays);

  // Run independent reads in parallel. They share the connection pool but
  // do not depend on each other, so total latency is bounded by the slowest
  // query rather than the sum of all seven.
  const [
    statsResult,
    prevStatsResult,
    inboundCostResult,
    prevInboundCostResult,
    revenueSeriesResult,
    inboundSeriesResult,
    categoryBreakdownResult,
    topProductResult,
    categorySeriesResult,
  ] = await Promise.all([
    query(STATS_QUERY, [safeRange]),
    query(PREV_STATS_QUERY, [safeRange]),
    query(INBOUND_COST_QUERY, [safeRange]),
    query(PREV_INBOUND_COST_QUERY, [safeRange]),
    query(REVENUE_SERIES_QUERY, [safeRange]),
    query(INBOUND_SERIES_QUERY, [safeRange]),
    query(CATEGORY_BREAKDOWN_QUERY, [safeRange]),
    query(TOP_PRODUCT_QUERY, [safeRange]),
    query(CATEGORY_SERIES_QUERY, [safeRange]),
  ]);

  const statsRow = statsResult.rows[0] || {};
  const prevStatsRow = prevStatsResult.rows[0] || {};
  const inboundCostRow = inboundCostResult.rows[0] || {};
  const prevInboundCostRow = prevInboundCostResult.rows[0] || {};

  const revenue = toFiniteNumber(statsRow.revenue, 0);
  const profit = toFiniteNumber(statsRow.profit, 0);
  const inboundCost = toFiniteNumber(inboundCostRow.inbound_cost, 0);
  const ordersCount = toFiniteNumber(statsRow.orders_count, 0);

  const prevRevenue = toFiniteNumber(prevStatsRow.revenue, 0);
  const prevProfit = toFiniteNumber(prevStatsRow.profit, 0);
  const prevInboundCost = toFiniteNumber(prevInboundCostRow.inbound_cost, 0);

  // avgMarginPercent computed from realized totals (not row-level avg) so a
  // single high-margin / very-cheap order cannot skew the summary.
  const avgMarginPercent = revenue > 0 ? (profit / revenue) * 100 : null;

  const dateKeys = buildDateKeys(safeRange);

  return {
    rangeDays: safeRange,
    stats: {
      revenue,
      profit,
      inboundCost,
      ordersCount,
      avgMarginPercent,
      revenueDeltaPercent: computeDeltaPercent(revenue, prevRevenue),
      profitDeltaPercent: computeDeltaPercent(profit, prevProfit),
      inboundCostDeltaPercent: computeDeltaPercent(inboundCost, prevInboundCost),
    },
    revenueSeries: buildRevenueSeries(
      dateKeys,
      revenueSeriesResult.rows,
      inboundSeriesResult.rows,
    ),
    categoryBreakdown: buildCategoryBreakdown(
      dateKeys,
      categoryBreakdownResult.rows,
      topProductResult.rows,
      categorySeriesResult.rows,
    ),
  };
}
