# Features Reference

## Session Save/Restore

Save running team configurations as named JSON snapshots and restore them later.

Captures each agent's profile, name, role, skill set, worktree setting, and `session_id` (CLI conversation identifier).

**Scopes:** project (`.synapse/sessions/`), user (`~/.synapse/sessions/`), or `--workdir DIR` (`DIR/.synapse/sessions/`).

Restore spawns all agents from the snapshot via `spawn_agent()`. Use `--resume` to resume each agent's previous CLI session (conversation history); if resume fails within 10 seconds, the agent is retried without resume args (shell-level fallback).

```bash
synapse session save <name> [--project|--user|--workdir <dir>]
synapse session list [--project|--user|--workdir <dir>]
synapse session show <name> [--project|--user|--workdir <dir>]
synapse session restore <name> [--project|--user|--workdir <dir>] [--worktree] [--resume] [-- tool_args...]
synapse session delete <name> [--project|--user|--workdir <dir>] [--force]
synapse session sessions                       # List CLI tool sessions from filesystem
synapse session sessions --profile claude      # Filter by profile
synapse session sessions --limit 10            # Limit results
```

## Workflow Definitions

Define multi-step agent workflows as YAML files. Each step targets an agent with a message, priority, and response mode.

**Storage:** `.synapse/workflows/` (project) or `~/.synapse/workflows/` (user).

```bash
synapse workflow create <name> [--project|--user] [--force]     # Create workflow template YAML (+ auto-generate skill)
synapse workflow list [--project|--user]                        # List saved workflows
synapse workflow show <name> [--project|--user]                 # Show workflow details
synapse workflow run <name> [--project|--user] [--dry-run] [--continue-on-error] [--auto-spawn]  # Execute steps
synapse workflow delete <name> [--project|--user] [--force]    # Delete a saved workflow (+ remove auto-generated skill)
synapse workflow sync                                          # Sync all workflows to skill directories
```

Supports `--dry-run` to preview execution without sending messages, `--continue-on-error` to proceed past step failures, and `--auto-spawn` to spawn missing agents on the fly.

**Execution engine:** Steps are sent directly via A2A HTTP (`/tasks/send-priority`) with built-in resilience. `response_mode: wait` steps poll the target's task until a terminal state (completed, failed, canceled) or a 10-minute timeout. HTTP 409 (agent busy) responses trigger automatic retry (up to 5 attempts, 2-second interval).

**Persistent execution history:** Workflow runs are persisted to SQLite (`.synapse/workflow_runs.db`, WAL mode) so that run history survives process restarts. The in-memory run list is merged with the DB on startup — in-memory entries take precedence over DB entries with the same run ID. A `delete_runs_older_than()` API is available for manual age-based cleanup, but no automatic DB pruning is performed.

### Workflow-to-Skill Bridge

Workflows can be auto-generated as skills so they appear as discoverable slash commands. The `trigger` YAML field provides keywords for skill matching, and `auto_spawn` (workflow-level or per-step) enables automatic agent spawning during execution.

- `synapse workflow create` auto-generates a SKILL.md in `.claude/skills/<name>/` and `.agents/skills/<name>/`
- `synapse workflow delete` removes the auto-generated skill directories
- `synapse workflow sync` regenerates skills for all workflows and removes orphaned auto-generated skills
- Auto-generated skills are marked with `<!-- synapse-workflow-autogen -->` and are never confused with hand-written skills

## Saved Agent Definitions

Persist reusable agent definitions with `synapse agents`. Stored as `.agent` files in project or user scope.

Use `--agent`/`-A` flag to start from a saved definition (e.g., `synapse claude --agent calm-lead`), or pass the saved ID/name directly to `synapse spawn`.

```bash
synapse agents list                       # List saved agent definitions
synapse agents show <id_or_name>          # Show details for a saved agent
synapse agents add <id> --name <name> --profile <profile> [--role <role>] [--skill-set <set>] [--scope project|user]
synapse agents delete <id_or_name>        # Delete a saved agent by ID or name
```

**Storage:** `.synapse/agents/` (project scope), `~/.synapse/agents/` (user scope).

## Token/Cost Tracking

`synapse history stats` shows a TOKEN USAGE section when token data exists. Token parsing is implemented via a registry pattern (`TokenUsage` dataclass + `parse_tokens()` registry).

```bash
synapse history stats                     # Overall stats with token usage
synapse history stats --agent gemini      # Per-agent token stats
```

