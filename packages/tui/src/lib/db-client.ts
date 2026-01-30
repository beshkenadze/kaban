import type { DB } from "@kaban-board/core/bun";
import type { CliRenderer, KeyEvent } from "@opentui/core";

interface BunSqliteClient {
  query: (sql: string) => { get: () => Record<string, unknown> | null };
}

interface LibsqlClient {
  execute: (sql: string) => Promise<{ rows: unknown[][] }>;
}

type DbClient = BunSqliteClient | LibsqlClient;

export function getDbClient(db: DB): DbClient {
  const internal = db as { $client?: unknown };
  if (!internal.$client) {
    throw new Error("Unable to access database client");
  }
  const client = internal.$client;
  if (
    typeof (client as BunSqliteClient).query === "function" ||
    typeof (client as LibsqlClient).execute === "function"
  ) {
    return client as DbClient;
  }
  throw new Error("Unknown database client type");
}

export function isBunSqlite(client: DbClient): client is BunSqliteClient {
  return typeof (client as BunSqliteClient).query === "function";
}

export async function getDataVersion(client: DbClient): Promise<number> {
  if (isBunSqlite(client)) {
    const row = client.query("PRAGMA data_version").get();
    return (row?.data_version as number) ?? 0;
  }
  const result = await (client as LibsqlClient).execute("PRAGMA data_version");
  return result.rows[0]?.[0] as number;
}

type KeypressHandler = (key: KeyEvent) => void;

interface KeyInputEmitter {
  on(event: "keypress", handler: KeypressHandler): void;
  off(event: "keypress", handler: KeypressHandler): void;
}

export function getKeyInput(renderer: CliRenderer): KeyInputEmitter {
  return renderer.keyInput as unknown as KeyInputEmitter;
}
