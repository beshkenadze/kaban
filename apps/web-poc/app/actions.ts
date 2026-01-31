"use server";

import { getClient, syncWithTurso } from "@/lib/db";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  column_id: string;
  position: number;
  created_by: string;
  assigned_to: string | null;
  created_at: number;
  updated_at: number;
  archived: number;
}

export interface ColumnData {
  id: string;
  name: string;
  position: number;
  wip_limit: number | null;
  tasks: Task[];
}

export async function getBoardData(boardId: string): Promise<{
  board: { id: string; name: string } | null;
  columns: ColumnData[];
  tasks: Task[];
}> {
  await syncWithTurso();
  const client = getClient();

  try {
    const boardResult = await client.execute({
      sql: "SELECT id, name FROM boards WHERE id = ?",
      args: [boardId],
    });

    if (boardResult.rows.length === 0) {
      return { board: null, columns: [], tasks: [] };
    }

    const board = {
      id: String(boardResult.rows[0].id),
      name: String(boardResult.rows[0].name),
    };

    const columnsResult = await client.execute({
      sql: "SELECT id, name, position, wip_limit FROM columns WHERE board_id = ? ORDER BY position ASC",
      args: [boardId],
    });

    const columns: ColumnData[] = columnsResult.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      position: Number(row.position),
      wip_limit: row.wip_limit ? Number(row.wip_limit) : null,
      tasks: [],
    }));

    const columnIds = columns.map((c) => c.id);
    
    let tasks: Task[] = [];
    if (columnIds.length > 0) {
      const placeholders = columnIds.map(() => "?").join(",");
      const tasksResult = await client.execute({
        sql: `SELECT id, title, description, column_id, position, created_by, assigned_to, created_at, updated_at, archived 
              FROM tasks 
              WHERE column_id IN (${placeholders}) AND archived = 0 
              ORDER BY position ASC`,
        args: columnIds,
      });

      tasks = tasksResult.rows.map((row) => ({
        id: String(row.id),
        title: String(row.title),
        description: row.description ? String(row.description) : null,
        column_id: String(row.column_id),
        position: Number(row.position),
        created_by: String(row.created_by),
        assigned_to: row.assigned_to ? String(row.assigned_to) : null,
        created_at: Number(row.created_at),
        updated_at: Number(row.updated_at),
        archived: Number(row.archived),
      }));
    }

    const columnsWithTasks = columns.map((col) => ({
      ...col,
      tasks: tasks.filter((t) => t.column_id === col.id),
    }));

    return {
      board,
      columns: columnsWithTasks,
      tasks,
    };
  } catch (error) {
    console.error("Error fetching board:", error);
    return { board: null, columns: [], tasks: [] };
  }
}

export async function moveTask(
  taskId: string,
  newColumnId: string,
  newPosition: number
): Promise<Task | null> {
  const client = getClient();
  const now = Math.floor(Date.now() / 1000);

  try {
    await client.execute({
      sql: "UPDATE tasks SET column_id = ?, position = ?, updated_at = ? WHERE id = ?",
      args: [newColumnId, newPosition, now, taskId],
    });

    await syncWithTurso();

    const result = await client.execute({
      sql: "SELECT id, title, description, column_id, position, created_by, assigned_to, created_at, updated_at, archived FROM tasks WHERE id = ?",
      args: [taskId],
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: String(row.id),
      title: String(row.title),
      description: row.description ? String(row.description) : null,
      column_id: String(row.column_id),
      position: Number(row.position),
      created_by: String(row.created_by),
      assigned_to: row.assigned_to ? String(row.assigned_to) : null,
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
      archived: Number(row.archived),
    };
  } catch (error) {
    console.error("Failed to move task:", error);
    return null;
  }
}

export async function addTask(data: {
  title: string;
  description?: string;
  column_id: string;
  created_by: string;
}): Promise<Task | null> {
  const client = getClient();
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();

  try {
    await client.execute({
      sql: `INSERT INTO tasks (id, title, description, column_id, position, created_by, assigned_to, created_at, updated_at, archived, version, depends_on, files, labels) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        data.title,
        data.description || null,
        data.column_id,
        0,
        data.created_by,
        null,
        now,
        now,
        0,
        1,
        "[]",
        "[]",
        "[]",
      ],
    });

    await syncWithTurso();

    return {
      id,
      title: data.title,
      description: data.description || null,
      column_id: data.column_id,
      position: 0,
      created_by: data.created_by,
      assigned_to: null,
      created_at: now,
      updated_at: now,
      archived: 0,
    };
  } catch (error) {
    console.error("Failed to add task:", error);
    return null;
  }
}

export async function archiveTask(taskId: string): Promise<boolean> {
  const client = getClient();
  const now = Math.floor(Date.now() / 1000);

  try {
    await client.execute({
      sql: "UPDATE tasks SET archived = 1, archived_at = ?, updated_at = ? WHERE id = ?",
      args: [now, now, taskId],
    });

    await syncWithTurso();

    return true;
  } catch (error) {
    console.error("Failed to archive task:", error);
    return false;
  }
}
