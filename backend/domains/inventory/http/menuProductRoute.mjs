import {
  createMenuProduct,
  deleteMenuProduct,
  getMenuProductById,
  listMenuProducts,
  updateMenuProduct,
} from "../use-cases/manageMenuProducts.mjs";

const COLLECTION_PATH = "/api/inventory/menu-products";

function parseIdFromUrl(requestUrl = "") {
  // The middleware in vite.config routes anything matching the
  // `/api/inventory/menu-products` prefix here, so the trailing segment can
  // be either empty (collection request) or a numeric id.
  const pathname = requestUrl.split("?")[0] || "";

  if (pathname === COLLECTION_PATH || pathname === `${COLLECTION_PATH}/`) {
    return null;
  }

  if (!pathname.startsWith(`${COLLECTION_PATH}/`)) {
    return null;
  }

  const remainder = pathname.slice(`${COLLECTION_PATH}/`.length);
  const idSegment = remainder.split("/")[0];

  if (!idSegment) {
    return null;
  }

  const parsed = Number(idSegment);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function handleMenuProductRequest({ method, requestUrl = "", body }) {
  try {
    const id = parseIdFromUrl(requestUrl);

    if (id === null) {
      // Collection-level requests: list + create.
      if (method === "GET") {
        const data = await listMenuProducts();

        return {
          status: 200,
          payload: { data },
        };
      }

      if (method === "POST") {
        const data = await createMenuProduct(body);

        return {
          status: 201,
          payload: { data },
        };
      }

      return {
        status: 405,
        payload: { error: "Method not allowed." },
      };
    }

    // Item-level requests: get one, update, delete.
    if (method === "GET") {
      const data = await getMenuProductById(id);

      return {
        status: 200,
        payload: { data },
      };
    }

    if (method === "PUT") {
      const data = await updateMenuProduct({ ...(body ?? {}), id });

      return {
        status: 200,
        payload: { data },
      };
    }

    if (method === "DELETE") {
      const data = await deleteMenuProduct(id);

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
