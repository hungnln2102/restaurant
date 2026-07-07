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
      setQuantity(1);
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
        <header className="table-modal-header">
          <h2>Chi tiết {table.tableName}</h2>
          <button className="btn-close-light" onClick={onClose}>&times;</button>
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
          <div className="table-modal-body">
            {!isOccupied ? (
              <div className="pos-empty-state">
                <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"></path>
                </svg>
                <p>Bàn {table.tableName} hiện đang trống hoặc chưa mở Order.</p>
                <button className="btn-premium" onClick={handleOpenTable} disabled={isLoading} style={{margin: '0 auto'}}>
                  Mở bàn & Gọi món
                </button>
              </div>
            ) : (
              <div className="pos-layout">
                <div className="pos-list-section">
                  <h4>Danh sách món đã gọi</h4>
                  <div className="pos-table-wrapper">
                    {orders.length === 0 ? (
                      <div style={{padding: '32px', textAlign: 'center', color: '#9ca3af'}}>Chưa có món nào.</div>
                    ) : (
                      <table className="pos-table">
                        <thead>
                          <tr>
                            <th>Tên món</th>
                            <th>SL</th>
                            <th>Đơn giá</th>
                            <th style={{textAlign: 'right'}}>Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map(o => (
                            <tr key={o.id}>
                              <td style={{fontWeight: 500}}>{o.productName}</td>
                              <td>x{o.quantity}</td>
                              <td>{o.unitPrice.toLocaleString()}đ</td>
                              <td style={{textAlign: 'right', fontWeight: 600}}>{o.totalAmount.toLocaleString()}đ</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  
                  <div className="pos-summary">
                    <div className="pos-summary-row">
                      <span>Số lượng món:</span>
                      <span>{orders.reduce((acc, curr) => acc + curr.quantity, 0)}</span>
                    </div>
                    <div className="pos-summary-row total">
                      <span>Tổng cộng:</span>
                      <span className="highlight">{table.totalAmount.toLocaleString()}đ</span>
                    </div>
                  </div>
                </div>

                <div className="pos-action-section">
                  <h4>Thêm món mới</h4>
                  <div className="pos-form-group">
                    <label>Chọn món</label>
                    <select 
                      value={selectedProduct} 
                      onChange={e => setSelectedProduct(e.target.value)}
                      className="pos-select"
                    >
                      {menu.map(m => (
                        <option key={m.id} value={m.id}>{m.productName} - {m.sellingPrice.toLocaleString()}đ</option>
                      ))}
                    </select>
                  </div>
                  <div className="pos-form-group">
                    <label>Số lượng</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={quantity} 
                      onChange={e => setQuantity(Number(e.target.value))} 
                      className="pos-input"
                    />
                  </div>
                  <button className="pos-btn-add" onClick={handleAddOrder} disabled={isLoading}>
                    + Thêm vào Order
                  </button>
                  
                  <div className="pos-divider"></div>
                  
                  <button className="pos-btn-checkout" onClick={handleCheckout} disabled={isLoading || orders.length === 0}>
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
