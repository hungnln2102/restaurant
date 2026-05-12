async function parseResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Không thể tải danh sách lô nhập.");
  }

  return payload?.data ?? [];
}

export async function fetchStockLots(stockProductId) {
  if (!Number.isInteger(Number(stockProductId)) || Number(stockProductId) <= 0) {
    throw new Error("Thiếu ID nguyên liệu để tải danh sách lô.");
  }

  const response = await fetch(
    `/api/inventory/stock-products/${stockProductId}/lots`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const data = await parseResponse(response);
  return Array.isArray(data) ? data : [];
}
