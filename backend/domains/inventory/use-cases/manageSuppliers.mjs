import {
  createSupplier as createSupplierInRepository,
  listSuppliers as listSuppliersInRepository,
} from "../repositories/supplierRepository.mjs";

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeUnitPrice(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = Number(value);

  if (!Number.isFinite(normalized) || normalized < 0) {
    throw badRequest("Giá thành không hợp lệ.");
  }

  return normalized;
}

const PRICING_UNIT_MAX_LENGTH = 30;

function normalizePricingUnit(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > PRICING_UNIT_MAX_LENGTH) {
    throw badRequest(`Đơn vị tính giá không được vượt quá ${PRICING_UNIT_MAX_LENGTH} ký tự.`);
  }

  return trimmed;
}

export function validateCreateSupplierPayload(input) {
  const supplierName = normalizeOptionalText(input?.supplierName);
  const primaryCategory = normalizeOptionalText(input?.primaryCategory);
  const featuredProductName = normalizeOptionalText(input?.featuredProductName);
  const contactName = normalizeOptionalText(input?.contactName);
  const phone = normalizeOptionalText(input?.phone);
  const email = normalizeOptionalText(input?.email);
  const address = normalizeOptionalText(input?.address);
  const notes = normalizeOptionalText(input?.notes);
  const defaultUnitPrice = normalizeUnitPrice(input?.defaultUnitPrice);
  const pricingUnit = normalizePricingUnit(input?.pricingUnit);

  if (!supplierName) {
    throw badRequest("Tên nhà cung ứng là bắt buộc.");
  }

  if (defaultUnitPrice !== null && !featuredProductName) {
    throw badRequest("Cần nhập mặt hàng tiêu biểu khi khai báo giá thành.");
  }

  if (defaultUnitPrice !== null && !pricingUnit) {
    throw badRequest("Hãy nhập đơn vị tính cho giá tham chiếu.");
  }

  return {
    supplierName,
    primaryCategory,
    defaultUnitPrice,
    pricingUnit,
    contactName,
    phone,
    email,
    address,
    notes,
    featuredProductName,
  };
}

export async function listSuppliers() {
  return listSuppliersInRepository();
}

export async function createSupplier(input) {
  return createSupplierInRepository(validateCreateSupplierPayload(input));
}
