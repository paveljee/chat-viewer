import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { convertFile, detectProvider, outputPathFor, renderMarkdown } from "../src";

const claudeInputPath = "test/fixtures/tampermonkey/claude/input.json";
const claudeOutputPath = "test/fixtures/tampermonkey/claude/output.md";
const chatGptInputPath = "test/fixtures/tampermonkey/chatgpt/input.json";
const chatGptOutputPath = "test/fixtures/tampermonkey/chatgpt/output.md";

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await Bun.file(path).text()) as unknown;
}

describe("provider detection", () => {
  test("detects Claude raw exports", async () => {
    expect(detectProvider(await readJson(claudeInputPath))).toBe("claude");
  });

  test("detects ChatGPT raw exports", async () => {
    expect(detectProvider(await readJson(chatGptInputPath))).toBe("chatgpt");
  });
});

describe("Claude rendering", () => {
  test("matches the Claude golden fixture", async () => {
    const input = await readJson(claudeInputPath);
    const expected = await Bun.file(claudeOutputPath).text();

    expect(renderMarkdown(input)).toBe(expected);
  });
});

describe("ChatGPT rendering", () => {
  test("matches the ChatGPT golden fixture", async () => {
    const input = await readJson(chatGptInputPath);
    const expected = await Bun.file(chatGptOutputPath).text();

    expect(renderMarkdown(input)).toBe(expected);
  });
});

describe("file conversion", () => {
  test("writes Markdown beside the input path", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "chat-viewer-"));
    const inputPath = join(tempDir, "conversation.json");
    const outputPath = outputPathFor(inputPath);

    try {
      await Bun.write(inputPath, Bun.file(claudeInputPath));
      const result = await convertFile(inputPath);

      expect(result.outputPath).toBe(outputPath);
      expect(result.provider).toBe("claude");
      expect(await Bun.file(outputPath).text()).toBe(await Bun.file(claudeOutputPath).text());
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
