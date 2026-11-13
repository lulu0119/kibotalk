# AGENTS.md

Guidance for AI coding agents working in this repo. Read before making changes.

## What this is

KiboTalk — "Live Reply Coach" MVP: a live foreign-language conversation coach.
Speaker verification splits user vs counterpart; after **either** speaker's
turn is ingested we always request reply suggestions. The LLM returns exactly
3 candidates or `[]` (skip). Empty / failed / in-flight keeps the previous
committed cards. User mid-utterance stalls (after pause) get full-sentence
completions; other turns almost always get 3. Same card schema for both.

**Language axes** (spec §1.4, ADR 0003): `conversationLang` (ja|en|zh) is what
both speakers use in-session (STT hint + `targetText`); persisted product
`uiLang` (ja|en|zh) controls the UI and is frozen into internal `meaningLang`
for candidate `meaning` when a session starts (it may equal conversation).
Level is one global `beginner|intermediate|advanced` value (`level`).
Prefs are session-out only; each session freezes a snapshot. Japanese-only
`segments` (furigana / particles); rename is `meaning` not `meaningZh`.

Authoritative spec: `docs/spec/live-reply-coach-mvp.md`. ADRs in
`docs/adr/`. Past fixes & known pitfalls in `docs/solutions/` (read the
relevant one before touching a documented area). Prompt / schema vieval
benchmark reports in `docs/prompt-evals/` (read the latest before changing
reply prompts). When implementation and spec diverge, align per spec or
update the spec — don't silently drift.

## Architecture

Web calls the user's configured reply endpoint from the browser. macOS calls it in
the Electron main process and stores its key with `safeStorage`. History,
voiceprints, and speech model assets stay on the device. See [local setup](README.md#run-locally).

The clients share `useConversationSession` and `createSessionCapture`.
The speech Worker runs Sherpaw VAD and streaming ASR on 16 kHz mono PCM in
512-sample frames. Desktop dual capture has independent VAD and ASR streams
for microphone and system audio. TurnGate merges finalized segments before
the reply pipeline runs. Only finalized transcripts go into history and prompts.

## Tech stack — do not bypass these

These are spec-named choices. **Do not rewrite or substitute them** with hand-rolled equivalents:

- **LLM → xsAI v1**. Use the pinned provider preview from xsAI PR #350 to resolve
  model routes and xsAI's text adapters for streaming. Read the repo's xsAI skill in
  `.agents/skills/xsai/` and verify v1 calls against the pinned types before editing `packages/llm`.
- **Prompts → Velin** (`@velin-dev/core-react`). Render the existing TSX prompts.
- **Speech → Sherpaw**. The model catalog pins Zipformer, X-ASR, and Paraformer.
  Silero v5 detects speech boundaries and CAM++ supplies speaker embeddings.
  Keep the version in the voiceprint storage namespace when changing models.
- **Trace → AIRI**. Emit through `@proj-airi/trace-kit`. Playground mounts the
  published `ui-trace` and `ui-timeline` components in its trace dialog.
- **Python deps → `uv`**: repo-local `.venv` (gitignored); install with `uv pip install -r <path>/requirements.txt`, never bare `pip`. Keep helper scripts in the repo so GitHub workflows can run them; invoke with `.venv/bin/python`.

## Conventions

- Persist reply-model settings per device. Browser keys stay in browser storage.
  Desktop keys are encrypted at rest. Keep credentials out of traces and logs.
- **Pure functions; no new classes** unless the framework/API requires it. Imports at top. TS unions: exhaustive `switch`.
- **Full words.** No obscure abbreviations; only use ones common in software.
- **Smallest correct diff.** Only change what was asked. No drive-by refactor, tests, or docs unless asked. When you touch code, small progressive refactors alongside the change are welcome.
- **Reuse and extend** existing functions/modules; do not duplicate similar logic. Before implementing a feature (a selector, a hook, a helper, a card), grep the repo for it first — chances are someone already wrote it. The moment you notice a second copy of something, extract it into a shared module/component and have both callers use it.
- **No backward-compatibility guards.** If a rename/breakage is needed, do it directly and update callers in the same change.
- **Playground UI is Chinese** — labels, examples, and sample content in Chinese.
- **Tailwind v4 + shadcn/ui** for all UI (playground included). Shared primitives in `packages/ui`（Button、Card、Badge、Input、Textarea、Label、Tabs、Separator、Accordion、Collapsible、Dialog、DropdownMenu、Popover、Progress、ScrollArea、Select、Sheet、Skeleton、Slider、Switch、Tooltip、Toaster）。缺组件先 `shadcn add` 进该包并导出；**改样式改源组件 / token，不要平行重造**。
- **Shared playground config** lives in `apps/playground/src/config-store.ts`.
  Reuse the fields in `components/ConfigFields.tsx` and the product model settings
  in `packages/pages`.


## Commands

```bash
pnpm install
pnpm dev:playground   # Vite dev panel
pnpm dev:web          # PWA shell
pnpm dev:ui           # Storybook 组件/Token/生产页面预览（apps/ui-kit）
pnpm build            # turbo build (all)
pnpm test             # turbo test (vitest per package)
pnpm typecheck        # turbo typecheck
pnpm eval             # vieval reply-prompt ablation → .vieval/reports/ (gitignored)
pnpm eval:report      # analyze report tree
```

Per-package: `pnpm --filter @kibotalk/<pkg> <script>` (e.g. `pnpm --filter @kibotalk/playground exec tsc --noEmit`).

## Prompt / LLM benchmarks (vieval)

- Harness: root `vieval.config.ts`, cases in `evals/`, variants in `evals/lib/variants.ts`.
- Machine artifacts land under `.vieval/reports/` (gitignored). They are **not** a substitute for a written report.
- **After every benchmark run** (`pnpm eval` or any vieval experiment on prompts/schema), add or update a human report under `docs/prompt-evals/` following `docs/prompt-evals/README.md`:
  - how each tested prompt/schema variant was designed;
  - metrics tables and outcomes;
  - conclusions / what (not) to ship to production.
- Do not change production prompts in `packages/prompts` based only on chat summaries — cite the report (and preferably the run id under `.vieval/reports/`).

## Testing & debugging practices

- Vitest per package; keep runs targeted for speed (`pnpm exec vitest run <path>`).
- For a reported bug, **reproduce with a test-only repro first** before changing production code. If a unit test can't reproduce it, use the smallest higher-level automated test that can.
- Prefer runtime evidence (logs, reproduction) over code-only reasoning when debugging. Don't "fix" with 100% confidence from reading code alone — confirm with a run.
- When debugging, instrument with logs, reproduce, analyze, then fix; remove instrumentation only after a post-fix run proves success.
- Known pitfalls and past fixes live in `docs/solutions/` (one file per issue, YAML frontmatter: `module`/`tags`/`problem_type`). Read the relevant solution before touching a documented area; add a new solution when you solve a non-obvious bug.
- Prompt eval history: `docs/prompt-evals/` (see above).

## Before finishing a change

- Run `code-simplifier` / `deslop` on the changes when readability or logic changed.
- Run targeted tests or `pnpm typecheck` when logic changed.
- Don't commit unless asked. When asked, use conventional commits (`feat(scope):`, `fix(scope):`, etc.), English subject; split unrelated changes into separate commits.
- Leave no debug instrumentation (console logs, fetch-to-localhost probes) in committed code.
