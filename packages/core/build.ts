import { build } from "bun";

const result = await build({
  entrypoints: ["./src/index.ts", "./src/index-bun.ts"],
  outdir: "./dist",
  target: "node",
  packages: "external",
  loader: {
    ".sql": "text",
    ".json": "json",
  },
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`Bundled ${result.outputs.length} files`);
for (const output of result.outputs) {
  console.log(`  ${output.path}`);
}
