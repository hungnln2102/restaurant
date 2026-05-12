import { listLotsByStockProduct } from "../repositories/stockLotRepository.mjs";

// Matches `/api/inventory/stock-products/<id>/lots` with an optional
// trailing slash or query string. Anchored at the start so we never accept
// a partial substring like `/foo/api/inventory/...`.
const STOCK_LOT_URL_PATTERN = /^\/api\/inventory\/stock-products\/(\d+)\/lots\/?(?:\?.*)?$/;

export function isStockLotRoute(requestUrl = "") {
  return STOCK_LOT_URL_PATTERN.test(requestUrl);
}

function parseStockProductIdFromUrl(requestUrl = "") {
  const match = STOCK_LOT_URL_PATTERN.exec(requestUrl);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export async function handleStockLotRequest({ method, requestUrl }) {
  try {
    if (method !== "GET") {
      return {
        status: 405,
        payload: { error: "Method not allowed." },
      };
    }

    const stockProductId = parseStockProductIdFromUrl(requestUrl);

    if (!stockProductId) {
      return {
        status: 400,
        payload: { error: "Thiếu ID nguyên liệu hợp lệ." },
      };
    }

    const data = await listLotsByStockProduct(stockProductId);

    return {
      status: 200,
      payload: { data },
    };
  } catch (error) {
    return {
      status: error.statusCode || 500,
      payload: {
        error: error.message || "Unexpected server error.",
      },
    };
  }
}
