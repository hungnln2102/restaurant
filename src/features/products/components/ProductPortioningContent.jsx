import React, { useEffect, useState } from "react";
import { deleteMenuProduct } from "../api/menuProductsApi";
import { fetchProductPortioning } from "../api/productPortioningApi";
import { MenuProductCreateModal } from "./MenuProductCreateModal";
import { MenuProductEditModal } from "./MenuProductEditModal";
import { MenuProductViewModal } from "./MenuProductViewModal";

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatCurrency(value) {
  if (value === null || value === undefined) {
    return "Chưa có";
  }

  return `${formatNumber(value)} đ`;
}

function formatPercent(value) {
  if (value === null || value === undefined) {
    return "Không áp dụng";
  }

  return `${formatNumber(value)}%`;
}

export function ProductPortioningContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedItemIds, setExpandedItemIds] = useState(() => new Set());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [reloadWarning, setReloadWarning] = useState("");
  const [viewingId, setViewingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [actionError, setActionError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const response = await fetchProductPortioning();
      const nextItems = Array.isArray(response?.items) ? response.items : [];
      setItems(nextItems);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreated() {
    setReloadWarning("");
    const reloaded = await loadData();

    if (!reloaded) {
      setReloadWarning(
        "Đã tạo sản phẩm nhưng chưa làm mới được bảng. Hãy bấm \"Tạo sản phẩm mới\" rồi đóng lại hoặc tải lại trang.",
      );
    }
  }

  async function handleSaved() {
    setReloadWarning("");
    setActionError("");
    const reloaded = await loadData();

    if (!reloaded) {
      setReloadWarning(
        "Đã cập nhật sản phẩm nhưng chưa làm mới được bảng. Hãy tải lại trang.",
      );
    }
  }

  async function handleDelete(item) {
    if (deletingId !== null) {
      // Guard against rapid double-clicks while a previous DELETE is in flight.
      return;
    }

    const confirmed =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(
            `Xóa sản phẩm "${item.productName}"? Hành động này không thể hoàn tác và sẽ xóa luôn các đơn hàng / kế hoạch bán liên quan.`,
          )
        : true;

    if (!confirmed) {
      return;
    }

    setDeletingId(item.id);
    setActionError("");

    try {
      await deleteMenuProduct(item.id);
      const reloaded = await loadData();
      if (!reloaded) {
        setReloadWarning(
          "Đã xóa sản phẩm nhưng chưa làm mới được bảng. Hãy tải lại trang.",
        );
      }
    } catch (deleteError) {
      setActionError(deleteError.message || "Không thể xóa sản phẩm.");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleExpanded(itemId) {
    setExpandedItemIds((current) => {
      const next = new Set(current);

      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }

      return next;
    });
  }

  return (
    <article className="panel-card">
      <div className="panel-heading">
        <div>
          <span>Định lượng sản phẩm</span>
          <h4>Bảng thành phần/BTP của món</h4>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => setIsCreateOpen(true)}
          disabled={loading}
        >
          Tạo sản phẩm mới
        </button>
      </div>

      {reloadWarning ? <p className="form-feedback error">{reloadWarning}</p> : null}
      {actionError ? <p className="form-feedback error">{actionError}</p> : null}

      {loading ? (
        <div className="empty-state">
          <strong>Đang tải bảng định lượng sản phẩm</strong>
          <p>Hệ thống đang tổng hợp thành phần món từ kho nguyên liệu.</p>
        </div>
      ) : error ? (
        <div className="empty-state error">
          <strong>Không tải được bảng định lượng sản phẩm</strong>
          <p>{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <strong>Chưa có món thành phẩm</strong>
          <p>Hãy thêm dữ liệu vào bảng menu_products và menu_product_components để hiển thị định lượng.</p>
        </div>
      ) : (
        <div className="product-portioning-scroll">
          <table className="product-portioning-master-table">
            <thead>
              <tr>
                <th className="col-toggle" aria-label="Mở rộng" />
                <th>Thành phẩm/BTP</th>
                <th>ĐVT</th>
                <th>Đơn giá bán</th>
                <th>S.Cost</th>
                <th>%Cost</th>
                <th className="row-actions-col">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isExpanded = expandedItemIds.has(item.id);

                return (
                  <React.Fragment key={item.id}>
                    <tr
                      className={`product-portioning-master-row ${isExpanded ? "expanded" : ""}`}
                      onClick={() => toggleExpanded(item.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleExpanded(item.id);
                        }
                      }}
                    >
                      <td className="col-toggle">
                        <span className={`chevron ${isExpanded ? "open" : ""}`} aria-hidden="true">
                          ›
                        </span>
                      </td>
                      <td>
                        <strong>{item.productName}</strong>
                        {item.productCategory ? (
                          <span className="muted-text"> · {item.productCategory}</span>
                        ) : null}
                      </td>
                      <td>{item.servingUnit || "Chưa có"}</td>
                      <td>{formatCurrency(item.sellingPrice)}</td>
                      <td>{formatCurrency(item.totalCost)}</td>
                      <td>{formatPercent(item.costPercent)}</td>
                      <td
                        className="row-actions-col"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="row-actions">
                          <button
                            type="button"
                            className="row-action-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setViewingId(item.id);
                            }}
                          >
                            Xem
                          </button>
                          <button
                            type="button"
                            className="row-action-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingId(item.id);
                            }}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="row-action-button row-action-danger"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDelete(item);
                            }}
                            disabled={deletingId === item.id}
                          >
                            {deletingId === item.id ? "Đang xóa..." : "Xóa"}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded ? (
                      <tr className="product-portioning-detail-row">
                        <td colSpan={7}>
                          {item.rows.length === 0 ? (
                            <div className="empty-state inline">
                              <strong>Món chưa có thành phần định lượng</strong>
                              <p>Hãy khai báo nguyên liệu/BTP để hệ thống tính cost.</p>
                            </div>
                          ) : (
                            <div className="product-portioning-detail">
                              <table className="product-portioning-table">
                                <thead>
                                  <tr>
                                    <th>STT</th>
                                    <th>NL/BTP</th>
                                    <th>Tên NL</th>
                                    <th>ĐVT</th>
                                    <th>Đơn giá</th>
                                    <th>Định lượng</th>
                                    <th>Thành tiền</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.rows.map((row) => (
                                    <tr key={row.id}>
                                      <td>{row.stt}</td>
                                      <td>{row.ingredientCategory || "Chưa phân nhóm"}</td>
                                      <td>{row.ingredientName}</td>
                                      <td>{row.ingredientUnit}</td>
                                      <td>{formatCurrency(row.ingredientUnitPrice)}</td>
                                      <td>{formatNumber(row.quantity)}</td>
                                      <td>{formatCurrency(row.componentCost)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr>
                                    <td colSpan={6}>Tổng S.Cost</td>
                                    <td>{formatCurrency(item.totalCost)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <MenuProductCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleCreated}
      />

      <MenuProductViewModal
        isOpen={viewingId !== null}
        menuProductId={viewingId}
        onClose={() => setViewingId(null)}
      />

      <MenuProductEditModal
        isOpen={editingId !== null}
        menuProductId={editingId}
        onClose={() => setEditingId(null)}
        onSaved={handleSaved}
      />
    </article>
  );
}
