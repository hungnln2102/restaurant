import React from "react";
import { ProductPortioningContent } from "./components/ProductPortioningContent";

export function ProductsPortioningView() {
  return (
    <section className="feature-page">
      <div className="feature-toolbar">
        <div>
          <span className="toolbar-kicker">Định lượng thực đơn</span>
          <h3>Bảng thành phần/BTP của từng sản phẩm</h3>
        </div>
      </div>

      <ProductPortioningContent />
    </section>
  );
}
