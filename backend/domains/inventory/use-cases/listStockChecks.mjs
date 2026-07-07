import { query } from "../../../db/connection.mjs";

export async function listStockChecks() {
  const result = await query(`
    select
      sc.id,
      sc.check_code as "checkCode",
      sc.status,
      sc.notes,
      sc.created_at as "createdAt",
      sc.updated_at as "updatedAt",
      count(sci.id) as "itemCount",
      sum(sci.variance_quantity) as "totalVariance"
    from inventory.stock_checks sc
    left join inventory.stock_check_items sci on sci.check_id = sc.id
    group by sc.id
    order by sc.created_at desc
    limit 100
  `);
  
  return result.rows.map(row => ({
    id: Number(row.id),
    checkCode: row.checkCode,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    itemCount: Number(row.itemCount || 0),
    totalVariance: Number(row.totalVariance || 0)
  }));
}

export async function getStockCheckItems(checkId) {
  const result = await query(`
    select
      sci.id,
      sp.product_name as "productName",
      sci.system_quantity as "systemQuantity",
      sci.actual_quantity as "actualQuantity",
      sci.variance_quantity as "varianceQuantity",
      sci.unit
    from inventory.stock_check_items sci
    join inventory.stock_products sp on sp.id = sci.stock_product_id
    where sci.check_id = $1
    order by sp.product_name asc
  `, [checkId]);
  
  return result.rows.map(row => ({
    id: Number(row.id),
    productName: row.productName,
    systemQuantity: Number(row.systemQuantity),
    actualQuantity: Number(row.actualQuantity),
    varianceQuantity: Number(row.varianceQuantity),
    unit: row.unit
  }));
}
