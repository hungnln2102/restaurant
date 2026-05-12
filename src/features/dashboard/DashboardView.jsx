import React, { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchDashboardOverview } from "./api/dashboardApi";

const RANGE_OPTIONS = [
  { id: "today", label: "Hôm nay" },
  { id: "7d", label: "7 ngày" },
  { id: "30d", label: "30 ngày" },
];

const DEFAULT_RANGE = "7d";

const SERIES_COLORS = {
  revenue: "#1f6feb",
  profit: "#2f8a4f",
  inboundCost: "#d77a2d",
};

const RANGE_LABEL_BY_ID = {
  today: "hôm qua",
  "7d": "7 ngày trước",
  "30d": "30 ngày trước",
};

function formatCurrency(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return `${new Intl.NumberFormat("vi-VN").format(Math.round(numeric))}đ`;
}

// Compact currency for chart axis labels — keeps tick widths constrained even
// when totals reach hundreds of millions.
function formatCompactCurrency(value) {
  if (value === null || value === undefined) {
    return "0";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0";
  }

  const abs = Math.abs(numeric);
  const sign = numeric < 0 ? "-" : "";

  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)}K`;
  }
  return `${sign}${Math.round(abs)}`;
}

function formatPercent(value, fractionDigits = 1) {
  if (value === null || value === undefined) {
    return "—";
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  return `${new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(numeric)}%`;
}

function formatInteger(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  return new Intl.NumberFormat("vi-VN").format(Math.round(numeric));
}

function formatDayLabel(rawValue) {
  if (typeof rawValue !== "string" || rawValue.length < 10) {
    return rawValue ?? "";
  }
  // Stored as YYYY-MM-DD — render as DD/MM (compact for axis labels).
  const [, month, day] = rawValue.split("-");
  if (!month || !day) {
    return rawValue;
  }
  return `${day}/${month}`;
}

function describeDelta(deltaPercent) {
  if (deltaPercent === null || deltaPercent === undefined) {
    return { text: "—", direction: "neutral" };
  }
  const numeric = Number(deltaPercent);
  if (!Number.isFinite(numeric)) {
    return { text: "—", direction: "neutral" };
  }
  if (numeric === 0) {
    return { text: "0%", direction: "neutral" };
  }
  const arrow = numeric > 0 ? "↑" : "↓";
  const direction = numeric > 0 ? "up" : "down";
  return {
    text: `${arrow} ${formatPercent(Math.abs(numeric))}`,
    direction,
  };
}

// "Up" is desirable for revenue/profit but undesirable for cost. We let each
// stat card decide its own positive direction so colors map to "good" vs
// "bad" rather than to the raw arrow direction.
function deltaToneFor(direction, positiveIsUp) {
  if (direction === "neutral") {
    return "muted";
  }
  if (direction === "up") {
    return positiveIsUp ? "safe" : "warning";
  }
  return positiveIsUp ? "warning" : "safe";
}

function DeltaBadge({ delta, positiveIsUp }) {
  const tone = deltaToneFor(delta.direction, positiveIsUp);
  const palette = {
    safe: { background: "rgba(47, 138, 79, 0.12)", color: "#1f6e3c" },
    warning: { background: "rgba(179, 38, 30, 0.1)", color: "#b3261e" },
    muted: { background: "rgba(102, 123, 115, 0.12)", color: "#667b73" },
  }[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: "0.78rem",
        fontWeight: 700,
        ...palette,
      }}
    >
      {delta.text}
    </span>
  );
}

function StatHeroCard({
  label,
  value,
  delta,
  positiveIsUp,
  comparisonLabel,
  accentColor,
}) {
  return (
    <article
      className="panel-card"
      style={{
        padding: 22,
        display: "grid",
        gap: 12,
        borderTop: `4px solid ${accentColor}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: "0.78rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          {label}
        </span>
        <DeltaBadge delta={delta} positiveIsUp={positiveIsUp} />
      </div>
      <strong
        style={{
          fontSize: "2rem",
          letterSpacing: "-0.03em",
          color: "var(--forest-deep)",
          fontFamily: '"Fraunces", Georgia, serif',
        }}
      >
        {value}
      </strong>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
        So với {comparisonLabel}
      </p>
    </article>
  );
}

