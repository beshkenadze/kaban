#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";

const program = new Command();

program
  .name("kaban")
  .description("Terminal Kanban for AI Code Agents")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(addCommand);

program.parse();
