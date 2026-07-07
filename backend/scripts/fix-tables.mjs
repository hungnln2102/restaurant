import { createClient } from '../db/connection.mjs';
async function run() {
  const c = createClient();
  await c.connect();
  await c.query('ALTER TABLE sales.tables DROP CONSTRAINT IF EXISTS tables_status_check;');
  await c.query("ALTER TABLE sales.tables ADD CONSTRAINT tables_status_check CHECK (status IN ('available', 'occupied', 'reserved'));");
  await c.end();
  console.log('Schema updated');
}
run();
