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

- The repo currently contains the project spec, setup scripts, Tampermonkey
  exporter references, and JSON/Markdown fixtures.
- No Bun package, TypeScript source, CLI entrypoint, or Bun tests have been
  created yet.
- The target is a Bun/TypeScript CLI that reads raw Anthropic or OpenAI
  conversation JSON and writes a Markdown file next to the input with the same
  base filename.
- The Claude fixture and exporter output style are the primary output contract.
- The ChatGPT exporter is useful for understanding the OpenAI JSON shape, but
  its Markdown behavior is too lossy for the project goal.

## Next Steps

- [ ] Scaffold the Bun/TypeScript project files:
  `package.json`, `tsconfig.json`, source directory, and test layout.
- [ ] Add a CLI entrypoint that accepts one JSON file path and writes adjacent
  `.md` output.
- [ ] Implement provider detection for Claude-style and ChatGPT-style raw JSON.
- [ ] Implement the first Claude renderer against
  `test/fixtures/tampermonkey/claude/input.json`.
- [ ] Add a golden test comparing generated Claude Markdown to
  `test/fixtures/tampermonkey/claude/output.md`.
- [ ] Run through `mise`/`make test` and `make lint` once the project scaffolding
  exists.
- [ ] Start OpenAI coverage after Claude golden output is reproducible.

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
