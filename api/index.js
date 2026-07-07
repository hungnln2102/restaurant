// Catch-all Vercel Serverless Function: hosts the entire backend API.
//
// Why one file instead of many: every route reuses the same domain handlers
// from `backend/domains/**`. Putting the dispatcher here avoids duplicating
// boilerplate across 13+ files, mirrors the routing logic that lives in
// `vite.config.js` for `npm run dev`, and lets us cold-start a single
// lambda + DB pool per request burst instead of per-route.

import { handlePortioningRequest } from "../backend/domains/inventory/http/portioningRoute.mjs";
import { handleStockReceiptRequest } from "../backend/domains/inventory/http/stockReceiptRoute.mjs";
import { handleInventoryOverviewRequest } from "../backend/domains/inventory/http/inventoryOverviewRoute.mjs";
import { handleSupplierRequest } from "../backend/domains/inventory/http/supplierRoute.mjs";
import { handleStockProductRequest } from "../backend/domains/inventory/http/stockProductRoute.mjs";
import {
  handleStockLotRequest,
  isStockLotRoute,
} from "../backend/domains/inventory/http/stockLotRoute.mjs";
import { handleProductPortioningRequest } from "../backend/domains/inventory/http/productPortioningRoute.mjs";
import { handleStockBalanceRequest } from "../backend/domains/inventory/http/stockBalanceRoute.mjs";
import { handleStockInboundRequest } from "../backend/domains/inventory/http/stockInboundRoute.mjs";
import { handleMenuProductRequest } from "../backend/domains/inventory/http/menuProductRoute.mjs";
import { handleProductSalesPlanRequest } from "../backend/domains/inventory/http/productSalesPlanRoute.mjs";
import { handleProductOrderRequest } from "../backend/domains/inventory/http/productOrderRoute.mjs";
import { handleDashboardOverviewRequest } from "../backend/domains/dashboard/http/dashboardRoute.mjs";

function isJsonBodyMethod(method) {
  return method === "POST" || method === "PUT" || method === "PATCH";
}

// Vercel auto-parses JSON when Content-Type is application/json and exposes
// it on req.body. For other content types or when parsing failed, req.body
// can be undefined/null/Buffer/string. We normalize to a plain object so the
// downstream handlers (which expect a JS object) never see a Buffer.
async function readBody(req) {
  const raw = req.body;

  if (raw === undefined || raw === null) {
    return {};
  }

  // Already-parsed JSON object (the common case on Vercel).
  if (typeof raw === "object" && !Buffer.isBuffer(raw)) {
    return raw;
  }

  // Vercel only buffers the body up-front when it can detect a JSON
  // content-type; if we ever receive raw bytes/text, parse them ourselves.
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return {};
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Surface as a 400 to the caller via the catch in the main handler.
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
 * Trên Vercel, serverless `api/[...path].js` đôi khi nhận `req.url` không có
 * tiền tố `/api` (vd: `/dashboard/overview?range=7d`), trong khi Vite dev luôn
 * thấy `/api/...`. Chuẩn hóa để `detectRoute` và các handler parse query giống
 * môi trường local.
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
  // The lot route is a strict subpath of `/api/inventory/stock-products`,
  // so it MUST be checked first; otherwise the generic stock-products
  // handler swallows the request.
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

export default async function handler(req, res) {
  // Same-origin deployment, but explicit CORS headers make local previews
  // and edge-cached debugging easier without touching frontend code.
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
    // Last-resort guard: route handlers already wrap their own errors and
    // return a {status, payload} shape. Hitting this branch means body
    // parsing failed or an unexpected throw escaped — log + return 500
    // (or 400 if we tagged it ourselves) so the frontend never sees
    // "[object Object]" again.
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
