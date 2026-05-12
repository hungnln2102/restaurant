import { createStockReceipt } from "../use-cases/createStockReceipt.mjs";

export async function handleStockReceiptRequest({ method, body }) {
  try {
    if (method === "POST") {
      const data = await createStockReceipt(body);

      return {
        status: 201,
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
