import { ZenStackClient } from '@zenstackhq/orm';
import { schema } from '../schema/schema';
import { PolicyPlugin } from '@zenstackhq/plugin-policy';

const syncUrl = process.env.TURSO_SYNC_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db = new ZenStackClient(schema, {
  adapter: 'libsql',
  url: process.env.TURSO_DATABASE_URL!,
  syncUrl: syncUrl,
  authToken: authToken,
}).$use(new PolicyPlugin());

export function setAuthContext(userId: string) {
  db.$setAuth({ userId });
}
