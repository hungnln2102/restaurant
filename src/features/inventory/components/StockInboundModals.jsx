import React, { useEffect, useState } from "react";
import { updateStockInbound } from "../api/stockInboundApi";
import { fetchSuppliers } from "../../suppliers/api/suppliersApi";

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

function getPriceSourceLabel(priceSource) {
  switch (priceSource) {
    case "inbound":
      return "Theo phiếu";
    case "supplier_product":
      return "Theo NCC (mặt hàng)";
    case "supplier_default":
      return "Theo NCC (mặc định)";
    default:
      return "—";
  }
}

function formatReferenceUnitPrice(row) {
  const value = row?.effectiveUnitPrice;

  if (value === null || value === undefined) {
    return "Chưa có";
  }

  const currency = row.effectiveCurrencyCode || row.currencyCode || "VND";
  const pricingUnit =
    typeof row.effectivePricingUnit === "string" && row.effectivePricingUnit.trim()
      ? row.effectivePricingUnit.trim()
      : row.inputUnit || "";

  const base = `${formatNumber(value)} ${currency}`;

  return pricingUnit ? `${base}/${pricingUnit}` : base;
}

function formatTotalAmount(row) {
  const total = row?.totalAmount;

  if (total === null || total === undefined) {
    return "Chưa có";
  }

  const currency = row.effectiveCurrencyCode || row.currencyCode || "VND";
  return `${formatNumber(total)} ${currency}`;
}

export function StockInboundViewModal({ isOpen, row, onClose }) {
  if (!isOpen || !row) {
    return null;
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-inbound-view-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="toolbar-kicker">Chi tiết phiếu nhập</span>
            <h4 id="stock-inbound-view-title">{row.productName}</h4>
            <p>Tóm tắt thông tin lần nhập kho gần đây.</p>
          </div>

          <button type="button" className="modal-close-button" onClick={onClose}>
            Đóng
          </button>
        </div>

        <div className="modal-form">
          <dl className="detail-grid">
            <div>
              <dt>Ngày nhập</dt>
              <dd>{formatDateTime(row.createdAt)}</dd>
            </div>
            <div>
              <dt>Nguyên liệu</dt>
              <dd>{row.productName}</dd>
            </div>
            <div>
              <dt>Số lượng nhập</dt>
              <dd>
                {formatNumber(row.inputQuantity)} {row.inputUnit || ""}
              </dd>
            </div>
            <div>
              <dt>Giá thành (đơn giá phiếu)</dt>
              <dd>
                {row.unitPrice === null || row.unitPrice === undefined
                  ? "Chưa có"
                  : `${formatNumber(row.unitPrice)} ${row.currencyCode || "VND"}`}
              </dd>
            </div>
            <div>
              <dt>Đơn giá tham chiếu</dt>
              <dd>
                {formatReferenceUnitPrice(row)}
                <span className="detail-grid-meta"> · Nguồn: {getPriceSourceLabel(row.priceSource)}</span>
                {row.priceMismatch ? (
                  <span
                    className="detail-grid-warning"
                    title={`Đơn vị giá (${row.effectivePricingUnit || "?"}) khác đơn vị nhập (${row.inputUnit || "?"}) — kiểm tra lại.`}
                  >
                    {" "}* lệch đơn vị
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Thành tiền</dt>
              <dd>{formatTotalAmount(row)}</dd>
            </div>
            <div>
              <dt>Nhà cung ứng</dt>
              <dd>{row.supplierName || "Chưa có NCC"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

export function StockInboundEditModal({ isOpen, row, onClose, onSaved }) {
  const [unitPrice, setUnitPrice] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isCancelled = false;

    async function loadSuppliers() {
      try {
        const data = await fetchSuppliers();

        if (!isCancelled) {
          setSuppliers(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (!isCancelled) {
          setSubmitError(error.message);
        }
      }
    }

    loadSuppliers();

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && row) {
      setUnitPrice(row.unitPrice === null || row.unitPrice === undefined ? "" : String(row.unitPrice));
      setSupplierId(row.supplierId ? String(row.supplierId) : "");
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

    let normalizedUnitPrice = null;

    if (unitPrice !== "") {
      normalizedUnitPrice = Number(unitPrice);

      if (!Number.isFinite(normalizedUnitPrice) || normalizedUnitPrice < 0) {
        setSubmitError("Giá thành phải là số lớn hơn hoặc bằng 0.");
        return;
      }
    }

    let normalizedSupplierId = null;

    if (supplierId !== "") {
      normalizedSupplierId = Number(supplierId);

      if (!Number.isInteger(normalizedSupplierId) || normalizedSupplierId <= 0) {
        setSubmitError("Nhà cung ứng không hợp lệ.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const updated = await updateStockInbound({
        id: row.id,
        unitPrice: normalizedUnitPrice,
        supplierId: normalizedSupplierId,
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
        aria-labelledby="stock-inbound-edit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="toolbar-kicker">Cập nhật phiếu nhập</span>
            <h4 id="stock-inbound-edit-title">{row.productName}</h4>
            <p>Chỉnh giá thành hoặc gán nhà cung ứng. Không thay đổi số lượng để giữ tồn ổn định.</p>
          </div>

          <button type="button" className="modal-close-button" onClick={onClose} disabled={isSubmitting}>
            Đóng
          </button>
        </div>

        <form className="portioning-form modal-form" onSubmit={handleSubmit}>
          <div className="portioning-form-grid">
            <label className="field-stack">
              <span>Số lượng đã nhập</span>
              <input
                type="text"
                value={`${formatNumber(row.inputQuantity)} ${row.inputUnit || ""}`}
                disabled
                readOnly
              />
            </label>

            <label className="field-stack">
              <span>Giá thành ({row.currencyCode || "VND"})</span>
              <input
                type="number"
                min="0"
                step="100"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                placeholder="Ví dụ: 45000"
                disabled={isSubmitting}
              />
            </label>

            <label className="field-stack field-stack-wide">
              <span>Nhà cung ứng</span>
              <select
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
                disabled={isSubmitting}
              >
                <option value="">Chưa gán</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplierName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {submitError ? <p className="form-feedback error">{submitError}</p> : null}

          <div className="portioning-form-actions">
            <p className="field-help">Đổi số lượng phải tạo phiếu nhập mới hoặc xóa rồi nhập lại để cập nhật tồn đúng.</p>

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
