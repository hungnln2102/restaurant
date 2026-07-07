import { listStockChecks, getStockCheckItems } from "../use-cases/listStockChecks.mjs";

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseIdFromUrl(requestUrl = "") {
  const pathname = requestUrl.split("?")[0];
  const segments = pathname.split("/").filter(Boolean);
  const idSegment = segments[segments.length - 2] === "stock-checks" 
    ? segments[segments.length - 1] 
    : segments[segments.length - 2];
    
  const parsed = Number(idSegment);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function handleStockCheckRequest({ method, requestUrl }) {
  try {
    if (method === "GET") {
      if (requestUrl.includes("/items")) {
        const id = parseIdFromUrl(requestUrl);
        if (!id) throw badRequest("Thiếu ID phiếu kiểm kê.");
        const data = await getStockCheckItems(id);
        return { status: 200, payload: { data } };
      }
      
      const data = await listStockChecks();
      return { status: 200, payload: { data } };
    }

    return {
      status: 405,
      payload: { error: "Method not allowed." },
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
