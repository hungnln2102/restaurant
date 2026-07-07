import React, { useState, useEffect } from "react";
import { createSession, getTableOrders, addTableOrder, checkoutSession } from "../api/tablesApi";
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
      <div className="modal-content table-modal">
        <header className="modal-header">
          <h2>Chi tiết {table.tableName}</h2>
          <button className="btn-icon" onClick={onClose}>&times;</button>
        </header>

        {checkoutData ? (
          <div className="checkout-view">
            <h3>Hóa đơn thanh toán</h3>
            <p>Tổng tiền: <strong>{checkoutData.totalAmount.toLocaleString()}đ</strong></p>
            <div className="qr-container">
              <img src={checkoutData.qrUrl} alt="VietQR" className="qr-image" />
              <p className="help-text">Khách hàng quét mã để thanh toán nhanh qua VietQR</p>
            </div>
            <div className="modal-actions" style={{justifyContent: 'center'}}>
              <button className="btn btn-primary" onClick={handleCloseCheckout}>Hoàn tất</button>
            </div>
          </div>
        ) : (
          <div className="modal-body">
            {!isOccupied ? (
              <div className="empty-state">
                <p>Bàn hiện đang trống hoặc chưa mở Order.</p>
                <button className="btn btn-primary" onClick={handleOpenTable} disabled={isLoading}>
                  Mở bàn & Gọi món
                </button>
              </div>
            ) : (
              <div className="order-view">
                <div className="order-list">
                  <h4>Danh sách món đã gọi</h4>
                  {orders.length === 0 ? (
                    <p className="text-secondary">Chưa có món nào.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Tên món</th>
                          <th>SL</th>
                          <th>Đơn giá</th>
                          <th>Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(o => (
                          <tr key={o.id}>
                            <td>{o.productName}</td>
                            <td>{o.quantity}</td>
                            <td>{o.unitPrice.toLocaleString()}đ</td>
                            <td>{o.totalAmount.toLocaleString()}đ</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  
                  <div className="order-total">
                    <strong>Tổng cộng:</strong>
                    <span>{table.totalAmount.toLocaleString()}đ</span>
                  </div>
                </div>

                <div className="order-actions">
                  <h4>Thêm món</h4>
                  <div className="add-form">
                    <select 
                      value={selectedProduct} 
                      onChange={e => setSelectedProduct(e.target.value)}
                      className="form-input"
                    >
                      {menu.map(m => (
                        <option key={m.id} value={m.id}>{m.productName} - {m.sellingPrice.toLocaleString()}đ</option>
                      ))}
                    </select>
                    <input 
                      type="number" 
                      min="1" 
                      value={quantity} 
                      onChange={e => setQuantity(Number(e.target.value))} 
                      className="form-input"
                      style={{width: '80px'}}
                    />
                    <button className="btn btn-secondary" onClick={handleAddOrder} disabled={isLoading}>Thêm</button>
                  </div>
                  
                  <hr style={{margin: '24px 0'}} />
                  <button className="btn btn-primary btn-block" onClick={handleCheckout} disabled={isLoading || orders.length === 0}>
                    Thanh toán & In Bill (QR)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
