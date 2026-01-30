import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { audits } from "../db/schema.js";
import type { DB } from "../db/types.js";

export type AuditEventType = "CREATE" | "UPDATE" | "DELETE";
export type AuditObjectType = "task" | "column" | "board";

export interface AuditEntry {
  id: number;
  timestamp: Date;
  eventType: AuditEventType;
  objectType: AuditObjectType;
  objectId: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  actor: string | null;
}

export interface AuditFilter {
  objectType?: AuditObjectType;
  objectId?: string;
  eventType?: AuditEventType;
  actor?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditHistoryResult {
  entries: AuditEntry[];
  total: number;
  hasMore: boolean;
}

export interface AuditStats {
  totalEntries: number;
  byEventType: Record<AuditEventType, number>;
  byObjectType: Record<AuditObjectType, number>;
  recentActors: string[];
}

export class AuditService {
  constructor(private db: DB) {}

  async getHistory(filter: AuditFilter = {}): Promise<AuditHistoryResult> {
    const conditions = [];

    if (filter.objectType) {
      conditions.push(eq(audits.objectType, filter.objectType));
    }
    if (filter.objectId) {
      conditions.push(eq(audits.objectId, filter.objectId));
    }
    if (filter.eventType) {
      conditions.push(eq(audits.eventType, filter.eventType));
    }
    if (filter.actor) {
      conditions.push(eq(audits.actor, filter.actor));
    }
    if (filter.since) {
      conditions.push(gte(audits.timestamp, filter.since));
    }
    if (filter.until) {
      conditions.push(lte(audits.timestamp, filter.until));
    }

    const limit = Math.min(filter.limit ?? 50, 1000);
    const offset = filter.offset ?? 0;

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const entries = await this.db
      .select()
      .from(audits)
      .where(whereClause)
      .orderBy(desc(audits.timestamp))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = entries.length > limit;
    if (hasMore) entries.pop();

    const countResult = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(audits)
      .where(whereClause);

    return {
      entries: entries as AuditEntry[],
      total: countResult[0]?.count ?? 0,
      hasMore,
    };
  }

  async getTaskHistory(taskId: string, limit = 50): Promise<AuditEntry[]> {
    const result = await this.getHistory({
      objectType: "task",
      objectId: taskId,
      limit,
    });
    return result.entries;
  }

  async getRecentChanges(limit = 50): Promise<AuditEntry[]> {
    const result = await this.getHistory({ limit });
    return result.entries;
  }

  async getChangesByActor(actor: string, limit = 50): Promise<AuditEntry[]> {
    const result = await this.getHistory({ actor, limit });
    return result.entries;
  }

  async getStats(): Promise<AuditStats> {
    const total = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(audits);

    const byEvent = await this.db
      .select({
        eventType: audits.eventType,
        count: sql<number>`COUNT(*)`,
      })
      .from(audits)
      .groupBy(audits.eventType);

    const byObject = await this.db
      .select({
        objectType: audits.objectType,
        count: sql<number>`COUNT(*)`,
      })
      .from(audits)
      .groupBy(audits.objectType);

    const recentActors = await this.db
      .selectDistinct({ actor: audits.actor })
      .from(audits)
      .where(isNotNull(audits.actor))
      .orderBy(desc(audits.timestamp))
      .limit(10);

    const byEventType: Record<AuditEventType, number> = {
      CREATE: 0,
      UPDATE: 0,
      DELETE: 0,
    };
    for (const e of byEvent) {
      byEventType[e.eventType as AuditEventType] = e.count;
    }

    const byObjectType: Record<AuditObjectType, number> = {
      task: 0,
      column: 0,
      board: 0,
    };
    for (const o of byObject) {
      byObjectType[o.objectType as AuditObjectType] = o.count;
    }

    return {
      totalEntries: total[0]?.count ?? 0,
      byEventType,
      byObjectType,
      recentActors: recentActors
        .map((a) => a.actor)
        .filter((a): a is string => a !== null),
    };
  }
}
