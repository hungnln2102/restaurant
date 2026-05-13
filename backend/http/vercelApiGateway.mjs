// Entry dùng chung cho Vercel: `api/[...path].js`, `api/dashboard/overview.js`, …
// Giữ logic ngoài thư mục `api/` để file helper không bị nhầm thành route riêng.

import { handlePortioningRequest } from "../domains/inventory/http/portioningRoute.mjs";
import { handleStockReceiptRequest } from "../domains/inventory/http/stockReceiptRoute.mjs";
import { handleInventoryOverviewRequest } from "../domains/inventory/http/inventoryOverviewRoute.mjs";
import { handleSupplierRequest } from "../domains/inventory/http/supplierRoute.mjs";
import { handleStockProductRequest } from "../domains/inventory/http/stockProductRoute.mjs";
import {
  handleStockLotRequest,
  isStockLotRoute,
} from "../domains/inventory/http/stockLotRoute.mjs";
import { handleProductPortioningRequest } from "../domains/inventory/http/productPortioningRoute.mjs";
import { handleStockBalanceRequest } from "../domains/inventory/http/stockBalanceRoute.mjs";
import { handleStockInboundRequest } from "../domains/inventory/http/stockInboundRoute.mjs";
import { handleMenuProductRequest } from "../domains/inventory/http/menuProductRoute.mjs";
import { handleProductSalesPlanRequest } from "../domains/inventory/http/productSalesPlanRoute.mjs";
import { handleProductOrderRequest } from "../domains/inventory/http/productOrderRoute.mjs";
import { handleDashboardOverviewRequest } from "../domains/dashboard/http/dashboardRoute.mjs";

function isJsonBodyMethod(method) {
  return method === "POST" || method === "PUT" || method === "PATCH";
}

async function readBody(req) {
  const raw = req.body;

  if (raw === undefined || raw === null) {
    return {};
  }

  if (typeof raw === "object" && !Buffer.isBuffer(raw)) {
    return raw;
  }

  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return {};
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const error = new Error("Payload không phải JSON hợp lệ.");
    error.statusCode = 400;
    throw error;
  }
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

/**
 * Trên Vercel, một số entry (catch-all hoặc rewrite) có thể truyền `req.url`
 * thiếu tiền tố `/api`. Chuẩn hóa để khớp `detectRoute` và parse query.
 */
function normalizeApiRequestUrl(rawUrl) {
  if (typeof rawUrl !== "string") {
    return "";
  }

  let pathWithQuery = rawUrl.trim();

  try {
    if (/^https?:\/\//i.test(pathWithQuery)) {
      const parsed = new URL(pathWithQuery);
      pathWithQuery = `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // giữ nguyên pathWithQuery
  }

  if (pathWithQuery.startsWith("/api/") || pathWithQuery === "/api") {
    return pathWithQuery;
  }

  if (pathWithQuery.startsWith("/")) {
    return `/api${pathWithQuery}`;
  }

  if (pathWithQuery.length > 0) {
    return `/api/${pathWithQuery}`;
  }

  return "";
}

function detectRoute(requestUrl) {
  if (isStockLotRoute(requestUrl)) return "stockLot";
  if (requestUrl.startsWith("/api/inventory/portioning")) return "portioning";
  if (requestUrl.startsWith("/api/inventory/stock-receipts")) return "stockReceipt";
  if (requestUrl.startsWith("/api/inventory/overview")) return "overview";
  if (requestUrl.startsWith("/api/inventory/suppliers")) return "supplier";
  if (requestUrl.startsWith("/api/inventory/stock-products")) return "stockProduct";
  if (requestUrl.startsWith("/api/inventory/menu-products")) return "menuProduct";
  if (requestUrl.startsWith("/api/inventory/product-portioning")) return "productPortioning";
  if (requestUrl.startsWith("/api/inventory/product-sales-plans")) return "productSalesPlan";
  if (requestUrl.startsWith("/api/inventory/product-orders")) return "productOrder";
  if (requestUrl.startsWith("/api/inventory/stock-balances")) return "stockBalance";
  if (requestUrl.startsWith("/api/inventory/stock-inbounds")) return "stockInbound";
  if (requestUrl.startsWith("/api/dashboard")) return "dashboard";
  return null;
}

async function dispatch(route, { method, requestUrl, body }) {
  switch (route) {
    case "portioning":
      return handlePortioningRequest({ method, body });
    case "stockReceipt":
      return handleStockReceiptRequest({ method, body });
    case "overview":
      return handleInventoryOverviewRequest({ method });
    case "supplier":
      return handleSupplierRequest({ method, body });
    case "stockLot":
      return handleStockLotRequest({ method, requestUrl });
    case "stockProduct":
      return handleStockProductRequest({ method });
    case "menuProduct":
      return handleMenuProductRequest({ method, requestUrl, body });
    case "productPortioning":
      return handleProductPortioningRequest({ method });
    case "productSalesPlan":
      return handleProductSalesPlanRequest({ method, requestUrl, body });
    case "productOrder":
      return handleProductOrderRequest({ method, requestUrl, body });
    case "stockBalance":
      return handleStockBalanceRequest({ method, requestUrl, body });
    case "stockInbound":
      return handleStockInboundRequest({ method, requestUrl, body });
    case "dashboard":
      return handleDashboardOverviewRequest({ method, requestUrl });
    default:
      return {
        status: 404,
        payload: { error: `Route ${requestUrl} không tồn tại.` },
      };
  }
}

export default async function vercelApiGateway(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const requestUrl = normalizeApiRequestUrl(req.url ?? "");
  const route = detectRoute(requestUrl);

  if (!route) {
    sendJson(res, 404, { error: `Route ${requestUrl} không tồn tại.` });
    return;
  }

  try {
    const body = isJsonBodyMethod(req.method) ? await readBody(req) : undefined;
    const result = await dispatch(route, {
      method: req.method,
      requestUrl,
      body,
    });
    sendJson(res, result.status, result.payload);
  } catch (error) {
    const status = error?.statusCode ?? 500;
    const message =
      typeof error?.message === "string" && error.message.length > 0
        ? error.message
        : "Unexpected server error.";
    if (status >= 500) {
      console.error("[api] Unhandled error:", error);
    }
    sendJson(res, status, { error: message });
  }
}
