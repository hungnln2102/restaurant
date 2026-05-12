import process from "node:process";
import pg from "pg";

const { Client, Pool } = pg;

function normalizeConnectionString(rawConnectionString) {
  const parsedUrl = new URL(rawConnectionString);
  const sslMode = parsedUrl.searchParams.get("sslmode");

  // Normalize deprecated aliases so pg does not emit compatibility warnings.
  if (["prefer", "require", "verify-ca"].includes(sslMode)) {
    parsedUrl.searchParams.set("sslmode", "verify-full");
  }

  return parsedUrl.toString();
}

export function getConnectionConfig(options = {}) {
  const { preferUnpooled = false } = options;
  const connectionString = preferUnpooled
    ? process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL
    : process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING;

  if (connectionString) {
    return {
      connectionString: normalizeConnectionString(connectionString),
    };
  }

  if (
    process.env.PGHOST &&
    process.env.PGUSER &&
    process.env.PGDATABASE &&
    process.env.PGPASSWORD
  ) {
    return {
      host: process.env.PGHOST,
      user: process.env.PGUSER,
      database: process.env.PGDATABASE,
      password: process.env.PGPASSWORD,
      ssl: { rejectUnauthorized: false },
    };
  }

  throw new Error(
    "Missing database configuration. Set DATABASE_URL/POSTGRES_URL or PGHOST/PGUSER/PGDATABASE/PGPASSWORD in backend/.env.",
  );
}

export function createClient(options = {}) {
  return new Client(getConnectionConfig(options));
}

// Singleton pool + keep-alive timer. Both are stashed on globalThis so Vite
// HMR (which can re-evaluate this module when dependents change) cannot
// create duplicate pools or stack multiple ping intervals.
const POOL_KEY = "__restaurantManagementPgPool__";
const KEEPALIVE_KEY = "__restaurantManagementPgKeepAliveTimer__";

function parsePositiveInt(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseBooleanFlag(rawValue, fallback) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback;
  }
  const normalized = String(rawValue).trim().toLowerCase();
  if (["1", "on", "true", "yes", "enabled"].includes(normalized)) {
    return true;
  }
  if (["0", "off", "false", "no", "disabled"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function buildPoolConfig() {
  return {
    ...getConnectionConfig(),
    // Default to 5 for Neon Free tier (which typically caps at ~10
    // concurrent connections per role). Override with PGPOOL_MAX on a paid
    // plan or local Postgres.
    max: parsePositiveInt(process.env.PGPOOL_MAX, 5),
    idleTimeoutMillis: parsePositiveInt(process.env.PGPOOL_IDLE_TIMEOUT_MS, 30_000),
    connectionTimeoutMillis: parsePositiveInt(
      process.env.PGPOOL_CONNECT_TIMEOUT_MS,
      10_000,
    ),
    allowExitOnIdle: false,
    // Enable TCP keep-alive at the socket level so NAT/firewalls/Neon's
    // PgBouncer do not silently drop idle connections between requests.
    keepAlive: true,
    keepAliveInitialDelayMillis: parsePositiveInt(
      process.env.PG_KEEPALIVE_INITIAL_DELAY_MS,
      10_000,
    ),
  };
}

function scheduleKeepAlivePing() {
  // Allow opting out via PG_KEEPALIVE=off when running CLI scripts that
  // do not want a long-lived timer pinning the process open.
  const enabled = parseBooleanFlag(process.env.PG_KEEPALIVE, true);
  if (!enabled) {
    return;
  }

  // Clear any timer left over from a previous module load (HMR safety).
  const previousTimer = globalThis[KEEPALIVE_KEY];
  if (previousTimer) {
    clearInterval(previousTimer);
  }

  const intervalMs = parsePositiveInt(
    process.env.PG_KEEPALIVE_PING_INTERVAL_MS,
    4 * 60 * 1000,
  );

  const timer = setInterval(() => {
    // Fire-and-forget. The pool's 'error' handler already takes care of
    // transport failures; we just swallow per-call errors so a single
    // failed ping never crashes the dev server.
    const pool = globalThis[POOL_KEY];
    if (!pool) {
      return;
    }
    pool.query("select 1").catch((error) => {
      console.warn("[pg] keep-alive ping failed:", error.message);
    });
  }, intervalMs);

  // unref() lets Node exit even if the timer is still scheduled — important
  // for `vite build` or any short-lived process that imports this module.
  timer.unref?.();

  globalThis[KEEPALIVE_KEY] = timer;
}

export function getPool() {
  const existingPool = globalThis[POOL_KEY];
  if (existingPool) {
    return existingPool;
  }

  const pool = new Pool(buildPoolConfig());

  // pg emits 'error' on idle clients that get disconnected by the server
  // (Neon closes idle TLS sockets aggressively). Swallow + log so the
  // process does not crash; the pool will create a fresh client on demand.
  pool.on("error", (error) => {
    console.error("[pg] Idle pool client error:", error.message);
  });

  globalThis[POOL_KEY] = pool;
  scheduleKeepAlivePing();
  return pool;
}

// Pre-create the pool and run a trivial query so the first real HTTP request
// doesn't pay for: (a) Neon auto-suspend wake-up (1–3s on free tier), and
// (b) TLS handshake + SCRAM auth. Safe to call multiple times — subsequent
// calls just hit the live pool.
export async function warmUpPool() {
  const startedAt = Date.now();
  try {
    await getPool().query("select 1");
    const elapsedMs = Date.now() - startedAt;
    console.log(`[pg] Pool warmed up in ${elapsedMs}ms`);
    return { ok: true, elapsedMs };
  } catch (error) {
    console.warn(`[pg] Pool warm-up failed: ${error.message}`);
    return { ok: false, error };
  }
}

function isTimingEnabled() {
  return parseBooleanFlag(process.env.PG_LOG_TIMING, false);
}

function buildTimingLabel(text) {
  if (typeof text !== "string") {
    return "[non-string query]";
  }
  return text.replace(/\s+/g, " ").trim().slice(0, 80);
}

export async function query(text, params) {
  if (!isTimingEnabled()) {
    return getPool().query(text, params);
  }
  const startedAt = Date.now();
  try {
    return await getPool().query(text, params);
  } finally {
    const elapsedMs = Date.now() - startedAt;
    console.log(`[pg] query ${elapsedMs}ms :: ${buildTimingLabel(text)}`);
  }
}

export async function withTransaction(callback) {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch (rollbackError) {
      console.error("[pg] Rollback failed:", rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
}
