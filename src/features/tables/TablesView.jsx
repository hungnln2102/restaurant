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
    if (status === "available") return "#10b981"; // Green
    if (status === "reserved") return "#f59e0b"; // Yellow
    if (status === "occupied") return "#ef4444"; // Red
    return "#6b7280";
  };

  const renderTableIcon = (table) => {
    const color = getStatusColor(table.status);
    return (
      <svg viewBox="0 0 100 100" className="table-icon">
        <rect x="35" y="5" width="30" height="10" rx="3" fill={color} opacity="0.8" />
        <rect x="35" y="85" width="30" height="10" rx="3" fill={color} opacity="0.8" />
        <rect x="5" y="35" width="10" height="30" rx="3" fill={color} opacity="0.8" />
        <rect x="85" y="35" width="10" height="30" rx="3" fill={color} opacity="0.8" />
        <circle cx="50" cy="50" r="32" fill="#ffffff" stroke={color} strokeWidth="6" />
        <text x="50" y="55" textAnchor="middle" fill={color} fontSize="14" fontWeight="bold">
          {table.tableName}
        </text>
      </svg>
    );
  };

  if (isLoading) return <div>Đang tải sơ đồ bàn...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="tables-view">
      <div className="workspace-header">
        <div>
          <h3>Sơ đồ bàn phục vụ</h3>
          <p className="text-secondary">Quản lý trạng thái bàn, order và thanh toán.</p>
        </div>
        <div className="tables-legend">
          <span className="legend-item"><span className="dot bg-green"></span>Trống</span>
          <span className="legend-item"><span className="dot bg-yellow"></span>Đã đặt</span>
          <span className="legend-item"><span className="dot bg-red"></span>Đang có khách</span>
          <button className="btn btn-primary" onClick={handleAddTable}>+ Thêm bàn mới</button>
        </div>
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
