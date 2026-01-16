#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";
import { listCommand } from "./commands/list.js";
import { moveCommand } from "./commands/move.js";
import { doneCommand } from "./commands/done.js";
import { statusCommand } from "./commands/status.js";

const program = new Command();

program
  .name("kaban")
  .description("Terminal Kanban for AI Code Agents")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(addCommand);
program.addCommand(listCommand);
program.addCommand(moveCommand);
program.addCommand(doneCommand);
program.addCommand(statusCommand);

program.parse();
