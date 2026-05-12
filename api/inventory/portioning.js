import { handlePortioningRequest } from "../../backend/domains/inventory/http/portioningRoute.mjs";

export default async function handler(req, res) {
  const result = await handlePortioningRequest({
    method: req.method,
    body: req.body ?? {},
  });

  res.status(result.status).json(result.payload);
}
