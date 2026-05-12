import { getDashboardOverview } from "../use-cases/getDashboardOverview.mjs";

function parseRangeFromUrl(requestUrl) {
  if (typeof requestUrl !== "string" || requestUrl.length === 0) {
    return undefined;
  }

  // requestUrl arrives as a path+query like "/api/dashboard/overview?range=7d".
  // We use a dummy origin to lean on the URL constructor for query parsing
  // instead of regex (handles encoding edge cases for free).
  let parsed;
  try {
    parsed = new URL(requestUrl, "http://internal.local");
  } catch {
    return undefined;
  }

  const range = parsed.searchParams.get("range");
  return range === null ? undefined : range;
}

export async function handleDashboardOverviewRequest({ method, requestUrl }) {
  try {
    if (method !== "GET") {
      return {
        status: 405,
        payload: { error: "Method not allowed." },
      };
    }

    const range = parseRangeFromUrl(requestUrl);
    const data = await getDashboardOverview({ range });

    return {
      status: 200,
      payload: { data },
    };
  } catch (error) {
    return {
      status: error.statusCode || 500,
      payload: {
        error: error.message || "Unexpected server error.",
      },
    };
  }
}
