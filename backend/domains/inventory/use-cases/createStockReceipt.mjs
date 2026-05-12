import { createStockReceipt as createStockReceiptInRepository } from "../repositories/stockReceiptRepository.mjs";
import { invalidateInventoryOverviewCache } from "./getInventoryOverview.mjs";

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeConversionRuleId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = Number(value);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw badRequest("Tỷ lệ quy đổi không hợp lệ.");
  }

  return normalized;
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

export function validateStockReceiptPayload(input) {
  const ingredientName = typeof input?.ingredient === "string" ? input.ingredient.trim() : "";
  const productCategory =
    typeof input?.productCategory === "string" && input.productCategory.trim()
      ? input.productCategory.trim()
      : null;
  const supplierName = typeof input?.supplierName === "string" ? input.supplierName.trim() : "";
  const inputUnit = typeof input?.inputUnit === "string" ? input.inputUnit.trim() : "";
  const inputQuantity = Number(input?.inputQuantity);
  const unitPrice = normalizeUnitPrice(input?.unitPrice);
  const unitConversionId = normalizeConversionRuleId(input?.conversionRuleId);

  if (!ingredientName) {
    throw badRequest("Tên sản phẩm là bắt buộc.");
  }

  if (!inputUnit) {
    throw badRequest("Đơn vị nhập là bắt buộc.");
  }

  if (!supplierName) {
    throw badRequest("Nhà cung ứng là bắt buộc.");
  }

  if (!Number.isFinite(inputQuantity) || inputQuantity <= 0) {
    throw badRequest("Số lượng nhập phải lớn hơn 0.");
  }

  return {
    ingredientName,
    productCategory,
    supplierName,
    inputQuantity,
    inputUnit,
    unitPrice,
    unitConversionId,
  };
}

export async function createStockReceipt(input) {
  const receipt = await createStockReceiptInRepository(validateStockReceiptPayload(input));
  invalidateInventoryOverviewCache();
  return receipt;
}
