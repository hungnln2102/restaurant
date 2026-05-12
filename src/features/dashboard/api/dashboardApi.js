const ALLOWED_RANGE = new Set(["today", "7d", "30d"]);

function parseDataPayload(payload) {
  if (!payload || typeof payload !== "object" || !Object.hasOwn(payload, "data")) {
    throw new Error("Phản hồi API tổng quan không hợp lệ.");
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

export async function fetchDashboardOverview(range = "7d") {
  // Defensive normalization: any unexpected value still resolves to a valid
  // server-supported key so the UI cannot crash on an out-of-range argument.
  const safeRange = ALLOWED_RANGE.has(range) ? range : "7d";

  const url = `/api/dashboard/overview?range=${encodeURIComponent(safeRange)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  return parseApiResponse(response, "Không thể tải dữ liệu tổng quan.");
}
