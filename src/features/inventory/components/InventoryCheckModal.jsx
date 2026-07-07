import React, { useEffect, useState, useMemo } from "react";
import { fetchInventoryOverview } from "../api/overviewApi";
import { submitInventoryCheck } from "../api/stockBalanceApi";

function formatQuantity(value) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function InventoryCheckModal({ isOpen, onClose, onSaved }) {
  const [balances, setBalances] = useState([]);
  const [actualQuantities, setActualQuantities] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setBalances([]);
      setActualQuantities({});
      setError("");
      setSubmitError("");
      setNotes("");
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    fetchInventoryOverview({ force: true })
      .then((data) => {
        if (!isMounted) return;
        const fetchedBalances = Array.isArray(data?.balances) ? data.balances : [];
        
        // Sắp xếp lại danh sách theo tên để dễ nhìn hơn
        fetchedBalances.sort((a, b) => a.productName.localeCompare(b.productName));
        
        setBalances(fetchedBalances);
        
        // Không pre-fill, để trống cho người dùng tự nhập
        setActualQuantities({});
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Không thể tải danh sách tồn kho.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  function updateQuantity(id, value) {
    setActualQuantities((current) => ({
      ...current,
      [id]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");
    
    const items = [];
    for (const row of balances) {
      const actualRaw = actualQuantities[row.id];
      if (actualRaw === undefined || actualRaw === "") continue;
      
      const numericActual = Number(actualRaw);
      if (!Number.isFinite(numericActual) || numericActual < 0) {
        setSubmitError(`Số lượng của ${row.productName} không hợp lệ.`);
        return;
      }
      
      // Chỉ push những cái có thay đổi (chênh lệch) ?
      // Yêu cầu là kiểm kê, ta có thể push hết hoặc chỉ push cái bị đổi.
      // Push hết sẽ update last_checked_at cho toàn bộ, đúng với ý nghĩa "Kiểm kê kho".
      items.push({
        balanceId: row.id,
        actualQuantity: numericActual
      });
    }

    if (items.length === 0) {
      setSubmitError("Không có số liệu để lưu.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      await submitInventoryCheck({ items, notes });
      onSaved?.();
      onClose();
    } catch (err) {
      setSubmitError(err.message || "Không thể lưu dữ liệu kiểm kê.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-check-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "800px", width: "90%" }}
      >
        <div className="modal-header">
          <div>
            <span className="toolbar-kicker">Quản lý kho</span>
            <h4 id="inventory-check-title">Kiểm kê kho</h4>
            <p>Nhập số lượng thực tế của nguyên vật liệu trong kho để đối chiếu và cập nhật số liệu hệ thống.</p>
          </div>
          <button type="button" className="modal-close-button" onClick={onClose} disabled={isSubmitting}>
            Đóng
          </button>
        </div>

        {isLoading ? (
          <div className="modal-form">
            <div className="empty-state">
              <strong>Đang tải danh sách nguyên vật liệu...</strong>
            </div>
          </div>
        ) : error ? (
          <div className="modal-form">
            <div className="empty-state error">
              <strong>Không thể tải danh sách kiểm kê</strong>
              <p>{error}</p>
            </div>
          </div>
        ) : balances.length === 0 ? (
          <div className="modal-form">
            <div className="empty-state">
              <strong>Kho đang trống</strong>
              <p>Chưa có dòng tồn kho nào để kiểm kê.</p>
            </div>
          </div>
        ) : (
          <form className="modal-form" onSubmit={handleSubmit}>
            <p style={{ marginBottom: "1rem" }}>
              Nhập số lượng thực tế của nguyên vật liệu trong kho để đối chiếu và cập nhật số liệu hệ
              thống. Bỏ trống nếu không muốn ghi nhận mặt hàng đó trong lần kiểm kê này.
            </p>
            
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label htmlFor="check-notes">Ghi chú (Tuỳ chọn)</label>
              <input 
                type="text" 
                id="check-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="VD: Kiểm kê cuối ngày, hoặc lý do thất thoát..."
                disabled={isSubmitting}
                style={{ width: "100%", padding: "0.5rem" }}
              />
            </div>

            <div className="table-wrapper" style={{ maxHeight: "50vh", overflowY: "auto", borderBottom: "1px solid var(--border-color)" }}>
              <table className="inventory-overview-table">
                <thead style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--card-bg)" }}>
                  <tr>
                    <th>Nguyên liệu</th>
                    <th>Đơn vị tính</th>
                    <th>Tồn hệ thống</th>
                    <th style={{ width: "200px" }}>Tồn thực tế</th>
                    <th>Chênh lệch</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map(row => {
                    const systemVal = Number(row.quantity);
                    const actualRaw = actualQuantities[row.id];
                    const actualVal = actualRaw !== "" && actualRaw !== undefined ? Number(actualRaw) : null;
                    const diff = actualVal !== null ? actualVal - systemVal : null;
                    
                    let diffColor = "";
                    if (diff !== null) {
                      if (diff > 0) diffColor = "var(--safe-color)";
                      else if (diff < 0) diffColor = "var(--danger-color)";
                    }

                    return (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 500 }}>{row.productName}</td>
                        <td className="muted-text">{row.unit}</td>
                        <td>{formatQuantity(systemVal)}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.0001"
                            value={actualRaw ?? ""}
                            onChange={(e) => updateQuantity(row.id, e.target.value)}
                            disabled={isSubmitting}
                            placeholder="Nhập..."
                            style={{ padding: "0.25rem 0.5rem", width: "100%", border: "1px solid var(--border-color)", borderRadius: "4px" }}
                          />
                        </td>
                        <td style={{ color: diffColor, fontWeight: diff !== 0 && diff !== null ? 600 : 400 }}>
                          {diff === null ? "-" : (diff > 0 ? "+" : "") + formatQuantity(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {submitError ? <p className="form-feedback error">{submitError}</p> : null}

            <div className="toolbar-actions" style={{ marginTop: "1rem" }}>
              <button type="button" className="ghost-button" onClick={onClose} disabled={isSubmitting}>
                Hủy
              </button>
              <button type="submit" className="primary-button" disabled={isSubmitting}>
                {isSubmitting ? "Đang lưu..." : "Xác nhận kiểm kê"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
