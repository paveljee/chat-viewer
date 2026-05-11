import type { ConvertResult, Provider, RenderOptions } from "./types";
import { outputPathFor } from "./shared";
import { isClaudeConversation, renderClaude } from "./providers/claude";
import { isChatGptExport, renderChatGpt } from "./providers/chatgpt";

export { outputPathFor } from "./shared";
export type { ConvertResult, Provider, RenderOptions } from "./types";

export function detectProvider(value: unknown): Provider {
  if (isClaudeConversation(value)) return "claude";
  if (isChatGptExport(value)) return "chatgpt";

  throw new Error("Unsupported chat JSON format. Expected Claude or ChatGPT raw export JSON.");
}

export function renderMarkdown(value: unknown, options: RenderOptions = {}): string {
  const provider = detectProvider(value);

  switch (provider) {
    case "claude":
      return renderClaude(value, options);
    case "chatgpt":
      return renderChatGpt(value, options);
  }
}

export async function convertFile(inputPath: string, options: RenderOptions = {}): Promise<ConvertResult> {
  const input = await Bun.file(inputPath).text();
  const json = JSON.parse(input) as unknown;
  const provider = detectProvider(json);
  const markdown = renderMarkdown(json, options);
  const outputPath = outputPathFor(inputPath);

  await Bun.write(outputPath, markdown);

  return {
    inputPath,
    outputPath,
    provider
  };
}
