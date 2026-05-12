import { query, withTransaction } from "../../../db/connection.mjs";
import {
  bumpSalesPlanActual,
  consumeFifoForOrder,
} from "./fifoCostingService.mjs";

const MAX_ORDER_CODE_RETRIES = 3;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 500;
const PER_MENU_LIST_LIMIT = 100;

const ALLOWED_ORDER_TYPES = new Set(["dine_in", "takeaway"]);

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

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function mapOrderRow(row) {
  return {
    id: Number(row.id),
    orderCode: row.order_code,
    menuProductId: Number(row.menu_product_id),
    productName: row.product_name ?? null,
    orderType: row.order_type,
    quantity: Number(row.quantity),
    unitPrice: toNumber(row.unit_price, 0),
    totalAmount: toNumber(row.total_amount, 0),
    costAmount: toNumber(row.cost_amount, 0),
    profitAmount: toNumber(row.profit_amount, 0),
    currencyCode: row.currency_code || "VND",
    notes: row.notes ?? null,
    orderedAt: row.ordered_at,
    createdAt: row.created_at,
  };
}

const ORDER_COLUMNS = `
  po.id,
  po.order_code,
  po.menu_product_id,
  po.order_type,
  po.quantity,
  po.unit_price,
  po.total_amount,
  po.cost_amount,
  po.profit_amount,
  po.currency_code,
  po.notes,
  po.ordered_at,
  po.created_at,
  mp.product_name
`;

export async function listOrdersByMenuProduct(menuProductId) {
  const result = await query(
    `
      select ${ORDER_COLUMNS}
      from inventory.product_orders po
      join inventory.menu_products mp on mp.id = po.menu_product_id
      where po.menu_product_id = $1
      order by po.ordered_at desc, po.id desc
      limit ${PER_MENU_LIST_LIMIT}
    `,
    [menuProductId],
  );

  return result.rows.map(mapOrderRow);
}

function clampLimit(rawLimit) {
  if (rawLimit === undefined || rawLimit === null || rawLimit === "") {
    return DEFAULT_LIST_LIMIT;
  }
  const numeric = Number(rawLimit);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_LIST_LIMIT;
  }
  if (numeric > MAX_LIST_LIMIT) {
    return MAX_LIST_LIMIT;
  }
  return Math.floor(numeric);
}

function clampOffset(rawOffset) {
  if (rawOffset === undefined || rawOffset === null || rawOffset === "") {
    return 0;
  }
  const numeric = Number(rawOffset);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.floor(numeric);
}

function parseIsoDate(rawValue, fieldLabel) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return null;
  }
  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${fieldLabel} không hợp lệ.`);
  }
  return date;
}

function normalizeOrderType(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return null;
  }
  const normalized = String(rawValue).trim().toLowerCase();
  if (!ALLOWED_ORDER_TYPES.has(normalized)) {
    throw badRequest("Loại đơn hàng không hợp lệ.");
  }
  return normalized;
}

function normalizeSearch(rawValue) {
  if (typeof rawValue !== "string") {
    return null;
  }
  const trimmed = rawValue.trim();
  return trimmed ? trimmed : null;
}

// List orders across the whole system. All filters are optional. We always
// LIMIT (capped at MAX_LIST_LIMIT) so callers cannot inadvertently pull the
// entire product_orders table over the wire.
export async function listAllOrders(filters = {}) {
  const orderType = normalizeOrderType(filters.orderType);
  const fromDate = parseIsoDate(filters.fromDate, "Ngày bắt đầu");
  const toDate = parseIsoDate(filters.toDate, "Ngày kết thúc");
  const search = normalizeSearch(filters.search);
  const limit = clampLimit(filters.limit);
  const offset = clampOffset(filters.offset);

  const whereClauses = [];
  const params = [];

  if (orderType) {
    params.push(orderType);
    whereClauses.push(`po.order_type = $${params.length}`);
  }

  if (fromDate) {
    params.push(fromDate.toISOString());
    whereClauses.push(`po.ordered_at >= $${params.length}`);
  }

  if (toDate) {
    params.push(toDate.toISOString());
    whereClauses.push(`po.ordered_at <= $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`po.order_code ilike $${params.length}`);
  }

  const whereSql = whereClauses.length > 0 ? `where ${whereClauses.join(" and ")}` : "";

  const countResult = await query(
    `select count(*)::bigint as total from inventory.product_orders po ${whereSql}`,
    params,
  );

  const total = Number(countResult.rows[0]?.total ?? 0);

  params.push(limit);
  const limitParamIndex = params.length;
  params.push(offset);
  const offsetParamIndex = params.length;

  const result = await query(
    `
      select ${ORDER_COLUMNS}
      from inventory.product_orders po
      join inventory.menu_products mp on mp.id = po.menu_product_id
      ${whereSql}
      order by po.ordered_at desc, po.id desc
      limit $${limitParamIndex} offset $${offsetParamIndex}
    `,
    params,
  );

  return {
    items: result.rows.map(mapOrderRow),
    total,
    limit,
    offset,
  };
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function buildOrderCodeCandidate(orderedAt) {
  const date = orderedAt instanceof Date ? orderedAt : new Date(orderedAt);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  const datePart = `${safeDate.getFullYear()}${pad2(safeDate.getMonth() + 1)}${pad2(
    safeDate.getDate(),
  )}`;

  // Larger entropy than before so retries inside a single transaction are
  // less likely to collide with the original code (which would force the
  // outer retry loop to roll back the FIFO consumption again).
  const suffix = Math.floor(100_000 + Math.random() * 900_000);
  return `ORD-${datePart}-${suffix}`;
}