## Skills Management

Central skill store with deploy, import, create, and skill set support. Skill set details (name, description, skills) are included in agent initial instructions when selected.

```bash
synapse skills                            # Interactive TUI skill manager
synapse skills list                       # List all discovered skills
synapse skills list --scope synapse       # List central store skills only
synapse skills show <name>                # Show skill details
synapse skills delete <name> [--force]    # Delete a skill
synapse skills move <name> --to <scope>   # Move skill between scopes
synapse skills deploy <name> --agent claude,codex --scope user  # Deploy from central store
synapse skills import <name>              # Import to central store (~/.synapse/skills/)
synapse skills add <repo>                 # Install from repo (npx skills wrapper)
synapse skills create [name]              # Create new skill template
synapse skills set list                   # List skill sets
synapse skills set show <name>            # Show skill set details
synapse skills apply <target> <set_name>        # Apply skill set to running agent
synapse skills apply <target> <set_name> --dry-run  # Preview changes only
```

**Storage:** `~/.synapse/skills/` (central/SYNAPSE scope).

## Settings Management

Configure Synapse via `settings.json` with interactive TUI or direct scope editing.

```bash
synapse config                            # Interactive config editor
synapse config --scope user               # Edit user settings directly
synapse config --scope project            # Edit project settings directly
synapse config show                       # Show merged settings (read-only)
synapse config show --scope user          # Show user settings only

synapse init                              # Interactive scope selection
synapse init --scope user                 # Create ~/.synapse/settings.json
synapse init --scope project              # Create ./.synapse/settings.json
synapse reset                             # Interactive scope selection
synapse reset --scope user                # Reset user settings to defaults
synapse reset --scope both -f             # Reset both without confirmation
```

Settings include `approvalMode` for controlling initial instruction approval behavior.

## Proactive Mode

Enforces mandatory usage of all Synapse coordination features for every task, regardless of size.

**Activation:** `SYNAPSE_PROACTIVE_MODE_ENABLED=true synapse claude`

When enabled, the `.synapse/proactive.md` instruction file is injected at startup. It requires agents to follow a strict per-task checklist:

**Before work:** Search shared memory, check available agents.
**During work:** Lock files before editing, save discoveries to memory, post artifacts to canvas, delegate subtasks.
**After work:** Unlock files, mark task complete, broadcast completion, post summary to canvas.

**Rules:**
- Always lock files before editing in multi-agent setups
- Always save useful findings to shared memory
- Always post significant artifacts to canvas
- For tasks with 2+ phases: delegate at least one phase to another agent
- For tasks touching 3+ files: use file-safety locks on all files

**Difference from default behavior:** Without proactive mode, the Collaboration Decision Framework in default instructions recommends feature usage but leaves it to agent judgment. With proactive mode, every step is mandatory and must be followed as a checklist.

**Configuration:** Toggle via `synapse config` TUI or set the environment variable directly.

## MCP Bootstrap Server

Distribute Synapse initial instructions via MCP (Model Context Protocol) resources and tools. MCP-compatible clients (Claude Code, Codex, Gemini CLI, OpenCode) can read instructions as structured resources instead of relying solely on PTY injection.

**Phase 1 (current):** Instruction resources + `bootstrap_agent` tool + minimal PTY bootstrap + `analyze_task` Smart Suggest tool. `bootstrap_agent` returns runtime context and instruction resource URIs for the current agent. When a Synapse MCP server config entry is detected for Claude Code, Codex, Gemini CLI, or OpenCode, Synapse sends a minimal PTY bootstrap message (agent ID, port, and pointers to MCP resources) instead of full instructions — approval prompts are kept. Non-Synapse MCP entries do not trigger the switch. Copilot supports MCP tools only (`bootstrap_agent`, `list_agents`, `analyze_task`) and cannot consume MCP resources/prompts.

**Resources:**

| URI | Description |
|-----|-------------|
| `synapse://instructions/default` | Base Synapse bootstrap instructions |
| `synapse://instructions/file-safety` | File locking rules (if enabled) |
| `synapse://instructions/shared-memory` | Shared memory conventions (if enabled) |
| `synapse://instructions/learning` | Learning mode guidance (if enabled) |
| `synapse://instructions/proactive` | Proactive mode instructions (if enabled) |

