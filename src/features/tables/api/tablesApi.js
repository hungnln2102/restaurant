export async function getTables() {
  const res = await fetch("/api/sales/tables");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Lỗi tải danh sách bàn");
  return json.data;
}

export async function createTable(tableName) {
  const res = await fetch("/api/sales/tables", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tableName }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Lỗi thêm bàn");
  return json.data;
}

export async function createSession(tableId) {
  const res = await fetch(`/api/sales/tables/${tableId}/session`, { method: "POST" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Lỗi mở bàn");
  return json.data;
}

export async function getTableOrders(sessionId) {
  if (!sessionId) return [];
  const res = await fetch(`/api/sales/tables/sessions/${sessionId}/orders`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Lỗi tải món");
  return json.data;
}

export async function addTableOrder(sessionId, menuProductId, quantity) {
  const res = await fetch(`/api/sales/tables/sessions/${sessionId}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ menuProductId, quantity }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Lỗi thêm món");
  return json.data;
}

export async function checkoutSession(tableId, sessionId) {
  const res = await fetch(`/api/sales/tables/${tableId}/sessions/${sessionId}/checkout`, { method: "POST" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Lỗi thanh toán");
  return json.data;
}
