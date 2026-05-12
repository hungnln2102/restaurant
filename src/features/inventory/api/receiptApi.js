function isValidApiPayload(payload) {
  return payload && typeof payload === "object" && Object.hasOwn(payload, "data");
}

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Không thể lưu phiếu nhập kho.");
  }

  if (!isValidApiPayload(payload)) {
    throw new Error("Phản hồi API phiếu nhập kho không hợp lệ.");
  }

  return payload.data;
}

export async function createInventoryReceipt(input) {
  const response = await fetch("/api/inventory/stock-receipts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseApiResponse(response);
}
