import {
  createSalesPlan as createSalesPlanInRepository,
  deleteSalesPlan as deleteSalesPlanInRepository,
  listSalesPlans as listSalesPlansInRepository,
  updateSalesPlan as updateSalesPlanInRepository,
} from "../repositories/productSalesPlanRepository.mjs";
import { withCache } from "../../../shared/cache.mjs";
import { invalidateAfterSalesPlanChange } from "../../../shared/cacheInvalidation.mjs";

const CACHE_KEY = "salesPlans:list:v1";
const CACHE_TTL_MS = 15_000;

const ALLOWED_STATUSES = new Set(["active", "limited", "paused"]);
const MAX_NOTES_LENGTH = 500;

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeMenuProductId(value) {
  if (value === undefined || value === null || value === "") {
    throw badRequest("Vui lòng chọn sản phẩm cần đưa vào vận hành.");
  }

  const normalized = Number(value);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw badRequest("Sản phẩm được chọn không hợp lệ.");
  }

  return normalized;
}

function normalizeIntegerCount(value, { fieldLabel, required = false, defaultValue = 0 }) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw badRequest(`${fieldLabel} là bắt buộc.`);
    }
    return defaultValue;
  }

  const normalized = Number(value);

  if (!Number.isInteger(normalized) || normalized < 0) {
    throw badRequest(`${fieldLabel} phải là số nguyên không âm.`);
  }

  return normalized;
}

function normalizeStatus(value, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw badRequest("Trạng thái là bắt buộc.");
    }
    return "active";
  }

  if (typeof value !== "string") {
    throw badRequest("Trạng thái không hợp lệ.");
  }

  const normalized = value.trim().toLowerCase();

  if (!ALLOWED_STATUSES.has(normalized)) {
    throw badRequest("Trạng thái không hợp lệ.");
  }

  return normalized;
}

function normalizeNotes(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw badRequest("Ghi chú không hợp lệ.");
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > MAX_NOTES_LENGTH) {
    throw badRequest(`Ghi chú không được vượt quá ${MAX_NOTES_LENGTH} ký tự.`);
  }

  return normalized;
}

export function validateCreatePayload(input) {
  const menuProductId = normalizeMenuProductId(input?.menuProductId);
  const salesTarget = normalizeIntegerCount(input?.salesTarget, {
    fieldLabel: "Số lượng kế hoạch",
    required: true,
  });
  const salesActual = normalizeIntegerCount(input?.salesActual, {
    fieldLabel: "Số lượng đã bán",
    defaultValue: 0,
  });
  const status = normalizeStatus(input?.status);
  const notes = normalizeNotes(input?.notes);

  return { menuProductId, salesTarget, salesActual, status, notes };
}

export function validateUpdatePayload(input) {
  const patch = {};

  if (input?.salesTarget !== undefined) {
    patch.salesTarget = normalizeIntegerCount(input.salesTarget, {
      fieldLabel: "Số lượng kế hoạch",
    });
  }

  if (input?.salesActual !== undefined) {
    patch.salesActual = normalizeIntegerCount(input.salesActual, {
      fieldLabel: "Số lượng đã bán",
    });
  }

  if (input?.status !== undefined) {
    patch.status = normalizeStatus(input.status);
  }

  if (Object.keys(patch).length === 0) {
    throw badRequest("Không có trường nào được cập nhật.");
  }

  return patch;
}

export async function listSalesPlans() {
  return withCache(CACHE_KEY, CACHE_TTL_MS, () => listSalesPlansInRepository());
}

export async function createSalesPlan(input) {
  const result = await createSalesPlanInRepository(validateCreatePayload(input));
  invalidateAfterSalesPlanChange();
  return result;
}

export async function updateSalesPlan(id, input) {
  const result = await updateSalesPlanInRepository({ id, ...validateUpdatePayload(input) });
  invalidateAfterSalesPlanChange();
  return result;
}

export async function deleteSalesPlan(id) {
  const result = await deleteSalesPlanInRepository(id);
  invalidateAfterSalesPlanChange();
  return result;
}
