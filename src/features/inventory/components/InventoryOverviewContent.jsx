import React, { useEffect, useState } from "react";
import { StatCards } from "../../../shared/components/StatCards";
import { fetchInventoryOverview } from "../api/overviewApi";
import { deleteStockBalance } from "../api/stockBalanceApi";
import { deleteStockInbound } from "../api/stockInboundApi";
import {
  StockBalanceEditModal,
  StockBalanceViewModal,
} from "./StockBalanceModals";
import {
  StockInboundEditModal,
  StockInboundViewModal,
} from "./StockInboundModals";

function formatQuantity(value) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPrice(value, currencyCode, pricingUnit) {
  if (value === null || value === undefined) {
    return "Chưa có";
  }

  const base = `${formatQuantity(value)} ${currencyCode || "VND"}`;
  const normalizedUnit = typeof pricingUnit === "string" ? pricingUnit.trim() : "";

  return normalizedUnit ? `${base}/${normalizedUnit}` : base;
}

function formatDateTime(value) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return "Chưa có thời gian";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

// Reads the aggregated minimum required quantity prepared by the backend
// (sum of component.quantity * conversion_ratio * sales_target across every
// active sales plan). NULL means the ingredient is not used by any active
// menu — we propagate that distinction to the UI so it can show "Chưa có"
// instead of "0" (which is reserved for an active plan with target = 0).
function getRequiredQuantity(row) {
  const value = row?.requiredQuantity;

  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getInventoryStatus(row) {
  const currentQuantity = Number(row.quantity || 0);
  const requiredQuantity = getRequiredQuantity(row);

  // Order matters: missing data wins so a 0-stock item without any sales
  // plan does not get flagged as "Hết hàng" misleadingly.
  if (requiredQuantity === null) {
    return {
      label: "Chưa đủ dữ liệu",
      tone: "muted",
    };
  }

  if (currentQuantity <= 0) {
    return {
      label: "Hết hàng",
      tone: "danger",
    };
  }

  if (currentQuantity < requiredQuantity) {
    return {
      label: "Sắp thiếu",
      tone: "warning",
    };
  }

  return {
    label: "Đủ hàng",
    tone: "safe",
  };
}

function getSuggestedInboundQuantity(row) {
  const requiredQuantity = getRequiredQuantity(row);
  const currentQuantity = Number(row.quantity || 0);

  if (requiredQuantity === null) {
    return null;
  }

  return Math.max(0, requiredQuantity - currentQuantity);
}

function getSupplierNameFromTimeline(row) {
  if (typeof row?.supplierName === "string" && row.supplierName.trim()) {
    return row.supplierName.trim();
  }

  if (typeof row?.supplier === "string" && row.supplier.trim()) {
    return row.supplier.trim();
  }

  return "Chưa có NCC";
}

function getPriceSourceLabel(priceSource) {
  switch (priceSource) {
    case "inbound":
      return "Theo phiếu";
    case "supplier_product":
      return "Theo NCC (mặt hàng)";
    case "supplier_default":
      return "Theo NCC (mặc định)";
    default:
      return "";
  }
}

function buildPriceFormulaText(row) {
  const unitPrice = row?.effectiveUnitPrice;

  if (unitPrice === null || unitPrice === undefined) {
    return "";
  }

  const currency = row.effectiveCurrencyCode || row.currencyCode || "VND";
  const pricingUnit = row.effectivePricingUnit || row.inputUnit || "";
  const inputUnit = row.inputUnit || "";

  return `${formatQuantity(unitPrice)} ${currency}/${pricingUnit} × ${formatQuantity(row.inputQuantity)} ${inputUnit}`.trim();
}

function renderTimelineTotalAmount(row) {
  const total = row?.totalAmount;

  if (total === null || total === undefined) {
    return "Chưa có";
  }

  const currency = row.effectiveCurrencyCode || row.currencyCode || "VND";
  const formula = buildPriceFormulaText(row);
  const sourceLabel = getPriceSourceLabel(row.priceSource);
  const tooltipParts = [];

  if (formula) {
    tooltipParts.push(formula);
  }

  if (sourceLabel) {
    tooltipParts.push(`Nguồn: ${sourceLabel}`);
  }

  if (row.priceMismatch) {
    tooltipParts.push(
      `Đơn vị giá (${row.effectivePricingUnit || "?"}) khác đơn vị nhập (${row.inputUnit || "?"}) — kiểm tra lại.`,
    );
  }

  const tooltip = tooltipParts.join(" — ");

  return (
    <span title={tooltip || undefined}>
      {formatQuantity(total)} {currency}
      {row.priceMismatch ? (
        <span
          className="price-mismatch-warning"
          aria-label={`Cảnh báo lệch đơn vị giá: ${row.effectivePricingUnit || "?"} so với ${row.inputUnit || "?"}`}
          title={`Đơn vị giá (${row.effectivePricingUnit || "?"}) khác đơn vị nhập (${row.inputUnit || "?"}) — kiểm tra lại.`}
        >
          {" *"}
        </span>
      ) : null}
    </span>
  );
}

const emptyOverview = {
  stats: [
    { label: "Mặt hàng đang theo dõi", value: "0", note: "Chưa có dữ liệu tồn kho thực tế." },
    { label: "Dòng tồn kho", value: "0", note: "Chưa có dòng tồn kho nào được ghi nhận." },
    { label: "Lô nhập hôm nay", value: "0", note: "Chưa có phiếu nhập nào được ghi nhận hôm nay." },
    { label: "Tổng lượng tồn", value: "0", note: "Sẽ cập nhật khi có dữ liệu nhập kho thực tế." },
  ],
  balances: [],
  timeline: [],
};

function buildOverviewStatCards(stats) {
  const trackedProducts = stats[0];
  const todayInboundProducts = stats[2];

  return [
    {
      label: "Tổng sản phẩm trong kho",
      value: trackedProducts?.value ?? "0",
      note: trackedProducts?.note ?? "Đếm theo số sản phẩm đang có tồn kho thực tế.",
    },
    {
      label: "Tổng sản phẩm nhập kho hôm nay",
      value: todayInboundProducts?.value ?? "0",
      note: todayInboundProducts?.note ?? "Số lần nhập được ghi nhận trong ngày hiện tại.",
    },
  ];
}

export function InventoryOverviewContent({ refreshKey }) {
  const [overview, setOverview] = useState(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingBalance, setViewingBalance] = useState(null);
  const [editingBalance, setEditingBalance] = useState(null);
  const [deletingBalanceId, setDeletingBalanceId] = useState(null);
  const [viewingInbound, setViewingInbound] = useState(null);
  const [editingInbound, setEditingInbound] = useState(null);
  const [deletingInboundId, setDeletingInboundId] = useState(null);
  const [actionError, setActionError] = useState("");
  const statCards = buildOverviewStatCards(overview.stats);

  async function loadOverview() {
    setLoading(true);
    setError("");

    try {
      const data = await fetchInventoryOverview();
      setOverview({
        stats: Array.isArray(data?.stats) ? data.stats : emptyOverview.stats,
        balances: Array.isArray(data?.balances) ? data.balances : [],
        timeline: Array.isArray(data?.timeline) ? data.timeline : [],
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, [refreshKey]);

  async function handleDeleteBalance(row) {
    if (!row?.id) {
      return;
    }

    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa dòng tồn của "${row.productName}"? Lịch sử nhập sẽ vẫn được giữ lại.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingBalanceId(row.id);
    setActionError("");

    try {
      await deleteStockBalance(row.id);
      await loadOverview();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setDeletingBalanceId(null);
    }
  }

  async function handleDeleteInbound(row) {
    if (!row?.id) {
      return;
    }

    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa phiếu nhập "${row.productName}"? Số lượng đã nhập sẽ được trừ ra khỏi tồn hiện tại.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingInboundId(row.id);
    setActionError("");

    try {
      await deleteStockInbound(row.id);
      await loadOverview();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setDeletingInboundId(null);
    }
  }

  return (
    <>
      <StatCards items={statCards} className="stat-grid--two-columns" />

      <div className="content-grid inventory-overview-grid">
        <article className="panel-card inventory-overview-main">
          <div className="panel-heading">
            <div>
              <span>Tồn kho trọng yếu</span>
              <h4>Danh sách nguyên liệu cần theo dõi</h4>
            </div>
            <button type="button" className="text-button" onClick={loadOverview}>
              Đồng bộ số liệu
            </button>
          </div>

          {loading ? (
            <div className="empty-state">
              <strong>Đang tải tồn kho thực tế</strong>
              <p>Hệ thống đang đọc dữ liệu từ bảng tồn kho hiện tại.</p>
            </div>
          ) : error ? (
            <div className="empty-state error">
              <strong>Không tải được dữ liệu tồn kho</strong>
              <p>{error}</p>
            </div>
          ) : overview.balances.length === 0 ? (
            <div className="empty-state">
              <strong>Chưa có dữ liệu tồn kho</strong>
              <p>Bảng tồn kho đang để trống để chờ dữ liệu thật từ phiếu nhập.</p>
            </div>
          ) : (
            <div className="table-wrapper inventory-overview-table-wrapper">
              <table className="inventory-overview-table">
                <thead>
                  <tr>
                    <th>Nguyên liệu</th>
                    <th>Đơn vị tồn</th>
                    <th>Tồn hiện tại</th>
                    <th>Mức cần tối thiểu</th>
                    <th>Cần nhập thêm</th>
                    <th>Giá</th>
                    <th>Trạng thái</th>
                    <th>Cập nhật</th>
                    <th className="row-actions-col">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.balances.map((row) => {
                    const status = getInventoryStatus(row);
                    const requiredQuantity = getRequiredQuantity(row);
                    const suggestedInboundQuantity = getSuggestedInboundQuantity(row);
                    const isDeleting = deletingBalanceId === row.id;
                    const incompleteWarningTitle =
                      "Một số đơn vị nguyên liệu chưa có quy đổi, số liệu có thể chưa chính xác.";
                    const showIncompleteWarning =
                      requiredQuantity !== null && Boolean(row.requiredIncomplete);

                    return (
                      <tr key={row.id ?? `${row.productName}-${row.updatedAt}`}>
                        <td>{row.productName}</td>
                        <td>{row.unit}</td>
                        <td>{formatQuantity(row.quantity)}</td>
                        <td>
                          {requiredQuantity === null ? (
                            "Chưa có"
                          ) : (
                            <span title={showIncompleteWarning ? incompleteWarningTitle : undefined}>
                              {formatQuantity(requiredQuantity)}
                              {showIncompleteWarning ? (
                                <span
                                  className="price-mismatch-warning"
                                  aria-label={incompleteWarningTitle}
                                  title={incompleteWarningTitle}
                                >
                                  {" *"}
                                </span>
                              ) : null}
                            </span>
                          )}
                        </td>
                        <td>
                          {suggestedInboundQuantity === null ? "Chưa có" : formatQuantity(suggestedInboundQuantity)}
                        </td>
                        <td>{formatPrice(row.unitPrice, row.currencyCode, row.pricingUnit)}</td>
                        <td>
                          <span className={`status-chip ${status.tone}`}>{status.label}</span>
                        </td>
                        <td>{formatDateTime(row.updatedAt)}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="row-action-button"
                              onClick={() => setViewingBalance(row)}
                              disabled={isDeleting}
                            >
                              Xem
                            </button>
                            <button
                              type="button"
                              className="row-action-button"
                              onClick={() => setEditingBalance(row)}
                              disabled={isDeleting}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="row-action-button row-action-danger"
                              onClick={() => handleDeleteBalance(row)}
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
          )}

          {actionError ? <p className="form-feedback error inventory-action-error">{actionError}</p> : null}
        </article>

        <article className="panel-card accent-card inventory-overview-timeline">
          <div className="panel-heading">
            <div>
              <span>Bảng nhập kho</span>
              <h4>Lịch sử nhập theo ngày</h4>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <strong>Đang tải lịch sử nhập kho</strong>
              <p>Hệ thống đang tổng hợp các lần nhập gần nhất.</p>
            </div>
          ) : overview.timeline.length === 0 ? (
            <div className="empty-state">
              <strong>Chưa có lịch sử nhập kho</strong>
              <p>Khi bạn lưu phiếu nhập, các dòng gần nhất sẽ hiển thị tại đây.</p>
            </div>
          ) : (
            <div className="table-wrapper inventory-overview-inbound-table-wrapper">
              <table className="inventory-overview-table inventory-overview-inbound-table">
                <thead>
                  <tr>
                    <th>Ngày nhập</th>
                    <th>Nguyên liệu</th>
                    <th>Số lượng nhập</th>
                    <th>Giá thành</th>
                    <th>Nhà cung ứng</th>
                    <th className="row-actions-col">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.timeline.map((row) => {
                    const isDeleting = deletingInboundId === row.id;

                    return (
                      <tr key={row.id ?? `${row.productName}-${row.createdAt}`}>
                        <td>{formatDateTime(row.createdAt)}</td>
                        <td>{row.productName}</td>
                        <td>
                          {formatQuantity(row.inputQuantity)} {row.inputUnit}
                        </td>
                        <td>{renderTimelineTotalAmount(row)}</td>
                        <td>{getSupplierNameFromTimeline(row)}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="row-action-button"
                              onClick={() => setViewingInbound(row)}
                              disabled={isDeleting}
                            >
                              Xem
                            </button>
                            <button
                              type="button"
                              className="row-action-button"
                              onClick={() => setEditingInbound(row)}
                              disabled={isDeleting}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="row-action-button row-action-danger"
                              onClick={() => handleDeleteInbound(row)}
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
          )}
        </article>
      </div>

      <StockBalanceViewModal
        isOpen={Boolean(viewingBalance)}
        row={viewingBalance}
        onClose={() => setViewingBalance(null)}
      />

      <StockBalanceEditModal
        isOpen={Boolean(editingBalance)}
        row={editingBalance}
        onClose={() => setEditingBalance(null)}
        onSaved={() => {
          loadOverview();
        }}
      />

      <StockInboundViewModal
        isOpen={Boolean(viewingInbound)}
        row={viewingInbound}
        onClose={() => setViewingInbound(null)}
      />

      <StockInboundEditModal
        isOpen={Boolean(editingInbound)}
        row={editingInbound}
        onClose={() => setEditingInbound(null)}
        onSaved={() => {
          loadOverview();
        }}
      />
    </>
  );
}
