import React, { useState } from "react";
import { DashboardView } from "./features/dashboard/DashboardView";
import { DebtsView } from "./features/debts/DebtsView";
import { InventoryView } from "./features/inventory/InventoryView";
import { OrdersView } from "./features/orders/OrdersView";
import { ProductsView } from "./features/products/ProductsView";
import { ProductsPortioningView } from "./features/products/ProductsPortioningView";
import { SuppliersView } from "./features/suppliers/SuppliersView";
import { AppShell } from "./shared/layout/AppShell";

const tabs = [
  {
    id: "dashboard",
    label: "Bảng điều khiển",
    eyebrow: "Tổng quan",
    description: "Doanh thu, lợi nhuận và biến động nhập hàng theo thời gian.",
  },
  {
    id: "inventory",
    label: "Quản lý kho",
    eyebrow: "Kho vận",
 },
  {
    id: "products-root",
    label: "Sản phẩm",
    eyebrow: "Thực đơn",
    children: [
      {
        id: "products-management",
        label: "Quản lý sản phẩm",
        description: "Tối ưu danh mục món ăn, trạng thái kinh doanh và biên lợi nhuận.",
      },
      {
        id: "products-portioning",
        label: "Định lượng sản phẩm",
        description: "Chuẩn hóa định mức và tỷ lệ quy đổi để đồng bộ cost với kho.",
      },
    ],
  },
  {
    id: "orders",
    label: "Đơn hàng",
    eyebrow: "Bán hàng",
    description: "Tổng hợp đơn bán theo ngày, loại đơn và lợi nhuận.",
  },
  {
    id: "suppliers",
    label: "Quản lý nhà cung cấp",
    eyebrow: "Đối tác",
  },
  {
    id: "debts",
    label: "Quản lý công nợ",
    eyebrow: "Tài chính",
  },
];

const featureViews = {
  dashboard: DashboardView,
  inventory: InventoryView,
  "products-management": ProductsView,
  "products-portioning": ProductsPortioningView,
  orders: OrdersView,
  suppliers: SuppliersView,
  debts: DebtsView,
};

function findActiveTabMeta(tabList, activeTabId) {
  for (const tab of tabList) {
    if (tab.id === activeTabId) {
      return tab;
    }

    if (Array.isArray(tab.children)) {
      const child = tab.children.find((item) => item.id === activeTabId);

      if (child) {
        return {
          ...child,
          eyebrow: tab.eyebrow,
        };
      }
    }
  }

  return tabList[0];
}

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const ActiveView = featureViews[activeTab];
  const activeMeta = findActiveTabMeta(tabs, activeTab);

  return (
    <AppShell
      tabs={tabs}
      activeTab={activeTab}
      activeMeta={activeMeta}
      onTabChange={setActiveTab}
    >
      <ActiveView />
    </AppShell>
  );
}
