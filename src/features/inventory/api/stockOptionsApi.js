function parseDataPayload(payload) {
  if (!payload || typeof payload !== "object" || !Object.hasOwn(payload, "data")) {
    throw new Error("Phản hồi API danh mục kho không hợp lệ.");
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

export async function fetchInventorySuppliers() {
  const response = await fetch("/api/inventory/suppliers", {
    headers: {
      Accept: "application/json",
    },
  });

  const data = await parseApiResponse(response, "Không thể tải danh sách nhà cung ứng.");
  return Array.isArray(data) ? data : [];
}

export async function fetchInventoryProducts() {
  const response = await fetch("/api/inventory/stock-products", {
    headers: {
      Accept: "application/json",
    },
  });

  const data = await parseApiResponse(response, "Không thể tải danh sách sản phẩm kho.");
  return Array.isArray(data) ? data : [];
}
