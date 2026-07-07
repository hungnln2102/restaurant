import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { createClient } from "../db/connection.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaFilePath = path.resolve(__dirname, "../sql/tables-schema.sql");

async function run() {
  const client = createClient({ preferUnpooled: true });
  const sql = await readFile(schemaFilePath, "utf8");

  try {
    await client.connect();
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log("Tables schema applied successfully!");
  } catch (error) {
    await client.query("rollback");
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
