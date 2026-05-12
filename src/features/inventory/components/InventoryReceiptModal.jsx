import React, { useEffect, useMemo, useState } from "react";
import { fetchPortioningRules } from "../api/portioningApi";
import { createInventoryReceipt } from "../api/receiptApi";
import { fetchInventoryProducts, fetchInventorySuppliers } from "../api/stockOptionsApi";
import { SupplierCreateModal } from "../../suppliers/components/SupplierCreateModal";

const initialFormState = {
  stockProductId: "",
  ingredient: "",
  productCategory: "",
  supplierName: "",
  inputQuantity: "",
  unitPrice: "",
  inputUnit: "",
  conversionRuleId: "",
};

function buildInputUnitOptions(rules) {
  const safeRules = Array.isArray(rules) ? rules : [];

  return Array.from(new Set(safeRules.map((rule) => rule.stockUnit.trim()).filter(Boolean))).sort(
    (left, right) => left.localeCompare(right, "vi"),
  );
}

function getNextUnitPrice(currentValue, suggestedValue) {
  if (currentValue) {
    return currentValue;
  }

  if (suggestedValue === null || suggestedValue === undefined) {
    return currentValue;
  }

  return String(suggestedValue);
}

function formatSupplierReferencePrice(supplier) {
  if (!supplier || supplier.defaultUnitPrice === null || supplier.defaultUnitPrice === undefined) {
    return "";
  }

  const formattedPrice = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(Number(supplier.defaultUnitPrice));
  const currency = supplier.currencyCode || "VND";
  const unit =
    typeof supplier.pricingUnit === "string" && supplier.pricingUnit.trim()
      ? `/${supplier.pricingUnit.trim()}`
      : "";

  return `${formattedPrice} ${currency}${unit}`;
}

