import { query } from "../../../db/connection.mjs";
import { buildFifoPreviewContext } from "./fifoCostingService.mjs";

const queryRunner = { query: (text, params) => query(text, params) };

function mapMenuProduct(row) {
  return {
    id: Number(row.id),
    productName: row.product_name,
    productCategory: row.product_category,
    servingUnit: row.serving_unit,
    sellingPrice: Number(row.selling_price || 0),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCompositionRow(row, index, fifoContext) {
  const stockProductId = Number(row.stock_product_id);
  const quantity = Number(row.quantity || 0);
  const recipeUnit = row.component_unit;

  const preview = fifoContext.previewComponentCost({
    stockProductId,
    quantityNeeded: quantity,
    recipeUnit,
    productName: row.ingredient_name,
  });

  // Surface a price only when we actually have data: a zero cost paired with
  // an incomplete preview means there is no lot and no supplier fallback, so
  // the UI should render "—" instead of "0đ" to avoid implying free stock.
  const hasPriceSignal = preview.componentCost > 0 || !preview.previewIncomplete;
  const ingredientUnitPrice = hasPriceSignal ? preview.fifoCostPerUnit : null;

  return {
    id: Number(row.component_id),
    stt: index + 1,
    menuProductId: Number(row.menu_product_id),
    ingredientId: stockProductId,
    ingredientName: row.ingredient_name,
    ingredientCategory: row.ingredient_category,
    ingredientUnit: recipeUnit,
    ingredientUnitPrice,
    quantity,
    componentCost: preview.componentCost,
    componentCostPreviewIncomplete: preview.previewIncomplete,
    notes: row.notes,
  };
}

function computeCostPercent(totalCost, sellingPrice) {
  const safeSellingPrice = Number(sellingPrice || 0);

  if (safeSellingPrice <= 0) {
    return null;
  }

  return (Number(totalCost || 0) / safeSellingPrice) * 100;
}

const MENU_PRODUCTS_QUERY = `
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
`;

const ALL_COMPONENTS_QUERY = `
  select
    mpc.id as component_id,
    mpc.menu_product_id,
    sp.id as stock_product_id,
    sp.product_name as ingredient_name,
    sp.product_category as ingredient_category,
    mpc.unit as component_unit,
    mpc.quantity,
    mpc.notes
  from inventory.menu_product_components mpc
  join inventory.stock_products sp
    on sp.id = mpc.stock_product_id
  order by mpc.menu_product_id asc, mpc.sort_order asc, mpc.id asc
`;

export async function getProductPortioningOverview() {
  // Three independent reads that share the pool — fan out in parallel and
  // bail out early if there are no menu products to render.
  const [menuProductsResult, componentRowsResult, fifoContext] = await Promise.all([
    query(MENU_PRODUCTS_QUERY),
    query(ALL_COMPONENTS_QUERY),
    buildFifoPreviewContext(queryRunner),
  ]);

  const menuProducts = menuProductsResult.rows.map(mapMenuProduct);

  if (menuProducts.length === 0) {
    return { items: [] };
  }

  const componentsByMenuProduct = new Map();

  for (const componentRow of componentRowsResult.rows) {
    const menuProductId = Number(componentRow.menu_product_id);
    const currentList = componentsByMenuProduct.get(menuProductId) ?? [];
    currentList.push(componentRow);
    componentsByMenuProduct.set(menuProductId, currentList);
  }

  const items = menuProducts.map((menuProduct) => {
    const componentRowsForProduct = componentsByMenuProduct.get(menuProduct.id) ?? [];
    const mappedRows = componentRowsForProduct.map((row, index) =>
      mapCompositionRow(row, index, fifoContext),
    );
    const totalCost = mappedRows.reduce(
      (sum, row) => sum + Number(row.componentCost || 0),
      0,
    );
    const costPercent = computeCostPercent(totalCost, menuProduct.sellingPrice);
    const totalCostPreviewIncomplete = mappedRows.some(
      (row) => row.componentCostPreviewIncomplete,
    );

    return {
      ...menuProduct,
      totalCost,
      costPercent,
      totalCostPreviewIncomplete,
      rows: mappedRows,
    };
  });

  return { items };
}
