import {
  createOrder as createOrderInRepository,
  listAllOrders as listAllOrdersInRepository,
  listOrdersByMenuProduct as listOrdersByMenuProductInRepository,
} from "../repositories/productOrderRepository.mjs";

const ALLOWED_ORDER_TYPES = new Set(["dine_in", "takeaway"]);
const MAX_NOTES_LENGTH = 500;

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeMenuProductId(value) {
  if (value === undefined || value === null || value === "") {
    throw badRequest("Mã sản phẩm là bắt buộc.");
  }

  const numeric = Number(value);

  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw badRequest("Mã sản phẩm không hợp lệ.");
  }

  return numeric;
}

function normalizeOrderType(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw badRequest("Loại đơn hàng là bắt buộc.");
  }

  const normalized = value.trim().toLowerCase();

  if (!ALLOWED_ORDER_TYPES.has(normalized)) {
    throw badRequest("Loại đơn hàng không hợp lệ.");
  }

  return normalized;
}

function normalizeQuantity(value) {
  if (value === undefined || value === null || value === "") {
    throw badRequest("Số lượng là bắt buộc.");
  }

  const numeric = Number(value);

  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw badRequest("Số lượng phải là số nguyên dương.");
  }

  return numeric;
}

function normalizeNonNegativeMoney(value, fieldLabel, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw badRequest(`${fieldLabel} là bắt buộc.`);
    }
    return null;
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    throw badRequest(`${fieldLabel} phải là số không âm.`);
  }

  return numeric;
}

function normalizeNotes(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw badRequest("Ghi chú không hợp lệ.");
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > MAX_NOTES_LENGTH) {
    throw badRequest(`Ghi chú không được vượt quá ${MAX_NOTES_LENGTH} ký tự.`);
  }

  return trimmed;
}

function normalizeOrderedAt(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw badRequest("Thời điểm đặt hàng không hợp lệ.");
  }

  return date.toISOString();
}

function validateCreatePayload(input) {
  const menuProductId = normalizeMenuProductId(input?.menuProductId);
  const orderType = normalizeOrderType(input?.orderType);
  const quantity = normalizeQuantity(input?.quantity);
  const unitPrice = normalizeNonNegativeMoney(input?.unitPrice, "Giá bán", {
    required: true,
  });
  const notes = normalizeNotes(input?.notes);
  const orderedAt = normalizeOrderedAt(input?.orderedAt);

  return {
    menuProductId,
    orderType,
    quantity,
    unitPrice,
    notes,
    orderedAt,
  };
}

export async function listOrders(menuProductIdInput) {
  const menuProductId = normalizeMenuProductId(menuProductIdInput);
  return listOrdersByMenuProductInRepository(menuProductId);
}

export async function listAllOrders(filters = {}) {
  return listAllOrdersInRepository(filters);
}

export async function createOrder(input) {
  return createOrderInRepository(validateCreatePayload(input));
}
