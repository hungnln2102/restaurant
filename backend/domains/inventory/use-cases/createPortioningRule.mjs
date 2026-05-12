import { createPortioningRule as createPortioningRuleInRepository } from "../repositories/portioningRepository.mjs";

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function buildInternalName(stockUnit, processingUnit, conversionRatio) {
  return `Quy ước ${stockUnit} sang ${processingUnit} (${conversionRatio})`;
}

export function validatePortioningPayload(input) {
  const stockUnit = typeof input?.stockUnit === "string" ? input.stockUnit.trim() : "";
  const processingUnit = typeof input?.processingUnit === "string" ? input.processingUnit.trim() : "";
  const rawConversionRatio = input?.conversionRatio;
  const conversionRatio = Number(rawConversionRatio);

  if (!stockUnit) {
    throw badRequest("Đơn vị kho là bắt buộc.");
  }

  if (!processingUnit) {
    throw badRequest("Đơn vị chế biến là bắt buộc.");
  }

  if (!Number.isFinite(conversionRatio) || conversionRatio <= 0) {
    throw badRequest("Tỷ lệ quy đổi phải là số lớn hơn 0.");
  }

  return {
    name: buildInternalName(stockUnit, processingUnit, conversionRatio),
    description: null,
    stockUnit,
    processingUnit,
    conversionRatio,
  };
}

export async function createPortioningRule(input) {
  return createPortioningRuleInRepository(validatePortioningPayload(input));
}
