import {
  handleStockReceiptRequest,
} from "../../backend/domains/inventory/http/stockReceiptRoute.mjs";
import {
  readJsonBody,
  sendJson,
} from "../../backend/domains/inventory/http/httpUtils.mjs";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const body = req.method === "POST" ? await readJsonBody(req) : undefined;
    const result = await handleStockReceiptRequest({
      method: req.method,
      body,
    });

    sendJson(res, result.status, result.payload);
  } catch (error) {
    sendJson(res, 400, {
      error: "Payload không hợp lệ.",
    });
  }
}
