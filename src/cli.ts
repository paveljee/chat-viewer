#!/usr/bin/env bun
import { convertFile } from "./index";

function usage(): string {
  return [
    "Usage: bun run src/cli.ts <input.json>",
    "",
    "Converts a raw Claude or ChatGPT JSON export into adjacent Markdown."
  ].join("\n");
}

const [inputPath] = Bun.argv.slice(2);

if (!inputPath || inputPath === "--help" || inputPath === "-h") {
  console.error(usage());
  process.exit(inputPath ? 0 : 1);
}

try {
  const result = await convertFile(inputPath);
  console.log(`Wrote ${result.outputPath} (${result.provider})`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`chat-viewer: ${message}`);
  process.exit(1);
}
