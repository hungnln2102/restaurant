import React, { useEffect, useMemo, useState } from "react";
import { fetchInventoryProducts } from "../../inventory/api/stockOptionsApi";
import { createMenuProduct } from "../api/menuProductsApi";

const initialForm = {
  productName: "",
  productCategory: "",
  servingUnit: "",
  sellingPrice: "",
  status: "active",
};

const MAX_COMPONENTS = 50;
const MAX_COMPONENT_UNIT_LENGTH = 30;

let tempIdCounter = 0;

function createTempId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  tempIdCounter += 1;
  return `component-${tempIdCounter}`;
}

function createEmptyComponentRow() {
  return {
    tempId: createTempId(),
    category: "ingredient",
    stockProductId: "",
    unit: "",
    quantity: "",
  };
}

function validateForm(form) {
  const productName = form.productName.trim();
  const servingUnit = form.servingUnit.trim();

  if (!productName) {
    return "Tên sản phẩm là bắt buộc.";
  }

  if (productName.length > 200) {
    return "Tên sản phẩm không được vượt quá 200 ký tự.";
  }

  if (form.productCategory.trim().length > 120) {
    return "Nhóm sản phẩm không được vượt quá 120 ký tự.";
  }

  if (!servingUnit) {
    return "Đơn vị tính là bắt buộc.";
  }

  if (servingUnit.length > 50) {
    return "Đơn vị tính không được vượt quá 50 ký tự.";
  }

  if (form.sellingPrice !== "") {
    const numericPrice = Number(form.sellingPrice);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return "Đơn giá bán phải là số không âm.";
    }
  }

  if (!["active", "inactive"].includes(form.status)) {
    return "Trạng thái không hợp lệ.";
  }

  return "";
}

function validateComponents(components) {
  if (components.length === 0) {
    return "";
  }

  if (components.length > MAX_COMPONENTS) {
    return `Số lượng thành phần không được vượt quá ${MAX_COMPONENTS}.`;
  }

  const seenStockProductIds = new Set();

  for (let index = 0; index < components.length; index += 1) {
    const row = components[index];
    const position = index + 1;

    if (!row.stockProductId) {
      return `Vui lòng chọn nguyên liệu cho dòng #${position}.`;
    }

    const unit = row.unit.trim();
    if (!unit) {
      return `Đơn vị tính của dòng #${position} là bắt buộc.`;
    }

    if (unit.length > MAX_COMPONENT_UNIT_LENGTH) {
      return `Đơn vị tính của dòng #${position} không được vượt quá ${MAX_COMPONENT_UNIT_LENGTH} ký tự.`;
    }

    if (row.quantity === "" || row.quantity === null || row.quantity === undefined) {
      return `Định lượng của dòng #${position} là bắt buộc.`;
    }

    const quantity = Number(row.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return `Định lượng của dòng #${position} phải lớn hơn 0.`;
    }

    const stockProductId = Number(row.stockProductId);
    if (seenStockProductIds.has(stockProductId)) {
      return "Một nguyên liệu chỉ được khai báo một lần.";
    }
    seenStockProductIds.add(stockProductId);
  }

  return "";
}

function buildComponentsPayload(components) {
  return components.map((row, index) => ({
    stockProductId: Number(row.stockProductId),
    quantity: Number(row.quantity),
    unit: row.unit.trim(),
    sortOrder: index,
    notes: row.category === "semi" ? "BTP" : null,
  }));
}

