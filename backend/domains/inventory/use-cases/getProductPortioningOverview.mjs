import { getProductPortioningOverview as getOverviewFromRepository } from "../repositories/productPortioningRepository.mjs";
import { withCache } from "../../../shared/cache.mjs";

const CACHE_KEY = "portioning:overview:v1";
const CACHE_TTL_MS = 15_000;

export async function getProductPortioningOverview() {
  return withCache(CACHE_KEY, CACHE_TTL_MS, () => getOverviewFromRepository());
}
