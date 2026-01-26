type DrizzleDb = ReturnType<typeof import("drizzle-orm/libsql").drizzle>;
type BunDatabase = InstanceType<typeof import("bun:sqlite").Database>;
type LibsqlClient = import("@libsql/client").Client;

export type DB = Omit<DrizzleDb, "$client"> & {
  $client: BunDatabase | LibsqlClient;
  $runRaw: (sql: string) => Promise<void>;
  $close: () => Promise<void>;
};

export interface DbConfig {
  url: string;
  authToken?: string;
}

export interface CreateDbOptions {
  migrate?: boolean;
}
