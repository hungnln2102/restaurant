import React, { useEffect, useState } from "react";
import { listStockChecks, getStockCheckItems } from "../api/stockCheckApi";
function formatDateTime(value) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  const timeStr = date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${timeStr} ${dateStr}`;
}

function formatQuantity(value) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function InventoryCheckDetailModal({ checkId, checkCode, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    getStockCheckItems(checkId)
      .then(data => {
        if (!isMounted) return;
        setItems(data);
      })
      .catch(err => {
        if (!isMounted) return;
        setError(err.message || "Không tải được chi tiết phiếu.");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });
    return () => { isMounted = false; };
  }, [checkId]);

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="modal-shell" role="dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: "800px" }}>
        <div className="modal-header">
          <div>
            <span className="toolbar-kicker">Chi tiết phiếu</span>
            <h4>{checkCode}</h4>
          </div>
          <button type="button" className="modal-close-button" onClick={onClose}>Đóng</button>
        </div>
        
        {loading ? (
          <div className="modal-form"><div className="empty-state"><strong>Đang tải...</strong></div></div>
        ) : error ? (
          <div className="modal-form"><div className="empty-state error"><strong>Lỗi</strong><p>{error}</p></div></div>
        ) : items.length === 0 ? (
          <div className="modal-form"><div className="empty-state">Không có mặt hàng nào.</div></div>
        ) : (
          <div className="modal-form">
            <div className="table-wrapper" style={{ maxHeight: "50vh", overflowY: "auto" }}>
              <table className="inventory-overview-table">
                <thead style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--card-bg)" }}>
                  <tr>
                    <th>Nguyên liệu</th>
                    <th>ĐVT</th>
                    <th>Tồn hệ thống</th>
                    <th>Tồn thực tế</th>
                    <th>Chênh lệch</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(row => {
                    const diff = row.varianceQuantity;
                    let diffColor = "";
                    if (diff > 0) diffColor = "var(--safe-color)";
                    else if (diff < 0) diffColor = "var(--danger-color)";
                    
                    return (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 500 }}>{row.productName}</td>
                        <td className="muted-text">{row.unit}</td>
                        <td>{formatQuantity(row.systemQuantity)}</td>
                        <td>{formatQuantity(row.actualQuantity)}</td>
                        <td style={{ color: diffColor, fontWeight: diff !== 0 ? 600 : 400 }}>
                          {diff > 0 ? "+" : ""}{formatQuantity(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function InventoryChecksList() {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingCheck, setViewingCheck] = useState(null);

  useEffect(() => {
    let isMounted = true;
    listStockChecks()
      .then(data => {
        if (!isMounted) return;
        setChecks(data || []);
      })
      .catch(err => {
        if (!isMounted) return;
        setError(err.message || "Không tải được lịch sử kiểm kê.");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  return (
    <>
      <div className="content-grid inventory-overview-grid">
        <article className="panel-card inventory-overview-main">
          <div className="panel-heading">
            <div>
              <span>Lịch sử kiểm kê</span>
              <h4>Các phiếu đã lưu</h4>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <strong>Đang tải dữ liệu...</strong>
            </div>
          ) : error ? (
            <div className="empty-state error">
              <strong>Không tải được lịch sử</strong>
              <p>{error}</p>
            </div>
          ) : checks.length === 0 ? (
            <div className="empty-state">
              <strong>Chưa có phiếu kiểm kê nào</strong>
              <p>Khi bạn thực hiện kiểm kê kho, các phiếu sẽ được lưu tại đây.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="inventory-overview-table">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Ngày tạo</th>
                    <th>Trạng thái</th>
                    <th>Số mặt hàng</th>
                    <th>Ghi chú</th>
                    <th className="row-actions-col">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map(row => {
                    
                    return (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 500 }}>{row.checkCode}</td>
                        <td>{formatDateTime(row.createdAt)}</td>
                        <td>
                          {row.status === "pending" ? (
                            <span className="status-chip warning">Chờ đồng bộ</span>
                          ) : (
                            <span className="status-chip info">Đã đồng bộ</span>
                          )}
                        </td>
                        <td>{formatQuantity(row.itemCount)}</td>
                        <td className="muted-text" style={{ maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {row.notes || "-"}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="row-action-button"
                              onClick={() => setViewingCheck(row)}
                            >
                              Xem chi tiết
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>
      
      {viewingCheck && (
        <InventoryCheckDetailModal
          checkId={viewingCheck.id}
          checkCode={viewingCheck.checkCode}
          onClose={() => setViewingCheck(null)}
        />
      )}
    </>
  );
}
