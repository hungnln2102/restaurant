import { query, withTransaction } from "../../../db/connection.mjs";
import crypto from "crypto";

export async function listTables() {
  const result = await query(`
    select 
      t.id, 
      t.table_name, 
      t.status, 
      t.qr_token,
      ts.id as current_session_id,
      ts.total_amount
    from sales.tables t
    left join sales.table_sessions ts on ts.table_id = t.id and ts.status = 'active'
    order by t.table_name asc
  `);
  
  return result.rows.map(row => ({
    id: Number(row.id),
    tableName: row.table_name,
    status: row.status,
    qrToken: row.qr_token,
    currentSessionId: row.current_session_id ? Number(row.current_session_id) : null,
    totalAmount: Number(row.total_amount || 0)
  }));
}

export async function createTable({ tableName }) {
  const token = crypto.randomBytes(8).toString("hex");
  const result = await query(
    `insert into sales.tables (table_name, qr_token) values ($1, $2) returning id, table_name, status, qr_token`,
    [tableName, token]
  );
  return result.rows[0];
}

export async function getTableDetails(tableId) {
  const result = await query(`
    select id, table_name, status, qr_token 
    from sales.tables 
    where id = $1
  `, [tableId]);
  
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

export async function createTableSession(tableId) {
  return withTransaction(async (client) => {
    // Check if table is available
    const tableRes = await client.query(`select status from sales.tables where id = $1 for update`, [tableId]);
    if (tableRes.rows.length === 0) throw new Error("Bàn không tồn tại.");
    if (tableRes.rows[0].status === 'occupied') throw new Error("Bàn đang có khách.");

    // Update table status
    await client.query(`update sales.tables set status = 'occupied' where id = $1`, [tableId]);

    // Create session
    const sessionRes = await client.query(
      `insert into sales.table_sessions (table_id) values ($1) returning id`,
      [tableId]
    );

    return sessionRes.rows[0];
  });
}

export async function addTableOrder(sessionId, menuProductId, quantity) {
  // In a real app we'd fetch the unit_price from menu_products, let's do that
  const result = await query(
    `
    with product_price as (
      select selling_price from inventory.menu_products where id = $2
    )
    insert into sales.table_orders (session_id, menu_product_id, quantity, unit_price)
    select $1, $2, $3, selling_price from product_price
    returning id, quantity, unit_price, total_amount
    `,
    [sessionId, menuProductId, quantity]
  );

  // Update total_amount in session
  await query(`
    update sales.table_sessions 
    set total_amount = total_amount + $1 
    where id = $2
  `, [result.rows[0].total_amount, sessionId]);

  return result.rows[0];
}

export async function getTableOrders(sessionId) {
  const result = await query(`
    select o.id, o.menu_product_id, p.product_name, o.quantity, o.unit_price, o.total_amount, o.status
    from sales.table_orders o
    join inventory.menu_products p on p.id = o.menu_product_id
    where o.session_id = $1
    order by o.created_at desc
  `, [sessionId]);

  return result.rows.map(row => ({
    id: Number(row.id),
    menuProductId: Number(row.menu_product_id),
    productName: row.product_name,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    totalAmount: Number(row.total_amount),
    status: row.status
  }));
}

export async function checkoutTableSession(sessionId, tableId) {
  return withTransaction(async (client) => {
    const sessionRes = await client.query(`
      update sales.table_sessions 
      set status = 'paid', ended_at = now() 
      where id = $1 and status = 'active'
      returning total_amount
    `, [sessionId]);

    if (sessionRes.rows.length === 0) throw new Error("Phiên không hợp lệ hoặc đã thanh toán.");

    await client.query(`update sales.tables set status = 'available' where id = $1`, [tableId]);

    return { totalAmount: Number(sessionRes.rows[0].total_amount) };
  });
}
