import React, { useState } from "react";
import { createTable } from "../api/tablesApi";

export function CreateTableModal({ onClose, onCreated }) {
  const [tableName, setTableName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tableName.trim()) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      await createTable(tableName.trim());
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-shell" style={{ width: "min(500px, 100%)" }}>
        <header className="modal-header">
          <div>
            <h4>Thêm bàn mới</h4>
            <p>Nhập tên hoặc số thứ tự bàn để tạo mới.</p>
          </div>
          <button type="button" className="modal-close-button" onClick={onClose}>Đóng</button>
        </header>

        <form className="modal-form" onSubmit={handleSubmit}>
          {error && (
            <div className="modal-highlight" style={{ marginBottom: "16px", borderColor: "var(--warning)" }}>
              <strong style={{ color: "var(--warning)" }}>Lỗi</strong>
              <p>{error}</p>
            </div>
          )}

          <div className="field-stack" style={{ marginBottom: "24px" }}>
            <span>Tên bàn *</span>
            <input
              type="text"
              autoFocus
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="Ví dụ: Bàn 12, VIP 1..."
              required
            />
          </div>

          <div className="portioning-form-actions">
            <button type="button" className="ghost-button" onClick={onClose} disabled={isSubmitting}>
              Hủy
            </button>
            <button type="submit" className="primary-button" disabled={isSubmitting || !tableName.trim()}>
              {isSubmitting ? "Đang thêm..." : "Thêm bàn"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
