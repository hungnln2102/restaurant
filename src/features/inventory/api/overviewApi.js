function isOverviewDataShape(payload) {
  return (
    payload &&
    typeof payload === "object" &&
    Array.isArray(payload.stats) &&
    Array.isArray(payload.balances) &&
    Array.isArray(payload.timeline)
  );
}

function extractOverviewData(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (Object.hasOwn(payload, "data") && isOverviewDataShape(payload.data)) {
    return payload.data;
  }

  if (isOverviewDataShape(payload)) {
    return payload;
  }

  return null;
}

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Không thể tải dữ liệu tồn kho.");
  }

  const data = extractOverviewData(payload);

  if (!data) {
    throw new Error("Phản hồi API tổng quan kho không hợp lệ.");
  }

  return data;
}

export async function fetchInventoryOverview() {
  const response = await fetch("/api/inventory/overview", {
    headers: {
      Accept: "application/json",
    },
  });

  return parseApiResponse(response);
}
