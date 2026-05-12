import { query, withTransaction } from "../../../db/connection.mjs";

// Tolerance used to absorb NUMERIC(18,4) ↔ JS Number drift on subtraction
// chains. Anything smaller than this is treated as zero so we never reject
// a legitimate "set to zero" or fail the FIFO loop on a 5th-decimal residue.
const QUANTITY_EPSILON = 1e-6;

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

function mapBalanceRow(row) {
  return {
    id: Number(row.id),
    stockProductId: Number(row.stock_product_id),
    onHandQuantity: Number(row.on_hand_quantity),
    onHandUnit: row.on_hand_unit,
    updatedAt: row.updated_at,
  };
}

async function consumeFifo(client, stockProductId, amountToConsume) {
  // Lock every still-available lot of the product so a parallel update of
  // the same product blocks behind us instead of double-consuming.
  const lotsResult = await client.query(
    `
      select id, remaining_quantity
      from inventory.stock_inbounds
      where stock_product_id = $1
        and remaining_quantity > 0
      order by created_at asc, id asc
      for update
    `,
    [stockProductId],
  );

  let remainingDelta = amountToConsume;

  for (const lot of lotsResult.rows) {
    if (remainingDelta <= QUANTITY_EPSILON) {
      break;
    }

    const lotRemaining = Number(lot.remaining_quantity || 0);
    const consumeNow = Math.min(lotRemaining, remainingDelta);

    if (consumeNow <= 0) {
      continue;
    }

    const nextLotRemaining = lotRemaining - consumeNow;
    // Snap to 0 when within epsilon so the lot is correctly flagged as
    // exhausted (and excluded from the partial FIFO index next time).
    const safeNextRemaining = nextLotRemaining < QUANTITY_EPSILON ? 0 : nextLotRemaining;

    await client.query(
      `
        update inventory.stock_inbounds
        set remaining_quantity = $1, updated_at = now()
        where id = $2
      `,
      [safeNextRemaining, lot.id],
    );

    remainingDelta -= consumeNow;
  }

  if (remainingDelta > QUANTITY_EPSILON) {
    throw badRequest(
      "Dữ liệu lô và tồn không khớp, hãy chạy đồng bộ trước khi giảm tồn.",
    );
  }
}

async function createAdjustmentLot(client, stockProductId, onHandUnit, addedQuantity) {
  // Use the balance's normalized unit so the new "phantom" lot can be
  // FIFO-consumed by future decreases just like a real receipt.
  await client.query(
    `
      insert into inventory.stock_inbounds (
        stock_product_id,
        supplier_id,
        input_quantity,
        input_unit,
        unit_price,
        currency_code,
        unit_conversion_id,
        conversion_ratio,
        remaining_quantity
      )
      values ($1, null, $2, $3, null, 'VND', null, null, $2)
    `,
    [stockProductId, addedQuantity, onHandUnit],
  );
}

export async function updateStockBalance({ id, onHandQuantity }) {
  if (!Number.isFinite(onHandQuantity) || onHandQuantity < 0) {
    throw badRequest("Tồn kho phải lớn hơn hoặc bằng 0.");
  }

  return withTransaction(async (client) => {
    // Lock the balance row first so concurrent updates of the same row are
    // serialized; this also pins the stock_product_id we hand to the FIFO
    // and adjustment helpers.
    const balanceResult = await client.query(
      `
        select id, stock_product_id, on_hand_quantity, on_hand_unit
        from inventory.stock_balances
        where id = $1
        for update
      `,
      [id],
    );

    if (balanceResult.rows.length === 0) {
      throw notFound("Không tìm thấy dòng tồn kho cần cập nhật.");
    }

    const balanceRow = balanceResult.rows[0];
    const stockProductId = Number(balanceRow.stock_product_id);
    const currentQuantity = Number(balanceRow.on_hand_quantity || 0);
    const onHandUnit = balanceRow.on_hand_unit;
    const delta = onHandQuantity - currentQuantity;

    if (delta < -QUANTITY_EPSILON) {
      await consumeFifo(client, stockProductId, -delta);
    } else if (delta > QUANTITY_EPSILON) {
      await createAdjustmentLot(client, stockProductId, onHandUnit, delta);
    }

    const updated = await client.query(
      `
        update inventory.stock_balances
        set on_hand_quantity = $1, updated_at = now()
        where id = $2
        returning id, stock_product_id, on_hand_quantity, on_hand_unit, updated_at
      `,
      [onHandQuantity, id],
    );

    return mapBalanceRow(updated.rows[0]);
  });
}

export async function deleteStockBalance(id) {
  const result = await query(
    `
      delete from inventory.stock_balances
      where id = $1
      returning id
    `,
    [id],
  );

  if (result.rows.length === 0) {
    throw notFound("Không tìm thấy dòng tồn kho cần xóa.");
  }

  return { id: Number(result.rows[0].id) };
}
