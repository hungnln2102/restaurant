import process from "node:process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { warmUpPool } from "./backend/db/connection.mjs";
import {
  handlePortioningRequest,
  readJsonBody,
  sendJson,
} from "./backend/domains/inventory/http/portioningRoute.mjs";
import { handleStockReceiptRequest } from "./backend/domains/inventory/http/stockReceiptRoute.mjs";
import { handleInventoryOverviewRequest } from "./backend/domains/inventory/http/inventoryOverviewRoute.mjs";
import { handleSupplierRequest } from "./backend/domains/inventory/http/supplierRoute.mjs";
import { handleStockProductRequest } from "./backend/domains/inventory/http/stockProductRoute.mjs";
import {
  handleStockLotRequest,
  isStockLotRoute,
} from "./backend/domains/inventory/http/stockLotRoute.mjs";
import { handleProductPortioningRequest } from "./backend/domains/inventory/http/productPortioningRoute.mjs";
import { handleStockBalanceRequest } from "./backend/domains/inventory/http/stockBalanceRoute.mjs";
import { handleStockInboundRequest } from "./backend/domains/inventory/http/stockInboundRoute.mjs";
import { handleMenuProductRequest } from "./backend/domains/inventory/http/menuProductRoute.mjs";
import { handleProductSalesPlanRequest } from "./backend/domains/inventory/http/productSalesPlanRoute.mjs";
import { handleProductOrderRequest } from "./backend/domains/inventory/http/productOrderRoute.mjs";
import { handleDashboardOverviewRequest } from "./backend/domains/dashboard/http/dashboardRoute.mjs";

process.loadEnvFile?.("backend/.env");

function isJsonBodyMethod(method) {
  return method === "POST" || method === "PUT";
}

const inventoryApiPlugin = {
  name: "inventory-api-plugin",
  configureServer(server) {
    // Kick off a warm-up ping right when the dev server starts so the first
    // real request does not pay for Neon auto-suspend wake-up + TLS+SCRAM.
    // Fire-and-forget; warmUpPool handles its own logging/errors and never
    // rejects, so this cannot crash Vite.
    warmUpPool();

    const inventoryApiMiddleware = async (req, res, next) => {
      const requestUrl = req.url ?? "";
      const isPortioningRoute = requestUrl.startsWith("/api/inventory/portioning");
      const isStockReceiptRoute = requestUrl.startsWith("/api/inventory/stock-receipts");
      const isOverviewRoute = requestUrl.startsWith("/api/inventory/overview");
      const isSupplierRoute = requestUrl.startsWith("/api/inventory/suppliers");
      // The lot route MUST be checked before the generic stock-products route
      // because its URL is a prefix-match of `/api/inventory/stock-products`.
      const isStockLotRequest = isStockLotRoute(requestUrl);
      const isStockProductRoute =
        requestUrl.startsWith("/api/inventory/stock-products") && !isStockLotRequest;
      const isMenuProductRoute = requestUrl.startsWith("/api/inventory/menu-products");
      const isProductPortioningRoute = requestUrl.startsWith("/api/inventory/product-portioning");
      const isProductSalesPlanRoute = requestUrl.startsWith("/api/inventory/product-sales-plans");
      const isProductOrderRoute = requestUrl.startsWith("/api/inventory/product-orders");
      const isStockBalanceRoute = requestUrl.startsWith("/api/inventory/stock-balances");
      const isStockInboundRoute = requestUrl.startsWith("/api/inventory/stock-inbounds");
      const isDashboardRoute = requestUrl.startsWith("/api/dashboard");

      if (
        !isPortioningRoute &&
        !isStockReceiptRoute &&
        !isOverviewRoute &&
        !isSupplierRoute &&
        !isStockLotRequest &&
        !isStockProductRoute &&
        !isMenuProductRoute &&
        !isProductPortioningRoute &&
        !isProductSalesPlanRoute &&
        !isProductOrderRoute &&
        !isStockBalanceRoute &&
        !isStockInboundRoute &&
        !isDashboardRoute
      ) {
        next();
        return;
      }

      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }

      try {
        const body = isJsonBodyMethod(req.method) ? await readJsonBody(req) : undefined;
        let result;

        if (isPortioningRoute) {
          result = await handlePortioningRequest({ method: req.method, body });
        } else if (isStockReceiptRoute) {
          result = await handleStockReceiptRequest({ method: req.method, body });
        } else if (isOverviewRoute) {
          result = await handleInventoryOverviewRequest({ method: req.method });
        } else if (isSupplierRoute) {
          result = await handleSupplierRequest({ method: req.method, body });
        } else if (isStockLotRequest) {
          result = await handleStockLotRequest({
            method: req.method,
            requestUrl,
          });
        } else if (isStockProductRoute) {
          result = await handleStockProductRequest({ method: req.method });
        } else if (isMenuProductRoute) {
          result = await handleMenuProductRequest({
            method: req.method,
            requestUrl,
            body,
          });
        } else if (isProductPortioningRoute) {
          result = await handleProductPortioningRequest({ method: req.method });
        } else if (isProductSalesPlanRoute) {
          result = await handleProductSalesPlanRequest({
            method: req.method,
            requestUrl,
            body,
          });
        } else if (isProductOrderRoute) {
          result = await handleProductOrderRequest({
            method: req.method,
            requestUrl,
            body,
          });
        } else if (isStockBalanceRoute) {
          result = await handleStockBalanceRequest({
            method: req.method,
            requestUrl,
            body,
          });
        } else if (isStockInboundRoute) {
          result = await handleStockInboundRequest({
            method: req.method,
            requestUrl,
            body,
          });
        } else {
          result = await handleDashboardOverviewRequest({
            method: req.method,
            requestUrl,
          });
        }

        sendJson(res, result.status, result.payload);
      } catch (error) {
        sendJson(res, 400, {
          error: "Payload không hợp lệ.",
        });
      }
    };

    server.middlewares.stack.unshift({
      route: "",
      handle: inventoryApiMiddleware,
    });
  },
};

export default defineConfig({
  plugins: [react(), inventoryApiPlugin],
});
