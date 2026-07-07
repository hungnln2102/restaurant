import { createStockProduct as createStockProductInRepository } from "../repositories/stockProductRepository.mjs";

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export async function createStockProduct(input) {
  const productName = typeof input?.productName === "string" ? input.productName.trim() : "";
  const productCategory = typeof input?.productCategory === "string" ? input.productCategory.trim() : null;

  if (!productName) {
    throw badRequest("Tên nguyên liệu là bắt buộc.");
  }

  if (productName.length > 200) {
    throw badRequest("Tên nguyên liệu không được vượt quá 200 ký tự.");
  }

  return createStockProductInRepository({ productName, productCategory });
}
