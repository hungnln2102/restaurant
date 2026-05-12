import { listStockProducts } from "../use-cases/listStockProducts.mjs";

export async function handleStockProductRequest({ method }) {
  try {
    if (method === "GET") {
      const data = await listStockProducts();

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
