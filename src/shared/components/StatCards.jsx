import React from "react";

export function StatCards({ items, className = "" }) {
  const gridClassName = className ? `stat-grid ${className}` : "stat-grid";

  return (
    <div className={gridClassName}>
      {items.map((item) => (
        <article key={item.label} className="stat-card">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <p>{item.note}</p>
        </article>
      ))}
    </div>
  );
}
