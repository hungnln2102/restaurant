import {
  createSalesPlan,
  deleteSalesPlan,
  listSalesPlans,
  updateSalesPlan,
} from "../use-cases/manageProductSalesPlans.mjs";

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

function hasIdSegment(requestUrl = "") {
  const pathname = requestUrl.split("?")[0];
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed !== "/api/inventory/product-sales-plans";
}

export async function handleProductSalesPlanRequest({ method, requestUrl, body }) {
  try {
    if (method === "GET") {
      const data = await listSalesPlans();
      return {
        status: 200,
        payload: { data },
      };
    }

    if (method === "POST") {
      const data = await createSalesPlan(body);
      return {
        status: 201,
        payload: { data },
      };
    }

    if (method === "PUT" || method === "DELETE") {
      if (!hasIdSegment(requestUrl)) {
        return {
          status: 400,
          payload: { error: "Thiếu ID sản phẩm vận hành." },
        };
      }

      const id = parseIdFromUrl(requestUrl);

      if (!id) {
        return {
          status: 400,
          payload: { error: "ID sản phẩm vận hành không hợp lệ." },
        };
      }

      if (method === "PUT") {
        const data = await updateSalesPlan(id, body || {});
        return {
          status: 200,
          payload: { data },
        };
      }

      const data = await deleteSalesPlan(id);
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
