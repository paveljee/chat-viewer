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
`test/fixtures/tampermonkey/claude/aea/output.md`).

Particular attention is paid to
reflecting **all** text/media content
included/referenced in
original JSON, including
all/any artifacts and
all branches of convo.

There is a text fixture at
`test/fixtures/tampermonkey`;
`test/fixtures/tampermonkey/claude/aea/input.json`
is sample input in raw Anthropic API format and
`test/fixtures/tampermonkey/claude/aea/output.md` is
how the Claude tampermonkey script
(`src/tampermonkey/Claude API Exporter-5.4.1.user.js`)
presents it.
Now,
there is also an input fixture
`test/fixtures/tampermonkey/chatgpt/aea/input.json` for
the ChatGPT tampermonkey script
(`src/tampermonkey/ChatGPT Exporter-2.32.0.user.js`)
but no output
because it's suboptimal and
we should stick to the Claude script approach.

Another fixture:
`test/fixtures/tampermonkey/chatgpt/doi-platforms/input.json`.
This is an example of OpenAI deep research and
is an important case to ensure
all artifacts are indeed shown
in the output Markdown.

All tests are implemented using Bun.
Everything should run through mise.
mise version is pinned in `install.sh`.
`.tool-versions` is used for pinning all software.
Native Bun tooling is used for all TS/JS work.
`Makefile` lint contains strict typecheck of all TS code.

# how ai understood the spec

This is a small Bun/TypeScript CLI for converting raw Anthropic and OpenAI chat
JSON into human-readable Markdown records. The intended workflow is deliberately
low-ceremony: pass a JSON file, detect the provider from shape, and write a
same-directory `.md` file with the same base name.

The product bar is archival fidelity. The renderer should preserve the
conversation as evidence: text, roles, order, timestamps, model metadata,
branches, alternate versions, thinking/tool/search traces, citations, media
references, attachments, and artifacts. If the source JSON contains content, the
Markdown should render it or explicitly account for it. Silent omission is the
primary risk.

Claude output remains the reference information architecture. The
`claude/aea` fixture and Claude Tampermonkey script define the desired
shape: conversation metadata, title, separators, numbered turn headers, branch
and version labels, timestamps, collapsible thinking blocks, explicit tool
activity, and side-branch preservation.

OpenAI output should follow that Claude-style standard rather than the ChatGPT
Tampermonkey Markdown export. The ChatGPT exporter is useful for schema
reconnaissance, but its Markdown path is too lossy. The OpenAI renderer must
walk the `mapping` tree, surface relevant branches, group tool calls/results
readably, and preserve citations, content references, media, reasoning traces,
and generated artifacts.

The `chatgpt/doi-platforms` fixture is a critical OpenAI acceptance case. Its
deep-research report lives inside embedded app widget state, not as a normal
visible assistant message, so the renderer must extract that report, plan,
citations, and content references from metadata rather than dropping it as
hidden UI plumbing.

Current repo state: the CLI, provider detection, renderers, Bun tests, strict
typecheck, and fixture coverage are in place. Claude has an exact golden output
test. ChatGPT coverage is fixture-driven rather than golden-driven, with tests
for AEA fixture preservation, deep-research embedded output, media references, and
unsupported content fallbacks. All toolchain execution should continue through
`mise`, `.tool-versions`, native Bun tooling, `make test`, and `make lint`.
