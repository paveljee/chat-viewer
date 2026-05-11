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
`test/fixtures/tampermonkey/claude/output.md`).

Particular attention is paid to
reflecting **all** text/media content
included/referenced in
original JSON, including
all/any artifacts and
all branches of convo.

There is a text fixture at
`test/fixtures/tampermonkey`;
`test/fixtures/tampermonkey/claude/input.json`
is sample input in raw Anthropic API format and
`test/fixtures/tampermonkey/claude/output.md` is
how the Claude tampermonkey script
(`src/tampermonkey/Claude API Exporter-5.4.1.user.js`)
presents it.
Now,
there is also an input fixture
`test/fixtures/tampermonkey/chatgpt/input.json` for
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


