-- Add updated_by column to tasks for actor tracking
ALTER TABLE tasks ADD COLUMN updated_by TEXT;

--> statement-breakpoint

-- Create audits table
CREATE TABLE audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  event_type TEXT NOT NULL CHECK (event_type IN ('CREATE', 'UPDATE', 'DELETE')),
  object_type TEXT NOT NULL CHECK (object_type IN ('task', 'column', 'board')),
  object_id TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  actor TEXT
);

--> statement-breakpoint

CREATE INDEX idx_audits_object ON audits(object_type, object_id);

--> statement-breakpoint

CREATE INDEX idx_audits_timestamp ON audits(timestamp);

--> statement-breakpoint

-- Trigger: task INSERT
CREATE TRIGGER audit_task_insert
AFTER INSERT ON tasks
BEGIN
  INSERT INTO audits (event_type, object_type, object_id, new_value, actor)
  VALUES ('CREATE', 'task', NEW.id, 
    json_object('title', NEW.title, 'columnId', NEW.column_id),
    NEW.created_by);
END;

--> statement-breakpoint

-- Trigger: task UPDATE (single trigger with conditional inserts for each field)
CREATE TRIGGER audit_task_update
AFTER UPDATE ON tasks
BEGIN
  -- Title changed
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'title', OLD.title, NEW.title, NEW.updated_by
  WHERE (OLD.title IS NULL AND NEW.title IS NOT NULL)
     OR (OLD.title IS NOT NULL AND NEW.title IS NULL)
     OR (OLD.title <> NEW.title);
  
  -- Column changed (task moved)
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'columnId', OLD.column_id, NEW.column_id, NEW.updated_by
  WHERE (OLD.column_id IS NULL AND NEW.column_id IS NOT NULL)
     OR (OLD.column_id IS NOT NULL AND NEW.column_id IS NULL)
     OR (OLD.column_id <> NEW.column_id);
  
  -- Assigned to changed
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'assignedTo', OLD.assigned_to, NEW.assigned_to, NEW.updated_by
  WHERE (OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL)
     OR (OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NULL)
     OR (OLD.assigned_to <> NEW.assigned_to);

  -- Description changed
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'description', OLD.description, NEW.description, NEW.updated_by
  WHERE (OLD.description IS NULL AND NEW.description IS NOT NULL)
     OR (OLD.description IS NOT NULL AND NEW.description IS NULL)
     OR (OLD.description <> NEW.description);

  -- Archived status changed
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'archived', OLD.archived, NEW.archived, NEW.updated_by
  WHERE (OLD.archived IS NULL AND NEW.archived IS NOT NULL)
     OR (OLD.archived IS NOT NULL AND NEW.archived IS NULL)
     OR (OLD.archived <> NEW.archived);

  -- Labels changed
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'labels', OLD.labels, NEW.labels, NEW.updated_by
  WHERE (OLD.labels IS NULL AND NEW.labels IS NOT NULL)
     OR (OLD.labels IS NOT NULL AND NEW.labels IS NULL)
     OR (OLD.labels <> NEW.labels);
END;

--> statement-breakpoint

-- Trigger: task DELETE
CREATE TRIGGER audit_task_delete
AFTER DELETE ON tasks
BEGIN
  INSERT INTO audits (event_type, object_type, object_id, old_value)
  VALUES ('DELETE', 'task', OLD.id,
    json_object('title', OLD.title, 'columnId', OLD.column_id));
END;
