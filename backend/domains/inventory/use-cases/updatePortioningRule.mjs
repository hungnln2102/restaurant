import { updatePortioningRule as updatePortioningRuleInRepository } from "../repositories/portioningRepository.mjs";
import { validatePortioningPayload } from "./createPortioningRule.mjs";
import { invalidateAfterPortioningRuleChange } from "../../../shared/cacheInvalidation.mjs";

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export async function updatePortioningRule(input) {
  const id = Number(input?.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest("ID quy đổi không hợp lệ.");
  }

  const payload = validatePortioningPayload(input);

  const result = await updatePortioningRuleInRepository({
    id,
    ...payload,
  });
  invalidateAfterPortioningRuleChange();
  return result;
}
