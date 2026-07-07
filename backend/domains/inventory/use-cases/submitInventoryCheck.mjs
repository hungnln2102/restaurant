import { withTransaction } from "../../../db/connection.mjs";
import { invalidateAfterBalanceChange } from "../../../shared/cacheInvalidation.mjs";

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function generateCheckCode() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `CHK-${dateStr}-${randomNum}`;
}

export async function submitInventoryCheck(payload) {
  const items = payload?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest("Danh sách kiểm kê trống.");
  }

  const result = await withTransaction(async (client) => {
    const checkCode = generateCheckCode();
    
    // Create stock_checks row
    const checkInsertResult = await client.query(
      `
        insert into inventory.stock_checks (check_code, status, notes)
        values ($1, 'pending', $2)
        returning id, check_code, status
      `,
      [checkCode, payload.notes || null]
    );
    const checkId = checkInsertResult.rows[0].id;

    let updatedCount = 0;

    for (const item of items) {
      const balanceId = Number(item.balanceId);
      const actualQuantity = Number(item.actualQuantity);

      if (!Number.isFinite(balanceId) || balanceId <= 0) {
        throw badRequest("ID dòng tồn kho không hợp lệ.");
      }

      if (!Number.isFinite(actualQuantity) || actualQuantity < 0) {
        throw badRequest("Số lượng thực tế phải lớn hơn hoặc bằng 0.");
      }

      // Read current balance
      const currentResult = await client.query(
        `select stock_product_id, on_hand_quantity, on_hand_unit from inventory.stock_balances where id = $1`,
        [balanceId]
      );

      if (currentResult.rows.length === 0) {
        throw badRequest(`Không tìm thấy dòng tồn kho ID ${balanceId}.`);
      }

      const balanceRow = currentResult.rows[0];
      const stockProductId = Number(balanceRow.stock_product_id);
      const currentQuantity = Number(balanceRow.on_hand_quantity);
      const unit = balanceRow.on_hand_unit;
      const variance = actualQuantity - currentQuantity;

      // Insert check item
      await client.query(
        `
          insert into inventory.stock_check_items (
            check_id, stock_product_id, system_quantity, actual_quantity, variance_quantity, unit
          ) values ($1, $2, $3, $4, $5, $6)
        `,
        [checkId, stockProductId, currentQuantity, actualQuantity, variance, unit]
      );

      // Update variance & last checked on stock_balances so it shows in Overview immediately
      await client.query(
        `
          update inventory.stock_balances
          set variance_quantity = $1, last_checked_at = now()
          where id = $2
        `,
        [variance, balanceId]
      );
      
      updatedCount++;
    }

    return { checkId: Number(checkId), checkCode, updatedCount };
  });

  invalidateAfterBalanceChange();
  return result;
}
