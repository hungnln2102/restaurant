import { handleInventoryOverviewRequest } from "../../backend/domains/inventory/http/inventoryOverviewRoute.mjs";
import { sendJson } from "../../backend/domains/inventory/http/httpUtils.mjs";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const result = await handleInventoryOverviewRequest({
    method: req.method,
  });

  sendJson(res, result.status, result.payload);
}
