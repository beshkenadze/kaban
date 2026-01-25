import { spawn } from "node:child_process";
import type { KabanTask } from "./types.js";

interface KabanListResponse {
  id: string;
  title: string;
  columnId: string;
  description?: string;
  labels?: string[];
}

interface KabanStatusResponse {
  board: { name: string };
  columns: Array<{ id: string; name: string; count: number }>;
  totalTasks: number;
}

export class KabanClient {
  private kabanCmd: string[];

  constructor(private cwd: string) {
    // Allow overriding kaban command via environment variable
    // Format: "bun /path/to/index.js" or just "kaban"
    const cliOverride = process.env.KABAN_CLI;
    this.kabanCmd = cliOverride ? cliOverride.split(" ") : ["kaban"];
  }

  async boardExists(): Promise<boolean> {
    try {
      const result = await this.exec([...this.kabanCmd, "status", "--json"]);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async listTasks(columnId?: string): Promise<KabanTask[]> {
    const args = [...this.kabanCmd, "list", "--json"];
    if (columnId) {
      args.push("--column", columnId);
    }

    const result = await this.exec(args);
    if (result.exitCode !== 0) {
      return [];
    }

    try {
      const parsed = JSON.parse(result.stdout);
      const tasks = (parsed.data ?? parsed) as KabanListResponse[];
      return tasks.map((t) => ({
        id: t.id,
        title: t.title,
        columnId: t.columnId,
        description: t.description,
        labels: t.labels,
      }));
    } catch {
      return [];
    }
  }

  async getTaskById(id: string): Promise<KabanTask | null> {
    const result = await this.exec([...this.kabanCmd, "get", id, "--json"]);
    if (result.exitCode !== 0) {
      return null;
    }

    try {
      const parsed = JSON.parse(result.stdout);
      const task = (parsed.data ?? parsed) as KabanListResponse;
      return {
        id: task.id,
        title: task.title,
        columnId: task.columnId,
        description: task.description,
        labels: task.labels,
      };
    } catch {
      return null;
    }
  }

  async findTaskByTitle(title: string): Promise<KabanTask | null> {
    const tasks = await this.listTasks();
    return tasks.find((t) => t.title === title) ?? null;
  }

  async addTask(title: string, columnId: string = "todo"): Promise<string | null> {
    const result = await this.exec([...this.kabanCmd, "add", title, "--column", columnId, "--json"]);
    if (result.exitCode !== 0) {
      return null;
    }

    try {
      const response = JSON.parse(result.stdout);
      return response.data?.id ?? response.id ?? null;
    } catch {
      const match = result.stdout.match(/id[":]*\s*["']?([A-Z0-9]+)/i);
      return match?.[1] ?? null;
    }
  }

  async moveTask(id: string, columnId: string): Promise<boolean> {
    const result = await this.exec([...this.kabanCmd, "move", id, columnId]);
    return result.exitCode === 0;
  }

  async completeTask(id: string): Promise<boolean> {
    const result = await this.exec([...this.kabanCmd, "done", id]);
    return result.exitCode === 0;
  }

  async getStatus(): Promise<KabanStatusResponse | null> {
    const result = await this.exec([...this.kabanCmd, "status", "--json"]);
    if (result.exitCode !== 0) {
      return null;
    }

    try {
      const parsed = JSON.parse(result.stdout);
      return (parsed.data ?? parsed) as KabanStatusResponse;
    } catch {
      return null;
    }
  }

  private exec(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const [cmd, ...cmdArgs] = args;
      const proc = spawn(cmd, cmdArgs, { cwd: this.cwd });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        resolve({ exitCode: code ?? 1, stdout, stderr });
      });

      proc.on("error", () => {
        resolve({ exitCode: 1, stdout: "", stderr: "spawn error" });
      });
    });
  }
}