function ChartTooltipContent({ active, payload, label }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        background: "rgba(255, 251, 246, 0.96)",
        border: "1px solid rgba(20, 38, 31, 0.12)",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 12px 24px rgba(15, 29, 24, 0.12)",
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 700, color: "#14261f", marginBottom: 6 }}>
        {formatDayLabel(label)}
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        {payload.map((entry) => (
          <div
            key={entry.dataKey}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              fontSize: "0.85rem",
            }}
          >
            <span style={{ color: entry.color, fontWeight: 600 }}>{entry.name}</span>
            <span style={{ color: "var(--forest-deep)", fontWeight: 700 }}>
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryCard({ entry }) {
  const categoryLabel = entry.category ?? "Chưa phân loại";
  // Recharts cannot render an empty/all-zero domain gracefully on its own,
  // but our backend always emits the full date range, so series.length > 0
  // is guaranteed. We still guard to be safe.
  const hasSeries = Array.isArray(entry.series) && entry.series.length > 0;

  return (
    <article
      className="panel-card"
      style={{
        padding: 18,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <strong
            style={{
              fontSize: "1.1rem",
              color: "var(--forest-deep)",
              fontFamily: '"Fraunces", Georgia, serif',
            }}
          >
            {categoryLabel}
          </strong>
          {entry.topProduct ? (
            <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
              Top: <strong style={{ color: "var(--accent-deep)" }}>{entry.topProduct}</strong>
            </p>
          ) : null}
        </div>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            background: "rgba(33, 77, 66, 0.08)",
            color: "var(--forest-deep)",
            fontWeight: 700,
            fontSize: "0.78rem",
            height: "fit-content",
          }}
        >
          {formatInteger(entry.orderCount)} đơn
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <div>
          <span style={{ fontSize: "0.74rem", color: "var(--muted)" }}>Doanh thu</span>
          <strong
            style={{
              display: "block",
              marginTop: 2,
              color: "var(--forest-deep)",
              fontSize: "1rem",
            }}
          >
            {formatCurrency(entry.revenue)}
          </strong>
        </div>
        <div>
          <span style={{ fontSize: "0.74rem", color: "var(--muted)" }}>Lợi nhuận</span>
          <strong
            style={{
              display: "block",
              marginTop: 2,
              color: entry.profit < 0 ? "#b3261e" : "var(--forest-deep)",
              fontSize: "1rem",
            }}
          >
            {formatCurrency(entry.profit)}
          </strong>
        </div>
      </div>

      {hasSeries ? (
        <div style={{ width: "100%", height: 100 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={entry.series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <Line
                type="monotone"
                dataKey="revenue"
                stroke={SERIES_COLORS.revenue}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: "rgba(0,0,0,0.06)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </article>
  );
}

export function DashboardView() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // isCancelled guards against state writes after the component unmounts
  // mid-fetch (e.g. user switches tab while waiting for the API).
  useEffect(() => {
    let isCancelled = false;

    async function loadOverview() {
      setLoading(true);
      setError("");

      try {
        const response = await fetchDashboardOverview(range);
        if (isCancelled) return;
        setData(response);
      } catch (requestError) {
        if (isCancelled) return;
        setError(requestError.message || "Không thể tải dữ liệu tổng quan.");
        setData(null);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadOverview();

    return () => {
      isCancelled = true;
    };
  }, [range]);

  const stats = data?.stats;
  const revenueSeries = data?.revenueSeries ?? [];
  const categoryBreakdown = data?.categoryBreakdown ?? [];

  const comparisonLabel = RANGE_LABEL_BY_ID[range] || "kỳ trước";

  const heroCards = useMemo(() => {
    if (!stats) return [];

    return [
      {
        key: "revenue",
        label: "Doanh thu",
        value: formatCurrency(stats.revenue),
        delta: describeDelta(stats.revenueDeltaPercent),
        positiveIsUp: true,
        accentColor: SERIES_COLORS.revenue,
      },
      {
        key: "profit",
        label: "Lợi nhuận",
        value: formatCurrency(stats.profit),
        delta: describeDelta(stats.profitDeltaPercent),
        positiveIsUp: true,
        accentColor: SERIES_COLORS.profit,
      },
      {
        key: "inboundCost",
        label: "Chi nhập hàng",
        value: formatCurrency(stats.inboundCost),
        delta: describeDelta(stats.inboundCostDeltaPercent),
        positiveIsUp: false,
        accentColor: SERIES_COLORS.inboundCost,
      },
    ];
  }, [stats]);

  const summaryRow = useMemo(() => {
    if (!stats) return null;
    return [
      {
        label: "Tổng số đơn",
        value: formatInteger(stats.ordersCount),
        note: "Số đơn ghi nhận trong khoảng thời gian đã chọn.",
      },
      {
        label: "Biên lợi nhuận TB",
        value: formatPercent(stats.avgMarginPercent),
        note:
          stats.revenue > 0
            ? "Tính trên doanh thu thực tế kỳ này."
            : "Chưa có doanh thu trong kỳ — hiển thị '—'.",
      },
    ];
  }, [stats]);

  return (
    <section className="feature-page">
      <div className="feature-toolbar">
        <div>
          <span className="toolbar-kicker">Tổng quan vận hành</span>
          <h3>Doanh thu, lợi nhuận và biến động nhập hàng</h3>
        </div>

        <div
          role="tablist"
          aria-label="Chọn khoảng thời gian"
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          {RANGE_OPTIONS.map((option) => {
            const isActive = option.id === range;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`inventory-subnav-tab ${isActive ? "active" : ""}`}
                onClick={() => setRange(option.id)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="empty-state error">
          <strong>Không tải được dữ liệu tổng quan</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="empty-state">
          <strong>Đang tải dữ liệu tổng quan</strong>
          <p>Hệ thống đang tổng hợp doanh thu, lợi nhuận và nhập hàng cho kỳ đã chọn.</p>
        </div>
      ) : null}

      {!loading && !error && stats ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 18,
            }}
          >
            {heroCards.map((card) => (
              <StatHeroCard
                key={card.key}
                label={card.label}
                value={card.value}
                delta={card.delta}
                positiveIsUp={card.positiveIsUp}
                comparisonLabel={comparisonLabel}
                accentColor={card.accentColor}
              />
            ))}
          </div>

          {summaryRow ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 18,
              }}
            >
              {summaryRow.map((item) => (
                <article key={item.label} className="stat-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.note}</p>
                </article>
              ))}
            </div>
          ) : null}

          <article className="panel-card">
            <div className="panel-heading">
              <div>
                <span>Biểu đồ</span>
                <h4>Doanh thu, lợi nhuận và chi nhập theo ngày</h4>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  fontSize: "0.82rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <LegendDot color={SERIES_COLORS.revenue} label="Doanh thu" />
                <LegendDot color={SERIES_COLORS.profit} label="Lợi nhuận" />
                <LegendDot color={SERIES_COLORS.inboundCost} label="Chi nhập" />
              </div>
            </div>

            <div style={{ width: "100%", height: 320, marginTop: 18 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={revenueSeries}
                  margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(20, 38, 31, 0.08)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDayLabel}
                    stroke="rgba(20, 38, 31, 0.5)"
                    fontSize={12}
                  />
                  <YAxis
                    tickFormatter={formatCompactCurrency}
                    stroke="rgba(20, 38, 31, 0.5)"
                    fontSize={12}
                    width={64}
                  />
                  <Tooltip
                    content={<ChartTooltipContent />}
                    cursor={{ stroke: "rgba(0,0,0,0.08)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Doanh thu"
                    stroke={SERIES_COLORS.revenue}
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Lợi nhuận"
                    stroke={SERIES_COLORS.profit}
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="inboundCost"
                    name="Chi nhập"
                    stroke={SERIES_COLORS.inboundCost}
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="panel-card">
            <div className="panel-heading">
              <div>
                <span>Cơ cấu nhóm hàng</span>
                <h4>Doanh thu và lợi nhuận theo nhóm sản phẩm</h4>
              </div>
            </div>

            {categoryBreakdown.length === 0 ? (
              <div className="empty-state" style={{ marginTop: 12 }}>
                <strong>Chưa có nhóm hàng nào ghi nhận đơn</strong>
                <p>Hãy tạo đơn hàng để xem cơ cấu doanh thu theo nhóm sản phẩm.</p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 16,
                  marginTop: 18,
                }}
              >
                {categoryBreakdown.map((entry, index) => (
                  <CategoryCard
                    key={`${entry.category ?? "null"}-${index}`}
                    entry={entry}
                  />
                ))}
              </div>
            )}
          </article>
        </>
      ) : null}
    </section>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 0 3px ${color}22`,
        }}
      />
      <span style={{ color: "var(--forest-deep)", fontWeight: 700 }}>{label}</span>
    </span>
  );
}