**Tools:**
- `bootstrap_agent` returns runtime context (agent_id, agent_type, port, working_dir, instruction_resources, available_features).
- `list_agents` lists running Synapse agents with status and connection info.
- `analyze_task` analyzes a user prompt and suggests team/task splits when the work is large enough (Smart Suggest).

```bash
# Start MCP server (stdio transport; options auto-resolved from $SYNAPSE_AGENT_ID)
# Fallback: if SYNAPSE_AGENT_ID is unset, defaults to agent-id "synapse-mcp"
synapse mcp serve
```

**Client configuration:** Add to `.mcp.json` (Claude Code), `~/.codex/config.toml` (Codex), `~/.gemini/settings.json` (Gemini CLI), or `~/.config/opencode/opencode.json` (OpenCode). Use `uv run --directory <repo> python -m synapse.mcp` as the command to ensure the correct Synapse version is used.

**Copilot MCP support:** GitHub Copilot's coding agent supports MCP tools only and cannot consume MCP resources/prompts. Copilot agents use `bootstrap_agent` to retrieve runtime context and `analyze_task` for smart suggestions; the `synapse://instructions/*` resources are not available to Copilot.

**Settings caching:** The MCP server caches `SynapseSettings` as a lazy singleton for the lifetime of the process, avoiding repeated file reads.

## Canvas Board

Shared visual dashboard for agents to post rich content cards rendered in a browser-based SPA.

**Views:** Hash-routed SPA with six views — `#/` (Canvas spotlight) with `#/history` as a sub-view (grid + live feed + agent messages; appears as indented sub-item under Canvas in sidebar), `#/dashboard` (operational overview with expandable summary+detail widgets: Agents, Tasks, File Locks, Worktrees, Memory, Errors), `#/admin` (Agent Control: clickable agent table for selection, double-click agent row to jump to terminal via `POST /api/admin/jump/{agent_id}`, textarea input with Cmd+Enter send, reply-based response via `synapse reply`, IME composition handling, sticky table headers), `#/workflow` (Workflow view: list saved workflows, inspect steps, trigger runs, monitor run progress with live updates via `workflow_update` SSE event; failed steps show error details, each step displays execution duration, Mermaid DAG includes message preview and response_mode edge labels, run history shows step progress count and failure details, project directory displayed next to Run button), and `#/system` (configuration panel: tips, saved agents, skills, skill sets, sessions, workflows, environment). Navigation via sidebar (fixed on desktop, hamburger drawer on mobile); Canvas parent link stays active when History sub-route is shown. View state preserved across SSE reconnects.

**25 card formats:** mermaid, markdown, html, artifact, table, json, diff, code, chart, image, log, status, metric, checklist, timeline, alert, file-preview, trace, tip, progress, terminal, dependency-graph, cost, link-preview, plan.

**Rendering highlights:**
- **Markdown cards**: Enhanced parser supports headings, paragraphs, bold/italic, inline code, code blocks, unordered and ordered lists, tables, blockquotes, horizontal rules, and links. Document content uses Source Sans 3 body font and Source Code Pro monospace font for a polished typographic appearance
- **Code cards**: Syntax highlighted via highlight.js (set `--lang` for best results)
- **Chart cards**: Chart.js supports all chart types (bar, line, pie, doughnut, radar, polarArea, scatter, bubble)
- **Diff cards**: Side-by-side renderer with left (deletions) / right (additions) columns and line numbers
- **HTML cards**: Rendered in sandboxed iframe (`allow-scripts`) with theme sync via `postMessage` (CSS variables `--bg`, `--fg`, `--border`), auto-resize via ResizeObserver, dark mode background, and full document normalization (extracts `<head>`/`<body>` from complete HTML documents to avoid CSP/cascade conflicts)
- **Artifact cards**: Interactive HTML/JS/CSS applications (like Claude.ai Artifacts) rendered in sandboxed iframe (`allow-scripts`) with theme sync via `postMessage` (CSS variables `--bg`, `--fg`, `--border`), auto-resize via ResizeObserver; accepts a full HTML document string
- **Mermaid cards**: Diagrams auto-sync with the Canvas light/dark theme toggle; dark mode uses a Catppuccin-inspired palette, light mode uses an Indigo palette with brand accent `#4051b5`
- **Image cards**: PNG, JPEG, SVG, GIF, WebP via URL or Base64 data URI (up to 2MB). SVG is ideal for agent-generated vector diagrams (architecture, network topology, data flow)
- **Link-preview cards**: Fetches Open Graph metadata from a URL and renders a rich card with title, description, and thumbnail image

