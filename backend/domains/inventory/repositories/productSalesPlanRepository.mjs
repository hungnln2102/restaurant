import { query } from "../../../db/connection.mjs";
import { buildFifoPreviewContext } from "./fifoCostingService.mjs";

// fifoCostingService loaders only depend on a `runner.query(text, params)`
// signature so we can use the pool helper directly.
const queryRunner = { query: (text, params) => query(text, params) };

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function conflict(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function computeProfitMargin(sellingPrice, totalCost) {
  const price = Number(sellingPrice || 0);

  // Avoid division by zero when no selling price is configured yet.
  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  const cost = Number(totalCost || 0);
  return (price - cost) / price;
}

function mapSalesPlanRow(row, costPreview) {
  const sellingPrice =
    row.selling_price === null || row.selling_price === undefined
      ? 0
      : Number(row.selling_price);
  const totalCost = Number(costPreview?.totalCost ?? 0);

  return {
    id: Number(row.id),
    menuProductId: Number(row.menu_product_id),
    productName: row.product_name,
    productCategory: row.product_category,
    servingUnit: row.serving_unit,
    sellingPrice,
    totalCost,
    costPreviewIncomplete: Boolean(costPreview?.previewIncomplete),
    profitMargin: computeProfitMargin(sellingPrice, totalCost),
    salesTarget: Number(row.sales_target || 0),
    salesActual: Number(row.sales_actual || 0),
    status: row.status,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

const SALES_PLANS_BASE_QUERY = `
  select
    psp.id,
    psp.menu_product_id,
    psp.sales_target,
    psp.sales_actual,
    psp.status,
    psp.notes,
    psp.updated_at,
    mp.product_name,
    mp.product_category,
    mp.serving_unit,
    mp.selling_price
  from inventory.product_sales_plans psp
  join inventory.menu_products mp on mp.id = psp.menu_product_id
`;

export async function listSalesPlans() {
  // Run the plan list and the FIFO preview snapshot in parallel — both are
  // independent reads that share the same pool, so this halves the latency
  // compared to the previous LATERAL subquery-per-row layout.
  const [plansResult, fifoContext] = await Promise.all([
    query(`${SALES_PLANS_BASE_QUERY} order by mp.product_name asc`),
    buildFifoPreviewContext(queryRunner),
  ]);

  return plansResult.rows.map((row) => {
    const preview = fifoContext.previewMenuProductCost(Number(row.menu_product_id));
    return mapSalesPlanRow(row, preview);
  });
}

async function fetchSalesPlanById(id) {
  const result = await query(`${SALES_PLANS_BASE_QUERY} where psp.id = $1`, [id]);

  if (result.rows.length === 0) {
    throw notFound("Không tìm thấy sản phẩm vận hành cần xử lý.");
  }

  const row = result.rows[0];
  const fifoContext = await buildFifoPreviewContext(queryRunner);
  const preview = fifoContext.previewMenuProductCost(Number(row.menu_product_id));
  return mapSalesPlanRow(row, preview);
}

export async function createSalesPlan({
  menuProductId,
  salesTarget,
  salesActual = 0,
  status = "active",
  notes = null,
}) {
  try {
    const result = await query(
      `
        insert into inventory.product_sales_plans (
          menu_product_id,
          sales_target,
          sales_actual,
          status,
          notes
        )
        values ($1, $2, $3, $4, $5)
        returning id
      `,
      [menuProductId, salesTarget, salesActual, status, notes],
    );

    return fetchSalesPlanById(result.rows[0].id);
  } catch (error) {
    if (error && error.code === "23505") {
      throw conflict("Sản phẩm này đã có trong danh sách vận hành.");
    }

    if (error && error.code === "23503") {
      throw badRequest("Sản phẩm trong định lượng không tồn tại hoặc đã bị xóa.");
    }

    throw error;
  }
}

export async function updateSalesPlan({ id, salesTarget, salesActual, status }) {
  const setClauses = [];
  const params = [];
  let paramIndex = 1;

  if (salesTarget !== undefined) {
    setClauses.push(`sales_target = $${paramIndex++}`);
    params.push(salesTarget);
  }

  if (salesActual !== undefined) {
    setClauses.push(`sales_actual = $${paramIndex++}`);
    params.push(salesActual);
  }

  if (status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    params.push(status);
  }

  if (setClauses.length === 0) {
    throw badRequest("Không có trường nào được cập nhật.");
  }

  setClauses.push(`updated_at = now()`);
  params.push(id);

  const result = await query(
    `
      update inventory.product_sales_plans
      set ${setClauses.join(", ")}
      where id = $${paramIndex}
      returning id
    `,
    params,
  );

  if (result.rows.length === 0) {
    throw notFound("Không tìm thấy sản phẩm vận hành cần cập nhật.");
  }

  return fetchSalesPlanById(id);
}

export async function deleteSalesPlan(id) {
  const result = await query(
    `
      delete from inventory.product_sales_plans
      where id = $1
      returning id
    `,
    [id],
  );

  if (result.rows.length === 0) {
    throw notFound("Không tìm thấy sản phẩm vận hành cần xóa.");
  }

  return { id: Number(result.rows[0].id) };
}
