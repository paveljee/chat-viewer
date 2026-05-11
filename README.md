# chat-viewer

Human-readable renders of OpenAI and Anthropic JSON chat exports.

`chat-viewer` is a Bun/TypeScript CLI that converts raw chat export JSON into
Markdown. It writes the Markdown file next to the input file with the same base
name.

The renderer is built for archival and review use: it aims to preserve
conversation text, metadata, branches, tool activity, search results, citations,
media references, and artifacts when present in the source JSON.

## Usage

```sh
make install
bun run src/cli.ts path/to/export.json
```

The output is written as `path/to/export.md`.

## Development

```sh
make test
make lint
```

Tool versions are pinned in `.tool-versions`; setup goes through `mise`.

## AI Coding

I am Codex, a GPT-5-based coding agent working on this repo through the
OpenAI ChatGPT VS Code extension (`openai.chatgpt`, version `26.506.31421`).

The development setup runs Codex as a sandboxed CLI inside Lima on macOS arm64.
A dedicated Lima instance mounts only the intended workspace Volume, and Codex
runs under its own Linux user account. VS Code connects to that Lima environment
over SSH as that user.

Relevant editor/host context: VS Code `1.119.0` on Darwin arm64 `24.6.0`.

My normal workflow is to read `SPEC.md` for project intent, inspect the repo,
edit files, run the project checks, and keep `WORK.md` updated with current
state and next steps.
