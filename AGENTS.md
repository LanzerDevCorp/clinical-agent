# Agent Context & Project Conventions

## Tech Stack
- **Framework**: Next.js 14.2 (App Router)
- **UI**: React 18, Tailwind CSS, shadcn/ui (radix-ui, lucide-react)
- **AI**: Vercel AI SDK (v3 / v6)
- **Type Checking / Linting**: TypeScript, ESLint

## Architecture
- **Knowledge Base (No RAG)**: We use a static string exported from `lib/knowledge.ts` (derived from `guia_respuestas_rapidas.md`) which is injected directly into the AI's system prompt. We do NOT use Drizzle ORM or a vector database, as it was previously refactored out for simplicity.
- **AI Route**: `app/api/chat/route.ts` handles the AI conversation via the \`streamText\` function using \`openai/gpt-4o\`.
- **AI Tools**: The AI is equipped with active product tools in the pipeline to discover and load clinical and technical information dynamically:
  - `searchProducts`: Searches the product registry by name or category, returning metadata only (canonical name, category, availability of technical sheet).
  - `getProductDetails`: Loads detailed technical data (sheet and catalogs) for a single canonical product.
  - `canShareProtocol`: Validates whether a product is authorized for step-by-step protocol instructions.
  - `validateProductData`: Coordinates the clinical reviewer sub-agent to cross-validate technical sheets and catalogs to report discrepancies.

## Custom Skills Registry
| Skill Name | Description | Link |
| :--- | :--- | :--- |
| `netlify-deploy` | Deploy current changes to Netlify for testing. | [SKILL.md](skills/netlify-deploy/SKILL.md) |
| `build-fixer` | Ejecuta pnpm build y arregla errores de TypeScript iterativamente en rama `dev-build-fix`. | [SKILL.md](skills/build-fixer/SKILL.md) |
| `extract-product` | Extract one complete product line from clinical catalogs/datasheets into a grouped datasheet and upsert it to Payload CMS via MCP. | [SKILL.md](.claude/skills/extract-product/SKILL.md) |
| `clinical-resolver` | Resolve clinical catalogue warnings interactively with the clinical director. | [SKILL.md](.agents/skills/clinical-resolver/SKILL.md) |
├── ⚙️ components.json
├── 📝 guia_respuestas_rapidas.md
├── 📝 implementar_con_callbell.md
├── 📄 next.config.mjs
├── ⚙️ package.json
├── ⚙️ pnpm-lock.yaml
├── ⚙️ pnpm-workspace.yaml
├── 📄 postcss.config.mjs
├── 📝 prd.md
├── 📄 tailwind.config.ts
├── ⚙️ tsconfig.json
├── 📄 vitest.config.ts
└── 📄 vitest.setup.ts
```

## Development & Testing
- **Testing**: Vitest + React Testing Library (JSDOM). Strict TDD Mode is ENABLED.
- **Environment**: Next.js development server (\`npm run dev\`).

# context-mode — MANDATORY routing rules

context-mode MCP tools available. Rules protect context window from flooding. One unrouted command dumps 56 KB into context.

## Think in Code — MANDATORY

Analyze/count/filter/compare/search/parse/transform data: **write code** via `context-mode_ctx_execute(language, code)`, `console.log()` only the answer. Do NOT read raw data into context. PROGRAM the analysis, not COMPUTE it. Pure JavaScript — Node.js built-ins only (`fs`, `path`, `child_process`). `try/catch`, handle `null`/`undefined`. One script replaces ten tool calls.

## BLOCKED — do NOT attempt

### curl / wget — BLOCKED
Shell `curl`/`wget` intercepted and blocked. Do NOT retry.
Use: `context-mode_ctx_fetch_and_index(url, source)` or `context-mode_ctx_execute(language: "javascript", code: "const r = await fetch(...)")`

### Inline HTTP — BLOCKED
`fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, `http.request(` — intercepted. Do NOT retry.
Use: `context-mode_ctx_execute(language, code)` — only stdout enters context

### Direct web fetching — BLOCKED
Use: `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)`

## REDIRECTED — use sandbox

### Shell (>20 lines output)
Shell ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`.
Otherwise: `context-mode_ctx_batch_execute(commands, queries)` or `context-mode_ctx_execute(language: "shell", code: "...")`

### File reading (for analysis)
Reading to **edit** → reading correct. Reading to **analyze/explore/summarize** → `context-mode_ctx_execute_file(path, language, code)`.

### grep / search (large results)
Use `context-mode_ctx_execute(language: "shell", code: "grep ...")` in sandbox.

## Tool selection

0. **MEMORY**: `context-mode_ctx_search(sort: "timeline")` — after resume, check prior context before asking user.
1. **GATHER**: `context-mode_ctx_batch_execute(commands, queries)` — runs all commands, auto-indexes, returns search. ONE call replaces 30+. Each command: `{label: "header", command: "..."}`.
2. **FOLLOW-UP**: `context-mode_ctx_search(queries: ["q1", "q2", ...])` — all questions as array, ONE call (default relevance mode).
3. **PROCESSING**: `context-mode_ctx_execute(language, code)` | `context-mode_ctx_execute_file(path, language, code)` — sandbox, only stdout enters context.
4. **WEB**: `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)` — raw HTML never enters context.
5. **INDEX**: `context-mode_ctx_index(content, source)` — store in FTS5 for later search.

## Parallel I/O batches

For multi-URL fetches or multi-API calls, **always** include `concurrency: N` (1-8):

- `context-mode_ctx_batch_execute(commands: [3+ network commands], concurrency: 5)` — gh, curl, dig, docker inspect, multi-region cloud queries
- `context-mode_ctx_fetch_and_index(requests: [{url, source}, ...], concurrency: 5)` — multi-URL batch fetch

**Use concurrency 4-8** for I/O-bound work (network calls, API queries). **Keep concurrency 1** for CPU-bound (npm test, build, lint) or commands sharing state (ports, lock files, same-repo writes).

GitHub API rate-limit: cap at 4 for `gh` calls.

## Output

Write artifacts to FILES — never inline. Return: file path + 1-line description.
Descriptive source labels for `search(source: "label")`.

## Session Continuity

Skills, roles, and decisions persist for the entire session. Do not abandon them as the conversation grows.

## Memory

Session history is persistent and searchable. On resume, search BEFORE asking the user:

| Need | Command |
|------|---------|
| What did we decide? | `context-mode_ctx_search(queries: ["decision"], source: "decision", sort: "timeline")` |
| What constraints exist? | `context-mode_ctx_search(queries: ["constraint"], source: "constraint")` |

DO NOT ask "what were we working on?" — SEARCH FIRST.
If search returns 0 results, proceed as a fresh session.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call `stats` MCP tool, display full output verbatim |
| `ctx doctor` | Call `doctor` MCP tool, run returned shell command, display as checklist |
| `ctx upgrade` | Call `upgrade` MCP tool, run returned shell command, display as checklist |
| `ctx purge` | Call `purge` MCP tool with confirm: true. Warns before wiping knowledge base. |

After /clear or /compact: knowledge base and session stats preserved. Use `ctx purge` to start fresh.
