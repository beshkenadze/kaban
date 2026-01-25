-- Add index for archived column
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived);
--> statement-breakpoint
-- Create FTS5 virtual table for full-text search
-- Uses unicode61 tokenizer with remove_diacritics for proper Russian language support
CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
  id, title, description,
  content='tasks',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
-- Create trigger to keep FTS in sync on INSERT
CREATE TRIGGER IF NOT EXISTS tasks_fts_insert AFTER INSERT ON tasks BEGIN
  INSERT INTO tasks_fts(rowid, id, title, description)
  VALUES (NEW.rowid, NEW.id, NEW.title, COALESCE(NEW.description, ''));
END;
--> statement-breakpoint
-- Create trigger to keep FTS in sync on DELETE
CREATE TRIGGER IF NOT EXISTS tasks_fts_delete AFTER DELETE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, id, title, description)
  VALUES('delete', OLD.rowid, OLD.id, OLD.title, COALESCE(OLD.description, ''));
END;
--> statement-breakpoint
-- Create trigger to keep FTS in sync on UPDATE
CREATE TRIGGER IF NOT EXISTS tasks_fts_update AFTER UPDATE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, id, title, description)
  VALUES('delete', OLD.rowid, OLD.id, OLD.title, COALESCE(OLD.description, ''));
  INSERT INTO tasks_fts(rowid, id, title, description)
  VALUES (NEW.rowid, NEW.id, NEW.title, COALESCE(NEW.description, ''));
END;
--> statement-breakpoint
-- Populate FTS with existing data (only if FTS table is empty)
INSERT INTO tasks_fts(rowid, id, title, description)
SELECT rowid, id, title, COALESCE(description, '') FROM tasks
WHERE NOT EXISTS (SELECT 1 FROM tasks_fts LIMIT 1);
