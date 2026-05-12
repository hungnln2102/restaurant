import { createClient } from "../db/connection.mjs";

const ORDERS_PER_PRODUCT = 5;
const TYPE_ROTATION = ["dine_in", "takeaway", "dine_in", "takeaway", "dine_in"];
const QUANTITY_ROTATION = [1, 2, 1, 1, 3];
const HOURS_OFFSETS = [3, 26, 50, 96, 152];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function buildOrderCode(orderedAt, productId, index) {
  const datePart = `${orderedAt.getFullYear()}${pad2(orderedAt.getMonth() + 1)}${pad2(
    orderedAt.getDate(),
  )}`;
  const seedSuffix = String(productId * 100 + index).padStart(4, "0");
  return `ORD-${datePart}-${seedSuffix}`;
}

async function fetchSalesPlanProducts(client) {
  const result = await client.query(
    `
      select
        psp.menu_product_id,
        mp.product_name,
        mp.selling_price,
        coalesce(cost.total_cost, 0) as total_cost
      from inventory.product_sales_plans psp
      join inventory.menu_products mp on mp.id = psp.menu_product_id
      left join lateral (
        select sum(mpc.quantity * coalesce(price.unit_price, 0)) as total_cost
        from inventory.menu_product_components mpc
        left join lateral (
          select unit_price
          from inventory.supplier_products
          where stock_product_id = mpc.stock_product_id
          order by is_preferred desc, updated_at desc
          limit 1
        ) price on true
        where mpc.menu_product_id = mp.id
      ) cost on true
      order by mp.product_name asc
    `,
  );

  return result.rows.map((row) => ({
    menuProductId: Number(row.menu_product_id),
    productName: row.product_name,
    sellingPrice: Number(row.selling_price || 0),
    totalCostPerUnit: Number(row.total_cost || 0),
  }));
}

async function hasExistingOrders(client, menuProductId) {
  const result = await client.query(
    `
      select 1
      from inventory.product_orders
      where menu_product_id = $1
      limit 1
    `,
    [menuProductId],
  );

  return result.rowCount > 0;
}

async function insertSeedOrder(client, product, index) {
  const orderType = TYPE_ROTATION[index % TYPE_ROTATION.length];
  const quantity = QUANTITY_ROTATION[index % QUANTITY_ROTATION.length];
  const hoursAgo = HOURS_OFFSETS[index % HOURS_OFFSETS.length];

  const orderedAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  const unitPrice = product.sellingPrice;
  const totalAmount = Number((unitPrice * quantity).toFixed(2));
  const costAmount = Number((product.totalCostPerUnit * quantity).toFixed(2));
  const profitAmount = Number((totalAmount - costAmount).toFixed(2));
  const orderCode = buildOrderCode(orderedAt, product.menuProductId, index);

  await client.query(
    `
      insert into inventory.product_orders (
        order_code,
        menu_product_id,
        order_type,
        quantity,
        unit_price,
        total_amount,
        cost_amount,
        profit_amount,
        ordered_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      on conflict (order_code) do nothing
    `,
    [
      orderCode,
      product.menuProductId,
      orderType,
      quantity,
      unitPrice,
      totalAmount,
      costAmount,
      profitAmount,
      orderedAt,
    ],
  );
}

async function run() {
  const client = createClient({ preferUnpooled: true });

  let totalProductsTouched = 0;
  let totalOrdersInserted = 0;
  let skippedProducts = 0;

  try {
    await client.connect();
    await client.query("begin");

    const products = await fetchSalesPlanProducts(client);

    if (products.length === 0) {
      console.log("Product orders seed: SKIPPED");
      console.log(
        "Lý do: chưa có sản phẩm nào trong inventory.product_sales_plans để gắn đơn mẫu.",
      );
      await client.query("commit");
      return;
    }

    for (const product of products) {
      const alreadySeeded = await hasExistingOrders(client, product.menuProductId);

      if (alreadySeeded) {
        skippedProducts += 1;
        continue;
      }

      for (let index = 0; index < ORDERS_PER_PRODUCT; index += 1) {
        await insertSeedOrder(client, product, index);
        totalOrdersInserted += 1;
      }

      totalProductsTouched += 1;
    }

    await client.query("commit");

    console.log("Product orders seed: OK");
    console.log(`Sản phẩm có đơn mới: ${totalProductsTouched}`);
    console.log(`Tổng số đơn vừa tạo: ${totalOrdersInserted}`);
    console.log(`Sản phẩm đã có đơn (bỏ qua): ${skippedProducts}`);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("Product orders seed: FAILED");
    console.error(`Message: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

await run();
