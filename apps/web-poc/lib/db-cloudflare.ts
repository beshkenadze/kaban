import { connect } from '@tursodatabase/serverless';

// Cloudflare Workers compatible Turso client
// Uses HTTP-based connection instead of local SQLite
export function createCloudflareDB() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set');
  }

  return connect({
    url,
    authToken,
  });
}

// Helper to execute queries
export async function executeQuery(query: string, params: unknown[] = []) {
  const conn = createCloudflareDB();
  const stmt = conn.prepare(query);
  return await stmt.all(params);
}
