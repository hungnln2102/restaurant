function parseDataPayload(payload) {
  if (!payload || typeof payload !== "object" || !Object.hasOwn(payload, "data")) {
    throw new Error("Phản hồi API sản phẩm không hợp lệ.");
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

function buildItemUrl(id) {
  // Coerce + clamp the id so a stray non-integer never becomes part of a URL
  // path segment (which the server treats as 404 anyway, but failing fast on
  // the client surfaces a clearer error to the modal).
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error("ID sản phẩm không hợp lệ.");
  }

  return `/api/inventory/menu-products/${numericId}`;
}

export async function fetchMenuProducts() {
  const response = await fetch("/api/inventory/menu-products", {
    headers: {
      Accept: "application/json",
    },
  });

  const data = await parseApiResponse(response, "Không thể tải danh sách sản phẩm.");
  return Array.isArray(data) ? data : [];
}

export async function createMenuProduct(input) {
  const response = await fetch("/api/inventory/menu-products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseApiResponse(response, "Không thể tạo sản phẩm mới.");
}

export async function fetchMenuProductById(id) {
  const response = await fetch(buildItemUrl(id), {
    headers: {
      Accept: "application/json",
    },
  });

  return parseApiResponse(response, "Không thể tải chi tiết sản phẩm.");
}

export async function updateMenuProduct(id, payload) {
  const response = await fetch(buildItemUrl(id), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseApiResponse(response, "Không thể cập nhật sản phẩm.");
}

export async function deleteMenuProduct(id) {
  const response = await fetch(buildItemUrl(id), {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  return parseApiResponse(response, "Không thể xóa sản phẩm.");
}
