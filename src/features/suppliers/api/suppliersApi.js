function parseDataPayload(payload) {
  if (!payload || typeof payload !== "object" || !Object.hasOwn(payload, "data")) {
    throw new Error("Phản hồi API nhà cung ứng không hợp lệ.");
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

export async function fetchSuppliers() {
  const response = await fetch("/api/inventory/suppliers", {
    headers: {
      Accept: "application/json",
    },
  });

  const data = await parseApiResponse(response, "Không thể tải danh sách nhà cung ứng.");
  return Array.isArray(data) ? data : [];
}

export async function createSupplier(input) {
  const response = await fetch("/api/inventory/suppliers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseApiResponse(response, "Không thể tạo nhà cung ứng.");
}
