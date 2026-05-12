function parseDataPayload(payload) {
  if (!payload || typeof payload !== "object" || !Object.hasOwn(payload, "data")) {
    throw new Error("Phản hồi API danh sách vận hành không hợp lệ.");
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

export async function fetchSalesPlans() {
  const response = await fetch("/api/inventory/product-sales-plans", {
    headers: {
      Accept: "application/json",
    },
  });

  const data = await parseApiResponse(
    response,
    "Không thể tải danh sách sản phẩm vận hành.",
  );

  return Array.isArray(data) ? data : [];
}

export async function createSalesPlan(input) {
  const response = await fetch("/api/inventory/product-sales-plans", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseApiResponse(response, "Không thể thêm sản phẩm vào vận hành.");
}

export async function updateSalesPlan(id, patch) {
  const response = await fetch(`/api/inventory/product-sales-plans/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(patch),
  });

  return parseApiResponse(response, "Không thể cập nhật sản phẩm vận hành.");
}

export async function deleteSalesPlan(id) {
  const response = await fetch(`/api/inventory/product-sales-plans/${id}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  return parseApiResponse(response, "Không thể xóa sản phẩm khỏi danh sách vận hành.");
}
