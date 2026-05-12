import { getProductPortioningOverview as getOverviewFromRepository } from "../repositories/productPortioningRepository.mjs";

export async function getProductPortioningOverview() {
  return getOverviewFromRepository();
}
