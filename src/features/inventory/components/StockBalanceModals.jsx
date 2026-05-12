import React, { useEffect, useState } from "react";
import { updateStockBalance } from "../api/stockBalanceApi";
import { fetchStockLots } from "../api/stockLotApi";

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatDateTime(value) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatLotPrice(lot) {
  if (lot.unitPrice === null || lot.unitPrice === undefined) {
    return "—";
  }

  const currency = lot.currencyCode || "VND";
  const pricingUnit =
    typeof lot.pricingUnit === "string" && lot.pricingUnit.trim()
      ? `/${lot.pricingUnit.trim()}`
      : "";
  return `${formatNumber(lot.unitPrice)} ${currency}${pricingUnit}`;
}

function renderLotsBody({ lots, lotsLoading, lotsError, displayUnit }) {
  if (lotsLoading) {
    return (
      <div className="empty-state">
        <strong>Đang tải lô nhập...</strong>
        <p>Hệ thống đang lấy danh sách lô FIFO của nguyên liệu này.</p>
      </div>
    );
  }

  if (lotsError) {
    return (
      <div className="empty-state error">
        <strong>Không tải được danh sách lô nhập</strong>
        <p>{lotsError}</p>
      </div>
    );
  }

  if (!lots.length) {
    return (
      <div className="empty-state">
        <strong>Chưa có lô nhập nào.</strong>
        <p>Khi có phiếu nhập mới, lô sẽ tự động hiển thị tại đây.</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="inventory-overview-table stock-lot-table">
        <thead>
          <tr>
            <th>Ngày nhập</th>
            <th>NCC</th>
            <th>Số lượng nhập</th>
            <th>Đơn giá</th>
            <th>Đã dùng</th>
            <th>Còn lại</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => {
            const isExhausted = Boolean(lot.isExhausted);
            const unit = lot.displayUnit || displayUnit || "";
            const supplierName = lot.isAdjustment
              ? "Điều chỉnh kiểm kê"
              : lot.supplierName || "—";

            return (
              <tr key={lot.id}>
                <td>{formatDateTime(lot.createdAt)}</td>
                <td>{supplierName}</td>
                <td>
                  {formatNumber(lot.inputQuantity)} {lot.inputUnit || ""}
                </td>
                <td>{formatLotPrice(lot)}</td>
                <td>
                  {formatNumber(lot.consumedQuantity)} {unit}
                </td>
                <td>
                  {formatNumber(lot.remainingQuantity)} {unit}
                </td>
                <td>
                  <span
                    className={`status-chip ${isExhausted ? "muted" : "safe"}`}
                  >
                    {isExhausted ? "Hết" : "Còn"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function StockBalanceViewModal({ isOpen, row, onClose }) {
  const [lots, setLots] = useState([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [lotsError, setLotsError] = useState("");

  useEffect(() => {
    if (!isOpen || !row?.productId) {
      setLots([]);
      setLotsError("");
      setLotsLoading(false);
      return undefined;
    }

    // isCancelled guards against React StrictMode double-invocation and
    // against the user closing the modal before the request settles.
    let isCancelled = false;
    setLotsLoading(true);
    setLotsError("");
    setLots([]);

    fetchStockLots(row.productId)
      .then((data) => {
        if (isCancelled) {
          return;
        }
        setLots(Array.isArray(data) ? data : []);
      })
      .catch((requestError) => {
        if (isCancelled) {
          return;
        }
        setLotsError(requestError.message || "Lỗi không xác định.");
      })
      .finally(() => {
        if (isCancelled) {
          return;
        }
        setLotsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, row?.productId]);

  if (!isOpen || !row) {
    return null;
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-shell modal-shell--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-balance-view-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="toolbar-kicker">Chi tiết tồn kho</span>
            <h4 id="stock-balance-view-title">{row.productName}</h4>
            <p>Xem nhanh tồn hiện tại và chi tiết từng lô nhập (FIFO).</p>
          </div>

          <button type="button" className="modal-close-button" onClick={onClose}>
            Đóng
          </button>
        </div>

        <div className="modal-form">
          <dl className="detail-grid">
            <div>
              <dt>Nguyên liệu</dt>
              <dd>{row.productName}</dd>
            </div>
            <div>
              <dt>Đơn vị tồn</dt>
              <dd>{row.unit || "—"}</dd>
            </div>
            <div>
              <dt>Tồn hiện tại</dt>
              <dd>
                {formatNumber(row.quantity)} {row.unit || ""}
              </dd>
            </div>
            <div>
              <dt>Mức cần tối thiểu</dt>
              <dd>
                {(() => {
                  const required = row.requiredQuantity;
                  if (required === null || required === undefined) {
                    return "Chưa có";
                  }

                  const numeric = Number(required);
                  if (!Number.isFinite(numeric)) {
                    return "Chưa có";
                  }

                  const incompleteTitle =
                    "Một số đơn vị nguyên liệu chưa có quy đổi, số liệu có thể chưa chính xác.";

                  return (
                    <span title={row.requiredIncomplete ? incompleteTitle : undefined}>
                      {`${formatNumber(numeric)} ${row.unit || ""}`.trim()}
                      {row.requiredIncomplete ? (
                        <span
                          className="price-mismatch-warning"
                          aria-label={incompleteTitle}
                          title={incompleteTitle}
                        >
                          {" *"}
                        </span>
                      ) : null}
                    </span>
                  );
                })()}
              </dd>
            </div>
            <div>
              <dt>Giá tham chiếu</dt>
              <dd>
                {row.unitPrice === null || row.unitPrice === undefined
                  ? "Chưa có"
                  : `${formatNumber(row.unitPrice)} ${row.currencyCode || "VND"}${
                      typeof row.pricingUnit === "string" && row.pricingUnit.trim()
                        ? `/${row.pricingUnit.trim()}`
                        : ""
                    }`}
              </dd>
            </div>
            <div>
              <dt>Cập nhật gần nhất</dt>
              <dd>{formatDateTime(row.updatedAt)}</dd>
            </div>
          </dl>

          <section className="stock-lot-section">
            <header className="stock-lot-section-heading">
              <div>
                <span className="toolbar-kicker">Chi tiết các lô nhập</span>
                <h5>Theo FIFO (lô cũ nhất ở trên)</h5>
              </div>
            </header>

            {renderLotsBody({
              lots,
              lotsLoading,
              lotsError,
              displayUnit: row.unit,
            })}
          </section>
        </div>
      </div>
    </div>
  );
}

export function StockBalanceEditModal({ isOpen, row, onClose, onSaved }) {
  const [onHandQuantity, setOnHandQuantity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (isOpen && row) {
      setOnHandQuantity(String(row.quantity ?? ""));
      setSubmitError("");
      setIsSubmitting(false);
    }
  }, [isOpen, row]);

  if (!isOpen || !row) {
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");

    const numericQuantity = Number(onHandQuantity);

    if (!Number.isFinite(numericQuantity) || numericQuantity < 0) {
      setSubmitError("Tồn kho phải là số lớn hơn hoặc bằng 0.");
      return;
    }

    setIsSubmitting(true);

    try {
      const updated = await updateStockBalance({
        id: row.id,
        onHandQuantity: numericQuantity,
      });
      onSaved?.(updated);
      onClose?.();
    } catch (error) {
      setSubmitError(error.message);
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
        aria-labelledby="stock-balance-edit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="toolbar-kicker">Cập nhật tồn kho</span>
            <h4 id="stock-balance-edit-title">{row.productName}</h4>
            <p>Hiệu chỉnh số lượng tồn thực tế khi kiểm kê hoặc điều chỉnh hao hụt.</p>
          </div>

          <button type="button" className="modal-close-button" onClick={onClose} disabled={isSubmitting}>
            Đóng
          </button>
        </div>

        <form className="portioning-form modal-form" onSubmit={handleSubmit}>
          <div className="portioning-form-grid">
            <label className="field-stack">
              <span>Đơn vị tồn</span>
              <input type="text" value={row.unit || ""} disabled readOnly />
            </label>

            <label className="field-stack">
              <span>Tồn hiện tại ({row.unit || ""})</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={onHandQuantity}
                onChange={(event) => setOnHandQuantity(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </label>
          </div>

          {submitError ? <p className="form-feedback error">{submitError}</p> : null}

          <div className="portioning-form-actions">
            <p className="field-help">Lưu ý: cập nhật này chỉ thay đổi tồn hiện tại, không ảnh hưởng lịch sử nhập.</p>

            <div className="toolbar-actions">
              <button type="button" className="ghost-button" onClick={onClose} disabled={isSubmitting}>
                Hủy
              </button>
              <button type="submit" className="primary-button" disabled={isSubmitting}>
                {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
