import {
  deleteStockInboundAndRollbackBalance,
  updateStockInbound,
} from "../repositories/stockInboundRepository.mjs";
import { invalidateInventoryOverviewCache } from "../use-cases/getInventoryOverview.mjs";

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseIdFromUrl(requestUrl = "") {
  const pathname = requestUrl.split("?")[0];
  const segments = pathname.split("/").filter(Boolean);
  const idSegment = segments[segments.length - 1];
  const parsed = Number(idSegment);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function normalizeUnitPrice(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = Number(value);

  if (!Number.isFinite(normalized) || normalized < 0) {
    throw badRequest("Giá thành phải lớn hơn hoặc bằng 0.");
  }

  return normalized;
}

function normalizeSupplierId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = Number(value);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw badRequest("Mã nhà cung ứng không hợp lệ.");
  }

  return normalized;
}

export async function handleStockInboundRequest({ method, requestUrl, body }) {
  try {
    const id = parseIdFromUrl(requestUrl);

    if (!id) {
      return {
        status: 400,
        payload: { error: "Thiếu ID phiếu nhập hợp lệ." },
      };
    }

    if (method === "PUT") {
      const unitPrice = normalizeUnitPrice(body?.unitPrice);
      const supplierId = normalizeSupplierId(body?.supplierId);
      const data = await updateStockInbound({ id, unitPrice, supplierId });
      invalidateInventoryOverviewCache();

      return {
        status: 200,
        payload: { data },
      };
    }

    if (method === "DELETE") {
      const data = await deleteStockInboundAndRollbackBalance(id);
      invalidateInventoryOverviewCache();

      return {
        status: 200,
        payload: { data },
      };
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
