import React from "react";
import { StatCards } from "../../shared/components/StatCards";

const debtStats = [
  { label: "Công nợ phải trả", value: "248.7M", note: "Tổng dư nợ của 22 nhà cung cấp." },
  { label: "Khoản đến hạn 7 ngày", value: "61.2M", note: "Ưu tiên nhóm hàng tươi sống và bao bì." },
  { label: "Đối tác cần đối soát", value: "06", note: "Chênh lệch hóa đơn so với phiếu nhập." },
  { label: "Chu kỳ thanh toán TB", value: "18 ngày", note: "Theo thỏa thuận hiện tại với NCC." },
];

const debtRows = [
  { supplier: "Fresh Valley", invoice: "PO-240419-01", amount: "18.500.000đ", dueDate: "22/04/2026", status: "Sắp đến hạn" },
  { supplier: "Blue Ocean Foods", invoice: "PO-240417-09", amount: "32.800.000đ", dueDate: "25/04/2026", status: "Đối soát" },
  { supplier: "PackPro", invoice: "PO-240412-03", amount: "12.300.000đ", dueDate: "29/04/2026", status: "Bình thường" },
  { supplier: "Milk & Cheese Hub", invoice: "PO-240410-07", amount: "21.600.000đ", dueDate: "30/04/2026", status: "Bình thường" },
];

export function DebtsView() {
  return (
    <section className="feature-page">
      <div className="feature-toolbar">
        <div>
          <span className="toolbar-kicker">Kiểm soát tài chính</span>
          <h3>Quản lý công nợ và lịch thanh toán nhà cung cấp</h3>
        </div>

        <div className="toolbar-actions">
          <button type="button" className="ghost-button">
            Xuất biên bản đối soát
          </button>
          <button type="button" className="primary-button">
            Tạo lịch thanh toán
          </button>
        </div>
      </div>

      <StatCards items={debtStats} />

      <div className="content-grid">
        <article className="panel-card">
          <div className="panel-heading">
            <div>
              <span>Bảng công nợ</span>
              <h4>Khoản phải trả theo hóa đơn mua hàng</h4>
            </div>
            <button type="button" className="text-button">
              Chốt kỳ công nợ
            </button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nhà cung cấp</th>
                  <th>Mã hóa đơn</th>
                  <th>Số tiền</th>
                  <th>Đến hạn</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {debtRows.map((row) => (
                  <tr key={row.invoice}>
                    <td>{row.supplier}</td>
                    <td>{row.invoice}</td>
                    <td>{row.amount}</td>
                    <td>{row.dueDate}</td>
                    <td>
                      <span
                        className={`status-chip ${
                          row.status === "Sắp đến hạn"
                            ? "warning"
                            : row.status === "Đối soát"
                              ? "muted"
                              : "safe"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-heading">
            <div>
              <span>Lịch thanh toán</span>
              <h4>Việc cần chốt trong 72 giờ</h4>
            </div>
          </div>

          <ul className="timeline-list">
            <li>
              <strong>Hôm nay</strong>
              <p>Chốt số liệu với Fresh Valley trước khi thanh toán đợt rau củ đầu tuần.</p>
            </li>
            <li>
              <strong>Ngày mai</strong>
              <p>Rà hóa đơn hải sản phát sinh với Blue Ocean Foods để loại chênh lệch cân nặng.</p>
            </li>
            <li>
              <strong>Trong 3 ngày</strong>
              <p>Khóa báo cáo công nợ tháng và chuẩn bị kế hoạch chi dòng tiền tuần kế tiếp.</p>
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
}
