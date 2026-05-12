import { createClient } from "../db/connection.mjs";

async function run() {
  const client = createClient({ preferUnpooled: true });

  try {
    await client.connect();

    const identityResult = await client.query(`
      select
        current_database() as database_name,
        current_user as user_name,
        now() as server_time
    `);

    const tablesResult = await client.query(`
      select table_schema, table_name
      from information_schema.tables
      where table_schema not in ('information_schema', 'pg_catalog')
      order by table_schema, table_name
      limit 20
    `);

    const identity = identityResult.rows[0];

    console.log("Database connection: OK");
    console.log(`Database: ${identity.database_name}`);
    console.log(`User: ${identity.user_name}`);
    console.log(`Server time: ${identity.server_time.toISOString()}`);

    if (tablesResult.rows.length === 0) {
      console.log("Visible tables: none found");
      return;
    }

    console.log("Visible tables:");

    for (const row of tablesResult.rows) {
      console.log(`- ${row.table_schema}.${row.table_name}`);
    }
  } catch (error) {
    console.error("Database connection: FAILED");
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
