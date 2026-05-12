import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "../db/connection.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaFilePath = path.resolve(__dirname, "../sql/inventory-schema.sql");

async function run() {
  const client = createClient({ preferUnpooled: true });
  const sql = await readFile(schemaFilePath, "utf8");

  try {
    await client.connect();
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");

    console.log("Inventory schema applied: OK");
    console.log("Schema: inventory");
    console.log("Tables:");
    console.log("- inventory.portion_definitions");
    console.log("- inventory.unit_conversions");
    console.log("- inventory.stock_products");
    console.log("- inventory.suppliers");
    console.log("- inventory.supplier_products");
    console.log("- inventory.stock_inbounds");
    console.log("- inventory.stock_balances");
    console.log("- inventory.menu_products");
    console.log("- inventory.menu_product_components");
    console.log("- inventory.product_sales_plans");
    console.log("- inventory.product_orders");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("Inventory schema applied: FAILED");
    console.error(`Message: ${error.message}`);

    if (error.code) {
      console.error(`Code: ${error.code}`);
    }

    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

await run();
