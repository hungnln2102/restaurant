import { getDashboardOverview as getDashboardOverviewFromRepository } from "../repositories/dashboardRepository.mjs";

const RANGE_TO_DAYS = {
  today: 1,
  "7d": 7,
  "30d": 30,
};

const DEFAULT_RANGE_KEY = "7d";

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function resolveRangeDays(rawRange) {
  if (rawRange === undefined || rawRange === null || rawRange === "") {
    return RANGE_TO_DAYS[DEFAULT_RANGE_KEY];
  }

  const normalized = String(rawRange).trim().toLowerCase();
  const days = RANGE_TO_DAYS[normalized];

  if (!days) {
    throw badRequest(
      "Khoảng thời gian không hợp lệ. Chỉ hỗ trợ today, 7d hoặc 30d.",
    );
  }

  return days;
}

export async function getDashboardOverview({ range } = {}) {
  const rangeDays = resolveRangeDays(range);
  return getDashboardOverviewFromRepository({ rangeDays });
}
