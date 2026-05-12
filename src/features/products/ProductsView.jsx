import React, { useEffect, useMemo, useState } from "react";
import { StatCards } from "../../shared/components/StatCards";
import { ProductSalesPlanCreateModal } from "./components/ProductSalesPlanCreateModal";
import { ProductSalesPlanTable } from "./components/ProductSalesPlanTable";
import { ProductOrdersModal } from "./components/ProductOrdersModal";
import {
  deleteSalesPlan,
  fetchSalesPlans,
} from "./api/productSalesPlanApi";

const FALLBACK_PRODUCT_STATS = [
  { label: "Món đang kinh doanh", value: "0", note: "Số sản phẩm có trạng thái 'Đang bán'." },
  { label: "Món bán chạy tuần", value: "12", note: "Tỷ lệ bán trên 85% kế hoạch." },
  { label: "Combo đang chạy", value: "08", note: "Tập trung ca trưa và giao nhanh." },
  { label: "Biên lợi nhuận TB", value: "31%", note: "Theo giá cost mới nhất từ kho." },
];

function buildStats(rows) {
  const stats = [...FALLBACK_PRODUCT_STATS];
  const activeCount = rows.filter((row) => row.status === "active").length;
  stats[0] = {
    ...stats[0],
    value: String(activeCount),
    note: "Sản phẩm có trạng thái 'Đang bán' trong danh sách vận hành.",
  };
  return stats;
}

export function ProductsView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [viewingOrdersRow, setViewingOrdersRow] = useState(null);

  async function loadRows() {
    setLoading(true);
    setError("");

    try {
      const data = await fetchSalesPlans();
      setRows(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.message || "Không thể tải danh sách sản phẩm vận hành.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, []);

  async function handleCreated() {
    setActionError("");
    await loadRows();
  }

  async function handleDelete(row) {
    if (!row?.id) return;

    const confirmed = window.confirm(
      `Xóa sản phẩm "${row.productName}" khỏi danh sách vận hành?`,
    );

    if (!confirmed) return;

    setDeletingId(row.id);
    setActionError("");

    try {
      await deleteSalesPlan(row.id);
      await loadRows();
    } catch (requestError) {
      setActionError(
        requestError.message || "Không thể xóa sản phẩm khỏi danh sách vận hành.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const stats = useMemo(() => buildStats(rows), [rows]);
  const existingMenuProductIds = useMemo(
    () => rows.map((row) => row.menuProductId),
    [rows],
  );

  return (
    <section className="feature-page">
      <div className="feature-toolbar">
        <div>
          <span className="toolbar-kicker">Quản trị thực đơn</span>
          <h3>Tối ưu danh mục món ăn và giá bán</h3>
        </div>

        <div className="toolbar-actions">
          <button type="button" className="ghost-button" disabled>
            Nhân bản menu
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => setIsCreateOpen(true)}
          >
            Thêm sản phẩm
          </button>
        </div>
      </div>

      <StatCards items={stats} />

      <div className="content-grid">
        <article className="panel-card">
          <div className="panel-heading">
            <div>
              <span>Danh mục kinh doanh</span>
              <h4>Danh sách sản phẩm đang vận hành</h4>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={loadRows}
              disabled={loading}
            >
              {loading ? "Đang tải..." : "Làm mới"}
            </button>
          </div>

          {actionError ? <p className="form-feedback error">{actionError}</p> : null}

          {loading ? (
            <div className="empty-state">
              <strong>Đang tải danh sách sản phẩm vận hành</strong>
              <p>Hệ thống đang tổng hợp giá bán và biên lợi nhuận từ định lượng.</p>
            </div>
          ) : error ? (
            <div className="empty-state error">
              <strong>Không tải được danh sách sản phẩm</strong>
              <p>{error}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <strong>Chưa có sản phẩm vận hành</strong>
              <p>
                Bấm "Thêm sản phẩm" để đưa các món đã có định lượng vào danh sách kinh doanh hằng ngày.
              </p>
            </div>
          ) : (
            <ProductSalesPlanTable
              rows={rows}
              onDelete={handleDelete}
              onView={(row) => setViewingOrdersRow(row)}
              deletingId={deletingId}
            />
          )}
        </article>

        <article className="panel-card">
          <div className="panel-heading">
            <div>
              <span>Chiến lược sản phẩm</span>
              <h4>Điểm cần xử lý tuần này</h4>
            </div>
          </div>

          <div className="signal-stack">
            <div className="signal-item">
              <strong>Menu trưa</strong>
              <p>Tạo gói combo dưới 95.000đ để đẩy đơn theo khung 11h-13h.</p>
            </div>
            <div className="signal-item">
              <strong>Món theo mùa</strong>
              <p>Đẩy thêm món có nguyên liệu xoài và sả trong 3 tuần cao điểm.</p>
            </div>
            <div className="signal-item">
              <strong>Kiểm soát cost</strong>
              <p>Rà lại giá cost của 5 món dùng cá hồi vì biên lợi nhuận đang giảm.</p>
            </div>
          </div>
        </article>
      </div>

      <ProductSalesPlanCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleCreated}
        existingMenuProductIds={existingMenuProductIds}
      />

      <ProductOrdersModal
        isOpen={Boolean(viewingOrdersRow)}
        salesPlanRow={viewingOrdersRow}
        onClose={() => setViewingOrdersRow(null)}
      />
    </section>
  );
}
