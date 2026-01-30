#!/usr/bin/env node
import { createRequire } from "node:module";
import { Command } from "commander";
import { addCommand } from "./commands/add.js";
import { archiveCommand, purgeCommand, resetCommand, restoreCommand } from "./commands/archive.js";
import { auditCommand } from "./commands/audit.js";
import { assignCommand } from "./commands/assign.js";
import { deleteCommand } from "./commands/delete.js";
import { doneCommand } from "./commands/done.js";
import { editCommand } from "./commands/edit.js";
import { exportCommand } from "./commands/export.js";
import { getCommand } from "./commands/get.js";
import { hookCommand } from "./commands/hook.js";
import { importCommand } from "./commands/import.js";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";
import { mcpCommand } from "./commands/mcp.js";
import { moveCommand } from "./commands/move.js";
import { nextCommand } from "./commands/next.js";
import { schemaCommand } from "./commands/schema.js";
import { statsCommand } from "./commands/stats.js";
import { searchCommand } from "./commands/search.js";
import { statusCommand } from "./commands/status.js";
import { syncCommand } from "./commands/sync.js";
import { tuiCommand } from "./commands/tui.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const program = new Command();

program.name("kaban").description("Terminal Kanban for AI Code Agents").version(pkg.version);

program.addCommand(initCommand);
program.addCommand(addCommand);
program.addCommand(auditCommand);
program.addCommand(listCommand);
program.addCommand(moveCommand);
program.addCommand(assignCommand);
program.addCommand(deleteCommand);
program.addCommand(doneCommand);
program.addCommand(editCommand);
program.addCommand(getCommand);
program.addCommand(statusCommand);
program.addCommand(schemaCommand);
program.addCommand(searchCommand);
program.addCommand(mcpCommand);
program.addCommand(nextCommand);
program.addCommand(statsCommand);
program.addCommand(tuiCommand);
program.addCommand(hookCommand);
program.addCommand(syncCommand);
program.addCommand(archiveCommand);
program.addCommand(restoreCommand);
program.addCommand(purgeCommand);
program.addCommand(resetCommand);
program.addCommand(exportCommand);
program.addCommand(importCommand);

program.parse();