export function InventoryReceiptModal({ isOpen, onClose, onSaved }) {
  const [rules, setRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSupplierCreateOpen, setIsSupplierCreateOpen] = useState(false);
  const [form, setForm] = useState(initialFormState);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;

    async function loadOptions() {
      setLoading(true);
      setLoadError("");

      try {
        const [portioningData, productsData, suppliersData] = await Promise.all([
          fetchPortioningRules(),
          fetchInventoryProducts(),
          fetchInventorySuppliers(),
        ]);

        if (isMounted) {
          setRules(Array.isArray(portioningData) ? portioningData : []);
          setProducts(Array.isArray(productsData) ? productsData : []);
          setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
        }
      } catch (requestError) {
        if (isMounted) {
          setLoadError(requestError.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadOptions();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setForm(initialFormState);
      setLoadError("");
      setSubmitError("");
      setSubmitSuccess("");
      setIsSubmitting(false);
      setIsSupplierCreateOpen(false);
    }
  }, [isOpen]);

  const selectedRule = useMemo(
    () => rules.find((rule) => String(rule.id) === form.conversionRuleId),
    [form.conversionRuleId, rules],
  );
  const inputUnitOptions = useMemo(() => buildInputUnitOptions(rules), [rules]);
  const visibleRules = useMemo(() => {
    if (!form.inputUnit) {
      return rules;
    }

    return rules.filter((rule) => rule.stockUnit === form.inputUnit);
  }, [form.inputUnit, rules]);
  const isCustomProduct = form.stockProductId === "__custom__";

  if (!isOpen) {
    return null;
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleInputUnitChange(value) {
    setForm((current) => {
      const currentRule = rules.find((rule) => String(rule.id) === current.conversionRuleId);

      return {
        ...current,
        inputUnit: value,
        conversionRuleId:
          currentRule && currentRule.stockUnit !== value ? "" : current.conversionRuleId,
      };
    });
  }

  function handleConversionRuleChange(value) {
    const nextRule = rules.find((rule) => String(rule.id) === value);

    setForm((current) => ({
      ...current,
      conversionRuleId: value,
      inputUnit: nextRule ? nextRule.stockUnit : current.inputUnit,
    }));
  }

  function handleProductChange(value) {
    if (value === "__custom__") {
      setForm((current) => ({
        ...current,
        stockProductId: value,
        ingredient: "",
      }));
      return;
    }

    const selectedProduct = products.find((product) => String(product.id) === value);

    setForm((current) => ({
      ...current,
      stockProductId: value,
      ingredient: selectedProduct?.productName ?? "",
      productCategory: selectedProduct?.productCategory ?? current.productCategory,
    }));
  }

  function handleSupplierChange(value) {
    const selectedSupplier = suppliers.find((supplier) => String(supplier.id) === value);

    setForm((current) => ({
      ...current,
      supplierName: selectedSupplier?.supplierName ?? "",
      productCategory:
        current.productCategory || selectedSupplier?.primaryCategory || current.productCategory,
      unitPrice: getNextUnitPrice(current.unitPrice, selectedSupplier?.defaultUnitPrice),
    }));
  }

  function findSelectedSupplier() {
    if (!form.supplierName) {
      return null;
    }

    return (
      suppliers.find(
        (supplier) =>
          supplier.supplierName.trim().toLowerCase() === form.supplierName.trim().toLowerCase(),
      ) ?? null
    );
  }

  function getSelectedSupplierId() {
    const selectedSupplier = findSelectedSupplier();

    return selectedSupplier ? String(selectedSupplier.id) : "";
  }

  const selectedSupplier = findSelectedSupplier();
  const supplierReferencePrice = formatSupplierReferencePrice(selectedSupplier);

  function handleSupplierCreated(createdSupplier) {
    setSuppliers((current) => {
      const safeCurrent = Array.isArray(current) ? current : [];
      const existedIndex = safeCurrent.findIndex((item) => item.id === createdSupplier.id);

      if (existedIndex >= 0) {
        const next = [...safeCurrent];
        next[existedIndex] = createdSupplier;
        return next;
      }

      return [createdSupplier, ...safeCurrent];
    });

    setForm((current) => ({
      ...current,
      supplierName: createdSupplier.supplierName,
      productCategory: current.productCategory || createdSupplier.primaryCategory || "",
      unitPrice: getNextUnitPrice(current.unitPrice, createdSupplier.defaultUnitPrice),
    }));

    setIsSupplierCreateOpen(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const savedReceipt = await createInventoryReceipt(form);
      setSubmitSuccess(`Đã lưu phiếu nhập kho #${savedReceipt.id} vào hệ thống.`);
      setForm(initialFormState);
      onSaved?.(savedReceipt);
    } catch (requestError) {
      setSubmitError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="modal-overlay" role="presentation" onClick={onClose}>
        <div
          className="modal-shell"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inventory-receipt-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-header">
            <div>
              <span className="toolbar-kicker">Phiếu nhập kho</span>
              <h4 id="inventory-receipt-title">Tạo phiếu nhập kho</h4>
              <p>Nhập nguyên liệu, số lượng nhập, đơn vị nhập và chọn tỷ lệ quy đổi nếu cần.</p>
            </div>

            <button type="button" className="modal-close-button" onClick={onClose}>
              Đóng
            </button>
          </div>

          <form className="portioning-form modal-form" onSubmit={handleSubmit}>
            <div className="portioning-form-grid">
              <label className="field-stack">
                <span>Nguyên liệu</span>
                <select
                  value={form.stockProductId}
                  onChange={(event) => handleProductChange(event.target.value)}
                  required={!isCustomProduct}
                  disabled={loading || isSubmitting}
                >
                  <option value="">
                    {loading
                      ? "Đang tải sản phẩm..."
                      : products.length === 0
                        ? "Chưa có sản phẩm trong kho"
                        : "Chọn sản phẩm"}
                  </option>
                  {products.map((product) => (
                    <option key={product.id} value={String(product.id)}>
                      {product.productName}
                    </option>
                  ))}
                  <option value="__custom__">+ Sản phẩm mới</option>
                </select>
              </label>

              {isCustomProduct ? (
                <label className="field-stack">
                  <span>Tên sản phẩm mới</span>
                  <input
                    type="text"
                    value={form.ingredient}
                    onChange={(event) => updateField("ingredient", event.target.value)}
                    placeholder="Ví dụ: Cá hồi phi lê"
                    required
                    disabled={isSubmitting}
                  />
                </label>
              ) : null}

              <label className="field-stack">
                <span>Nhà cung ứng</span>
                <div className="field-inline">
                  <select
                    value={getSelectedSupplierId()}
                    onChange={(event) => handleSupplierChange(event.target.value)}
                    required
                    disabled={loading || isSubmitting || suppliers.length === 0}
                  >
                    <option value="">
                      {loading
                        ? "Đang tải nhà cung ứng..."
                        : suppliers.length === 0
                          ? "Chưa có nhà cung ứng"
                          : "Chọn nhà cung ứng"}
                    </option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={String(supplier.id)}>
                        {supplier.supplierName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="ghost-button field-inline-button"
                    onClick={() => setIsSupplierCreateOpen(true)}
                    disabled={isSubmitting}
                  >
                    Tạo mới NCC
                  </button>
                </div>
                {supplierReferencePrice ? (
                  <small className="field-help">
                    Giá tham chiếu NCC: {supplierReferencePrice}
                  </small>
                ) : null}
              </label>

              <label className="field-stack">
                <span>Loại sản phẩm</span>
                <input
                  type="text"
                  value={form.productCategory}
                  onChange={(event) => updateField("productCategory", event.target.value)}
                  placeholder="Ví dụ: Thịt tươi"
                  disabled={isSubmitting}
                />
              </label>

              <label className="field-stack">
                <span>Số lượng nhập</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.inputQuantity}
                  onChange={(event) => updateField("inputQuantity", event.target.value)}
                  placeholder="Ví dụ: 25"
                  required
                  disabled={isSubmitting}
                />
              </label>

              <label className="field-stack">
                <span>Giá thành / đơn vị (VND)</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={form.unitPrice}
                  onChange={(event) => updateField("unitPrice", event.target.value)}
                  placeholder="Ví dụ: 125000"
                  disabled={isSubmitting}
                />
              </label>

              <label className="field-stack">
                <span>Đơn vị nhập</span>
                <select
                  value={form.inputUnit}
                  onChange={(event) => handleInputUnitChange(event.target.value)}
                  required
                  disabled={loading || inputUnitOptions.length === 0 || isSubmitting}
                >
                  <option value="">
                    {loading
                      ? "Đang tải đơn vị nhập..."
                      : inputUnitOptions.length === 0
                        ? "Chưa có đơn vị nhập trong bảng quy đổi"
                        : "Chọn đơn vị nhập"}
                  </option>
                  {inputUnitOptions.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack field-stack-wide">
                <span>Tỷ lệ quy đổi</span>
                <select
                  value={form.conversionRuleId}
                  onChange={(event) => handleConversionRuleChange(event.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">Không áp dụng tỷ lệ quy đổi</option>
                  {visibleRules.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.ratioLabel}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {loading ? (
              <div className="empty-state">
                <strong>Đang tải danh mục phiếu nhập kho...</strong>
                <p>Hệ thống đang đọc sản phẩm, nhà cung ứng và tỷ lệ quy đổi từ database.</p>
              </div>
            ) : null}

            {loadError ? (
              <div className="empty-state error">
                <strong>Không tải được danh mục phiếu nhập kho</strong>
                <p>{loadError}</p>
              </div>
            ) : null}

            {selectedRule ? (
              <div className="modal-highlight">
                <strong>Tỷ lệ đang chọn</strong>
                <p>{selectedRule.ratioLabel}</p>
              </div>
            ) : (
              <div className="modal-highlight muted">
                <strong>Chưa chọn tỷ lệ quy đổi</strong>
                <p>Phiếu nhập này sẽ lưu trực tiếp mà không gắn với quy đổi định lượng.</p>
              </div>
            )}

            {submitError ? <p className="form-feedback error">{submitError}</p> : null}
            {submitSuccess ? <p className="form-feedback success">{submitSuccess}</p> : null}

            <div className="portioning-form-actions">
              <p className="field-help">
                Bỏ qua tỷ lệ quy đổi nếu nguyên liệu nhập kho chưa cần chuẩn hóa ngay. Nếu chưa có NCC thì bấm
                "Tạo mới NCC".
              </p>

              <div className="toolbar-actions">
                <button type="button" className="ghost-button" onClick={onClose} disabled={isSubmitting}>
                  Hủy
                </button>
                <button type="submit" className="primary-button" disabled={isSubmitting}>
                  {isSubmitting ? "Đang lưu..." : "Lưu phiếu nhập"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <SupplierCreateModal
        isOpen={isSupplierCreateOpen}
        onClose={() => setIsSupplierCreateOpen(false)}
        onCreated={handleSupplierCreated}
      />
    </>
  );
}
