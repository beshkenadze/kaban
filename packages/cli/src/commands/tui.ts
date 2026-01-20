import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Command } from "commander";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function hasBun(): boolean {
  try {
    const result = spawnSync("bun", ["--version"], { stdio: "ignore" });
    return result.status === 0;
  } catch {
    return false;
  }
}

function findInPath(name: string): string | null {
  const result = spawnSync("which", [name], { encoding: "utf-8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function resolveTuiPackage(): string | null {
  try {
    return require.resolve("@kaban-board/tui");
  } catch {
    return null;
  }
}

function runBinary(path: string, args: string[]): void {
  const child = spawn(path, args, { stdio: "inherit", cwd: process.cwd() });
  child.on("exit", (code) => process.exit(code ?? 0));
}

export const tuiCommand = new Command("tui")
  .description("Start interactive Terminal UI")
  .action(async () => {
    const cwd = process.cwd();
    const args = process.argv.slice(3);
    const useBun = hasBun();

    // 1. Homebrew: Check sibling binary (e.g., /opt/homebrew/bin/kaban-tui)
    const siblingBinary = join(dirname(process.execPath), "kaban-tui");
    if (existsSync(siblingBinary)) return runBinary(siblingBinary, args);

    // 2. Global install: Check PATH for kaban-tui
    const pathBinary = findInPath("kaban-tui");
    if (pathBinary) return runBinary(pathBinary, args);

    // 3. Development mode: Try monorepo TypeScript source
    const tuiDevEntry = join(__dirname, "../../../tui/src/index.ts");
    if (existsSync(tuiDevEntry) && useBun) {
      const child = spawn("bun", ["run", tuiDevEntry], { stdio: "inherit", cwd });
      child.on("exit", (code) => process.exit(code ?? 0));
      return;
    }

    // TUI requires Bun (uses bun:ffi via @opentui/core)
    if (!useBun) {
      console.error("TUI requires Bun. Install: curl -fsSL https://bun.sh/install | bash");
      process.exit(1);
    }

    // 4. Production npm: Use the bundled @kaban-board/tui dependency
    const tuiEntry = resolveTuiPackage();
    if (tuiEntry) {
      const child = spawn("bun", [tuiEntry, ...args], { stdio: "inherit", cwd });
      child.on("exit", (code) => process.exit(code ?? 0));
      return;
    }

    // 5. Fallback: bunx
    const child = spawn("bun", ["x", "@kaban-board/tui", ...args], { stdio: "inherit", cwd });
    child.on("exit", (code) => process.exit(code ?? 0));
  });
