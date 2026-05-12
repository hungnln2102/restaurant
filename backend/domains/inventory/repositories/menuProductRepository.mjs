import { query, withTransaction } from "../../../db/connection.mjs";

function mapMenuProductRow(row) {
  return {
    id: Number(row.id),
    productName: row.product_name,
    productCategory: row.product_category,
    servingUnit: row.serving_unit,
    sellingPrice:
      row.selling_price === null || row.selling_price === undefined
        ? null
        : Number(row.selling_price),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapComponentRow(row) {
  const quantity = Number(row.quantity);
  const rawUnitPrice =
    row.ingredient_unit_price === null || row.ingredient_unit_price === undefined
      ? null
      : Number(row.ingredient_unit_price);
  // Components inserted by createMenuProduct/updateMenuProduct go through the
  // same fetch helper, so we tolerate the absence of the price/category
  // columns and only expose the derived cost when both inputs are available.
  const componentCost =
    rawUnitPrice === null || !Number.isFinite(quantity)
      ? null
      : quantity * rawUnitPrice;

  return {
    id: Number(row.id),
    menuProductId: Number(row.menu_product_id),
    stockProductId: Number(row.stock_product_id),
    stockProductName: row.stock_product_name,
    stockUnit: row.stock_unit ?? null,
    ingredientCategory: row.ingredient_category ?? null,
    quantity,
    unit: row.unit,
    sortOrder: Number(row.sort_order),
    notes: row.notes,
    ingredientUnitPrice: rawUnitPrice,
    componentCost,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildDuplicateNameError() {
  const error = new Error("Tên sản phẩm đã tồn tại.");
  error.statusCode = 409;
  return error;
}

function buildDuplicateComponentError() {
  const error = new Error("Một nguyên liệu chỉ được khai báo một lần.");
  error.statusCode = 400;
  return error;
}

function buildMissingStockProductError() {
  const error = new Error("Nguyên liệu được chọn không tồn tại trong kho.");
  error.statusCode = 400;
  return error;
}

function buildNotFoundError() {
  const error = new Error("Không tìm thấy sản phẩm.");
  error.statusCode = 404;
  return error;
}

function buildHasReferencesError() {
  // Reserved for the case where a future FK no longer cascades; if any
  // referencing row blocks deletion we surface a clear 409 to the UI.
  const error = new Error(
    "Không thể xóa: sản phẩm đang có đơn hàng hoặc dữ liệu liên kết.",
  );
  error.statusCode = 409;
  return error;
}

function isMenuProductNameConstraint(error) {
  // Postgres reports the violated constraint name. The unique index on
  // inventory.menu_products(product_name) is the default
  // "menu_products_product_name_key", but we also fall back to a detail
  // sniff so re-creating the table with a custom name keeps working.
  const constraint = typeof error?.constraint === "string" ? error.constraint : "";

  if (constraint && constraint.toLowerCase().includes("product_name")) {
    return true;
  }

  const detail = typeof error?.detail === "string" ? error.detail.toLowerCase() : "";
  return detail.includes("(product_name)");
}

function isComponentUniqueConstraint(error) {
  const constraint = typeof error?.constraint === "string" ? error.constraint : "";

  if (constraint && constraint.toLowerCase().includes("menu_product_components")) {
    return true;
  }

  const detail = typeof error?.detail === "string" ? error.detail.toLowerCase() : "";
  return detail.includes("(menu_product_id, stock_product_id)");
}

function isMissingStockProductForeignKey(error) {
  const constraint = typeof error?.constraint === "string" ? error.constraint : "";

  if (constraint && constraint.toLowerCase().includes("stock_product_id")) {
    return true;
  }

  const detail = typeof error?.detail === "string" ? error.detail.toLowerCase() : "";
  return detail.includes("stock_product_id");
}

export async function listMenuProducts() {
  const result = await query(
    `
      select
        id,
        product_name,
        product_category,
        serving_unit,
        selling_price,
        status,
        created_at,
        updated_at
      from inventory.menu_products
      order by product_name asc
    `,
  );

  return result.rows.map(mapMenuProductRow);
}

async function insertMenuProductRow(client, payload) {
  const insertResult = await client.query(
    `
      insert into inventory.menu_products (
        product_name,
        product_category,
        serving_unit,
        selling_price,
        status
      )
      values ($1, $2, $3, $4, $5)
      returning
        id,
        product_name,
        product_category,
        serving_unit,
        selling_price,
        status,
        created_at,
        updated_at
    `,
    [
      payload.productName,
      payload.productCategory,
      payload.servingUnit,
      payload.sellingPrice === null ? 0 : payload.sellingPrice,
      payload.status,
    ],
  );

  return insertResult.rows[0];
}

async function insertMenuProductComponents(client, menuProductId, components) {
  if (!Array.isArray(components) || components.length === 0) {
    return [];
  }

  const insertedRows = [];

  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    const sortOrder = Number.isFinite(component.sortOrder)
      ? Number(component.sortOrder)
      : index;

    const inserted = await client.query(
      `
        insert into inventory.menu_product_components (
          menu_product_id,
          stock_product_id,
          quantity,
          unit,
          sort_order,
          notes
        )
        values ($1, $2, $3, $4, $5, $6)
        returning
          id,
          menu_product_id,
          stock_product_id,
          quantity,
          unit,
          sort_order,
          notes,
          created_at,
          updated_at
      `,
      [
        menuProductId,
        component.stockProductId,
        component.quantity,
        component.unit,
        sortOrder,
        component.notes ?? null,
      ],
    );

    insertedRows.push(inserted.rows[0]);
  }

  return insertedRows;
}

async function fetchComponentsWithNames(client, menuProductId) {
  // The lateral price subquery mirrors the one in productPortioningRepository
  // so the View modal sees the exact same unit price the overview table uses.
  const result = await client.query(
    `
      select
        mpc.id,
        mpc.menu_product_id,
        mpc.stock_product_id,
        sp.product_name as stock_product_name,
        sp.product_category as ingredient_category,
        sb.on_hand_unit as stock_unit,
        mpc.quantity,
        mpc.unit,
        mpc.sort_order,
        mpc.notes,
        mpc.created_at,
        mpc.updated_at,
        price.unit_price as ingredient_unit_price
      from inventory.menu_product_components mpc
      join inventory.stock_products sp on sp.id = mpc.stock_product_id
      left join inventory.stock_balances sb on sb.stock_product_id = sp.id
      left join lateral (
        select unit_price
        from inventory.supplier_products
        where stock_product_id = sp.id
        order by is_preferred desc, updated_at desc
        limit 1
      ) price on true
      where mpc.menu_product_id = $1
      order by mpc.sort_order asc, mpc.id asc
    `,
    [menuProductId],
  );

  return result.rows.map(mapComponentRow);
}

async function fetchMenuProductRowById(client, id) {
  const result = await client.query(
    `
      select
        id,
        product_name,
        product_category,
        serving_unit,
        selling_price,
        status,
        created_at,
        updated_at
      from inventory.menu_products
      where id = $1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function createMenuProduct(input) {
  const {
    productName,
    productCategory,
    servingUnit,
    sellingPrice,
    status,
    components = [],
  } = input;

  try {
    return await withTransaction(async (client) => {
      const menuProductRow = await insertMenuProductRow(client, {
        productName,
        productCategory,
        servingUnit,
        sellingPrice,
        status,
      });

      const menuProductId = Number(menuProductRow.id);

      await insertMenuProductComponents(client, menuProductId, components);

      const componentRows =
        components.length > 0 ? await fetchComponentsWithNames(client, menuProductId) : [];

      return {
        ...mapMenuProductRow(menuProductRow),
        components: componentRows,
      };
    });
  } catch (error) {
    if (error && error.code === "23505") {
      if (isComponentUniqueConstraint(error)) {
        throw buildDuplicateComponentError();
      }

      if (isMenuProductNameConstraint(error)) {
        throw buildDuplicateNameError();
      }

      throw buildDuplicateNameError();
    }

    if (error && error.code === "23503" && isMissingStockProductForeignKey(error)) {
      throw buildMissingStockProductError();
    }

    throw error;
  }
}

function computeTotalsFromComponents(components, sellingPrice) {
  // null + non-null components are mixed when an ingredient has no supplier
  // price yet — only count rows where componentCost is a real number so the
  // total never silently treats "no price" as 0.
  let totalCost = 0;
  let hasMissingPrice = false;

  for (const component of components) {
    if (component.componentCost === null || component.componentCost === undefined) {
      hasMissingPrice = true;
      continue;
    }
    totalCost += Number(component.componentCost);
  }

  const safeSellingPrice = Number(sellingPrice || 0);
  const costPercent =
    safeSellingPrice > 0 ? (totalCost / safeSellingPrice) * 100 : null;

  return { totalCost, costPercent, hasMissingPrice };
}

export async function getMenuProductById(id) {
  // Use a single connection so the row + components fetch is a consistent
  // snapshot even if another worker edits the components in parallel.
  return withTransaction(async (client) => {
    const row = await fetchMenuProductRowById(client, id);

    if (!row) {
      throw buildNotFoundError();
    }

    const components = await fetchComponentsWithNames(client, Number(row.id));
    const mapped = mapMenuProductRow(row);
    const { totalCost, costPercent, hasMissingPrice } = computeTotalsFromComponents(
      components,
      mapped.sellingPrice,
    );

    return {
      ...mapped,
      components,
      totalCost,
      costPercent,
      hasMissingPrice,
    };
  });
}

export async function updateMenuProduct(input) {
  const {
    id,
    productName,
    productCategory,
    servingUnit,
    sellingPrice,
    status,
    components = [],
  } = input;

  try {
    return await withTransaction(async (client) => {
      const existingRow = await fetchMenuProductRowById(client, id);

      if (!existingRow) {
        throw buildNotFoundError();
      }

      const updateResult = await client.query(
        `
          update inventory.menu_products
          set
            product_name = $2,
            product_category = $3,
            serving_unit = $4,
            selling_price = $5,
            status = $6,
            updated_at = now()
          where id = $1
          returning
            id,
            product_name,
            product_category,
            serving_unit,
            selling_price,
            status,
            created_at,
            updated_at
        `,
        [
          id,
          productName,
          productCategory,
          servingUnit,
          sellingPrice === null ? 0 : sellingPrice,
          status,
        ],
      );

      const updatedRow = updateResult.rows[0];

      // Replace the entire components set inside the same transaction so a
      // failure on insert rolls back the delete and leaves the recipe intact.
      await client.query(
        `delete from inventory.menu_product_components where menu_product_id = $1`,
        [id],
      );

      await insertMenuProductComponents(client, Number(id), components);

      const componentRows =
        components.length > 0 ? await fetchComponentsWithNames(client, Number(id)) : [];

      return {
        ...mapMenuProductRow(updatedRow),
        components: componentRows,
      };
    });
  } catch (error) {
    if (error && error.code === "23505") {
      if (isComponentUniqueConstraint(error)) {
        throw buildDuplicateComponentError();
      }

      if (isMenuProductNameConstraint(error)) {
        throw buildDuplicateNameError();
      }

      throw buildDuplicateNameError();
    }

    if (error && error.code === "23503" && isMissingStockProductForeignKey(error)) {
      throw buildMissingStockProductError();
    }

    throw error;
  }
}

export async function deleteMenuProduct(id) {
  try {
    const result = await query(
      `
        delete from inventory.menu_products
        where id = $1
        returning id
      `,
      [id],
    );

    if (result.rowCount === 0) {
      throw buildNotFoundError();
    }

    return { id: Number(result.rows[0].id) };
  } catch (error) {
    // The schema cascades menu_product_components, product_sales_plans and
    // product_orders, so in normal operation this branch should not fire.
    // We still translate any future FK violation into a clear 409 so the UI
    // can surface it instead of leaking a raw 500.
    if (error && error.code === "23503") {
      throw buildHasReferencesError();
    }

    throw error;
  }
}
