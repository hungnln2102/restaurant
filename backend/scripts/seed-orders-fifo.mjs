// Seed lại bảng inventory.product_orders bằng cách gọi use-case createOrder
// thật sự để FIFO costing chạy đúng đường (consume lot + lưu cost_amount theo
// công thức `unit_price / conversion_ratio` đã được fix trong fifoCostingService).
//
// Vì sao không INSERT trực tiếp như script cũ?
//   Script cũ (seed-product-orders.mjs) tính cost = sum(quantity *
//   supplier_unit_price) mà KHÔNG quy đổi đơn vị. Recipe ghi 150 g, giá NCC
//   ghi 139.000 đ/kg → cost lệch 1.000 lần (150 × 139.000 = 20.850.000đ thay
//   vì 20.850đ). Đó là nguồn của các đơn 87 triệu hiện tại.
//
// Cách an toàn:
//   1. DELETE từ product_orders (không rollback FIFO – đơn cũ insert thẳng,
//      chưa từng consume lot nào).
//   2. Reset sales_actual về 0 cho mọi sales plan (createOrder sẽ tự bump lại).
//   3. Gọi createOrder(...) cho 5-10 đơn random → mỗi lần đi qua transaction
//      với consumeFifoForOrder → cost_amount được tính từ lot thực + ratio.
//
// Idempotent: chạy lại nhiều lần OK vì đã delete + reset trước khi seed.

import { query, getPool } from "../db/connection.mjs";
import { createOrder } from "../domains/inventory/use-cases/manageProductOrders.mjs";

const DEFAULT_ORDER_COUNT = 8;
const MIN_ORDER_COUNT = 5;
const MAX_ORDER_COUNT = 10;
const QUANTITY_CHOICES = [1, 1, 1, 2, 2, 3];
const ORDER_TYPES = ["dine_in", "takeaway"];

function parseOrderCount() {
  const raw = process.env.SEED_ORDER_COUNT;
  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_ORDER_COUNT;
  }
  const numeric = Number(raw);
  if (!Number.isInteger(numeric) || numeric < MIN_ORDER_COUNT) {
    return DEFAULT_ORDER_COUNT;
  }
  if (numeric > MAX_ORDER_COUNT) {
    return MAX_ORDER_COUNT;
  }
  return numeric;
}

function randomChoice(list) {
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

function randomOrderedAtIso() {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const ageMs = Math.floor(Math.random() * sevenDaysMs);
  return new Date(Date.now() - ageMs).toISOString();
}

function formatVnd(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "0đ";
  }
  return `${numeric.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}đ`;
}

async function purgeExistingOrders() {
  const deleteResult = await query(
    `delete from inventory.product_orders`,
  );
  await query(
    `update inventory.product_sales_plans set sales_actual = 0, updated_at = now()`,
  );
  return Number(deleteResult.rowCount || 0);
}

async function fetchEligibleMenuProducts() {
  const result = await query(
    `
      select
        psp.menu_product_id,
        mp.product_name,
        mp.selling_price,
        psp.status
      from inventory.product_sales_plans psp
      join inventory.menu_products mp on mp.id = psp.menu_product_id
      where psp.status in ('active', 'limited')
        and mp.selling_price > 0
      order by mp.product_name asc
    `,
  );
  return result.rows.map((row) => ({
    menuProductId: Number(row.menu_product_id),
    productName: row.product_name,
    sellingPrice: Number(row.selling_price || 0),
    status: row.status,
  }));
}

async function seedOne(targetProducts) {
  const product = randomChoice(targetProducts);
  const quantity = randomChoice(QUANTITY_CHOICES);
  const orderType = randomChoice(ORDER_TYPES);
  const orderedAt = randomOrderedAtIso();

  try {
    const order = await createOrder({
      menuProductId: product.menuProductId,
      orderType,
      quantity,
      unitPrice: product.sellingPrice,
      orderedAt,
      notes: "Seed FIFO",
    });

    console.log(
      `[seed] ${order.orderCode} :: ${product.productName} x${quantity} ` +
        `(${orderType}) ordered_at=${order.orderedAt} ` +
        `total=${formatVnd(order.totalAmount)} ` +
        `cost=${formatVnd(order.costAmount)} ` +
        `profit=${formatVnd(order.profitAmount)}`,
    );

    return order;
  } catch (error) {
    const message = error?.message ?? String(error);
    console.error(
      `[seed] FAILED ${product.productName} x${quantity}: ${message}`,
    );
    if (error?.statusCode === 400 && /không đủ tồn/i.test(message)) {
      console.error(
        "[seed] Hint: chạy phiếu nhập (npm run db:seed:inventory) hoặc nhập tay trên UI trước khi seed lại.",
      );
    }
    return null;
  }
}

async function main() {
  const targetCount = parseOrderCount();
  console.log(`[seed] Bắt đầu seed FIFO orders: target = ${targetCount}`);

  const deletedCount = await purgeExistingOrders();
  console.log(`[seed] Đã xóa ${deletedCount} đơn cũ + reset sales_actual = 0.`);

  const products = await fetchEligibleMenuProducts();
  if (products.length === 0) {
    console.log("[seed] Bỏ qua: chưa có sản phẩm nào trong product_sales_plans đang bán.");
    return;
  }

  console.log(
    `[seed] Sản phẩm khả dụng: ${products
      .map((p) => `${p.productName} (${formatVnd(p.sellingPrice)})`)
      .join(", ")}`,
  );

  const created = [];
  for (let index = 0; index < targetCount; index += 1) {
    const order = await seedOne(products);
    if (order) {
      created.push(order);
    }
  }

  console.log("\n[seed] === KẾT QUẢ ===");
  console.log(`[seed] Tổng số đơn tạo thành công: ${created.length}/${targetCount}`);

  if (created.length === 0) {
    return;
  }

  const totalRevenue = created.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const totalCost = created.reduce((sum, o) => sum + Number(o.costAmount || 0), 0);
  const totalProfit = created.reduce((sum, o) => sum + Number(o.profitAmount || 0), 0);

  console.log(`[seed] Tổng doanh thu: ${formatVnd(totalRevenue)}`);
  console.log(`[seed] Tổng cost:      ${formatVnd(totalCost)}`);
  console.log(`[seed] Tổng lợi nhuận: ${formatVnd(totalProfit)}`);
  console.log(
    `[seed] Cost trung bình / đơn: ${formatVnd(totalCost / created.length)}`,
  );
}

main()
  .catch((error) => {
    console.error("[seed] FATAL:", error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => {});
  });
