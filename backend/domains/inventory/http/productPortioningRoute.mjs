import { getProductPortioningOverview } from "../use-cases/getProductPortioningOverview.mjs";

export async function handleProductPortioningRequest({ method }) {
  try {
    if (method === "GET") {
      const data = await getProductPortioningOverview();

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
