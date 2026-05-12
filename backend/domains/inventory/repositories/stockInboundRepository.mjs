import { query, withTransaction } from "../../../db/connection.mjs";

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function mapInboundRow(row) {
  return {
    id: Number(row.id),
    stockProductId: Number(row.stock_product_id),
    supplierId: row.supplier_id === null ? null : Number(row.supplier_id),
    inputQuantity: Number(row.input_quantity),
    inputUnit: row.input_unit,
    unitPrice: row.unit_price === null ? null : Number(row.unit_price),
    currencyCode: row.currency_code,
    conversionRatio: row.conversion_ratio === null ? null : Number(row.conversion_ratio),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateStockInbound({ id, unitPrice, supplierId }) {
  if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
    throw badRequest("Giá thành phải lớn hơn hoặc bằng 0.");
  }

  const result = await query(
    `
      update inventory.stock_inbounds
      set
        unit_price = $1,
        supplier_id = $2,
        updated_at = now()
      where id = $3
      returning
        id,
        stock_product_id,
        supplier_id,
        input_quantity,
        input_unit,
        unit_price,
        currency_code,
        conversion_ratio,
        created_at,
        updated_at
    `,
    [unitPrice, supplierId, id],
  );

  if (result.rows.length === 0) {
    throw notFound("Không tìm thấy phiếu nhập cần cập nhật.");
  }

  return mapInboundRow(result.rows[0]);
}

export async function deleteStockInboundAndRollbackBalance(id) {
  return withTransaction(async (client) => {
    const inboundResult = await client.query(
      `
        select id, stock_product_id, input_quantity, conversion_ratio, remaining_quantity
        from inventory.stock_inbounds
        where id = $1
        for update
      `,
      [id],
    );

    if (inboundResult.rows.length === 0) {
      throw notFound("Không tìm thấy phiếu nhập cần xóa.");
    }

    const inboundRow = inboundResult.rows[0];
    const stockProductId = Number(inboundRow.stock_product_id);
    // Only the still-available portion of the lot should be rolled back from
    // the running balance. The already-consumed portion has already left the
    // balance via FIFO consumption and must NOT be subtracted again, otherwise
    // we would double-subtract and break the invariant
    //   sum(remaining_quantity) == on_hand_quantity.
    const remainingQuantity = Number(inboundRow.remaining_quantity || 0);

    const balanceResult = await client.query(
      `
        select id, on_hand_quantity
        from inventory.stock_balances
        where stock_product_id = $1
        for update
      `,
      [stockProductId],
    );

    if (balanceResult.rows.length > 0 && remainingQuantity > 0) {
      const existingBalance = balanceResult.rows[0];
      const currentBalance = Number(existingBalance.on_hand_quantity || 0);
      const nextQuantity = currentBalance - remainingQuantity;

      // 1e-6 tolerance: NUMERIC(18,4) ↔ JS Number can drift on the 5th
      // decimal during arithmetic; treat tiny negatives as zero and only
      // reject when the deficit is meaningfully negative.
      if (nextQuantity < -1e-6) {
        throw badRequest(
          "Không thể xóa phiếu nhập vì tồn kho hiện tại đang ít hơn lượng còn lại của lô.",
        );
      }

      const safeNextQuantity = nextQuantity < 0 ? 0 : nextQuantity;

      await client.query(
        `
          update inventory.stock_balances
          set on_hand_quantity = $1, updated_at = now()
          where id = $2
        `,
        [safeNextQuantity, existingBalance.id],
      );
    }

    await client.query(`delete from inventory.stock_inbounds where id = $1`, [id]);

    return { id: Number(inboundRow.id) };
  });
}
