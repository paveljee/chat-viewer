# WORK.md

Personal working notebook for the AI coding agent on this repo.

This file is for keeping the work legible between sessions. It should stay
clean enough for human review and practical enough for me to use while moving.
`SPEC.md` remains the source of truth; this file is execution memory.

Last updated: 2026-05-11

## Operating Notes

- Keep this file ordered: current state first, then next steps, then completed
  work and background notes.
- When a task is done, move it to `Done` or mark it checked.
- Keep implementation details short unless they affect future decisions.
- Prefer updating this file at natural checkpoints, not after every tiny edit.

## Current State

- The repo now has a Bun/TypeScript project scaffold, CLI entrypoint, provider
  detection, renderers, and Bun tests.
- The target is a Bun/TypeScript CLI that reads raw Anthropic or OpenAI
  conversation JSON and writes a Markdown file next to the input with the same
  base filename.
- The Claude fixture and exporter output style are the primary output contract.
- Claude rendering currently matches the checked-in golden fixture exactly.
- ChatGPT/OpenAI JSON is detected, rendered with branch/version labels, and now
  has a checked-in golden Markdown fixture.

## Next Steps

- [ ] Expand Claude artifact handling beyond the current basic inline artifact
  rendering so create/update/rewrite chains are fully reconstructed.
- [ ] Refine ChatGPT thinking/tool rendering so thought and tool-result chains
  can be grouped into fewer, more readable assistant turns without losing raw
  content.
- [ ] Add tests for attachments/media references and unsupported content
  fallbacks.

## Decisions

- Use native Bun tooling for install, tests, and TypeScript checks.
- Keep provider-specific parsing separate from shared Markdown rendering where
  that reduces complexity.
- Treat "content preservation" as the key product requirement. If a source
  object cannot be rendered beautifully yet, represent it explicitly rather than
  silently dropping it.
- Favor deterministic offline rendering over reusing browser/Tampermonkey code.

## Done

- [x] Read `SPEC.md`, setup files, fixtures, and the relevant Tampermonkey
  exporter behavior.
- [x] Added an executive-oriented AI interpretation to `SPEC.md`.
- [x] Created this notebook.
- [x] Scaffolded Bun/TypeScript project files:
  `package.json`, `bun.lock`, `tsconfig.json`, `src/`, and `test/`.
- [x] Added CLI entrypoint at `src/cli.ts`.
- [x] Implemented provider detection for Claude-style and ChatGPT-style raw JSON.
- [x] Implemented Claude Markdown rendering against
  `test/fixtures/tampermonkey/claude/input.json`.
- [x] Added a golden test comparing generated Claude Markdown to
  `test/fixtures/tampermonkey/claude/output.md`.
- [x] Added conservative ChatGPT rendering and a smoke test against the ChatGPT
  fixture.
- [x] Ran `make test`: 5 passing tests.
- [x] Ran `make lint`: strict TypeScript typecheck passing.
- [x] Improved ChatGPT/OpenAI rendering with branch labels, version labels,
  search query rendering, search result rendering, content references, and
  citation sections.
- [x] Added `test/fixtures/tampermonkey/chatgpt/output.md` as a golden fixture.
- [x] Changed ChatGPT test coverage from a smoke test to exact golden comparison.
- [x] Re-ran `make test`: 5 passing tests.
- [x] Re-ran `make lint`: strict TypeScript typecheck passing.
- [x] Added a concise `README.md`.

## Background Notes

- Claude raw fixture shape:
  top-level `chat_messages`, `uuid`, `name`, `created_at`, `updated_at`,
  `model`, and `current_leaf_message_uuid`.
- Claude output fixture shape:
  conversation metadata, title, separators, numbered message headings, branch
  labels, version labels, timestamps, collapsible thinking blocks, web/tool
  sections, and all branches.
- ChatGPT raw fixture shape:
  top-level array containing conversation objects with `mapping`,
  `current_node`, `title`, `create_time`, `update_time`, and model metadata in
  message metadata.
- ChatGPT branch handling will likely need an explicit tree walk over
  `mapping`, not the current-path-only approach used by the referenced
  Tampermonkey Markdown export.
