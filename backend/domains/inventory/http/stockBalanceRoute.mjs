import {
  deleteStockBalance,
  updateStockBalance,
} from "../repositories/stockBalanceRepository.mjs";
import { submitInventoryCheck } from "../use-cases/submitInventoryCheck.mjs";
import { syncInventoryData } from "../use-cases/syncInventoryData.mjs";
import { invalidateAfterBalanceChange } from "../../../shared/cacheInvalidation.mjs";

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

function normalizeQuantity(value) {
  if (value === undefined || value === null || value === "") {
    throw badRequest("Tồn kho không hợp lệ.");
  }

  const normalized = Number(value);

  if (!Number.isFinite(normalized) || normalized < 0) {
    throw badRequest("Tồn kho phải lớn hơn hoặc bằng 0.");
  }

  return normalized;
}

export async function handleStockBalanceRequest({ method, requestUrl, body }) {
  try {
    if (method === "POST" && requestUrl && requestUrl.includes("/bulk-check")) {
      const data = await submitInventoryCheck(body);
      return { status: 200, payload: { data } };
    }

    if (method === "POST" && requestUrl && requestUrl.includes("/sync")) {
      const data = await syncInventoryData();
      return { status: 200, payload: { data } };
    }

    const id = parseIdFromUrl(requestUrl);

    if (!id) {
      return {
        status: 400,
        payload: { error: "Thiếu ID dòng tồn kho hợp lệ." },
      };
    }

    if (method === "PUT") {
      const onHandQuantity = normalizeQuantity(body?.onHandQuantity);
      const data = await updateStockBalance({ id, onHandQuantity });
      invalidateAfterBalanceChange();

      return {
        status: 200,
        payload: { data },
      };
    }

    if (method === "DELETE") {
      const data = await deleteStockBalance(id);
      invalidateAfterBalanceChange();

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
