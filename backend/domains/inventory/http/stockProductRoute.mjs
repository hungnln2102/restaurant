import { listStockProducts } from "../use-cases/listStockProducts.mjs";
import { createStockProduct } from "../use-cases/createStockProduct.mjs";

export async function handleStockProductRequest({ method, body }) {
  try {
    if (method === "GET") {
      const data = await listStockProducts();

      return {
        status: 200,
        payload: { data },
      };
    }

    if (method === "POST") {
      const data = await createStockProduct(body);

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
    if (error.code === '23505') { // Postgres Unique Violation
      return {
        status: 400,
        payload: { error: "Tên nguyên liệu này đã tồn tại trong kho." },
      };
    }
    return {
      status: error.statusCode || 500,
      payload: {
        error: error.message || "Unexpected server error.",
      },
    };
  }
}
