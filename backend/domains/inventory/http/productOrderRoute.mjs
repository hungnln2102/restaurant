import {
  createOrder,
  listAllOrders,
  listOrders,
} from "../use-cases/manageProductOrders.mjs";

function parseQueryParams(requestUrl = "") {
  const queryStart = requestUrl.indexOf("?");

  if (queryStart === -1) {
    return new URLSearchParams();
  }

  return new URLSearchParams(requestUrl.slice(queryStart + 1));
}

function readQueryString(params, key) {
  const raw = params.get(key);
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }
  return raw;
}

export async function handleProductOrderRequest({ method, requestUrl, body }) {
  try {
    if (method === "GET") {
      const params = parseQueryParams(requestUrl);
      const menuProductIdParam = readQueryString(params, "menuProductId");

      // Backwards-compatible: GET ?menuProductId=... still returns the
      // per-product order list ProductOrdersModal already consumes.
      if (menuProductIdParam !== null) {
        const data = await listOrders(menuProductIdParam);
        return {
          status: 200,
          payload: { data },
        };
      }

      // Without menuProductId we serve the system-wide orders list with
      // optional filters used by the new "Đơn hàng" page.
      const filters = {
        orderType: readQueryString(params, "orderType"),
        fromDate: readQueryString(params, "fromDate"),
        toDate: readQueryString(params, "toDate"),
        search: readQueryString(params, "search"),
        limit: readQueryString(params, "limit"),
        offset: readQueryString(params, "offset"),
      };

      const data = await listAllOrders(filters);

      return {
        status: 200,
        payload: { data },
      };
    }

    if (method === "POST") {
      const data = await createOrder(body || {});

      return {
        status: 201,
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
