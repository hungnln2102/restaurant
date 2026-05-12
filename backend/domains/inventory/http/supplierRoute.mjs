import { createSupplier, listSuppliers } from "../use-cases/manageSuppliers.mjs";

export async function handleSupplierRequest({ method, body }) {
  try {
    if (method === "GET") {
      const data = await listSuppliers();

      return {
        status: 200,
        payload: { data },
      };
    }

    if (method === "POST") {
      const data = await createSupplier(body);

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
