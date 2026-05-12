import React, { useEffect, useState } from "react";
import { createSupplier } from "../api/suppliersApi";

const initialForm = {
  supplierName: "",
  primaryCategory: "",
  featuredProductName: "",
  defaultUnitPrice: "",
  pricingUnit: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

const PRICING_UNIT_SUGGESTIONS = [
  "kg",
  "g",
  "lít",
  "ml",
  "cái",
  "hộp",
  "gói",
  "lon",
  "chai",
  "túi",
  "kết",
  "set",
];

const PRICING_UNIT_MAX_LENGTH = 30;

export function SupplierCreateModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setForm(initialForm);
      setIsSubmitting(false);
      setSubmitError("");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");

    const trimmedPrice = form.defaultUnitPrice.trim();
    const trimmedPricingUnit = form.pricingUnit.trim();

    if (trimmedPrice && !trimmedPricingUnit) {
      setSubmitError("Hãy nhập đơn vị tính cho giá tham chiếu.");
      return;
    }

    if (trimmedPricingUnit.length > PRICING_UNIT_MAX_LENGTH) {
      setSubmitError(`Đơn vị tính giá không được vượt quá ${PRICING_UNIT_MAX_LENGTH} ký tự.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await createSupplier({
        ...form,
        pricingUnit: trimmedPricingUnit || null,
      });
      onCreated?.(created);
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
        aria-labelledby="supplier-create-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="toolbar-kicker">Nhà cung ứng</span>
            <h4 id="supplier-create-title">Thêm nhà cung cấp mới</h4>
            <p>Lưu thông tin NCC, loại sản phẩm chính và giá thành tham chiếu để dùng cho phiếu nhập.</p>
          </div>

          <button type="button" className="modal-close-button" onClick={onClose} disabled={isSubmitting}>
            Đóng
          </button>
        </div>

        <form className="portioning-form modal-form" onSubmit={handleSubmit}>
          <div className="portioning-form-grid">
            <label className="field-stack">
              <span>Tên nhà cung ứng</span>
              <input
                type="text"
                value={form.supplierName}
                onChange={(event) => updateField("supplierName", event.target.value)}
                placeholder="Ví dụ: Fresh Valley"
                required
                disabled={isSubmitting}
              />
            </label>

            <label className="field-stack">
              <span>Loại sản phẩm chính</span>
              <input
                type="text"
                value={form.primaryCategory}
                onChange={(event) => updateField("primaryCategory", event.target.value)}
                placeholder="Ví dụ: Rau củ"
                disabled={isSubmitting}
              />
            </label>

            <label className="field-stack">
              <span>Mặt hàng tiêu biểu</span>
              <input
                type="text"
                value={form.featuredProductName}
                onChange={(event) => updateField("featuredProductName", event.target.value)}
                placeholder="Ví dụ: Cà chua bi"
                disabled={isSubmitting}
              />
            </label>

            <label className="field-stack">
              <span>Giá thành tham chiếu (VND)</span>
              <input
                type="number"
                min="0"
                step="100"
                value={form.defaultUnitPrice}
                onChange={(event) => updateField("defaultUnitPrice", event.target.value)}
                placeholder="Ví dụ: 45000"
                disabled={isSubmitting}
              />
            </label>

            <label className="field-stack">
              <span>Định lượng (đơn vị giá)</span>
              <input
                type="text"
                list="supplier-pricing-units"
                value={form.pricingUnit}
                onChange={(event) => updateField("pricingUnit", event.target.value)}
                placeholder="Ví dụ: kg, g, lít, hộp..."
                maxLength={PRICING_UNIT_MAX_LENGTH}
                disabled={isSubmitting}
              />
              <datalist id="supplier-pricing-units">
                {PRICING_UNIT_SUGGESTIONS.map((unit) => (
                  <option key={unit} value={unit} />
                ))}
              </datalist>
            </label>

            <label className="field-stack">
              <span>Người liên hệ</span>
              <input
                type="text"
                value={form.contactName}
                onChange={(event) => updateField("contactName", event.target.value)}
                placeholder="Ví dụ: Ms. Hương"
                disabled={isSubmitting}
              />
            </label>

            <label className="field-stack">
              <span>Số điện thoại</span>
              <input
                type="text"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="Ví dụ: 0901234567"
                disabled={isSubmitting}
              />
            </label>

            <label className="field-stack">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="contact@supplier.vn"
                disabled={isSubmitting}
              />
            </label>

            <label className="field-stack">
              <span>Địa chỉ</span>
              <input
                type="text"
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
                placeholder="Ví dụ: Quận 7, TP.HCM"
                disabled={isSubmitting}
              />
            </label>

            <label className="field-stack field-stack-wide">
              <span>Ghi chú</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Điều kiện giao hàng, MOQ, khung giờ giao..."
                disabled={isSubmitting}
              />
            </label>
          </div>

          {submitError ? <p className="form-feedback error">{submitError}</p> : null}

          <div className="portioning-form-actions">
            <p className="field-help">
              Nếu nhập giá thành, cần nhập thêm mặt hàng tiêu biểu và đơn vị tính giá (ví dụ
              "kg", "hộp") để hệ thống hiển thị giá tham chiếu chính xác.
            </p>

            <div className="toolbar-actions">
              <button type="button" className="ghost-button" onClick={onClose} disabled={isSubmitting}>
                Hủy
              </button>
              <button type="submit" className="primary-button" disabled={isSubmitting}>
                {isSubmitting ? "Đang lưu..." : "Lưu nhà cung cấp"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
