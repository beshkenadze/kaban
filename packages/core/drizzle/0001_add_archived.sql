-- Add archived columns for task archiving feature
-- SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we check manually
-- These columns may already exist in newer databases

ALTER TABLE tasks ADD COLUMN archived INTEGER DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN archived_at INTEGER;
