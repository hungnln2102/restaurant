import React, { useEffect, useMemo, useState } from "react";
import { fetchInventoryProducts } from "../../inventory/api/stockOptionsApi";
import { fetchMenuProductById, updateMenuProduct } from "../api/menuProductsApi";

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

function buildComponentRowFromDetail(component) {
  const noteText =
    typeof component?.notes === "string" ? component.notes.trim().toUpperCase() : "";
  return {
    tempId: createTempId(),
    category: noteText === "BTP" ? "semi" : "ingredient",
    stockProductId:
      component?.stockProductId !== undefined && component?.stockProductId !== null
        ? String(component.stockProductId)
        : "",
    unit: component?.unit ?? "",
    quantity:
      component?.quantity !== undefined && component?.quantity !== null
        ? String(component.quantity)
        : "",
  };
}

function buildFormFromDetail(detail) {
  return {
    productName: detail?.productName ?? "",
    productCategory: detail?.productCategory ?? "",
    servingUnit: detail?.servingUnit ?? "",
    sellingPrice:
      detail?.sellingPrice === null || detail?.sellingPrice === undefined
        ? ""
        : String(detail.sellingPrice),
    status: detail?.status === "inactive" ? "inactive" : "active",
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

export function MenuProductEditModal({ isOpen, menuProductId, onClose, onSaved }) {
  const [form, setForm] = useState(() => buildFormFromDetail(null));
  const [components, setComponents] = useState([]);
  const [stockProducts, setStockProducts] = useState([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [isLoadingStockProducts, setIsLoadingStockProducts] = useState(false);
  const [stockProductsError, setStockProductsError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Reset every piece of local state when the modal closes so the next open
  // never flashes stale data from a previous menu product.
  useEffect(() => {
    if (!isOpen) {
      setForm(buildFormFromDetail(null));
      setComponents([]);
      setIsSubmitting(false);
      setSubmitError("");
      setDetailError("");
      setStockProductsError("");
      setIsLoadingDetail(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !menuProductId) {
      return undefined;
    }

    let isCancelled = false;

    async function loadDetail() {
      setIsLoadingDetail(true);
      setDetailError("");

      try {
        const detail = await fetchMenuProductById(menuProductId);
        if (isCancelled) {
          return;
        }
        setForm(buildFormFromDetail(detail));
        const detailComponents = Array.isArray(detail?.components)
          ? detail.components.map(buildComponentRowFromDetail)
          : [];
        setComponents(detailComponents);
      } catch (loadError) {
        if (isCancelled) {
          return;
        }
        setDetailError(
          loadError.message || "Không tải được chi tiết sản phẩm.",
        );
      } finally {
        if (isCancelled) {
          return;
        }
        setIsLoadingDetail(false);
      }
    }

    loadDetail();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, menuProductId]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    let isCancelled = false;

    async function loadStockProducts() {
      setIsLoadingStockProducts(true);
      setStockProductsError("");

      try {
        const products = await fetchInventoryProducts();
        if (isCancelled) {
          return;
        }
        setStockProducts(Array.isArray(products) ? products : []);
      } catch (loadError) {
        if (isCancelled) {
          return;
        }
        setStockProductsError(
          loadError.message || "Không thể tải danh sách nguyên liệu trong kho.",
        );
      } finally {
        if (isCancelled) {
          return;
        }
        setIsLoadingStockProducts(false);
      }
    }

    loadStockProducts();

    return () => {
      isCancelled = true;
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

    if (detailError) {
      // Disallow submitting against stale or unknown server-side state.
      return;
    }

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

      const updated = await updateMenuProduct(menuProductId, payload);
      onSaved?.(updated);
      onClose?.();
    } catch (error) {
      setSubmitError(error.message || "Không thể cập nhật sản phẩm.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasStockProducts = stockProducts.length > 0;
  const disableInputs = isSubmitting || isLoadingDetail || Boolean(detailError);
  const disableAddRow =
    disableInputs || isLoadingStockProducts || components.length >= MAX_COMPONENTS;
  const disableSubmit = disableInputs;

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-product-edit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="toolbar-kicker">Định lượng sản phẩm</span>
            <h4 id="menu-product-edit-title">Sửa sản phẩm</h4>
            <p>Cập nhật thông tin sản phẩm và danh sách thành phần định lượng.</p>
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

        {isLoadingDetail ? (
          <div className="modal-form">
            <div className="empty-state">
              <strong>Đang tải chi tiết sản phẩm...</strong>
              <p>Hệ thống đang lấy thông tin sản phẩm và thành phần.</p>
            </div>
          </div>
        ) : detailError ? (
          <div className="modal-form">
            <div className="empty-state error">
              <strong>Không tải được chi tiết sản phẩm</strong>
              <p>{detailError}</p>
            </div>
          </div>
        ) : (
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
                  disabled={disableInputs}
                />
              </label>

              <label className="field-stack">
                <span>Nhóm sản phẩm</span>
                <input
                  type="text"
                  value={form.productCategory}
                  onChange={(event) =>
                    updateField("productCategory", event.target.value)
                  }
                  placeholder="Ví dụ: Món nước"
                  maxLength={120}
                  disabled={disableInputs}
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
                  disabled={disableInputs}
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
                  disabled={disableInputs}
                />
              </label>

              <label className="field-stack">
                <span>Trạng thái</span>
                <select
                  value={form.status}
                  onChange={(event) => updateField("status", event.target.value)}
                  disabled={disableInputs}
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
                    Thêm/xóa/sửa nguyên liệu hoặc bán thành phẩm. Có thể bỏ
                    trống để giữ món không kèm thành phần.
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
                  Chưa có nguyên liệu trong kho — hãy nhập kho trước. Có thể
                  giữ món không kèm thành phần và bổ sung sau.
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
                              disabled={disableInputs}
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
                              disabled={
                                disableInputs ||
                                isLoadingStockProducts ||
                                !hasStockProducts
                              }
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
                              disabled={disableInputs}
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
                                updateComponentRow(row.tempId, {
                                  quantity: event.target.value,
                                })
                              }
                              placeholder="0"
                              disabled={disableInputs}
                              aria-label={`Định lượng dòng ${index + 1}`}
                            />
                          </td>
                          <td className="row-actions-col">
                            <button
                              type="button"
                              className="row-action-button row-action-danger"
                              onClick={() => removeComponentRow(row.tempId)}
                              disabled={disableInputs}
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
              <p className="field-help">
                Lưu ý: Lưu sẽ thay thế toàn bộ thành phần hiện tại bằng danh
                sách trong form.
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
                  disabled={disableSubmit}
                >
                  {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
