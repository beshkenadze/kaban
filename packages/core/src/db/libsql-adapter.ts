import { ExitCode, KabanError } from "../types.js";
import * as schema from "./schema.js";
import { ensureDbDir, fileUrlToPath } from "./utils.js";
import type { DB, DbConfig } from "./types.js";

export async function createLibsqlDb(config: DbConfig): Promise<DB> {
  let client: ReturnType<typeof import("@libsql/client").createClient> | undefined;
  try {
    const { createClient } = await import("@libsql/client");
    const { drizzle } = await import("drizzle-orm/libsql");

    if (config.url.startsWith("file:")) {
      ensureDbDir(fileUrlToPath(config.url));
    }

    client = createClient(config);
    const db = drizzle(client, { schema });

    let closed = false;
    const clientRef = client;

    return Object.assign(db, {
      $client: clientRef,
      $runRaw: async (sql: string) => {
        try {
          await clientRef.executeMultiple(sql);
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
          clientRef.close();
        } catch {
          // best-effort close
        }
      },
    }) as unknown as DB;
  } catch (error) {
    try {
      client?.close?.();
    } catch {
      // ignore cleanup failures
    }
    if (error instanceof KabanError) throw error;
    throw new KabanError(
      `Failed to create libsql database: ${error instanceof Error ? error.message : String(error)}`,
      ExitCode.GENERAL_ERROR,
    );
  }
}
