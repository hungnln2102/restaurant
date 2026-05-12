import React, { useEffect, useMemo, useState } from "react";
import { fetchOrdersByMenuProduct } from "../api/productOrdersApi";

const ORDER_TYPE_META = {
  dine_in: { label: "Ăn tại quán", tone: "safe" },
  takeaway: { label: "Mua mang về", tone: "warning" },
};

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return `${new Intl.NumberFormat("vi-VN").format(numeric)}đ`;
}

function formatProfit(value) {
  if (value === null || value === undefined || value === "") {
    return { text: "—", isNegative: false };
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return { text: "—", isNegative: false };
  }

  return {
    text: `${new Intl.NumberFormat("vi-VN").format(numeric)}đ`,
    isNegative: numeric < 0,
  };
}

function formatQuantity(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return new Intl.NumberFormat("vi-VN").format(numeric);
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const datePart = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

  const timePart = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${timePart} ${datePart}`;
}

function renderOrderTypeChip(orderType) {
  const meta = ORDER_TYPE_META[orderType] || { label: orderType || "—", tone: "muted" };
  return <span className={`status-chip ${meta.tone}`}>{meta.label}</span>;
}

function summarizeOrders(orders) {
  return orders.reduce(
    (acc, order) => {
      const total = Number(order?.totalAmount);
      const profit = Number(order?.profitAmount);

      acc.count += 1;

      if (Number.isFinite(total)) {
        acc.totalRevenue += total;
      }

      if (Number.isFinite(profit)) {
        acc.totalProfit += profit;
      }

      return acc;
    },
    { count: 0, totalRevenue: 0, totalProfit: 0 },
  );
}

export function ProductOrdersModal({ isOpen, salesPlanRow, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const menuProductId = salesPlanRow?.menuProductId ?? null;

  useEffect(() => {
    if (!isOpen || !menuProductId) {
      return undefined;
    }

    let isCancelled = false;

    async function loadOrders() {
      setLoading(true);
      setError("");

      try {
        const data = await fetchOrdersByMenuProduct(menuProductId);

        if (isCancelled) {
          return;
        }

        setOrders(Array.isArray(data) ? data : []);
      } catch (requestError) {
        if (isCancelled) {
          return;
        }

        setError(requestError.message || "Không thể tải lịch sử đơn hàng.");
        setOrders([]);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, menuProductId]);

  useEffect(() => {
    if (!isOpen) {
      setOrders([]);
      setError("");
      setLoading(false);
    }
  }, [isOpen]);

  const summary = useMemo(() => summarizeOrders(orders), [orders]);

  if (!isOpen || !salesPlanRow) {
    return null;
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-shell modal-shell--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-orders-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="toolbar-kicker">Lịch sử đơn hàng</span>
            <h4 id="product-orders-modal-title">{salesPlanRow.productName}</h4>
            <p>
              Danh sách các đơn hàng đã ghi nhận cho sản phẩm này (mới nhất trước,
              tối đa 100 đơn).
            </p>
          </div>

          <button type="button" className="modal-close-button" onClick={onClose}>
            Đóng
          </button>
        </div>

        <div className="modal-form">
          {loading ? (
            <div className="empty-state">
              <strong>Đang tải lịch sử đơn hàng...</strong>
              <p>Vui lòng đợi trong giây lát.</p>
            </div>
          ) : error ? (
            <div className="empty-state error">
              <strong>Không tải được lịch sử đơn hàng</strong>
              <p>{error}</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <strong>Chưa có đơn hàng nào cho sản phẩm này.</strong>
              <p>
                Khi có đơn hàng được ghi nhận, lịch sử sẽ xuất hiện ở đây kèm
                doanh thu và lợi nhuận của từng đơn.
              </p>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Ngày giờ</th>
                      <th>Loại</th>
                      <th>Số lượng</th>
                      <th>Giá bán</th>
                      <th>Tổng tiền</th>
                      <th>Lợi nhuận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const profit = formatProfit(order.profitAmount);

                      return (
                        <tr key={order.id}>
                          <td>
                            <strong>{order.orderCode}</strong>
                          </td>
                          <td>{formatDateTime(order.orderedAt)}</td>
                          <td>{renderOrderTypeChip(order.orderType)}</td>
                          <td>{formatQuantity(order.quantity)}</td>
                          <td>{formatCurrency(order.unitPrice)}</td>
                          <td>{formatCurrency(order.totalAmount)}</td>
                          <td style={profit.isNegative ? { color: "#b3261e" } : undefined}>
                            {profit.text}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <dl className="detail-grid" style={{ marginTop: 18 }}>
                <div>
                  <dt>Tổng số đơn</dt>
                  <dd>{formatQuantity(summary.count)}</dd>
                </div>
                <div>
                  <dt>Tổng doanh thu</dt>
                  <dd>{formatCurrency(summary.totalRevenue)}</dd>
                </div>
                <div>
                  <dt>Tổng lợi nhuận</dt>
                  <dd
                    style={
                      summary.totalProfit < 0 ? { color: "#b3261e" } : undefined
                    }
                  >
                    {formatCurrency(summary.totalProfit)}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