export function MenuProductCreateModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [components, setComponents] = useState([]);
  const [stockProducts, setStockProducts] = useState([]);
  const [isLoadingStockProducts, setIsLoadingStockProducts] = useState(false);
  const [stockProductsError, setStockProductsError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setForm(initialForm);
      setComponents([]);
      setIsSubmitting(false);
      setSubmitError("");
      setStockProductsError("");
      return;
    }

    let isMounted = true;

    async function loadStockProducts() {
      setIsLoadingStockProducts(true);
      setStockProductsError("");

      try {
        const products = await fetchInventoryProducts();
        if (isMounted) {
          setStockProducts(Array.isArray(products) ? products : []);
        }
      } catch (loadError) {
        if (isMounted) {
          setStockProductsError(
            loadError.message || "Không thể tải danh sách nguyên liệu trong kho.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingStockProducts(false);
        }
      }
    }

    loadStockProducts();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const stockProductsById = useMemo(() => {
    const map = new Map();
    for (const product of stockProducts) {
      map.set(Number(product.id), product);
    }
    return map;
  }, [stockProducts]);

  if (!isOpen) {
    return null;
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateComponentRow(tempId, patch) {
    setComponents((current) =>
      current.map((row) => (row.tempId === tempId ? { ...row, ...patch } : row)),
    );
  }

  function handleStockProductChange(tempId, rawValue) {
    const stockProductId = rawValue;
    const numericId = Number(rawValue);
    const selectedProduct = Number.isFinite(numericId)
      ? stockProductsById.get(numericId)
      : null;
    const suggestedUnit =
      typeof selectedProduct?.unit === "string" ? selectedProduct.unit : "";

    setComponents((current) =>
      current.map((row) => {
        if (row.tempId !== tempId) {
          return row;
        }

        const shouldFillUnit = !row.unit.trim() && suggestedUnit;
        return {
          ...row,
          stockProductId,
          unit: shouldFillUnit ? suggestedUnit : row.unit,
        };
      }),
    );
  }

  function addComponentRow() {
    if (components.length >= MAX_COMPONENTS) {
      return;
    }
    setComponents((current) => [...current, createEmptyComponentRow()]);
  }

  function removeComponentRow(tempId) {
    setComponents((current) => current.filter((row) => row.tempId !== tempId));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationMessage = validateForm(form);
    if (validationMessage) {
      setSubmitError(validationMessage);
      return;
    }

    const componentsValidation = validateComponents(components);
    if (componentsValidation) {
      setSubmitError(componentsValidation);
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const payload = {
        productName: form.productName.trim(),
        productCategory: form.productCategory.trim() || null,
        servingUnit: form.servingUnit.trim(),
        sellingPrice: form.sellingPrice === "" ? null : Number(form.sellingPrice),
        status: form.status,
        components: buildComponentsPayload(components),
      };

      const created = await createMenuProduct(payload);
      onCreated?.(created);
      onClose?.();
    } catch (error) {
      setSubmitError(error.message || "Không thể tạo sản phẩm mới.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasStockProducts = stockProducts.length > 0;
  const disableAddRow =
    isSubmitting || isLoadingStockProducts || components.length >= MAX_COMPONENTS;

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-product-create-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="toolbar-kicker">Định lượng sản phẩm</span>
            <h4 id="menu-product-create-title">Tạo sản phẩm mới</h4>
            <p>Khai báo thành phẩm/BTP mới và liệt kê thành phần cấu thành món.</p>
          </div>

          <button type="button" className="modal-close-button" onClick={onClose} disabled={isSubmitting}>
            Đóng
          </button>
        </div>

        <form className="portioning-form modal-form" onSubmit={handleSubmit}>
          <div className="portioning-form-grid">
            <label className="field-stack">
              <span>Tên sản phẩm</span>
              <input
                type="text"
                value={form.productName}
                onChange={(event) => updateField("productName", event.target.value)}
                placeholder="Ví dụ: Phở bò tái"
                maxLength={200}
                required
                disabled={isSubmitting}
              />
            </label>

            <label className="field-stack">
              <span>Nhóm sản phẩm</span>
              <input
                type="text"
                value={form.productCategory}
                onChange={(event) => updateField("productCategory", event.target.value)}
                placeholder="Ví dụ: Món nước"
                maxLength={120}
                disabled={isSubmitting}
              />
            </label>

            <label className="field-stack">
              <span>Đơn vị tính</span>
              <input
                type="text"
                value={form.servingUnit}
                onChange={(event) => updateField("servingUnit", event.target.value)}
                placeholder="Ví dụ: nồi, phần, ly"
                maxLength={50}
                required
                disabled={isSubmitting}
              />
            </label>

            <label className="field-stack">
              <span>Đơn giá bán (VND)</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.sellingPrice}
                onChange={(event) => updateField("sellingPrice", event.target.value)}
                placeholder="Ví dụ: 65000"
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
                <option value="active">Đang bán</option>
                <option value="inactive">Ngừng bán</option>
              </select>
            </label>
          </div>

          <section className="menu-product-component-section">
            <header className="menu-product-component-header">
              <div>
                <h5>Thành phần / Nguyên liệu</h5>
                <p className="field-help">
                  Liệt kê nguyên liệu hoặc bán thành phẩm tạo nên món. Có thể bỏ trống để bổ sung sau.
                </p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={addComponentRow}
                disabled={disableAddRow}
              >
                + Thêm nguyên liệu
              </button>
            </header>

            {stockProductsError ? (
              <p className="form-feedback error">{stockProductsError}</p>
            ) : null}

            {!stockProductsError && !isLoadingStockProducts && !hasStockProducts ? (
              <p className="field-help menu-product-component-empty-hint">
                Chưa có nguyên liệu trong kho — hãy nhập kho trước. Bạn vẫn có thể tạo món
                không kèm thành phần và bổ sung sau.
              </p>
            ) : null}

            {components.length > 0 ? (
              <div className="menu-product-component-table-wrapper">
                <table className="menu-product-component-table">
                  <thead>
                    <tr>
                      <th className="menu-product-component-col-category">NL/BTP</th>
                      <th className="menu-product-component-col-name">Tên nguyên liệu</th>
                      <th className="menu-product-component-col-unit">ĐVT</th>
                      <th className="menu-product-component-col-quantity">Định lượng</th>
                      <th className="row-actions-col" aria-label="Hành động" />
                    </tr>
                  </thead>
                  <tbody>
                    {components.map((row, index) => (
                      <tr key={row.tempId}>
                        <td>
                          <select
                            value={row.category}
                            onChange={(event) =>
                              updateComponentRow(row.tempId, {
                                category: event.target.value,
                              })
                            }
                            disabled={isSubmitting}
                            aria-label={`Phân loại thành phần dòng ${index + 1}`}
                          >
                            <option value="ingredient">Nguyên liệu</option>
                            <option value="semi">Bán thành phẩm</option>
                          </select>
                        </td>
                        <td>
                          <select
                            value={row.stockProductId}
                            onChange={(event) =>
                              handleStockProductChange(row.tempId, event.target.value)
                            }
                            disabled={isSubmitting || isLoadingStockProducts || !hasStockProducts}
                            aria-label={`Chọn nguyên liệu dòng ${index + 1}`}
                          >
                            <option value="">
                              {isLoadingStockProducts
                                ? "Đang tải..."
                                : hasStockProducts
                                ? "-- Chọn nguyên liệu --"
                                : "Chưa có nguyên liệu trong kho"}
                            </option>
                            {stockProducts.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.productName}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(event) =>
                              updateComponentRow(row.tempId, { unit: event.target.value })
                            }
                            placeholder="kg, g, ml..."
                            maxLength={MAX_COMPONENT_UNIT_LENGTH}
                            disabled={isSubmitting}
                            aria-label={`Đơn vị tính dòng ${index + 1}`}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.0001"
                            value={row.quantity}
                            onChange={(event) =>
                              updateComponentRow(row.tempId, { quantity: event.target.value })
                            }
                            placeholder="0"
                            disabled={isSubmitting}
                            aria-label={`Định lượng dòng ${index + 1}`}
                          />
                        </td>
                        <td className="row-actions-col">
                          <button
                            type="button"
                            className="row-action-button row-action-danger"
                            onClick={() => removeComponentRow(row.tempId)}
                            disabled={isSubmitting}
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          {submitError ? <p className="form-feedback error">{submitError}</p> : null}

          <div className="portioning-form-actions">
            <p className="field-help">Có thể bổ sung thành phần/BTP cho món sau khi tạo sản phẩm.</p>

            <div className="toolbar-actions">
              <button type="button" className="ghost-button" onClick={onClose} disabled={isSubmitting}>
                Hủy
              </button>
              <button type="submit" className="primary-button" disabled={isSubmitting}>
                {isSubmitting ? "Đang lưu..." : "Lưu sản phẩm"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
