import React, { useEffect, useMemo, useState } from "react";
import { StatCards } from "../../../shared/components/StatCards";
import {
  createPortioningRule,
  fetchPortioningRules,
  updatePortioningRule,
} from "../api/portioningApi";

const portioningChecklist = [
  {
    title: "Quy đổi theo đơn vị kho",
    copy: "Chuẩn hóa các đơn vị như thùng, khay, bao sang đơn vị chế biến để tính cost chính xác.",
  },
  {
    title: "Định mức theo món",
    copy: "Mỗi quy ước nên gắn với một định lượng chuẩn để bếp và kho cùng dùng một chuẩn dữ liệu.",
  },
  {
    title: "Phê duyệt thay đổi",
    copy: "Khi thay đổi định lượng, nên cập nhật quy đổi và theo dõi lại tác động tới cost.",
  },
];

const initialFormState = {
  id: null,
  stockUnit: "",
  processingUnit: "",
  conversionRatio: "",
};

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(value);
}

function buildStats(rules) {
  const portionDefinitionCount = new Set(rules.map((rule) => rule.portionDefinitionId)).size;
  const stockUnitCount = new Set(rules.map((rule) => rule.stockUnit)).size;
  const averageRatio =
    rules.length === 0
      ? 0
      : rules.reduce((total, rule) => total + Number(rule.conversionRatio), 0) / rules.length;

  return [
    {
      label: "Quy ước định lượng",
      value: String(portionDefinitionCount),
      note: "Số quy ước hiện đang lưu trong database.",
    },
    {
      label: "Dòng quy đổi đơn vị",
      value: String(rules.length),
      note: "Tổng số dòng quy đổi đang hoạt động.",
    },
    {
      label: "Đơn vị kho khác nhau",
      value: String(stockUnitCount),
      note: "Số loại đơn vị kho đã được chuẩn hóa.",
    },
    {
      label: "Tỷ lệ quy đổi TB",
      value: rules.length === 0 ? "0" : formatNumber(averageRatio),
      note: "Giá trị trung bình trên các quy ước đang có.",
    },
  ];
}

export function InventoryPortioningContent() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [form, setForm] = useState(initialFormState);

  async function loadRules() {
    setLoading(true);
    setError("");

    try {
      const data = await fetchPortioningRules();
      setRules(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRules();
  }, []);

  const stats = useMemo(() => buildStats(rules), [rules]);
  const isEditing = form.id !== null;

  function updateFormField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openCreateForm() {
    setForm(initialFormState);
    setIsFormOpen(true);
    setSubmitError("");
    setSubmitSuccess("");
  }

  function openEditForm(rule) {
    setForm({
      id: Number(rule.id),
      stockUnit: rule.stockUnit,
      processingUnit: rule.processingUnit,
      conversionRatio: String(rule.conversionRatio),
    });
    setIsFormOpen(true);
    setSubmitError("");
    setSubmitSuccess("");
  }

  function closeForm() {
    setIsFormOpen(false);
    setForm(initialFormState);
    setSubmitError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const payload = {
        stockUnit: form.stockUnit,
        processingUnit: form.processingUnit,
        conversionRatio: Number(form.conversionRatio),
      };

      if (isEditing) {
        const updatedRule = await updatePortioningRule({
          id: form.id,
          ...payload,
        });

        setRules((current) =>
          current.map((rule) => (rule.id === updatedRule.id ? updatedRule : rule)),
        );
        setSubmitSuccess("Đã cập nhật quy đổi định lượng.");
      } else {
        const createdRule = await createPortioningRule(payload);
        setRules((current) => [createdRule, ...current]);
        setSubmitSuccess("Đã tạo quy ước định lượng mới.");
      }

      setForm(initialFormState);
      setIsFormOpen(false);
    } catch (requestError) {
      setSubmitError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <StatCards items={stats} />

      <div className="content-grid">
        <article className="panel-card">
          <div className="panel-heading">
            <div>
              <span>Quy chuẩn định lượng</span>
              <h4>Bảng quy đổi định lượng</h4>
            </div>

            <div className="panel-actions">
              <button type="button" className="ghost-button" onClick={openCreateForm}>
                Tạo quy ước định lượng
              </button>
              <button type="button" className="text-button">
                Xuất định mức
              </button>
            </div>
          </div>

          {isFormOpen ? (
            <form className="portioning-form" onSubmit={handleSubmit}>
              <div className="portioning-form-grid">
                <label className="field-stack">
                  <span>Đơn vị kho</span>
                  <input
                    type="text"
                    value={form.stockUnit}
                    onChange={(event) => updateFormField("stockUnit", event.target.value)}
                    placeholder="Ví dụ: kg"
                    required
                  />
                </label>

                <label className="field-stack">
                  <span>Đơn vị chế biến</span>
                  <input
                    type="text"
                    value={form.processingUnit}
                    onChange={(event) => updateFormField("processingUnit", event.target.value)}
                    placeholder="Ví dụ: phần"
                    required
                  />
                </label>

                <label className="field-stack">
                  <span>Tỷ lệ quy đổi</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.conversionRatio}
                    onChange={(event) => updateFormField("conversionRatio", event.target.value)}
                    placeholder="Ví dụ: 8.3"
                    required
                  />
                </label>
              </div>

              <div className="portioning-form-actions">
                <p className="field-help">
                  {isEditing
                    ? "Cập nhật trực tiếp dòng quy đổi đang chọn trong database."
                    : "Hệ thống sẽ tự tạo quy ước định lượng nội bộ và liên kết dòng quy đổi bằng ID."}
                </p>

                <div className="toolbar-actions">
                  <button type="button" className="ghost-button" onClick={closeForm}>
                    Đóng
                  </button>
                  <button type="submit" className="primary-button" disabled={isSubmitting}>
                    {isSubmitting ? "Đang lưu..." : isEditing ? "Lưu chỉnh sửa" : "Lưu quy ước"}
                  </button>
                </div>
              </div>
            </form>
          ) : null}

          {submitError ? <p className="form-feedback error">{submitError}</p> : null}
          {submitSuccess ? <p className="form-feedback success">{submitSuccess}</p> : null}

          {loading ? (
            <div className="empty-state">
              <strong>Đang tải dữ liệu định lượng...</strong>
              <p>Hệ thống đang đọc danh sách quy đổi từ database.</p>
            </div>
          ) : error ? (
            <div className="empty-state error">
              <strong>Không tải được dữ liệu định lượng</strong>
              <p>{error}</p>
              <button type="button" className="text-button" onClick={loadRules}>
                Tải lại
              </button>
            </div>
          ) : rules.length === 0 ? (
            <div className="empty-state">
              <strong>Chưa có quy ước định lượng nào</strong>
              <p>Tạo quy ước đầu tiên để bảng này đọc dữ liệu trực tiếp từ database.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Đơn vị kho</th>
                    <th>Đơn vị chế biến</th>
                    <th>Tỷ lệ quy đổi</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((row) => (
                    <tr key={row.id}>
                      <td>{row.stockUnit}</td>
                      <td>{row.processingUnit}</td>
                      <td>{row.ratioLabel}</td>
                      <td className="table-action-cell">
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => openEditForm(row)}
                        >
                          Sửa quy đổi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="panel-card accent-card">
          <div className="panel-heading">
            <div>
              <span>Quy trình kiểm soát</span>
              <h4>Điểm cần khóa trong quản lý định lượng</h4>
            </div>
          </div>

          <div className="signal-stack">
            {portioningChecklist.map((item) => (
              <div key={item.title} className="signal-item">
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </>
  );
}
