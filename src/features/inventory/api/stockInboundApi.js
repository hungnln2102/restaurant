async function parseResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Không thể xử lý yêu cầu phiếu nhập.");
  }

  return payload?.data ?? null;
}

export async function updateStockInbound({ id, unitPrice, supplierId }) {
  const response = await fetch(`/api/inventory/stock-inbounds/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ unitPrice, supplierId }),
  });

  return parseResponse(response);
}

export async function deleteStockInbound(id) {
  const response = await fetch(`/api/inventory/stock-inbounds/${id}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  return parseResponse(response);
}
