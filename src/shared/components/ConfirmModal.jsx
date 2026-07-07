import React from "react";

export function ConfirmModal({ isOpen, title, message, confirmText = "Xác nhận", cancelText = "Hủy", onConfirm, onClose, isProcessing = false }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="presentation" onClick={!isProcessing ? onClose : undefined} style={{ zIndex: 1200 }}>
      <div className="modal-shell" role="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "450px" }}>
        <div className="modal-header">
          <div>
            <h4>{title}</h4>
          </div>
          <button 
            type="button" 
            className="modal-close-button" 
            onClick={onClose}
            disabled={isProcessing}
          >
            Đóng
          </button>
        </div>
        
        <div className="modal-form" style={{ padding: "1.5rem" }}>
          <p style={{ margin: 0, fontSize: "1rem", color: "var(--text-color)", lineHeight: 1.5 }}>
            {message}
          </p>
        </div>

        <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", padding: "1rem 1.5rem", borderTop: "1px solid var(--border-color)" }}>
          <button 
            type="button" 
            className="ghost-button" 
            onClick={onClose}
            disabled={isProcessing}
          >
            {cancelText}
          </button>
          <button 
            type="button" 
            className="primary-button" 
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? "Đang xử lý..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
