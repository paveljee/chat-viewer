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
