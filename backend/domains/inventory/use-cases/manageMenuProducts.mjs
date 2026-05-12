import {
  createMenuProduct as createMenuProductInRepository,
  deleteMenuProduct as deleteMenuProductInRepository,
  getMenuProductById as getMenuProductByIdInRepository,
  listMenuProducts as listMenuProductsInRepository,
  updateMenuProduct as updateMenuProductInRepository,
} from "../repositories/menuProductRepository.mjs";

const ALLOWED_STATUSES = new Set(["active", "inactive"]);

const MAX_PRODUCT_NAME_LENGTH = 200;
const MAX_PRODUCT_CATEGORY_LENGTH = 120;
const MAX_SERVING_UNIT_LENGTH = 50;
const MAX_COMPONENT_UNIT_LENGTH = 30;
const MAX_COMPONENT_NOTES_LENGTH = 500;
const MAX_COMPONENTS_PER_PRODUCT = 50;

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeRequiredText(value, { fieldLabel, maxLength }) {
  if (typeof value !== "string") {
    throw badRequest(`${fieldLabel} là bắt buộc.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw badRequest(`${fieldLabel} là bắt buộc.`);
  }

  if (normalized.length > maxLength) {
    throw badRequest(`${fieldLabel} không được vượt quá ${maxLength} ký tự.`);
  }

  return normalized;
}

function normalizeOptionalText(value, { fieldLabel, maxLength }) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw badRequest(`${fieldLabel} không hợp lệ.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw badRequest(`${fieldLabel} không được vượt quá ${maxLength} ký tự.`);
  }

  return normalized;
}

function normalizeSellingPrice(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = Number(value);

  if (!Number.isFinite(normalized) || normalized < 0) {
    throw badRequest("Đơn giá bán không hợp lệ.");
  }

  return normalized;
}

function normalizeStatus(value) {
  if (value === undefined || value === null || value === "") {
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

function normalizePositiveInteger(value, { fieldLabel }) {
  if (value === undefined || value === null || value === "") {
    throw badRequest(`${fieldLabel} là bắt buộc.`);
  }

  const normalized = Number(value);

  if (!Number.isFinite(normalized) || !Number.isInteger(normalized) || normalized <= 0) {
    throw badRequest(`${fieldLabel} không hợp lệ.`);
  }

  return normalized;
}

function normalizePositiveNumber(value, { fieldLabel }) {
  if (value === undefined || value === null || value === "") {
    throw badRequest(`${fieldLabel} là bắt buộc.`);
  }

  const normalized = Number(value);

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw badRequest(`${fieldLabel} phải là số lớn hơn 0.`);
  }

  return normalized;
}

function normalizeNonNegativeInteger(value, { fieldLabel }) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = Number(value);

  if (!Number.isFinite(normalized) || !Number.isInteger(normalized) || normalized < 0) {
    throw badRequest(`${fieldLabel} không hợp lệ.`);
  }

  return normalized;
}

function normalizeComponent(rawComponent, index) {
  if (!rawComponent || typeof rawComponent !== "object") {
    throw badRequest(`Thành phần #${index + 1} không hợp lệ.`);
  }

  const stockProductId = normalizePositiveInteger(rawComponent.stockProductId, {
    fieldLabel: `Nguyên liệu của thành phần #${index + 1}`,
  });
  const quantity = normalizePositiveNumber(rawComponent.quantity, {
    fieldLabel: `Định lượng của thành phần #${index + 1}`,
  });
  const unit = normalizeRequiredText(rawComponent.unit, {
    fieldLabel: `Đơn vị tính của thành phần #${index + 1}`,
    maxLength: MAX_COMPONENT_UNIT_LENGTH,
  });
  const sortOrder = normalizeNonNegativeInteger(rawComponent.sortOrder, {
    fieldLabel: `Thứ tự của thành phần #${index + 1}`,
  });
  const notes = normalizeOptionalText(rawComponent.notes, {
    fieldLabel: `Ghi chú của thành phần #${index + 1}`,
    maxLength: MAX_COMPONENT_NOTES_LENGTH,
  });

  return {
    stockProductId,
    quantity,
    unit,
    sortOrder: sortOrder ?? index,
    notes,
  };
}

function normalizeComponents(rawComponents) {
  if (rawComponents === undefined || rawComponents === null) {
    return [];
  }

  if (!Array.isArray(rawComponents)) {
    throw badRequest("Danh sách thành phần không hợp lệ.");
  }

  if (rawComponents.length === 0) {
    return [];
  }

  if (rawComponents.length > MAX_COMPONENTS_PER_PRODUCT) {
    throw badRequest(
      `Số lượng thành phần không được vượt quá ${MAX_COMPONENTS_PER_PRODUCT}.`,
    );
  }

  const seenStockProductIds = new Set();
  const normalizedComponents = [];

  for (let index = 0; index < rawComponents.length; index += 1) {
    const component = normalizeComponent(rawComponents[index], index);

    if (seenStockProductIds.has(component.stockProductId)) {
      throw badRequest("Một nguyên liệu chỉ được khai báo một lần.");
    }

    seenStockProductIds.add(component.stockProductId);
    normalizedComponents.push(component);
  }

  return normalizedComponents;
}

export function validateCreateMenuProductPayload(input) {
  const productName = normalizeRequiredText(input?.productName, {
    fieldLabel: "Tên sản phẩm",
    maxLength: MAX_PRODUCT_NAME_LENGTH,
  });
  const productCategory = normalizeOptionalText(input?.productCategory, {
    fieldLabel: "Nhóm sản phẩm",
    maxLength: MAX_PRODUCT_CATEGORY_LENGTH,
  });
  const servingUnit = normalizeRequiredText(input?.servingUnit, {
    fieldLabel: "Đơn vị tính",
    maxLength: MAX_SERVING_UNIT_LENGTH,
  });
  const sellingPrice = normalizeSellingPrice(input?.sellingPrice);
  const status = normalizeStatus(input?.status);
  const components = normalizeComponents(input?.components);

  return {
    productName,
    productCategory,
    servingUnit,
    sellingPrice,
    status,
    components,
  };
}

function validateMenuProductId(id) {
  return normalizePositiveInteger(id, { fieldLabel: "ID sản phẩm" });
}

export async function listMenuProducts() {
  return listMenuProductsInRepository();
}

export async function createMenuProduct(input) {
  return createMenuProductInRepository(validateCreateMenuProductPayload(input));
}

export async function getMenuProductById(id) {
  const validatedId = validateMenuProductId(id);
  return getMenuProductByIdInRepository(validatedId);
}

export async function updateMenuProduct(input) {
  const validatedId = validateMenuProductId(input?.id);
  const payload = validateCreateMenuProductPayload(input);

  return updateMenuProductInRepository({
    id: validatedId,
    ...payload,
  });
}

export async function deleteMenuProduct(id) {
  const validatedId = validateMenuProductId(id);
  return deleteMenuProductInRepository(validatedId);
}
