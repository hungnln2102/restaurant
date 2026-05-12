function parseDataPayload(payload) {
  if (!payload || typeof payload !== "object" || !Object.hasOwn(payload, "data")) {
    throw new Error("Phản hồi API đơn hàng không hợp lệ.");
  }

  return payload.data;
}

async function parseApiResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || fallbackMessage);
  }

  return parseDataPayload(payload);
}

export async function fetchOrdersByMenuProduct(menuProductId) {
  const numericId = Number(menuProductId);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error("Mã sản phẩm không hợp lệ.");
  }

  const response = await fetch(
    `/api/inventory/product-orders?menuProductId=${encodeURIComponent(numericId)}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  const data = await parseApiResponse(
    response,
    "Không thể tải lịch sử đơn hàng.",
  );

  return Array.isArray(data) ? data : [];
}

function appendQueryParam(params, key, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  params.append(key, String(value));
}

// System-wide order list with optional filters. Returns the full envelope
// {items, total, limit, offset} so the caller can drive pagination.
export async function fetchAllOrders(filters = {}) {
  const params = new URLSearchParams();
  appendQueryParam(params, "orderType", filters.orderType);
  appendQueryParam(params, "fromDate", filters.fromDate);
  appendQueryParam(params, "toDate", filters.toDate);
  appendQueryParam(params, "search", filters.search);
  appendQueryParam(params, "limit", filters.limit);
  appendQueryParam(params, "offset", filters.offset);

  const querySuffix = params.toString();
  const url = querySuffix
    ? `/api/inventory/product-orders?${querySuffix}`
    : "/api/inventory/product-orders";

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  const data = await parseApiResponse(
    response,
    "Không thể tải danh sách đơn hàng.",
  );

  if (!data || typeof data !== "object") {
    return { items: [], total: 0, limit: 0, offset: 0 };
  }

  return {
    items: Array.isArray(data.items) ? data.items : [],
    total: Number.isFinite(Number(data.total)) ? Number(data.total) : 0,
    limit: Number.isFinite(Number(data.limit)) ? Number(data.limit) : 0,
    offset: Number.isFinite(Number(data.offset)) ? Number(data.offset) : 0,
  };
}

export async function createOrder(input) {
  const response = await fetch("/api/inventory/product-orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseApiResponse(response, "Không thể tạo đơn hàng.");
}
