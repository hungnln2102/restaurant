async function parseResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Không thể xử lý yêu cầu tồn kho.");
  }

  return payload?.data ?? null;
}

export async function updateStockBalance({ id, onHandQuantity }) {
  const response = await fetch(`/api/inventory/stock-balances/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ onHandQuantity }),
  });

  return parseResponse(response);
}

export async function deleteStockBalance(id) {
  const response = await fetch(`/api/inventory/stock-balances/${id}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  return parseResponse(response);
}
