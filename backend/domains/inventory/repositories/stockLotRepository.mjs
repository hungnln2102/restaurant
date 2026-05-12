import { query } from "../../../db/connection.mjs";

function toNullableNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function mapLotRow(row) {
  const inputQuantity = Number(row.input_quantity || 0);
  const conversionRatio =
    row.conversion_ratio === null || row.conversion_ratio === undefined
      ? 1
      : Number(row.conversion_ratio);
  const normalizedQuantity = inputQuantity * conversionRatio;
  const remainingQuantity = Number(row.remaining_quantity || 0);
  // Clamp consumed to >= 0 so display never shows a negative number even
  // when remaining drifts above normalized by epsilon-level rounding.
  const consumedQuantity = Math.max(0, normalizedQuantity - remainingQuantity);
  const displayUnit = row.processing_unit || row.input_unit;

  return {
    id: Number(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    supplierId: row.supplier_id === null ? null : Number(row.supplier_id),
    supplierName: row.supplier_name ?? null,
    inputQuantity,
    inputUnit: row.input_unit,
    normalizedQuantity,
    remainingQuantity,
    consumedQuantity,
    displayUnit,
    unitPrice: toNullableNumber(row.unit_price),
    currencyCode: row.currency_code ?? "VND",
    pricingUnit: row.input_unit,
    conversionRatio:
      row.conversion_ratio === null || row.conversion_ratio === undefined
        ? null
        : Number(row.conversion_ratio),
    isExhausted: remainingQuantity <= 0,
    isAdjustment: row.supplier_id === null && row.unit_conversion_id === null,
  };
}

const LOTS_QUERY = `
  select
    si.id,
    si.stock_product_id,
    si.supplier_id,
    su.supplier_name,
    si.input_quantity,
    si.input_unit,
    si.unit_price,
    si.currency_code,
    si.unit_conversion_id,
    si.conversion_ratio,
    si.remaining_quantity,
    si.created_at,
    si.updated_at,
    uc.processing_unit
  from inventory.stock_inbounds si
  left join inventory.suppliers su on su.id = si.supplier_id
  left join inventory.unit_conversions uc on uc.id = si.unit_conversion_id
  where si.stock_product_id = $1
  order by si.created_at asc, si.id asc
`;

export async function listLotsByStockProduct(stockProductId) {
  if (!Number.isInteger(stockProductId) || stockProductId <= 0) {
    const error = new Error("ID nguyên liệu không hợp lệ.");
    error.statusCode = 400;
    throw error;
  }

  const result = await query(LOTS_QUERY, [stockProductId]);
  return result.rows.map(mapLotRow);
}
