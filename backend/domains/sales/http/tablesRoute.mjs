import { 
  listTables, 
  createTable, 
  getTableDetails, 
  createTableSession, 
  addTableOrder, 
  getTableOrders, 
  checkoutTableSession 
} from "../repositories/tablesRepository.mjs";

function badRequest(msg) {
  const err = new Error(msg);
  err.statusCode = 400;
  return err;
}

export async function handleTablesRequest({ method, requestUrl, body }) {
  try {
    // Basic routing
    if (method === "GET" && requestUrl.endsWith("/api/sales/tables")) {
      const tables = await listTables();
      return { status: 200, payload: { data: tables } };
    }
    
    if (method === "POST" && requestUrl.endsWith("/api/sales/tables")) {
      if (!body.tableName) throw badRequest("Tên bàn là bắt buộc");
      const newTable = await createTable({ tableName: body.tableName });
      return { status: 200, payload: { data: newTable } };
    }

    // Match /api/sales/tables/:id/session
    const sessionMatch = requestUrl.match(/\/api\/sales\/tables\/(\d+)\/session$/);
    if (method === "POST" && sessionMatch) {
      const tableId = Number(sessionMatch[1]);
      const session = await createTableSession(tableId);
      return { status: 200, payload: { data: session } };
    }

    // Match /api/sales/tables/:sessionId/orders
    const ordersMatch = requestUrl.match(/\/api\/sales\/tables\/sessions\/(\d+)\/orders$/);
    if (method === "GET" && ordersMatch) {
      const sessionId = Number(ordersMatch[1]);
      const orders = await getTableOrders(sessionId);
      return { status: 200, payload: { data: orders } };
    }
    
    if (method === "POST" && ordersMatch) {
      const sessionId = Number(ordersMatch[1]);
      if (!body.menuProductId || !body.quantity) throw badRequest("Thiếu thông tin món hoặc số lượng.");
      const order = await addTableOrder(sessionId, Number(body.menuProductId), Number(body.quantity));
      return { status: 200, payload: { data: order } };
    }

    // Match /api/sales/tables/:sessionId/checkout
    const checkoutMatch = requestUrl.match(/\/api\/sales\/tables\/(\d+)\/sessions\/(\d+)\/checkout$/);
    if (method === "POST" && checkoutMatch) {
      const tableId = Number(checkoutMatch[1]);
      const sessionId = Number(checkoutMatch[2]);
      const result = await checkoutTableSession(sessionId, tableId);
      
      // MOCK VietQR Generation. In a real app we'd call an API like img.vietqr.io
      // Format: https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-<TEMPLATE>.png?amount=<AMOUNT>&addInfo=<INFO>
      // Using generic dummy data for now
      const bankId = "vietcombank";
      const accountNo = "123456789";
      const amount = result.totalAmount;
      const addInfo = `Thanh toan ban ${tableId}`;
      const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}`;

      return { status: 200, payload: { data: { totalAmount: amount, qrUrl } } };
    }

    return { status: 404, payload: { error: "Route not found in tablesRoute." } };
  } catch (error) {
    return {
      status: error.statusCode || 500,
      payload: { error: error.message || "Lỗi server." },
    };
  }
}
