function isValidApiPayload(payload) {
  return payload && typeof payload === "object" && Object.hasOwn(payload, "data");
}

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Không thể xử lý yêu cầu định lượng.");
  }

  if (!isValidApiPayload(payload)) {
    throw new Error("Phản hồi API định lượng không hợp lệ.");
  }

  return payload.data;
}

export async function fetchPortioningRules() {
  const response = await fetch("/api/inventory/portioning", {
    headers: {
      Accept: "application/json",
    },
  });

  return parseApiResponse(response);
}

export async function createPortioningRule(input) {
  const response = await fetch("/api/inventory/portioning", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseApiResponse(response);
}

export async function updatePortioningRule(input) {
  const response = await fetch("/api/inventory/portioning", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseApiResponse(response);
}
