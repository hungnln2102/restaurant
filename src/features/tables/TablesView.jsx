import React, { useState, useEffect } from "react";
import { getTables, createTable, createSession, getTableOrders, checkoutSession } from "./api/tablesApi";
import { TableDetailModal } from "./components/TableDetailModal";
import "./tables.css";

export function TablesView() {
  const [tables, setTables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);

  const fetchTables = async () => {
    setIsLoading(true);
    try {
      const data = await getTables();
      setTables(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleAddTable = async () => {
    const tableName = window.prompt("Nhập tên bàn mới:");
    if (!tableName) return;
    try {
      await createTable(tableName);
      fetchTables();
    } catch (err) {
      alert(err.message);
    }
  };

  const getStatusColor = (status) => {
    if (status === "available") return "#10b981"; // Emerald
    if (status === "reserved") return "#f59e0b"; // Amber
    if (status === "occupied") return "#ef4444"; // Rose
    return "#6b7280";
  };

  const getStatusBg = (status) => {
    if (status === "available") return "#d1fae5"; // Emerald light
    if (status === "reserved") return "#fef3c7"; // Amber light
    if (status === "occupied") return "#ffe4e6"; // Rose light
    return "#f3f4f6";
  };

  const renderTableIcon = (table) => {
    const color = getStatusColor(table.status);
    const bg = getStatusBg(table.status);
    return (
      <svg viewBox="0 0 100 100" className={`table-icon status-${table.status}`}>
        <defs>
          <filter id={`shadow-${table.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor={color} floodOpacity="0.2" />
          </filter>
        </defs>
        {/* Chairs */}
        <rect x="35" y="4" width="30" height="12" rx="4" fill={color} className="chair chair-top" />
        <rect x="35" y="84" width="30" height="12" rx="4" fill={color} className="chair chair-bottom" />
        <rect x="4" y="35" width="12" height="30" rx="4" fill={color} className="chair chair-left" />
        <rect x="84" y="35" width="12" height="30" rx="4" fill={color} className="chair chair-right" />
        {/* Table Body */}
        <circle cx="50" cy="50" r="32" fill={bg} stroke={color} strokeWidth="3" filter={`url(#shadow-${table.id})`} className="table-circle" />
        <text x="50" y="56" textAnchor="middle" fill={color} fontSize="18" fontWeight="bold" className="table-text">
          {table.tableName}
        </text>
      </svg>
    );
  };

  if (isLoading) return <div>Đang tải sơ đồ bàn...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="tables-view">
      <div className="tables-header-container">
        <div className="tables-header-text">
          <h2>Sơ đồ bàn phục vụ</h2>
          <p className="text-secondary">Quản lý trạng thái bàn, order và thanh toán.</p>
        </div>
        <button className="btn-premium" onClick={handleAddTable}>
          <span>+</span> Thêm bàn mới
        </button>
      </div>

      <div className="tables-legend-glass">
        <span className="legend-item"><span className="dot bg-green"></span>Trống</span>
        <span className="legend-item"><span className="dot bg-yellow"></span>Đã đặt</span>
        <span className="legend-item"><span className="dot bg-red"></span>Đang có khách</span>
      </div>

      <div className="tables-grid">
        {tables.map(table => (
          <div 
            key={table.id} 
            className="table-card" 
            onClick={() => setSelectedTable(table)}
          >
            {renderTableIcon(table)}
            <div className="table-info">
              {table.status === "occupied" && table.totalAmount > 0 ? (
                <span className="table-amount">{table.totalAmount.toLocaleString()}đ</span>
              ) : (
                <span className="table-status">{
                  table.status === "available" ? "Trống" :
                  table.status === "reserved" ? "Đã đặt" : "Đang phục vụ"
                }</span>
              )}
            </div>
          </div>
        ))}
        {tables.length === 0 && <p>Chưa có bàn nào.</p>}
      </div>

      {selectedTable && (
        <TableDetailModal 
          table={selectedTable} 
          onClose={() => setSelectedTable(null)} 
          onUpdated={() => {
            fetchTables();
          }}
        />
      )}
    </div>
  );
}