```bash
synapse canvas post <format> "<body>" --title "<title>" [--pinned] [--tags "t1,t2"]
synapse canvas link "<url>" --title "<title>" [--pinned]
synapse canvas briefing '<json>' --title "<title>" [--pinned]
synapse canvas briefing --file report.json --title "CI Report"
synapse canvas open                      # Open in browser (auto-starts server)
synapse canvas list [--agent-id <id>] [--type <format>] [--search "<query>"]
```

**Templates (6):** briefing, comparison, dashboard, steps, slides, plan. Templates control how composite content blocks are laid out. Use `synapse canvas briefing` for the briefing template CLI shortcut, `synapse canvas plan` for plan cards with Mermaid DAG and step tracking, or `synapse canvas post-raw` with `template`/`template_data` fields for any template. See `references/commands.md` for full schema details.

### Plan Cards

Plan cards combine a Mermaid DAG visualization with a step list for tracking multi-step work.

```bash
synapse canvas plan '{"plan_id":"plan-auth","status":"proposed","mermaid":"graph TD; A-->B","steps":[{"id":"s1","subject":"Design","status":"pending"}]}' --title "Auth Plan"
```

### Card Download

Cards can be downloaded as files via the browser download button or the API endpoint `GET /api/cards/{card_id}/download[?format=md|json|csv|html|txt|native]`. Each card format maps to an optimal download format automatically (e.g., table → CSV, code → native source file, markdown → `.md`). The optional `format` query parameter overrides the default. Supported export groups: Markdown (Group A), native file (Group B), JSON (Group C), CSV (Group D).

**Storage:** `~/.synapse/canvas.db` (user-global, SQLite).

## Self-Learning Pipeline (ECC)

Observe agent behavior, learn patterns, and evolve reusable skills automatically. The pipeline has four stages:

### 1. Observation Layer (`synapse/observation.py`)

`ObservationStore` persists structured events to `.synapse/observations.db` (SQLite, WAL mode). `ObservationCollector` provides typed methods for recording events without manual SQL.

**Event types:**
- `task_received` — message received with sender and priority
- `task_completed` — task finished with duration, status, output summary
- `error` — error with type, message, and recovery action
- `status_change` — agent status transition (from/to/trigger)
- `file_operation` — file path and operation type

**Configuration:**
- `SYNAPSE_OBSERVATION_ENABLED` — enable/disable collection (default: `true`)
- `SYNAPSE_OBSERVATION_DB_PATH` — custom database path

Each observation is tagged with a `project_hash` (derived from `git remote.origin.url` or `cwd`) for per-project isolation.

### 2. Pattern Analyzer (`synapse/pattern_analyzer.py`)

`PatternAnalyzer` scans observations and generates instinct candidates using rule-based analysis:

- **Repeated errors** — errors of the same type appearing 2+ times produce a debugging instinct with the observed recovery action
- **Successful senders** — senders whose tasks consistently complete are surfaced as collaboration patterns
- **Status transitions** — frequent from/to status pairs suggest workflow optimization opportunities

Confidence scales with frequency: 2 occurrences = 0.3, 3+ = 0.5, 5+ = 0.7, 10+ = 0.9.

### 3. Instinct Store (`synapse/instinct.py`)

`InstinctStore` persists learned trigger/action pairs to `.synapse/instincts.db` (SQLite, WAL mode). Each instinct has:

- **trigger** — condition that activates the instinct
- **action** — recommended response
- **confidence** — 0.3–0.9, increases with repeated evidence
- **scope** — `project` (local) or `global` (promoted across projects)
- **domain** — category (debugging, testing, workflow, etc.)
- **source_observations** — IDs of observations that produced the instinct

Instincts can be promoted from project to global scope via `synapse instinct promote`.

**Configuration:** `SYNAPSE_INSTINCT_DB_PATH` — custom database path.

### 4. Evolution Engine (`synapse/evolve.py`)

`EvolutionEngine` clusters instincts by domain and generates reusable skill candidates:

- Groups instincts by domain, requires 2+ instincts and average confidence >= 0.5
- Generates `SKILL.md` files in `.synapse/evolved/skills/`, `.claude/skills/`, and `.agents/skills/`
- Each generated skill includes frontmatter with source instinct IDs, trigger patterns, and action recommendations

**Storage:** `.synapse/observations.db`, `.synapse/instincts.db`, `.synapse/evolved/skills/` (all project-local, SQLite).
