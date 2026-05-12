import React from "react";

export function AppShell({ tabs, activeTab, activeMeta, onTabChange, children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-pill">Restaurant Admin</span>
          <h1>Bảng điều khiển</h1>
          <p>
            Giao diện nền để vận hành kho, sản phẩm, nhà cung cấp và công nợ trên
            cùng một hệ thống.
          </p>
        </div>

        <nav className="nav-tabs" aria-label="Danh mục quản trị">
          {tabs.map((tab) => {
            if (Array.isArray(tab.children) && tab.children.length > 0) {
              const hasActiveChild = tab.children.some((child) => child.id === activeTab);

              return (
                <div key={tab.id} className={`nav-group ${hasActiveChild ? "active" : ""}`}>
                  <div className="nav-group-header">
                    <span className="nav-tab-eyebrow">{tab.eyebrow}</span>
                    <strong>{tab.label}</strong>
                  </div>

                  <div className="nav-subtabs" role="group" aria-label={tab.label}>
                    {tab.children.map((child) => {
                      const isChildActive = child.id === activeTab;

                      return (
                        <button
                          key={child.id}
                          type="button"
                          className={`nav-subtab ${isChildActive ? "active" : ""}`}
                          onClick={() => onTabChange(child.id)}
                        >
                          {child.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const isActive = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                className={`nav-tab ${isActive ? "active" : ""}`}
                onClick={() => onTabChange(tab.id)}
              >
                <span className="nav-tab-eyebrow">{tab.eyebrow}</span>
                <strong>{tab.label}</strong>
                {tab.description ? <span className="nav-tab-copy">{tab.description}</span> : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="workspace">
        <header className="workspace-hero">
          <div>
            <span className="section-kicker">{activeMeta.eyebrow}</span>
            <h2>{activeMeta.label}</h2>
            <p>{activeMeta.description}</p>
          </div>

          <div className="workspace-summary">
            <div>
              <span>Mô hình</span>
              <strong>Feature-based UI</strong>
            </div>
            <div>
              <span>Trạng thái</span>
              <strong>Sẵn sàng mở rộng</strong>
            </div>
          </div>
        </header>

        <div className="workspace-content">{children}</div>
      </main>
    </div>
  );
}
