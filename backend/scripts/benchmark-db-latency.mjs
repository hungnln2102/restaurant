import process from "node:process";
import { getPool, warmUpPool } from "../db/connection.mjs";

function formatMs(value) {
  return `${value.toFixed(1)}ms`;
}

async function timed(label, fn) {
  const startedAt = process.hrtime.bigint();
  try {
    const result = await fn();
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.log(`${label}: ${formatMs(elapsedMs)}`);
    return { ok: true, elapsedMs, result };
  } catch (error) {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.log(`${label}: FAILED in ${formatMs(elapsedMs)} -> ${error.message}`);
    return { ok: false, elapsedMs, error };
  }
}

async function run() {
  console.log("=== DB latency benchmark ===");
  console.log(`Node: ${process.version}`);
  console.log(`PGHOST: ${process.env.PGHOST ?? "(from DATABASE_URL)"}`);

  await timed("Cold warm-up (TLS + auth + SELECT 1)", () => warmUpPool());

  const pool = getPool();

  const warmTimings = [];
  for (let i = 1; i <= 5; i += 1) {
    const probe = await timed(`Warm SELECT 1 #${i}`, () => pool.query("select 1"));
    if (probe.ok) {
      warmTimings.push(probe.elapsedMs);
    }
  }

  await timed("inventory.stock_balances count", () =>
    pool.query("select count(*) from inventory.stock_balances"),
  );

  await timed("inventory overview stats query", () =>
    pool.query(`
      with balance_stats as (
        select
          count(distinct stock_product_id) as tracked_items,
          count(*) as balance_rows,
          coalesce(sum(on_hand_quantity), 0) as total_on_hand_quantity
        from inventory.stock_balances
      ),
      inbound_stats as (
        select
          count(*) filter (
            where created_at >= date_trunc('day', now())
              and created_at < date_trunc('day', now()) + interval '1 day'
          ) as today_inbounds
        from inventory.stock_inbounds
      )
      select balance_stats.*, inbound_stats.today_inbounds
      from balance_stats cross join inbound_stats
    `),
  );

  await timed("inventory overview balances query", () =>
    pool.query(`
      with latest_inbounds as (
        select distinct on (si.stock_product_id)
          si.id, si.stock_product_id, si.input_quantity, si.input_unit,
          si.unit_conversion_id, si.created_at
        from inventory.stock_inbounds si
        order by si.stock_product_id, si.created_at desc, si.id desc
      )
      select sb.id, sp.product_name
      from inventory.stock_balances sb
      join inventory.stock_products sp on sp.id = sb.stock_product_id
      left join latest_inbounds li on li.stock_product_id = sb.stock_product_id
      left join inventory.unit_conversions uc on uc.id = li.unit_conversion_id
      left join lateral (
        select sp_price.unit_price
        from inventory.supplier_products sp_price
        where sp_price.stock_product_id = sb.stock_product_id
        order by sp_price.is_preferred desc, sp_price.updated_at desc
        limit 1
      ) price on true
      order by sb.updated_at desc, sp.product_name asc
      limit 20
    `),
  );

  if (warmTimings.length > 0) {
    const avg = warmTimings.reduce((sum, value) => sum + value, 0) / warmTimings.length;
    const min = Math.min(...warmTimings);
    const max = Math.max(...warmTimings);
    console.log("---");
    console.log(`Warm SELECT 1 stats over ${warmTimings.length} samples: avg=${formatMs(avg)} min=${formatMs(min)} max=${formatMs(max)}`);
  }

  await pool.end();
}

try {
  await run();
} catch (error) {
  console.error("Benchmark failed:", error.message);
  process.exitCode = 1;
}
