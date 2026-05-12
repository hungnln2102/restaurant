import React from "react";

const STATUS_LABELS = {
  active: { label: "Đang bán", tone: "safe" },
  limited: { label: "Giới hạn", tone: "warning" },
  paused: { label: "Tạm dừng", tone: "muted" },
};

function formatCurrency(value) {
  const numeric = Number(value || 0);

  if (!Number.isFinite(numeric)) {
    return "0đ";
  }

  return `${new Intl.NumberFormat("vi-VN").format(numeric)}đ`;
}

function formatSalesProgress(salesActual, salesTarget) {
  const target = Number(salesTarget || 0);

  if (!Number.isFinite(target) || target <= 0) {
    return "—";
  }

  const actual = Number(salesActual || 0);
  return `${new Intl.NumberFormat("vi-VN").format(actual)}/${new Intl.NumberFormat("vi-VN").format(target)}`;
}

function formatTotalRevenue(salesActual, sellingPrice) {
  if (sellingPrice === null || sellingPrice === undefined) {
    return "—";
  }

  const priceNumeric = Number(sellingPrice);

  if (!Number.isFinite(priceNumeric) || priceNumeric <= 0) {
    return "—";
  }

  const actualNumeric = Number(salesActual ?? 0);

  if (!Number.isFinite(actualNumeric)) {
    return "—";
  }

  const safeActual = actualNumeric < 0 ? 0 : actualNumeric;
  const total = safeActual * priceNumeric;

  if (!Number.isFinite(total)) {
    return "—";
  }

  return `${new Intl.NumberFormat("vi-VN").format(total)}đ`;
}

function formatPlannedRevenueTooltip(salesTarget, sellingPrice) {
  if (sellingPrice === null || sellingPrice === undefined) {
    return undefined;
  }

  const priceNumeric = Number(sellingPrice);
  const targetNumeric = Number(salesTarget ?? 0);

  if (
    !Number.isFinite(priceNumeric) ||
    priceNumeric <= 0 ||
    !Number.isFinite(targetNumeric) ||
    targetNumeric <= 0
  ) {
    return undefined;
  }

  const planned = targetNumeric * priceNumeric;

  if (!Number.isFinite(planned)) {
    return undefined;
  }

  return `Kế hoạch: ${new Intl.NumberFormat("vi-VN").format(planned)}đ`;
}

function formatMargin(profitMargin) {
  if (profitMargin === null || profitMargin === undefined) {
    return { label: "—", tone: "muted" };
  }

  const percent = Math.round(Number(profitMargin) * 100);

  if (!Number.isFinite(percent)) {
    return { label: "—", tone: "muted" };
  }

  let tone = "safe";

  if (percent < 0) {
    tone = "danger";
  } else if (percent < 15) {
    tone = "warning";
  }

  return { label: `${percent}%`, tone };
}

function renderStatusChip(status) {
  const meta = STATUS_LABELS[status] || { label: status || "—", tone: "muted" };
  return <span className={`status-chip ${meta.tone}`}>{meta.label}</span>;
}

export function ProductSalesPlanTable({ rows, onDelete, onView, deletingId }) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Tên sản phẩm</th>
            <th>Số lượng bán</th>
            <th>Giá bán</th>
            <th>Biên lợi nhuận</th>
            <th>Tổng tiền</th>
            <th>Trạng thái</th>
            <th aria-label="Hành động" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const margin = formatMargin(row.profitMargin);
            const totalRevenue = formatTotalRevenue(row.salesActual, row.sellingPrice);
            const plannedTooltip = formatPlannedRevenueTooltip(row.salesTarget, row.sellingPrice);
            const isDeleting = deletingId === row.id;

            return (
              <tr key={row.id}>
                <td>
                  <strong>{row.productName}</strong>
                  {row.productCategory ? (
                    <span className="muted-text"> · {row.productCategory}</span>
                  ) : null}
                </td>
                <td>{formatSalesProgress(row.salesActual, row.salesTarget)}</td>
                <td>{formatCurrency(row.sellingPrice)}</td>
                <td>
                  <span className={`status-chip ${margin.tone}`}>{margin.label}</span>
                </td>
                <td title={plannedTooltip}>{totalRevenue}</td>
                <td>{renderStatusChip(row.status)}</td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="row-action-button"
                      onClick={() => onView?.(row)}
                      disabled={isDeleting}
                      aria-label={`Xem lịch sử đơn của ${row.productName}`}
                      title="Xem lịch sử đơn hàng"
                    >
                      Xem
                    </button>
                    <button
                      type="button"
                      className="row-action-button row-action-danger"
                      onClick={() => onDelete?.(row)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Đang xóa..." : "Xóa"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
