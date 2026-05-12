function parseDataPayload(payload) {
  if (!payload || typeof payload !== "object" || !Object.hasOwn(payload, "data")) {
    throw new Error("Phản hồi API định lượng sản phẩm không hợp lệ.");
  }

  return payload.data;
}

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Không thể tải dữ liệu định lượng sản phẩm.");
  }

  return parseDataPayload(payload);
}

export async function fetchProductPortioning() {
  const response = await fetch("/api/inventory/product-portioning", {
    headers: {
      Accept: "application/json",
    },
  });

  return parseApiResponse(response);
}