async function fetchOrderRowByIdWithClient(client, id) {
  const result = await client.query(
    `
      select ${ORDER_COLUMNS}
      from inventory.product_orders po
      join inventory.menu_products mp on mp.id = po.menu_product_id
      where po.id = $1
    `,
    [id],
  );

  if (result.rows.length === 0) {
    throw notFound("Không tìm thấy đơn hàng vừa tạo.");
  }

  return mapOrderRow(result.rows[0]);
}

async function attemptCreateOrder({
  menuProductId,
  orderType,
  quantity,
  unitPrice,
  totalAmount,
  notes,
  orderedAtValue,
}) {
  return withTransaction(async (client) => {
    // Lock the menu_product row so a concurrent edit/delete cannot race the
    // order against component changes mid-FIFO. SELECT ... FOR UPDATE on the
    // master row + FOR UPDATE on lots/balances inside consumeFifoForOrder
    // gives us a clean serialization order.
    const menuProductResult = await client.query(
      `select id from inventory.menu_products where id = $1 for update`,
      [menuProductId],
    );

    if (menuProductResult.rows.length === 0) {
      throw badRequest("Sản phẩm trong đơn không tồn tại hoặc đã bị xóa.");
    }

    const fifoResult = await consumeFifoForOrder(client, {
      menuProductId,
      orderQuantity: quantity,
    });

    const resolvedCost = Number(fifoResult.totalCost.toFixed(2));
    const profitAmount = Number((totalAmount - resolvedCost).toFixed(2));
    const orderCode = buildOrderCodeCandidate(orderedAtValue);

    const insertResult = await client.query(
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
          ordered_at,
          notes
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning id
      `,
      [
        orderCode,
        menuProductId,
        orderType,
        quantity,
        unitPrice,
        totalAmount,
        resolvedCost,
        profitAmount,
        orderedAtValue,
        notes,
      ],
    );

    await bumpSalesPlanActual(client, menuProductId, quantity);

    return fetchOrderRowByIdWithClient(client, insertResult.rows[0].id);
  });
}

export async function createOrder({
  menuProductId,
  orderType,
  quantity,
  unitPrice,
  notes = null,
  orderedAt,
  // costAmount is intentionally ignored: cost is now computed from real FIFO
  // consumption inside the transaction so it cannot drift from inventory.
}) {
  const safeQuantity = Number(quantity);
  const safeUnitPrice = Number(unitPrice);

  if (!Number.isInteger(safeQuantity) || safeQuantity <= 0) {
    throw badRequest("Số lượng phải là số nguyên dương.");
  }

  if (!Number.isFinite(safeUnitPrice) || safeUnitPrice < 0) {
    throw badRequest("Giá bán phải là số không âm.");
  }

  const totalAmount = Number((safeUnitPrice * safeQuantity).toFixed(2));
  const orderedAtValue = orderedAt ? new Date(orderedAt) : new Date();

  if (Number.isNaN(orderedAtValue.getTime())) {
    throw badRequest("Thời điểm đặt hàng không hợp lệ.");
  }

  let lastError = null;

  // Retry on the order_code unique-violation only. FIFO consumption inside
  // the transaction was rolled back when the unique constraint fired, so the
  // next attempt sees the original lot/balance state.
  for (let attempt = 0; attempt < MAX_ORDER_CODE_RETRIES; attempt += 1) {
    try {
      return await attemptCreateOrder({
        menuProductId,
        orderType,
        quantity: safeQuantity,
        unitPrice: safeUnitPrice,
        totalAmount,
        notes,
        orderedAtValue,
      });
    } catch (error) {
      lastError = error;

      if (error && error.code === "23505") {
        continue;
      }

      if (error && error.code === "23503") {
        throw badRequest("Sản phẩm trong đơn không tồn tại hoặc đã bị xóa.");
      }

      if (error && error.code === "23514") {
        throw badRequest("Dữ liệu đơn hàng vi phạm ràng buộc của bảng.");
      }

      throw error;
    }
  }

  const conflictError = new Error(
    "Không tạo được mã đơn duy nhất sau nhiều lần thử. Vui lòng thử lại.",
  );
  conflictError.statusCode = 409;
  conflictError.cause = lastError;
  throw conflictError;
}
