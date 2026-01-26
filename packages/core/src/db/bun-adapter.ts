import { ExitCode, KabanError } from "../types.js";
import * as schema from "./schema.js";
import { ensureDbDir } from "./utils.js";
import type { DB } from "./types.js";

export async function createBunDb(filePath: string): Promise<DB> {
  let sqlite: InstanceType<typeof import("bun:sqlite").Database> | undefined;
  try {
    const { Database } = await import("bun:sqlite");
    const { drizzle } = await import("drizzle-orm/bun-sqlite");

    ensureDbDir(filePath);
    sqlite = new Database(filePath);
    const db = drizzle({ client: sqlite, schema });

    let closed = false;
    const sqliteRef = sqlite;

    return Object.assign(db, {
      $client: sqliteRef,
      $runRaw: async (sql: string) => {
        try {
          if (typeof sqliteRef.exec === "function") {
            sqliteRef.exec(sql);
            return;
          }
          const statements = sql.split(";").filter((s) => s.trim());
          for (const stmt of statements) {
            sqliteRef.run(stmt);
          }
        } catch (error) {
          throw new KabanError(
            `SQL execution failed: ${error instanceof Error ? error.message : String(error)}`,
            ExitCode.GENERAL_ERROR,
          );
        }
      },
      $close: async () => {
        if (closed) return;
        closed = true;
        try {
          sqliteRef.close();
        } catch {
          // best-effort close
        }
      },
    }) as unknown as DB;
  } catch (error) {
    try {
      sqlite?.close?.();
    } catch {
      // ignore cleanup failures
    }
    if (error instanceof KabanError) throw error;
    throw new KabanError(
      `Failed to create Bun database: ${error instanceof Error ? error.message : String(error)}`,
      ExitCode.GENERAL_ERROR,
    );
  }
}
