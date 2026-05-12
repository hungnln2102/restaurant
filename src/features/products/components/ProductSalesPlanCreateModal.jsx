import React, { useEffect, useMemo, useState } from "react";
import { fetchMenuProducts } from "../api/menuProductsApi";
import { createSalesPlan } from "../api/productSalesPlanApi";

const initialForm = {
  menuProductId: "",
  salesTarget: "",
  salesActual: "0",
  status: "active",
};

const STATUS_OPTIONS = [
  { value: "active", label: "Đang bán" },
  { value: "limited", label: "Giới hạn" },
  { value: "paused", label: "Tạm dừng" },
];

function formatCurrency(value) {
  const numeric = Number(value || 0);

  if (!Number.isFinite(numeric)) {
    return "0 đ";
  }

  return `${new Intl.NumberFormat("vi-VN").format(numeric)} đ`;
}

function validateForm(form) {
  if (!form.menuProductId) {
    return "Vui lòng chọn sản phẩm cần đưa vào vận hành.";
  }

  const target = Number(form.salesTarget);

  if (form.salesTarget === "" || !Number.isInteger(target) || target < 0) {
    return "Số lượng kế hoạch phải là số nguyên không âm.";
  }

  const actual = Number(form.salesActual);

  if (form.salesActual === "" || !Number.isInteger(actual) || actual < 0) {
    return "Số lượng đã bán phải là số nguyên không âm.";
  }

  if (!STATUS_OPTIONS.some((option) => option.value === form.status)) {
    return "Trạng thái không hợp lệ.";
  }

  return "";
}

export function ProductSalesPlanCreateModal({
  isOpen,
  onClose,
  onCreated,
  existingMenuProductIds = [],
}) {
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [menuProducts, setMenuProducts] = useState([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(false);
  const [menuError, setMenuError] = useState("");

  const excludedIds = useMemo(
    () => new Set(existingMenuProductIds.map((id) => Number(id))),
    [existingMenuProductIds],
  );

  const availableMenuProducts = useMemo(
    () => menuProducts.filter((product) => !excludedIds.has(Number(product.id))),
    [menuProducts, excludedIds],
  );

  useEffect(() => {
    if (!isOpen) {
      setForm(initialForm);
      setIsSubmitting(false);
      setSubmitError("");
      setMenuError("");
      return;
    }

    let isCancelled = false;
    setIsLoadingMenu(true);
    setMenuError("");

    fetchMenuProducts()
      .then((data) => {
        if (isCancelled) return;
        setMenuProducts(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (isCancelled) return;
        setMenuError(error.message || "Không thể tải danh sách sản phẩm.");
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoadingMenu(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationMessage = validateForm(form);

    if (validationMessage) {
      setSubmitError(validationMessage);
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const created = await createSalesPlan({
        menuProductId: Number(form.menuProductId),
        salesTarget: Number(form.salesTarget),
        salesActual: Number(form.salesActual),
        status: form.status,
      });

      onCreated?.(created);
      onClose?.();
    } catch (error) {
      setSubmitError(error.message || "Không thể thêm sản phẩm vào vận hành.");
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
        aria-labelledby="product-sales-plan-create-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="toolbar-kicker">Quản lý sản phẩm</span>
            <h4 id="product-sales-plan-create-title">Thêm sản phẩm vào vận hành</h4>
            <p>Chọn món đã có định lượng và đặt mục tiêu bán cho kỳ vận hành hiện tại.</p>
          </div>

          <button
            type="button"
            className="modal-close-button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Đóng
          </button>
        </div>

        <form className="portioning-form modal-form" onSubmit={handleSubmit}>
          <div className="portioning-form-grid">
            <label className="field-stack">
              <span>Sản phẩm</span>
              <select
                value={form.menuProductId}
                onChange={(event) => updateField("menuProductId", event.target.value)}
                disabled={isSubmitting || isLoadingMenu}
                required
              >
                <option value="">
                  {isLoadingMenu ? "Đang tải danh sách..." : "-- Chọn sản phẩm --"}
                </option>
                {availableMenuProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.productName} — {formatCurrency(product.sellingPrice)}
                  </option>
                ))}
              </select>
              {menuError ? (
                <span className="field-help error">{menuError}</span>
              ) : !isLoadingMenu && availableMenuProducts.length === 0 ? (
                <span className="field-help">
                  Tất cả sản phẩm đã có trong danh sách vận hành. Hãy tạo sản phẩm mới ở trang Định lượng.
                </span>
              ) : null}
            </label>

            <label className="field-stack">
              <span>Số lượng kế hoạch</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.salesTarget}
                onChange={(event) => updateField("salesTarget", event.target.value)}
                placeholder="Ví dụ: 50"
                required
                disabled={isSubmitting}
              />
            </label>

            <label className="field-stack">
              <span>Số lượng đã bán</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.salesActual}
                onChange={(event) => updateField("salesActual", event.target.value)}
                placeholder="Ví dụ: 0"
                disabled={isSubmitting}
              />
            </label>

            <label className="field-stack">
              <span>Trạng thái</span>
              <select
                value={form.status}
                onChange={(event) => updateField("status", event.target.value)}
                disabled={isSubmitting}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {submitError ? <p className="form-feedback error">{submitError}</p> : null}

          <div className="portioning-form-actions">
            <p className="field-help">
              Sản phẩm cần được khai báo ở trang Định lượng trước khi đưa vào vận hành.
            </p>

            <div className="toolbar-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={isSubmitting || isLoadingMenu}
              >
                {isSubmitting ? "Đang lưu..." : "Thêm vào vận hành"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
