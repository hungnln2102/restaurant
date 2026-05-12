import React, { useEffect, useState } from "react";
import { fetchMenuProductById } from "../api/menuProductsApi";

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(Number(value));
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

function formatStatus(status) {
  if (status === "active") {
    return "Đang bán";
  }
  if (status === "inactive") {
    return "Ngừng bán";
  }
  return status || "—";
}

export function MenuProductViewModal({ isOpen, menuProductId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !menuProductId) {
      setDetail(null);
      setError("");
      setLoading(false);
      return undefined;
    }

    // isCancelled guards against React StrictMode double-invocation and the
    // user closing the modal mid-fetch; without it we'd setState on an
    // unmounted modal and either flash stale data or warn in dev.
    let isCancelled = false;
    setLoading(true);
    setError("");
    setDetail(null);

    fetchMenuProductById(menuProductId)
      .then((data) => {
        if (isCancelled) {
          return;
        }
        setDetail(data);
      })
      .catch((requestError) => {
        if (isCancelled) {
          return;
        }
        setError(requestError.message || "Không tải được chi tiết sản phẩm.");
      })
      .finally(() => {
        if (isCancelled) {
          return;
        }
        setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, menuProductId]);

  if (!isOpen) {
    return null;
  }

  const components = Array.isArray(detail?.components) ? detail.components : [];

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-shell modal-shell--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-product-view-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="toolbar-kicker">Chi tiết sản phẩm</span>
            <h4 id="menu-product-view-title">
              {detail?.productName || "Định lượng sản phẩm"}
            </h4>
            <p>Xem nhanh thông tin món và thành phần định lượng.</p>
          </div>

          <button type="button" className="modal-close-button" onClick={onClose}>
            Đóng
          </button>
        </div>

        <div className="modal-form">
          {loading ? (
            <div className="empty-state">
              <strong>Đang tải chi tiết sản phẩm...</strong>
              <p>Hệ thống đang lấy thông tin món và thành phần.</p>
            </div>
          ) : error ? (
            <div className="empty-state error">
              <strong>Không tải được chi tiết sản phẩm</strong>
              <p>{error}</p>
            </div>
          ) : !detail ? (
            <div className="empty-state">
              <strong>Không có dữ liệu</strong>
              <p>Sản phẩm có thể đã bị xóa.</p>
            </div>
          ) : (
            <>
              <dl className="detail-grid">
                <div>
                  <dt>Tên sản phẩm</dt>
                  <dd>{detail.productName}</dd>
                </div>
                <div>
                  <dt>Nhóm sản phẩm</dt>
                  <dd>{detail.productCategory || "—"}</dd>
                </div>
                <div>
                  <dt>Đơn vị tính</dt>
                  <dd>{detail.servingUnit || "—"}</dd>
                </div>
                <div>
                  <dt>Đơn giá bán</dt>
                  <dd>{formatCurrency(detail.sellingPrice)}</dd>
                </div>
                <div>
                  <dt>Trạng thái</dt>
                  <dd>{formatStatus(detail.status)}</dd>
                </div>
                <div>
                  <dt>S.Cost</dt>
                  <dd>{formatCurrency(detail.totalCost)}</dd>
                </div>
                <div>
                  <dt>%Cost</dt>
                  <dd>{formatPercent(detail.costPercent)}</dd>
                </div>
              </dl>

              {detail.hasMissingPrice ? (
                <p className="field-help">
                  Một số nguyên liệu chưa có giá NCC nên S.Cost có thể chưa
                  bao gồm đầy đủ.
                </p>
              ) : null}

              <section className="menu-product-component-section">
                <header className="menu-product-component-header">
                  <div>
                    <h5>Thành phần / Nguyên liệu</h5>
                    <p className="field-help">
                      Bảng nguyên liệu/BTP cấu thành món, kèm đơn giá tham
                      chiếu và thành tiền.
                    </p>
                  </div>
                </header>

                {components.length === 0 ? (
                  <div className="empty-state inline">
                    <strong>Món chưa có thành phần định lượng</strong>
                    <p>Hãy bấm Sửa để bổ sung nguyên liệu/BTP.</p>
                  </div>
                ) : (
                  <div className="menu-product-component-table-wrapper">
                    <table className="menu-product-component-table">
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Loại</th>
                          <th>Tên NL</th>
                          <th>ĐVT</th>
                          <th>Đơn giá</th>
                          <th>Định lượng</th>
                          <th>Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {components.map((component, index) => {
                          const isSemi =
                            typeof component.notes === "string" &&
                            component.notes.trim().toUpperCase() === "BTP";
                          return (
                            <tr key={component.id}>
                              <td>{index + 1}</td>
                              <td>{isSemi ? "Bán thành phẩm" : "Nguyên liệu"}</td>
                              <td>{component.stockProductName || "—"}</td>
                              <td>{component.unit || "—"}</td>
                              <td>{formatCurrency(component.ingredientUnitPrice)}</td>
                              <td>{formatNumber(component.quantity)}</td>
                              <td>{formatCurrency(component.componentCost)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={6}>Tổng S.Cost</td>
                          <td>{formatCurrency(detail.totalCost)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
