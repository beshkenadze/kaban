import { createClient, type Client } from '@libsql/client';

const dbUrl = process.env.TURSO_DATABASE_URL || 'file:./local.db';
const syncUrl = process.env.TURSO_SYNC_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

let client: Client | null = null;

export function getClient(): Client {
  if (!client) {
    client = createClient({
      url: dbUrl,
      syncUrl,
      authToken,
    });
  }
  return client;
}

export async function syncWithTurso() {
  if (!syncUrl || !authToken) {
    return;
  }
  
  try {
    const c = getClient();
    await c.sync();
    console.log('Synced with Turso Cloud');
  } catch (error) {
    console.error('Sync failed:', error);
  }
}
