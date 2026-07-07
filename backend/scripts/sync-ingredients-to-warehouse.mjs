import { query, withTransaction } from "../db/connection.mjs";

async function run() {
  console.log("Đang bắt đầu đồng bộ nguyên liệu từ định lượng (menu_product_components) vào kho (stock_balances)...");

  await withTransaction(async (client) => {
    // Tìm các nguyên liệu đang có trong định lượng nhưng CHƯA CÓ dòng tồn kho nào
    const missingResult = await client.query(`
      select distinct 
        mpc.stock_product_id, 
        mpc.unit,
        sp.product_name
      from inventory.menu_product_components mpc
      join inventory.stock_products sp on sp.id = mpc.stock_product_id
      where not exists (
        select 1 
        from inventory.stock_balances sb 
        where sb.stock_product_id = mpc.stock_product_id
      )
    `);

    const missingIngredients = missingResult.rows;
    console.log(`Tìm thấy ${missingIngredients.length} nguyên liệu có trong định lượng nhưng chưa có trong kho.`);

    for (const item of missingIngredients) {
      console.log(`- Đang khởi tạo kho cho: ${item.product_name} (ĐVT: ${item.unit})`);
      
      // Tạo một dòng balance với số lượng = 0
      await client.query(`
        insert into inventory.stock_balances (stock_product_id, on_hand_quantity, on_hand_unit)
        values ($1, 0, $2)
      `, [item.stock_product_id, item.unit]);
    }

    console.log("Đồng bộ hoàn tất thành công!");
  });
  
  process.exit(0);
}

run().catch((error) => {
  console.error("Lỗi khi đồng bộ:", error);
  process.exit(1);
});
