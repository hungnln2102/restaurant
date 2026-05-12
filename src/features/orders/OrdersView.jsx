import React, { useEffect, useMemo, useState } from "react";
import { StatCards } from "../../shared/components/StatCards";
import { fetchAllOrders } from "../products/api/productOrdersApi";

const ORDER_TYPE_META = {
  dine_in: { label: "Ăn tại quán", tone: "safe" },
  takeaway: { label: "Mua mang về", tone: "warning" },
};

const ORDER_TYPE_FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "dine_in", label: "Ăn tại quán" },
  { id: "takeaway", label: "Mua mang về" },
];

const DATE_RANGE_FILTERS = [
  { id: "today", label: "Hôm nay", days: 0 },
  { id: "7days", label: "7 ngày", days: 7 },
  { id: "30days", label: "30 ngày", days: 30 },
  { id: "all", label: "Tất cả", days: null },
];

const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return `${new Intl.NumberFormat("vi-VN").format(Math.round(numeric))}đ`;
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
    text: `${new Intl.NumberFormat("vi-VN").format(Math.round(numeric))}đ`,
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

function formatPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }
  return `${new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
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

function buildDateRange(rangeId) {
  const meta = DATE_RANGE_FILTERS.find((item) => item.id === rangeId) ?? DATE_RANGE_FILTERS[1];

  if (meta.days === null) {
    return { fromDate: null, toDate: null };
  }

  const now = new Date();
  const toDate = new Date(now);
  // Day-aligned start so "Hôm nay" returns orders from 00:00:00 of the local
  // day, not from rolling 24h. Server then receives the ISO timestamp.
  const fromDate = new Date(now);
  fromDate.setHours(0, 0, 0, 0);

  if (meta.days > 0) {
    fromDate.setDate(fromDate.getDate() - meta.days + 1);
  }

  return { fromDate: fromDate.toISOString(), toDate: toDate.toISOString() };
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

export function OrdersView() {
  const [orderType, setOrderType] = useState("all");
  const [dateRange, setDateRange] = useState("7days");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // Server-side filters trigger a fresh page (offset=0); the load-more flow
  // below re-uses the same filters but increments the offset.
  useEffect(() => {
    let isCancelled = false;

    async function loadFirstPage() {
      setLoading(true);
      setError("");
      setOffset(0);

      try {
        const range = buildDateRange(dateRange);
        const response = await fetchAllOrders({
          orderType: orderType === "all" ? null : orderType,
          fromDate: range.fromDate,
          toDate: range.toDate,
          search: submittedSearch || null,
          limit: PAGE_SIZE,
          offset: 0,
        });

        if (isCancelled) {
          return;
        }

        setOrders(response.items);
        setTotal(response.total);
      } catch (requestError) {
        if (isCancelled) {
          return;
        }
        setError(requestError.message || "Không thể tải danh sách đơn hàng.");
        setOrders([]);
        setTotal(0);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadFirstPage();

    return () => {
      isCancelled = true;
    };
  }, [orderType, dateRange, submittedSearch]);

  async function handleLoadMore() {
    if (loadingMore || loading) {
      return;
    }

    const nextOffset = offset + PAGE_SIZE;
    if (nextOffset >= total) {
      return;
    }

    setLoadingMore(true);
    setError("");

    try {
      const range = buildDateRange(dateRange);
      const response = await fetchAllOrders({
        orderType: orderType === "all" ? null : orderType,
        fromDate: range.fromDate,
        toDate: range.toDate,
        search: submittedSearch || null,
        limit: PAGE_SIZE,
        offset: nextOffset,
      });

      setOrders((current) => [...current, ...response.items]);
      setTotal(response.total);
      setOffset(nextOffset);
    } catch (requestError) {
      setError(requestError.message || "Không thể tải thêm đơn hàng.");
    } finally {
      setLoadingMore(false);
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  function handleResetSearch() {
    setSearch("");
    setSubmittedSearch("");
  }

  const summary = useMemo(() => summarizeOrders(orders), [orders]);
  const profitMargin = useMemo(() => {
    if (summary.totalRevenue <= 0) {
      return null;
    }
    return (summary.totalProfit / summary.totalRevenue) * 100;
  }, [summary]);

  const stats = useMemo(
    () => [
      {
        label: "Tổng số đơn",
        value: formatQuantity(total),
        note: orders.length < total
          ? `Đang hiển thị ${formatQuantity(orders.length)} đơn — tải thêm để xem hết.`
          : "Khớp đủ với bộ lọc hiện tại.",
      },
      {
        label: "Tổng doanh thu",
        value: formatCurrency(summary.totalRevenue),
        note: "Tính trên các đơn đang hiển thị.",
      },
      {
        label: "Tổng lợi nhuận",
        value: formatCurrency(summary.totalProfit),
        note:
          summary.totalProfit < 0
            ? "Lợi nhuận âm — kiểm tra giá vốn và bộ lọc."
            : "Tính trên các đơn đang hiển thị.",
      },
      {
        label: "Biên lợi nhuận TB",
        value: formatPercent(profitMargin),
        note: "Lợi nhuận chia cho doanh thu của các đơn đang hiển thị.",
      },
    ],
    [orders.length, profitMargin, summary, total],
  );

  const canLoadMore = orders.length < total && orders.length < MAX_PAGE_SIZE;
  const isEmpty = !loading && !error && orders.length === 0;

  return (
    <section className="feature-page">
      <div className="feature-toolbar">
        <div>
          <span className="toolbar-kicker">Tổng hợp bán hàng</span>
          <h3>Lịch sử đơn hàng toàn hệ thống</h3>
        </div>
      </div>

      <StatCards items={stats} />

      <article className="panel-card">
        <div className="panel-heading">
          <div>
            <span>Bộ lọc</span>
            <h4>Tìm và lọc đơn hàng</h4>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginTop: 18,
          }}
        >
          <div>
            <label
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                display: "block",
                marginBottom: 6,
              }}
            >
              Loại đơn
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ORDER_TYPE_FILTERS.map((option) => {
                const isActive = option.id === orderType;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`inventory-subnav-tab ${isActive ? "active" : ""}`}
                    onClick={() => setOrderType(option.id)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                display: "block",
                marginBottom: 6,
              }}
            >
              Khoảng thời gian
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DATE_RANGE_FILTERS.map((option) => {
                const isActive = option.id === dateRange;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`inventory-subnav-tab ${isActive ? "active" : ""}`}
                    onClick={() => setDateRange(option.id)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSearchSubmit}>
            <label
              htmlFor="order-search-input"
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                display: "block",
                marginBottom: 6,
              }}
            >
              Tìm theo mã đơn
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="order-search-input"
                type="search"
                placeholder="VD: ORD-20260513-..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  borderRadius: 16,
                  border: "1px solid rgba(20, 38, 31, 0.12)",
                  background: "rgba(255, 255, 255, 0.88)",
                }}
              />
              <button type="submit" className="ghost-button">
                Tìm
              </button>
              {submittedSearch ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={handleResetSearch}
                >
                  Xóa
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </article>

      <article className="panel-card">
        <div className="panel-heading">
          <div>
            <span>Lịch sử đơn hàng</span>
            <h4>
              {loading
                ? "Đang tải..."
                : `Hiển thị ${formatQuantity(orders.length)}/${formatQuantity(total)} đơn`}
            </h4>
          </div>
        </div>

        {error ? (
          <div className="empty-state error" style={{ marginTop: 12 }}>
            <strong>Không tải được danh sách đơn hàng</strong>
            <p>{error}</p>
          </div>
        ) : null}

        {loading && orders.length === 0 ? (
          <div className="empty-state">
            <strong>Đang tải lịch sử đơn hàng</strong>
            <p>Hệ thống đang lấy dữ liệu, vui lòng đợi trong giây lát.</p>
          </div>
        ) : isEmpty ? (
          <div className="empty-state">
            <strong>Chưa có đơn hàng phù hợp với bộ lọc</strong>
            <p>
              Thay đổi loại đơn hoặc khoảng thời gian để xem nhiều dữ liệu hơn,
              hoặc tạo đơn mới từ trang Sản phẩm.
            </p>
          </div>
        ) : orders.length > 0 ? (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Ngày giờ</th>
                    <th>Sản phẩm</th>
                    <th>Loại</th>
                    <th>SL</th>
                    <th>Giá bán</th>
                    <th>Tổng tiền</th>
                    <th>Cost</th>
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
                        <td>{order.productName || "—"}</td>
                        <td>{renderOrderTypeChip(order.orderType)}</td>
                        <td>{formatQuantity(order.quantity)}</td>
                        <td>{formatCurrency(order.unitPrice)}</td>
                        <td>{formatCurrency(order.totalAmount)}</td>
                        <td>{formatCurrency(order.costAmount)}</td>
                        <td style={profit.isNegative ? { color: "#b3261e" } : undefined}>
                          {profit.text}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {canLoadMore ? (
              <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Đang tải thêm..." : `Tải thêm ${PAGE_SIZE} đơn`}
                </button>
              </div>
            ) : null}

            {orders.length >= MAX_PAGE_SIZE && total > MAX_PAGE_SIZE ? (
              <p
                style={{
                  marginTop: 12,
                  textAlign: "center",
                  fontSize: "0.85rem",
                  color: "var(--muted)",
                }}
              >
                Đã đạt giới hạn hiển thị {MAX_PAGE_SIZE} đơn. Hãy thu hẹp bộ lọc để
                xem dữ liệu cũ hơn.
              </p>
            ) : null}
          </>
        ) : null}
      </article>
    </section>
  );
}
