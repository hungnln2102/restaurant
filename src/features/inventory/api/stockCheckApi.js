async function parseResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Không thể xử lý yêu cầu.");
  }

  return payload?.data ?? null;
}

export async function listStockChecks() {
  const response = await fetch("/api/inventory/stock-checks", {
    headers: { Accept: "application/json" }
  });
  return parseResponse(response);
}

export async function getStockCheckItems(checkId) {
  const response = await fetch(`/api/inventory/stock-checks/${checkId}/items`, {
    headers: { Accept: "application/json" }
  });
  return parseResponse(response);
}
