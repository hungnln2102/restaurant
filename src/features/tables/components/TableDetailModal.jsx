import React, { useState, useEffect } from "react";
import { createSession, getTableOrders, addTableOrder, checkoutSession, reserveTable, cancelReservation } from "../api/tablesApi";
import { fetchMenuProducts } from "../../products/api/menuProductsApi";

export function TableDetailModal({ table, onClose, onUpdated }) {
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutData, setCheckoutData] = useState(null);

  const isOccupied = table.status === "occupied" && table.currentSessionId;

  useEffect(() => {
    if (isOccupied) {
      loadOrders();
    }
    loadMenu();
  }, [table]);

  const loadOrders = async () => {
    try {
      const data = await getTableOrders(table.currentSessionId);
      setOrders(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMenu = async () => {
    try {
      const data = await fetchMenuProducts();
      setMenu(data);
      if (data.length > 0) setSelectedProduct(data[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenTable = async () => {
    setIsLoading(true);
    try {
      await createSession(table.id);
      onUpdated();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddOrder = async () => {
    if (!selectedProduct || quantity < 1) return;
    setIsLoading(true);
    try {
      await addTableOrder(table.currentSessionId, selectedProduct, quantity);
      await loadOrders();
      setQuantity(1);
      onUpdated();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReserveTable = async () => {
    setIsLoading(true);
    try {
      await reserveTable(table.id);
      onUpdated();
      onClose(); // Đóng modal sau khi đặt
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelReservation = async () => {
    setIsLoading(true);
    try {
      await cancelReservation(table.id);
      onUpdated();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      const result = await checkoutSession(table.id, table.currentSessionId);
      setCheckoutData(result);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseCheckout = () => {
    setCheckoutData(null);
    onUpdated();
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-shell modal-shell--wide">
        <header className="modal-header">
          <div>
            <h4>Chi tiết {table.tableName}</h4>
            <p>Thông tin hóa đơn & gọi món tại bàn</p>
          </div>
          <button className="modal-close-button" onClick={onClose}>Đóng</button>
        </header>

        <div className="modal-form">
          {checkoutData ? (
            <div style={{textAlign: "center", padding: "32px 0"}}>
              <h4>Hóa đơn thanh toán</h4>
              <p style={{fontSize: "1.2rem", margin: "16px 0"}}>
                Tổng tiền: <strong style={{color: "var(--accent-deep)"}}>{checkoutData.totalAmount.toLocaleString()}đ</strong>
              </p>
              <div style={{margin: "24px auto", background: "white", padding: "16px", borderRadius: "16px", display: "inline-block", boxShadow: "0 12px 32px rgba(0,0,0,0.06)"}}>
                <img src={checkoutData.qrUrl} alt="VietQR" style={{maxWidth: "280px", borderRadius: "8px", display: "block"}} />
              </div>
              <p style={{color: "var(--muted)", marginBottom: "32px"}}>Khách hàng quét mã để thanh toán nhanh qua VietQR</p>
              
              <div style={{display: "flex", justifyContent: "center"}}>
                <button className="primary-button" onClick={handleCloseCheckout}>
                  Hoàn tất
                </button>
              </div>
            </div>
          ) : (
            <div>
              {!isOccupied ? (
                <div style={{textAlign: "center", padding: "48px 0"}}>
                  <div className="modal-highlight muted" style={{display: "inline-block", marginBottom: "24px"}}>
                    {table.status === "reserved" ? (
                      <p>Bàn {table.tableName} đã được <strong>khách hàng đặt trước</strong>.</p>
                    ) : (
                      <p>Bàn {table.tableName} hiện đang trống hoặc chưa mở Order.</p>
                    )}
                  </div>
                  <div style={{display: "flex", justifyContent: "center", gap: "16px"}}>
                    {table.status === "reserved" && (
                      <button className="ghost-button" onClick={handleCancelReservation} disabled={isLoading}>
                        Hủy đặt bàn
                      </button>
                    )}
                    {table.status === "available" && (
                      <button className="ghost-button" onClick={handleReserveTable} disabled={isLoading}>
                        Đặt bàn trước
                      </button>
                    )}
                    <button className="primary-button" onClick={handleOpenTable} disabled={isLoading}>
                      {table.status === "reserved" ? "Nhận bàn & Gọi món" : "Mở bàn & Gọi món"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{display: "grid", gridTemplateColumns: "1fr 340px", gap: "32px"}}>
                  {/* Left Column: Order List */}
                  <div>
                    <h5 style={{fontSize: "1.1rem", color: "var(--forest-deep)", marginBottom: "16px"}}>Danh sách món đã gọi</h5>
                    
                    {orders.length === 0 ? (
                      <div className="modal-highlight muted">
                        <p>Chưa có món nào.</p>
                      </div>
                    ) : (
                      <table>
                        <thead>
                          <tr style={{color: "var(--muted)"}}>
                            <th>Tên món</th>
                            <th>SL</th>
                            <th>Đơn giá</th>
                            <th style={{textAlign: "right"}}>Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map(o => (
                            <tr key={o.id} style={{borderBottom: "1px solid rgba(20,38,31,0.06)"}}>
                              <td style={{color: "var(--forest-deep)", fontWeight: 700}}>{o.productName}</td>
                              <td>x{o.quantity}</td>
                              <td>{o.unitPrice.toLocaleString()}đ</td>
                              <td style={{textAlign: "right", fontWeight: 700}}>{o.totalAmount.toLocaleString()}đ</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    
                    <div className="modal-highlight" style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                      <strong>Số lượng món: {orders.reduce((acc, curr) => acc + curr.quantity, 0)}</strong>
                      <span style={{fontSize: "1.4rem", fontWeight: 700, color: "var(--accent-deep)"}}>
                        Tổng cộng: {table.totalAmount.toLocaleString()}đ
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div>
                    <div className="modal-highlight muted" style={{marginBottom: "24px"}}>
                      <strong style={{marginBottom: "16px"}}>Thêm món mới</strong>
                      <div className="field-stack" style={{marginBottom: "16px"}}>
                        <span>Chọn món</span>
                        <select 
                          value={selectedProduct} 
                          onChange={e => setSelectedProduct(e.target.value)}
                        >
                          {menu.map(m => (
                            <option key={m.id} value={m.id}>{m.productName} - {m.sellingPrice.toLocaleString()}đ</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="field-stack" style={{marginBottom: "24px"}}>
                        <span>Số lượng</span>
                        <input 
                          type="number" 
                          min="1" 
                          value={quantity} 
                          onChange={e => setQuantity(Number(e.target.value))} 
                        />
                      </div>
                      
                      <button className="ghost-button" style={{width: "100%", justifyContent: "center"}} onClick={handleAddOrder} disabled={isLoading}>
                        Thêm vào Order
                      </button>
                    </div>

                    <button className="primary-button" style={{width: "100%", justifyContent: "center", padding: "16px"}} onClick={handleCheckout} disabled={isLoading || orders.length === 0}>
                      Thanh toán & In Bill
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
