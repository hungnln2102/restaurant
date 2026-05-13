import vercelApiGateway from "./vercelApiGateway.mjs";

function normalizeRewrittenUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) {
    return "/api";
  }

  let parsed;
  try {
    parsed = new URL(rawUrl, "http://internal.local");
  } catch {
    return "/api";
  }

  const encodedPath = parsed.searchParams.get("__path");
  if (!encodedPath || encodedPath.trim().length === 0) {
    return parsed.pathname + parsed.search;
  }

  // Safety: avoid path traversal tokens in rewrite param.
  if (encodedPath.includes("..")) {
    return "/api";
  }

  parsed.searchParams.delete("__path");
  const suffix = encodedPath.startsWith("/") ? encodedPath : `/${encodedPath}`;
  const query = parsed.searchParams.toString();
  return `/api${suffix}${query ? `?${query}` : ""}`;
}

export default async function rewrittenApiEntry(req, res) {
  req.url = normalizeRewrittenUrl(req.url ?? "");
  return vercelApiGateway(req, res);
}
