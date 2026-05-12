import React, { useEffect, useMemo, useState } from "react";
import { StatCards } from "../../shared/components/StatCards";
import { fetchSuppliers } from "./api/suppliersApi";
import { SupplierCreateModal } from "./components/SupplierCreateModal";

function formatCurrency(value, currencyCode = "VND", pricingUnit = null) {
  if (value === null || value === undefined) {
    return "Chưa có";
  }

  const formattedAmount = `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0))} ${currencyCode}`;

  const normalizedUnit = typeof pricingUnit === "string" ? pricingUnit.trim() : "";

  return normalizedUnit ? `${formattedAmount}/${normalizedUnit}` : formattedAmount;
}

const PRODUCT_NAMES_MAX_LENGTH = 60;

function summarizeProductNames(productNames) {
  if (typeof productNames !== "string") {
    return "";
  }

  const trimmed = productNames.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.length <= PRODUCT_NAMES_MAX_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, PRODUCT_NAMES_MAX_LENGTH).trimEnd()}…`;
}

const productNamesCellStyle = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  maxWidth: "260px",
  wordBreak: "break-word",
};

export function SuppliersView() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSuppliers() {
    setLoading(true);
    setError("");

    try {
      const data = await fetchSuppliers();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  const supplierStats = useMemo(() => {
    const activeSuppliers = suppliers.length;
    const categorizedSuppliers = suppliers.filter((item) => item.primaryCategory).length;
    const suppliersWithPrice = suppliers.filter((item) => item.defaultUnitPrice !== null).length;
    const distinctCategories = new Set(
      suppliers.map((item) => item.primaryCategory).filter((category) => typeof category === "string"),
    ).size;

    return [
      {
        label: "Nhà cung cấp hoạt động",
        value: String(activeSuppliers),
        note: "Đồng bộ trực tiếp từ dữ liệu NCC trong hệ thống.",
      },
      {
        label: "NCC có nhóm hàng chính",
        value: String(categorizedSuppliers),
        note: "Đã khai báo loại sản phẩm chính để phân luồng thu mua.",
      },
      {
        label: "NCC có giá tham chiếu",
        value: String(suppliersWithPrice),
        note: "Có thể dùng làm giá tham chiếu khi tạo phiếu nhập kho.",
      },
      {
        label: "Nhóm hàng đang theo dõi",
        value: String(distinctCategories),
        note: "Số nhóm sản phẩm chính đang được cung ứng.",
      },
    ];
  }, [suppliers]);

  return (
    <section className="feature-page">
      <div className="feature-toolbar">
        <div>
          <span className="toolbar-kicker">Mạng lưới đối tác</span>
          <h3>Quản lý nhà cung cấp theo năng lực giao hàng</h3>
        </div>

        <div className="toolbar-actions">
          <button type="button" className="ghost-button">
            Xuất danh bạ
          </button>
          <button type="button" className="primary-button" onClick={() => setIsCreateModalOpen(true)}>
            Thêm nhà cung cấp
          </button>
        </div>
      </div>

      <StatCards items={supplierStats} />

      <div className="content-grid">
        <article className="panel-card">
          <div className="panel-heading">
            <div>
              <span>Danh bạ nhà cung cấp</span>
              <h4>Đối tác đang phục vụ hệ thống</h4>
            </div>
            <button type="button" className="text-button" onClick={loadSuppliers}>
              Đồng bộ danh sách
            </button>
          </div>

          {loading ? (
            <div className="empty-state">
              <strong>Đang tải danh bạ nhà cung cấp</strong>
              <p>Hệ thống đang đồng bộ dữ liệu NCC mới nhất.</p>
            </div>
          ) : error ? (
            <div className="empty-state error">
              <strong>Không tải được danh bạ nhà cung cấp</strong>
              <p>{error}</p>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="empty-state">
              <strong>Chưa có nhà cung cấp</strong>
              <p>Hãy bấm "Thêm nhà cung cấp" để bắt đầu tạo danh bạ NCC.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Nhà cung cấp</th>
                    <th>Nhóm hàng</th>
                    <th>Nguyên liệu</th>
                    <th>Liên hệ</th>
                    <th>Điện thoại</th>
                    <th>Giá tham chiếu</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((row) => {
                    const productNames = row?.productNames;
                    const productSummary = summarizeProductNames(productNames);

                    return (
                      <tr key={row.id}>
                        <td>{row.supplierName}</td>
                        <td>{row.primaryCategory || "Chưa có"}</td>
                        <td>
                          {productSummary ? (
                            <span style={productNamesCellStyle} title={productNames}>
                              {productSummary}
                            </span>
                          ) : (
                            "Chưa có"
                          )}
                        </td>
                        <td>{row.contactName || "Chưa có"}</td>
                        <td>{row.phone || "Chưa có"}</td>
                        <td>{formatCurrency(row.defaultUnitPrice, row.currencyCode, row.pricingUnit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="panel-card accent-card">
          <div className="panel-heading">
            <div>
              <span>Chính sách mua hàng</span>
              <h4>Điểm đàm phán ưu tiên</h4>
            </div>
          </div>

          <div className="signal-stack">
            <div className="signal-item">
              <strong>Ưu đãi sản lượng</strong>
              <p>Gom nhu cầu thịt đỏ theo tuần để chốt giá tốt hơn cho ca tối.</p>
            </div>
            <div className="signal-item">
              <strong>Rủi ro phụ thuộc</strong>
              <p>Cần thêm nhà cung cấp dự phòng cho nhóm hải sản tươi sống.</p>
            </div>
            <div className="signal-item">
              <strong>Chuẩn hóa SLA</strong>
              <p>Thiết lập cam kết giao hàng và tỷ lệ bù hao hụt rõ ràng.</p>
            </div>
          </div>
        </article>
      </div>

      <SupplierCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => {
          loadSuppliers();
        }}
      />
    </section>
  );
}
