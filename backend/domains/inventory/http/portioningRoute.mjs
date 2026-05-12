import { createPortioningRule } from "../use-cases/createPortioningRule.mjs";
import { listPortioningRules } from "../use-cases/listPortioningRules.mjs";
import { updatePortioningRule } from "../use-cases/updatePortioningRule.mjs";
import { readJsonBody, sendJson } from "./httpUtils.mjs";

export async function handlePortioningRequest({ method, body }) {
  try {
    if (method === "GET") {
      const data = await listPortioningRules();

      return {
        status: 200,
        payload: { data },
      };
    }

    if (method === "POST") {
      const data = await createPortioningRule(body);

      return {
        status: 201,
        payload: { data },
      };
    }

    if (method === "PUT") {
      const data = await updatePortioningRule(body);

      return {
        status: 200,
        payload: { data },
      };
    }

    return {
      status: 405,
      payload: { error: "Method not allowed." },
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

export { readJsonBody, sendJson };
