import { listPortioningRules as listPortioningRulesFromRepository } from "../repositories/portioningRepository.mjs";

export async function listPortioningRules() {
  return listPortioningRulesFromRepository();
}
