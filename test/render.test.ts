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

  test("reconstructs artifact update and rewrite chains", () => {
    const markdown = renderMarkdown({
      uuid: "claude-artifacts",
      name: "Claude Artifacts",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:03:00.000Z",
      model: "claude-test",
      chat_messages: [
        {
          uuid: "human-1",
          parent_message_uuid: "00000000-0000-4000-8000-000000000000",
          sender: "human",
          index: 0,
          created_at: "2026-01-01T00:00:00.000Z",
          content: [{ type: "text", text: "make an artifact" }]
        },
        {
          uuid: "assistant-1",
          parent_message_uuid: "human-1",
          sender: "assistant",
          index: 1,
          created_at: "2026-01-01T00:01:00.000Z",
          content: [
            {
              type: "tool_use",
              name: "artifacts",
              input: {
                id: "artifact-1",
                title: "Plan",
                command: "create",
                type: "text/markdown",
                language: "markdown",
                content: "Hello old world"
              }
            },
            {
              type: "tool_use",
              name: "artifacts",
              input: {
                id: "artifact-1",
                title: "Plan",
                command: "update",
                old_str: "old",
                new_str: "new"
              }
            },
            {
              type: "tool_use",
              name: "artifacts",
              input: {
                id: "artifact-1",
                title: "Final Plan",
                command: "rewrite",
                type: "text/markdown",
                language: "markdown",
                content: "# Final\n\nDone"
              }
            },
            {
              type: "mystery",
              payload: true
            }
          ],
          files_v2: [{ file_name: "diagram.png", file_uuid: "file-1" }]
        }
      ]
    });

    expect(markdown).toContain("> *Version:* 1");
    expect(markdown).toContain("> *Version:* 2");
    expect(markdown).toContain("> *Update Info:* Successfully applied update");
    expect(markdown).toContain("Hello new world");
    expect(markdown).toContain("# Final");
    expect(markdown).toContain("**Unsupported Claude content:** `mystery`");
    expect(markdown).toContain("**File:** diagram.png");
  });
});

describe("ChatGPT rendering", () => {
  test.failing("[XFAIL] matches the ChatGPT golden fixture", async () => {
    const input = await readJson(chatGptInputPath);
    const expected = await Bun.file(chatGptOutputPath).text();

    expect(renderMarkdown(input)).toBe(expected);
  });

  test("renders media references and unsupported content fallbacks", () => {
    const markdown = renderMarkdown({
      id: "chatgpt-media",
      title: "ChatGPT Media",
      create_time: 1767225600,
      update_time: 1767225660,
      current_node: "assistant-1",
      mapping: {
        "user-1": {
          id: "user-1",
          parent: null,
          children: ["assistant-1"],
          message: {
            author: { role: "user" },
            recipient: "all",
            create_time: 1767225600,
            content: {
              content_type: "multimodal_text",
              parts: ["look at this", { content_type: "image_asset_pointer", asset_pointer: "sediment://image-1" }]
            }
          }
        },
        "assistant-1": {
          id: "assistant-1",
          parent: "user-1",
          children: [],
          message: {
            author: { role: "assistant" },
            recipient: "all",
            create_time: 1767225660,
            content: {
              content_type: "future_content_type",
              value: true
            }
          }
        }
      }
    });

    expect(markdown).toContain("![image](sediment://image-1)");
    expect(markdown).toContain("**Unsupported ChatGPT content:** `future_content_type`");
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
