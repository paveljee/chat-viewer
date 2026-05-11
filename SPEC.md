# human written - ai never touches this section
Bun TS CLI
that takes json input
and produces md output
in the same dir with the same filename.

The goal is to take
raw API output of
Anthropic or
OpenAI chats
(sample JSONs here:
`test/fixtures/tampermonkey`) and
render them as a
human-readable Markdown file
(example here:
`test/fixtures/tampermonkey/claude/ottosr/output.md`).

Particular attention is paid to
reflecting **all** text/media content
included/referenced in
original JSON, including
all/any artifacts and
all branches of convo.

There is a text fixture at
`test/fixtures/tampermonkey`;
`test/fixtures/tampermonkey/claude/ottosr/input.json`
is sample input in raw Anthropic API format and
`test/fixtures/tampermonkey/claude/ottosr/output.md` is
how the Claude tampermonkey script
(`src/tampermonkey/Claude API Exporter-5.4.1.user.js`)
presents it.
Now,
there is also an input fixture
`test/fixtures/tampermonkey/chatgpt/ottosr/input.json` for
the ChatGPT tampermonkey script
(`src/tampermonkey/ChatGPT Exporter-2.32.0.user.js`)
but no output
because it's suboptimal and
we should stick to the Claude script approach.

All tests are implemented using Bun.
Everything should run through mise.
mise version is pinned in `install.sh`.
`.tool-versions` is used for pinning all software.
Native Bun tooling is used for all TS/JS work.
`Makefile` lint contains strict typecheck of all TS code.

# how ai understood the spec

This project should become a small, reliable Bun/TypeScript CLI that converts raw
LLM conversation JSON into a Markdown record suitable for humans to read,
audit, share, and archive.

The expected user experience is intentionally simple: give the CLI a JSON file,
and it writes a Markdown file next to it with the same base name. The tool should
work for both Anthropic/Claude exports and OpenAI/ChatGPT exports, with provider
detection handled from the JSON shape rather than from user ceremony.

The product bar is fidelity, not summarization. The Markdown must preserve the
conversation as a record: message order, roles, timestamps, model metadata,
branches/alternate versions, thinking/tool/search sections when present,
attachments/media references, code blocks, and every artifact or generated file
that is represented in the source data. If the source JSON contains content, the
Markdown should either render it directly or make its existence and reference
clear. Silent omission is the main failure mode to avoid.

The Claude Tampermonkey exporter is the best reference for output semantics. Its
sample `output.md` shows the desired shape: conversation-level metadata, a clear
title, separators between turns, numbered message headers, branch labels,
version labels, timestamps, collapsible thinking blocks, explicit tool/search
activity, and preservation of side branches. The new CLI does not need to clone
the browser script, but it should reproduce the same information architecture in
a deterministic offline renderer.

The ChatGPT Tampermonkey script is useful mostly as schema reconnaissance, not
as the output model. Its Markdown exporter follows only the selected/current path
through `mapping`, skips many non-chat nodes, and is therefore too lossy for this
project's goal. For OpenAI data, the CLI should instead apply the Claude-style
standard: understand the `mapping` tree, recover all relevant branches, and
surface tool calls, tool results, images, citations, and reasoning/thought nodes
where the raw export provides them.

Success should be judged with fixtures and golden Markdown output. The existing
Claude fixture gives the clearest acceptance target. The ChatGPT fixture is
large and branch/tool-heavy, so it should drive coverage for OpenAI tree
handling and content preservation. Tests should run under Bun through `mise`,
and `make lint` should remain a strict TypeScript typecheck gate.

Current repo state: the specification, fixtures, exporter references, and
toolchain pins are present; the actual Bun package, CLI implementation, and test
suite still need to be built. The first implementation milestone should be a
minimal CLI plus provider-specific parsers that can reproduce the Claude golden
fixture before broadening OpenAI coverage.
