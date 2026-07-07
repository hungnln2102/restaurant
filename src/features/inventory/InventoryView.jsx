import React, { useState } from "react";
import { InventoryOverviewContent } from "./components/InventoryOverviewContent";
import { InventoryPortioningContent } from "./components/InventoryPortioningContent";
import { InventoryReceiptModal } from "./components/InventoryReceiptModal";
import { InventoryCheckModal } from "./components/InventoryCheckModal";
import { InventoryChecksList } from "./components/InventoryChecksList";

const inventoryTabs = [
  {
    id: "overview",
    label: "Tổng quan kho",
    description: "Theo dõi tồn kho, mức tối thiểu và nhịp nhập hàng trong ngày.",
  },
  {
    id: "portioning",
    label: "Quản lý định lượng",
    description: "Kiểm soát định mức nguyên liệu theo món, đơn vị chuẩn và tỷ lệ quy đổi.",
  },
  {
    id: "history",
    label: "Lịch sử kiểm kê",
    description: "Xem lại các phiếu kiểm kê kho, đối chiếu số lượng thực tế và lịch sử chênh lệch.",
  },
];

export function InventoryView() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [overviewRefreshKey, setOverviewRefreshKey] = useState(0);
  const activeMeta = inventoryTabs.find((tab) => tab.id === activeTab) ?? inventoryTabs[0];

  function handleReceiptSaved() {
    setOverviewRefreshKey((current) => current + 1);
  }

  return (
    <section className="feature-page">
      <div className="feature-toolbar">
        <div>
          <span className="toolbar-kicker">Theo dõi kho vận</span>
          <h3>Điều phối nguyên liệu theo mức tồn và định lượng chuẩn</h3>
        </div>

        <div className="toolbar-actions">
          <button type="button" className="ghost-button" onClick={() => setIsCheckModalOpen(true)}>
            Kiểm kê kho
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => setIsReceiptModalOpen(true)}
          >
            Tạo phiếu nhập kho
          </button>
        </div>
      </div>

      <section className="inventory-subnav" aria-label="Menu con quản lý kho">
        <div className="inventory-subnav-header">
          <div>
            <span className="toolbar-kicker">Menu con</span>
            <h4>{activeMeta.label}</h4>
          </div>
          <p>{activeMeta.description}</p>
        </div>

        <div className="inventory-subnav-tabs" role="tablist" aria-label="Chức năng quản lý kho">
          {inventoryTabs.map((tab) => {
            const isActive = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`inventory-subnav-tab ${isActive ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === "overview" ? (
        <InventoryOverviewContent refreshKey={overviewRefreshKey} />
      ) : activeTab === "portioning" ? (
        <InventoryPortioningContent />
      ) : (
        <InventoryChecksList />
      )}

      <InventoryReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onSaved={handleReceiptSaved}
      />

      <InventoryCheckModal
        isOpen={isCheckModalOpen}
        onClose={() => setIsCheckModalOpen(false)}
        onSaved={handleReceiptSaved}
      />
    </section>
  );
}
