const OVERVIEW_CACHE_TTL_MS = 5_000;

let overviewCache = null;
let overviewInFlight = null;

function normalizeApiErrorMessage(raw) {
  if (raw === undefined || raw === null) {
    return "";
  }
  if (typeof raw === "string") {
    return raw.trim();
  }
  if (typeof raw === "object") {
    const nested =
      typeof raw.message === "string"
        ? raw.message
        : typeof raw.error === "string"
          ? raw.error
          : "";
    if (nested.trim()) {
      return nested.trim();
    }
    try {
      return JSON.stringify(raw);
    } catch {
      return "";
    }
  }
  return String(raw);
}

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
    const message =
      normalizeApiErrorMessage(payload?.error) || "Không thể tải dữ liệu tồn kho.";
    throw new Error(message);
  }

  const data = extractOverviewData(payload);

  if (!data) {
    throw new Error("Phản hồi API tổng quan kho không hợp lệ.");
  }

  return data;
}

export async function fetchInventoryOverview({ force = false } = {}) {
  const now = Date.now();

  if (!force && overviewCache && now - overviewCache.createdAt < OVERVIEW_CACHE_TTL_MS) {
    return overviewCache.data;
  }

  if (!force && overviewInFlight) {
    return overviewInFlight;
  }

  overviewInFlight = fetch("/api/inventory/overview", {
    headers: {
      Accept: "application/json",
    },
  })
    .then(parseApiResponse)
    .then((data) => {
      overviewCache = {
        data,
        createdAt: Date.now(),
      };
      return data;
    })
    .finally(() => {
      overviewInFlight = null;
    });

  return overviewInFlight;
}
