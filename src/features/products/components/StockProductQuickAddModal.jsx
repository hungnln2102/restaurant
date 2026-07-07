import React, { useState } from "react";
import { createInventoryProduct } from "../../inventory/api/stockOptionsApi";

export function StockProductQuickAddModal({ isOpen, onClose, onCreated }) {
  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    const name = productName.trim();
    if (!name) {
      setError("Tên nguyên liệu là bắt buộc.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const newProduct = await createInventoryProduct({
        productName: name,
        productCategory: productCategory.trim() || null,
      });
      onCreated(newProduct);
      setProductName("");
      setProductCategory("");
    } catch (err) {
      setError(err.message || "Không thể tạo nguyên liệu mới.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setProductName("");
    setProductCategory("");
    setError("");
    onClose();
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }} role="presentation" onClick={handleClose}>
      <div
        className="modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-material-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "400px" }}
      >
        <div className="modal-header">
          <div>
            <span className="toolbar-kicker">Thêm nhanh</span>
            <h4 id="quick-add-material-title">Tạo nguyên liệu mới</h4>
          </div>
          <button type="button" className="modal-close-button" onClick={handleClose} disabled={isSubmitting}>
            Đóng
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="portioning-form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <label className="field-stack">
              <span>Tên nguyên liệu *</span>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ví dụ: Thịt bò tơ"
                required
                disabled={isSubmitting}
                autoFocus
              />
            </label>

            <label className="field-stack">
              <span>Danh mục (Tùy chọn)</span>
              <input
                type="text"
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                placeholder="Ví dụ: Thịt cá"
                disabled={isSubmitting}
              />
            </label>
          </div>

          {error ? <p className="form-feedback error">{error}</p> : null}

          <div className="toolbar-actions" style={{ marginTop: "1rem" }}>
            <button type="button" className="ghost-button" onClick={handleClose} disabled={isSubmitting}>
              Hủy
            </button>
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? "Đang lưu..." : "Thêm nguyên liệu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
