import { query } from "../../../db/connection.mjs";

function mapStockProductRow(row) {
  return {
    id: Number(row.id),
    productName: row.product_name,
    productCategory: row.product_category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listStockProducts() {
  const result = await query(`
    select
      id,
      product_name,
      product_category,
      created_at,
      updated_at
    from inventory.stock_products
    order by product_name asc
    limit 300
  `);

  return result.rows.map(mapStockProductRow);
}
