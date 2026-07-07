import { updateStockBalanceInTx } from "../repositories/stockBalanceRepository.mjs";
import { withTransaction } from "../../../db/connection.mjs";
import { invalidateAfterBalanceChange } from "../../../shared/cacheInvalidation.mjs";

export async function syncInventoryData() {
  const result = await withTransaction(async (client) => {
    // 1. Find all balances that have a non-null, non-zero variance
    const balancesResult = await client.query(`
      select id, on_hand_quantity, variance_quantity 
      from inventory.stock_balances 
      where variance_quantity is not null and variance_quantity != 0
    `);

    const balancesToUpdate = balancesResult.rows;
    let syncedCount = 0;

    // 2. Apply variance to on_hand_quantity via existing updateStockBalanceInTx
    for (const row of balancesToUpdate) {
      const balanceId = Number(row.id);
      const currentQuantity = Number(row.on_hand_quantity);
      const variance = Number(row.variance_quantity);
      const newQuantity = currentQuantity + variance;

      // Leverage existing FIFO/Adjustment logic for the delta
      await updateStockBalanceInTx(client, { id: balanceId, onHandQuantity: newQuantity });
      syncedCount++;
    }

    // 3. Reset variance_quantity for all items in the database
    // Even if variance was 0, we reset it so the UI clears the "Chênh lệch" column.
    await client.query(`
      update inventory.stock_balances
      set variance_quantity = null
    `);

    // 4. Update all pending stock_checks to 'applied'
    const checksResult = await client.query(`
      update inventory.stock_checks
      set status = 'applied', updated_at = now()
      where status = 'pending'
      returning id
    `);

    return { syncedBalances: syncedCount, appliedChecks: checksResult.rowCount };
  });

  if (result.syncedBalances > 0) {
    invalidateAfterBalanceChange();
  }

  return result;
}
