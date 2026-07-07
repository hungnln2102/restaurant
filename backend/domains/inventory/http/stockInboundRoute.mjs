export async function handleStockInboundRequest({ method }) {
  if (method === "PUT" || method === "DELETE") {
    return {
      status: 403,
      payload: {
        error: "Lịch sử nhập kho chỉ được xem, không được sửa hoặc xóa.",
      },
    };
  }

  return {
    status: 405,
    payload: { error: "Method not allowed." },
  };
}
