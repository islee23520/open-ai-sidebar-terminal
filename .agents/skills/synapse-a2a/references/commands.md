# CLI Command Reference

## Agent Management

### List Running Agents

```bash
# Show all running agents (Rich TUI with auto-refresh on changes)
synapse list

# Force one-shot plain text even on a TTY
synapse list --plain

# Output agent list as JSON array (machine-readable, no TUI)
synapse list --json
```

**AI / automation rule:** Do not use bare `synapse list` for agent discovery from an AI-controlled TTY. Use `synapse list --json`, `synapse list --plain`, `synapse status <target> --json`, or the MCP `list_agents` tool.

**Rich TUI Features:**
- Auto-refresh when agent status changes (via file watcher)
- Color-coded status display:
  - READY = green (idle, waiting for input)
  - WAITING = cyan (awaiting user input - selection, confirmation; auto-expires after `waiting_expiry`, default 10s)
  - PROCESSING = yellow (busy handling a task)
  - DONE = blue (task completed, auto-clears after 10s)
  - SHUTTING_DOWN = red (graceful shutdown in progress)
- **Compound signal detection**: Status uses multiple signals beyond PTY output:
  - `task_active` flag: suppresses READY during active A2A tasks (`task_protection_timeout`, default 30s)
  - File locks: agents holding locks remain PROCESSING even when PTY is idle
  - WAITING auto-expiry: auto-clears after `waiting_expiry` seconds (default 10s)
- Flicker-free updates
- **Interactive row selection**: Press 1-9 or ↑/↓ to select an agent row and view full paths in a detail panel
- **Terminal Jump**: Press `Enter` or `j` to jump directly to the selected agent's terminal
- **Kill Agent**: Press `k` to terminate selected agent (with confirmation dialog)
- **Filter**: Press `/` to filter by TYPE, NAME, or WORKING_DIR
- Press `ESC` to clear filter/selection, `q` to exit

**Terminal Jump Supported Terminals:**
- iTerm2 (macOS) - Switches to correct tab/pane
- Terminal.app (macOS) - Switches to correct tab
- Ghostty (macOS) - Switches to correct tab via AppleScript. **Note:** Do not switch tabs during spawn or team start.
- VS Code integrated terminal - Activates/focuses VS Code window
- tmux - Switches to agent's session/pane
- Zellij - Activates terminal app (direct pane focus not supported via CLI)

**Detection:** Terminal jump uses per-agent PID-based detection (`_detect_agent_terminal`) that walks the agent's parent process chain, with TTY device fallback when PID is unavailable.

**Output columns:**
- **NAME**: Custom name if set, otherwise agent type (e.g., `my-claude` or `claude`)
- **TYPE**: Agent type (claude, gemini, codex, opencode, copilot)
- **ID**: Full Runtime ID (e.g., `synapse-claude-8100`)
- **ROLE**: Role description if set
- **STATUS**: READY / WAITING / PROCESSING / DONE / SHUTTING_DOWN
- **CURRENT**: Current task preview (truncated to 30 chars) with elapsed time (e.g., `Review code (2m 15s)`) - shows what agent is working on and for how long
- **TRANSPORT**: Communication method during inter-agent messages
  - `UDS→` / `TCP→`: Sending via UDS/TCP
  - `→UDS` / `→TCP`: Receiving via UDS/TCP
  - `-`: No active communication
- **WORKING_DIR**: Working directory (truncated in TUI, full path in detail panel). Also included in plain-text output for scripting (e.g., `synapse list --plain | grep my-project`).
- **EDITING FILE** (when File Safety enabled): Currently locked file name

**Plain Output:** `synapse list --plain` forces single-shot text output without entering the Rich TUI, even when stdout is a TTY. `SYNAPSE_NONINTERACTIVE=1` provides the same behavior for automation wrappers.

**JSON Output:** `synapse list --json` outputs a JSON array of agent objects (fields: `agent_id`, `agent_type`, `name`, `role`, `skill_set`, `port`, `status`, `pid`, `working_dir`, `endpoint`, `transport`, `current_task_preview`, `task_received_at`, optionally `editing_file`).

**Name vs ID:** Display shows name if set, internal operations use Runtime ID (`synapse-claude-8100`).

### Start Agents

```bash
# Interactive mode (foreground)
synapse claude
synapse gemini
synapse codex
synapse opencode
synapse copilot

# With custom name and role
synapse claude --name my-claude --role "code reviewer"

# With skill set
synapse claude --skill-set dev-set

# With saved agent definition (--agent / -A)
synapse claude --agent calm-lead
synapse claude --agent calm-lead --role "override role"  # CLI args override saved values

# With role from file (@prefix reads file content as role)
synapse claude --name reviewer --role "@./roles/reviewer.md"
synapse gemini --role "@~/my-roles/analyst.md"

# Delegate/manager mode (no file editing, delegates via synapse send)
synapse claude --delegate-mode --name manager --role "task manager"

# Worktree isolation in current terminal (Synapse-native, all agent types)
synapse claude --worktree my-feature              # Start in worktree in current terminal
synapse gemini --worktree review --name Reviewer --role "code reviewer"

# Skip interactive name/role setup
synapse claude --no-setup

# With specific port
synapse claude --port 8101

# History is enabled by default (v0.3.13+)
# To disable history:
SYNAPSE_HISTORY_ENABLED=false synapse claude

# With File Safety enabled
SYNAPSE_FILE_SAFETY_ENABLED=true synapse claude

# With Learning Mode: prompt improvement feedback
SYNAPSE_LEARNING_MODE_ENABLED=true synapse claude

# With Learning Mode: Japanese-to-English translation
SYNAPSE_LEARNING_MODE_TRANSLATION=true synapse claude

# With both Learning Mode flags (prompt improvement + translation)
SYNAPSE_LEARNING_MODE_ENABLED=true SYNAPSE_LEARNING_MODE_TRANSLATION=true synapse claude

# With Proactive Mode: mandatory Synapse feature usage for every task
SYNAPSE_PROACTIVE_MODE_ENABLED=true synapse claude

# Resume mode (skip initial instructions)
# Note: Claude/Gemini use --resume flag, Codex uses resume subcommand, OpenCode/Copilot use --continue
synapse claude -- --resume
synapse gemini -- --resume
synapse codex -- resume      # Codex: resume is a subcommand, not a flag
synapse opencode -- --continue
synapse copilot -- --continue

# Background mode
synapse start claude --port 8100
synapse start claude --port 8100 --foreground  # for debugging

# With SSL/HTTPS
synapse start claude --port 8100 --ssl-cert cert.pem --ssl-key key.pem
```

### Spawn Single Agent

Spawn a single agent in a new terminal pane or window. Accepts profile names or saved agent IDs/names.

**Workflow:** Spawn is sub-agent delegation — the parent spawns children to offload subtasks while preserving its own context. The full lifecycle is: spawn → send task → evaluate result → (re-send if needed) → kill. If the user specifies the number of agents, follow that exactly; otherwise the parent decides based on task structure. See `references/examples.md` → "Sub-Agent Delegation Patterns" for concrete patterns.

```bash
synapse spawn claude                          # Spawn Claude in a new pane
synapse spawn gemini --port 8115              # Spawn with explicit port
synapse spawn claude --name Tester --role "test writer"  # With name/role
synapse spawn claude --skill-set dev-set      # With skill set
synapse spawn claude --terminal tmux          # Use specific terminal
synapse spawn claude -n Tester -r "reviewer" -S backend-tools  # Short options

# Spawn from saved agent definition (by ID or display name)
synapse spawn sharp-checker                    # Spawn by saved Agent ID
synapse spawn Claud                           # Spawn by saved agent display name
synapse spawn sharp-checker --role "temporary override"  # Override saved values

# Worktree isolation (Synapse-level flag, before '--'; works for ALL agent types)
synapse spawn claude --name Impl --role "implementer" --worktree            # auto-named worktree
synapse spawn gemini --name Analyst -w feat-auth                            # named worktree
synapse spawn codex --name Coder --worktree                                 # Codex in worktree

# Pass tool-specific arguments after '--' (permission skip flags per CLI)
synapse spawn claude -- --dangerously-skip-permissions   # Claude: skip all prompts
synapse spawn gemini -- -y                               # Gemini: yolo mode
synapse spawn codex -- --full-auto                       # Codex: sandboxed auto-approve
synapse spawn copilot -- --allow-all-tools               # Copilot: allow all tools

# Combine worktree + tool args (worktree before '--', tool args after '--')
synapse spawn claude --name Impl --worktree -- --dangerously-skip-permissions
```

**Worktree Isolation (`--worktree` / `-w`, Synapse-native flag):**
`--worktree` is a Synapse-level flag placed **before** `--`. It creates an isolated git worktree for any agent type under `.synapse/worktrees/<name>/` with a branch named `worktree-<name>`. Each worktree gets its own branch and working directory, preventing file conflicts when multiple agents edit the same codebase. `synapse list` shows a `[WT]` prefix in the WORKING_DIR column for worktree agents. Environment variables `SYNAPSE_WORKTREE_PATH`, `SYNAPSE_WORKTREE_BRANCH`, and `SYNAPSE_WORKTREE_BASE_BRANCH` are set automatically. The base branch is determined via a 3-step fallback: `git symbolic-ref` -> `origin/main` -> `HEAD`. Note: `.gitignore`-listed files (`.env`, `.venv/`, `node_modules/`) are not copied -- run dependency install or copy `.env` if needed. On exit, cleanup checks for both uncommitted changes and new commits (vs. the base branch); worktrees with neither are auto-deleted, worktrees with either prompt to keep or remove. The registry stores `worktree_base_branch` so cleanup can detect new commits accurately. `synapse kill` also handles worktree cleanup. Consider adding `.synapse/worktrees/` to your `.gitignore` to avoid untracked worktree files appearing in `git status`.

**Headless Mode:**
When an agent is started via `synapse spawn` or `synapse team start`, `--no-setup --headless` are always added. This skips all interactive setup (name/role prompts, startup animations, and initial instruction approval prompts) to allow for smooth programmatic orchestration. The A2A server remains active, initial instructions are still sent to enable communication, and startup/runtime logs are redirected to the per-agent log file so they do not leak into the visible terminal transcript.

**Readiness Warning:** After spawning, `synapse spawn` waits for the agent to register and warns with concrete `synapse send` command examples if the agent is not yet ready. Additionally, a server-side Readiness Gate blocks `/tasks/send` until initialization completes (HTTP 503 + `Retry-After: 5` if not ready within 30s; priority 5 and replies bypass).

**Tool Args Guardrail:** Synapse flags (`--port`, `--name`, `--role`, etc.) placed after `--` are detected and trigger a warning, since they should go before `--`.

**Note:** The spawning agent is responsible for the lifecycle of the spawned agent. Ensure you terminate spawned agents using `synapse kill <target> -f` when their task is complete.

**Spawn Zone Tiling (tmux):** `synapse spawn` uses `layout="auto"` by default. In tmux, spawned pane IDs are tracked via `SYNAPSE_SPAWN_PANES` in the tmux session environment. The first spawn splits the current pane horizontally; subsequent spawns find the largest pane in the spawn zone and split it, producing balanced tiled layouts automatically. See `references/spawning.md` for details.

**Pane Titles (tmux):** Each spawned tmux pane is labelled `synapse(<profile>)` or `synapse(<profile>:<name>)` via `tmux select-pane -T`, making agents identifiable when pane border status is enabled.

**Pane Auto-Close:** Spawned panes close automatically when the agent process terminates in all supported terminals (tmux, zellij, iTerm2, Terminal.app, Ghostty).

**Known Limitation:** Spawned agents cannot use `synapse reply` because PTY-injected messages don't register sender info. Use `synapse send <target> "message"` instead (`--from` is auto-detected) ([#237](https://github.com/s-hiraoku/synapse-a2a/issues/237)).

### Stop Agents

```bash
# Stop by profile
synapse stop claude

# Stop by specific ID (recommended for precision)
synapse stop synapse-claude-8100

# Stop all instances of a profile
synapse stop claude --all
```

### Kill Agents

```bash
# Graceful shutdown (default): multi-phase — SHUTTING_DOWN → HTTP request → grace → SIGTERM → SIGKILL
synapse kill my-claude

# Kill by Runtime ID
synapse kill synapse-claude-8100

# Kill by agent type (only if single instance)
synapse kill claude

# Force kill (immediate SIGKILL, skip graceful shutdown)
synapse kill my-claude -f
```

**Graceful shutdown flow** (total budget: `shutdown.timeout_seconds`, default 30s):
1. Sets agent status to `SHUTTING_DOWN`
2. Sends `shutdown_request` A2A message (HTTP, up to `min(10s, total budget)`)
3. Waits grace period (`min(max(1, remaining // 3), remaining)` — targets 1/3 of remaining budget, capped to `remaining`; **0s when budget ≤ 10s**), then sends SIGTERM
4. Waits escalation period (budget remaining after step 3), then sends SIGKILL if process is still alive
5. With `-f`: sends SIGKILL immediately, skipping all phases

### Jump to Terminal

```bash
# Jump by custom name
synapse jump my-claude

# Jump by Runtime ID
synapse jump synapse-claude-8100

# Jump by agent type (only if single instance)
synapse jump claude
```

**Supported Terminals:** iTerm2, Terminal.app, Ghostty, VS Code, tmux, Zellij

### Rename Agents

Assign or update custom names and roles for running agents:

```bash
# Set name and role
synapse rename synapse-claude-8100 --name my-claude --role "code reviewer"

# Update role only (use current name)
synapse rename my-claude --role "test writer"

# Clear name and role
synapse rename my-claude --clear
```

**Name vs ID:**
- Custom names are for **display and user-facing operations** (prompts, `synapse list` output)
- Runtime ID (`synapse-claude-8100`) is used **internally** for registry and processing
- Target resolution: name has highest priority when matching

### Show Agent Status

Show detailed status for a single agent, including agent info, current task with elapsed time, recent messages, and file locks.

```bash
# Human-readable output
synapse status my-claude
synapse status synapse-claude-8100
synapse status claude              # Only if single instance

# Machine-readable JSON
synapse status my-claude --json
```

**Text output sections:**
- **Agent Info**: ID, type, name, role, port, status, PID, working directory, uptime
- **Current Task**: Task preview with elapsed time (e.g., `Review code (2m 15s)`)
- **Recent Messages**: Last 5 messages from history (task ID, direction, sender, preview)
- **File Locks**: Files currently locked by this agent (if File Safety is enabled)

**JSON output** includes all the same data in structured format, with `uptime_seconds` and `current_task.elapsed_seconds` as numeric values for programmatic use.

**Use cases:**
- Checking what an agent is currently working on and how long it has been running
- Debugging why an agent is stuck in PROCESSING (check file locks)
- Reviewing recent communication history for a specific agent

### Saved Agent Definitions

Manage reusable agent definitions that persist across sessions. Saved agents are stored as `.agent` files in project (`.synapse/agents/`) or user (`~/.synapse/agents/`) scope.

IDs must use Agent ID format (e.g., `sharp-checker`).

```bash
# List all saved agent definitions
synapse agents list

# Show details for a saved agent (by ID or display name)
synapse agents show <id-or-name>

# Add or update a saved agent definition
synapse agents add <id> --name <name> --profile <profile> [--role <role>] [--skill-set <set>] [--scope project|user]

# Delete a saved agent definition
synapse agents delete <id-or-name>
```

**Examples:**

```bash
# Save a codex agent with role from file
synapse agents add sharp-checker --name Reviewer --profile codex --role @./roles/reviewer.md --skill-set architect --scope project

# List saved agents (Rich TUI table when interactive)
synapse agents list

# Show saved agent details
synapse agents show sharp-checker
synapse agents show Reviewer          # Also resolves by display name

# Delete a saved agent
synapse agents delete sharp-checker
```

**Output columns** (in `synapse agents list`):
- **ID**: Agent ID identifier (e.g., `sharp-checker`)
- **NAME**: Display name
- **PROFILE**: Agent type (claude, codex, gemini, opencode, copilot)
- **ROLE**: Role description (or `-` if not set)
- **SKILL_SET**: Skill set name (or `-` if not set)
- **SCOPE**: Storage scope (`project` or `user`)

**Resolution order:** When resolving `<id-or-name>`, exact ID match is checked first, then display name match. An error is raised if the query matches multiple entries.

**Storage:**
- Project scope: `.synapse/agents/<id>.agent`
- User scope: `~/.synapse/agents/<id>.agent`
- Project-scoped definitions take precedence over user-scoped when IDs collide.

### Port Ranges

| Agent    | Ports     |
|----------|-----------|
| Claude   | 8100-8109 |
| Gemini   | 8110-8119 |
| Codex    | 8120-8129 |
| OpenCode | 8130-8139 |
| Copilot  | 8140-8149 |

## Receiving Messages

When you receive an A2A message, it appears with the `A2A:` prefix that includes optional sender identification and reply expectations:

**Message Formats:**
```
A2A: [From: NAME (SENDER_ID)] [REPLY EXPECTED] <message content>
```

- **From**: Identifies the sender's display name and Runtime ID.
- **REPLY EXPECTED**: Indicates that the sender is waiting for a response (blocking).

If sender information is not available, it falls back to:
- `A2A: [From: SENDER_ID] <message content>`
- `A2A: <message content>` (backward compatible format)

If `[REPLY EXPECTED]` marker is present, you **MUST** reply using `synapse reply`.

**IMPORTANT:** Do NOT manually include `[REPLY EXPECTED]` in your messages. Synapse adds this marker automatically when `--wait` is used. Manually adding it causes duplication.

**Reply Tracking:** Synapse automatically tracks senders who expect a reply (`[REPLY EXPECTED]` messages). Use `synapse reply` for responses - it automatically knows who to reply to.

**Replying to messages:**

```bash
# Use the reply command (auto-routes to last sender)
synapse reply "<your reply>"

# In sandboxed environments (like Codex), specify your Runtime ID
synapse reply "<your reply>" --from $SYNAPSE_AGENT_ID
```

**Example - Question received (MUST reply):**
```
Received: A2A: [From: Claude (synapse-claude-8100)] [REPLY EXPECTED] What is the project structure?
Reply:    synapse reply "The project has src/, tests/..."
```

**Example - Delegation received (no reply needed):**
```
Received: A2A: [From: Gemini (synapse-gemini-8110)] Run the tests and fix failures
Action:   Just do the task. No reply needed unless you have questions.
```

## Sending Messages

### synapse send (Recommended)

**Use this command for inter-agent communication.** Works from any environment including sandboxed agents.

```bash
synapse send <target> "<message>" [--from <sender>] [--priority <1-5>] [--wait | --notify | --silent] [--callback "<command>"] [--force]
```

**Target Formats (in priority order):**

| Format | Example | Description |
|--------|---------|-------------|
| Custom name | `my-claude` | Highest priority, exact match, case-sensitive |
| Full ID | `synapse-claude-8100` | Always works, unique identifier |
| Type-port | `claude-8100` | Use when multiple agents of same type |
| Agent type | `claude` | Only when single instance exists |

**Parameters:**
- `--from, -f`: Sender Runtime ID (for reply identification) - **auto-detected** from `SYNAPSE_AGENT_ID` env var. Usually omittable; specify explicitly in sandboxed environments (e.g., Codex). When using, always provide the Runtime ID format (`synapse-<type>-<port>`). Note: `-f` means `--force` in other subcommands (e.g., `synapse kill -f`); prefer the long form `--from` to avoid confusion.
- `--priority, -p`: Priority level 1-5 (default: 3)
  - 1-2: Low priority, background tasks
  - 3: Normal tasks
  - 4: Urgent follow-ups
  - 5: Critical/emergency (sends SIGINT first)
- `--wait`: Synchronous blocking - wait for receiver to reply with `synapse reply`
- `--notify`: Async notification - get notified when task completes (default)
- `--silent`: Fire and forget - no reply or PTY notification needed. The receiver sends a best-effort completion callback (`POST /history/update`) to update the sender's history when the task finishes.
- `--callback`: Shell command to run on sender after task completion (requires `--silent`)
- `--message-file`: Read message from file (use `-` for stdin)
- `--stdin`: Read message from stdin
- `--attach`: Attach file(s) to message (repeatable)
- `--force`: Bypass the working directory mismatch check (send to agents in different directories)
**Working Directory Check:** Before sending, `synapse send` verifies that your current working directory matches the target agent's working directory. If they differ, the command prints a warning (listing agents in your current directory or suggesting `synapse spawn`) and exits with code 1. Use `--force` to skip this check.

**Choosing response mode:**

Analyze the message content and determine if you need immediate results:
- If you need immediate results and want to block until reply → use `--wait`
- If you want to be notified when the task is done (async) → use `--notify` (default)
- If the message is purely informational with no notification needed → use `--silent`

| Message Type | Mode | Example |
|--------------|------|---------|
| Question | `--wait` | "What is the status?" |
| Request for analysis | `--wait` | "Please review this code" |
| Status check | `--wait` | "Are you ready?" |
| Task with result expected | `--notify` | "Run tests and report the results" |
| Delegated task (fire-and-forget) | `--silent` | "Fix this bug and commit" |
| Notification | `--silent` | "FYI: Build completed" |

**Completion Callback:** With `--silent`, the receiver sends a best-effort callback to the sender when the task completes or fails. This updates the sender's history from `sent` to the final status with an output summary. The callback is fire-and-forget; failures are logged but do not block the receiver.

**Examples:**
```bash
# Question - immediate reply needed (blocking)
synapse send gemini "What is the best approach?" --wait

# Task with result expected (async notification - default)
synapse send codex "Run pytest and report the results" --notify

# Delegation with no result needed - fire and forget
synapse send codex "Fix this bug and commit" --silent

# Send to specific instance with status check
synapse send claude-8100 "What is your status?" --wait

# Emergency interrupt
synapse send codex "STOP" --priority 5

# Send to agent in a different working directory (bypasses working_dir check)
synapse send my-claude "Cross-project info" --force
```

**Sending long messages or files:**
```bash
# Send message from file (avoids ARG_MAX shell limits)
synapse send claude --message-file /tmp/review.txt --silent

# Read message from stdin
echo "long message" | synapse send claude --stdin --silent
synapse send claude --message-file - --silent   # '-' reads from stdin

# Attach files to message
synapse send claude "Review this" --attach src/main.py --silent
synapse send claude "Review these" --attach src/a.py --attach src/b.py --silent

```

Messages >100KB are automatically written to temp files (configurable via `SYNAPSE_SEND_MESSAGE_THRESHOLD`).

For `--wait` and `--notify`, reply artifacts are built from the PTY output delta captured since task start rather than the raw terminal tail. For all agents, Synapse applies four-stage ANSI stripping (full escape sequences, orphaned SGR fragments, bare SGR fragments, and unterminated OSC sequences) to clean TUI output. For Copilot specifically, Synapse also strips Ink TUI artifacts from the captured delta. Copilot uses character-by-character input (bracketed paste disabled) plus Enter; Synapse replaces `/` with fullwidth solidus `\uff0f` in Copilot messages to prevent slash-command autocomplete from triggering. Before sending the submit sequence, Synapse disables ICRNL on the PTY master to ensure `\r` is delivered as CR (Ink maps `\r` to key.return for submit, but `\n` to a different event). In interactive mode (pty.spawn), writes go through an inject pipe so that pty._copy's select loop picks them up correctly. Submit confirmation uses adaptive nudge timing (0.1 s for normal messages, 0.2 s for long messages) and stays pending while the visible prompt still shows the original text, file-reference markers, or placeholders such as `[Paste #1 - 12 lines]` and `[Saved pasted content to workspace ...]`, even when the same placeholder label is repeated across retries. Quota errors such as `402 You have no quota` are surfaced as failed tasks instead of normal replies.

**Important:** `--from` is auto-detected from `$SYNAPSE_AGENT_ID` (set at startup, expands to `synapse-<type>-<port>`). You can usually omit it. If you specify it explicitly, never hardcode Runtime IDs -- always use `$SYNAPSE_AGENT_ID`.

### Interrupt Command

Shorthand for sending a priority-4, fire-and-forget message:

```bash
synapse interrupt <target> "<message>" [--from <sender>] [--force]
```

Equivalent to `synapse send <target> "<message>" -p 4 --silent [--from <sender>]`.

**Parameters:**
- `target`: Target agent (name, ID, type-port, or agent type)
- `message`: Interrupt message to send
- `--from, -f`: Sender Runtime ID (auto-detected from `SYNAPSE_AGENT_ID` env var)
- `--force`: Bypass the working directory mismatch check

**Examples:**
```bash
# Interrupt an agent with an urgent message
synapse interrupt claude "Stop and review"

# With explicit sender (usually not needed)
synapse interrupt gemini "Check status" --from $SYNAPSE_AGENT_ID

# Interrupt agent in a different working directory
synapse interrupt claude "Stop" --force
```

### Reply Command

Reply to the last received message:

```bash
synapse reply "<message>"
synapse reply --fail "<reason>"   # Send a failed reply
```

Synapse automatically knows who to reply to based on tracked senders. The `--from` flag is only needed in sandboxed environments (like Codex). Use `--fail` to indicate the task could not be completed; the sender receives a failed status with an error instead of a normal text reply.

If multiple senders are pending, list and choose explicitly:

```bash
# Show tracked sender IDs
synapse reply --list-targets

# Reply to a specific sender
synapse reply "<message>" --to <sender_id>
```

Tasks completed without an explicit `synapse reply` when `--wait` or `--notify` was used are automatically marked as `MISSING_REPLY` (failed).

### Broadcast Command

Send a message to all agents in the current working directory:

```bash
synapse broadcast "<message>" [--from <sender>] [--priority <1-5>] [--wait | --notify | --silent]
```

**Parameters:**
- `message`: Message to broadcast to all cwd agents
- `--from, -f`: Sender Runtime ID (auto-detected from `SYNAPSE_AGENT_ID` env var)
- `--priority, -p`: Priority level 1-5 (default: 1)
- `--wait`: Synchronous wait for all agents
- `--notify`: Async notification from each agent (default)
- `--silent`: Fire-and-forget broadcast

**Scope:** Only targets agents sharing the same working directory as the sender.

**Examples:**
```bash
# Broadcast status check
synapse broadcast "Status check"

# Urgent broadcast with priority
synapse broadcast "Stop current work" --priority 4

# Fire-and-forget notification
synapse broadcast "FYI: Build completed" --silent

# Wait for responses from all agents
synapse broadcast "What are you working on?" --wait
```

### A2A Tool (Advanced)

For advanced use cases or external scripts:

```bash
python -m synapse.tools.a2a send --target <AGENT> [--priority <1-5>] "<MESSAGE>"
python -m synapse.tools.a2a broadcast [--priority <1-5>] [--from <AGENT>] [--wait | --silent] "<MESSAGE>"  # Broadcast to cwd agents
python -m synapse.tools.a2a reply "<MESSAGE>"  # Reply to last received message
python -m synapse.tools.a2a reply --list-targets
python -m synapse.tools.a2a reply "<MESSAGE>" --to <SENDER_ID>
python -m synapse.tools.a2a list                # List agents
python -m synapse.tools.a2a cleanup             # Cleanup stale entries
```

## Task History

Enabled by default (v0.3.13+). To disable: `SYNAPSE_HISTORY_ENABLED=false`.

### List History

```bash
# Recent tasks (default: 50)
synapse history list

# Filter by agent
synapse history list --agent claude

# Limit results
synapse history list --limit 100
```

### Show Task Details

```bash
synapse history show <task_id>
```

### Search Tasks

```bash
# Search by keywords (OR logic)
synapse history search "Python" "Docker" --logic OR

# Search with AND logic
synapse history search "error" "authentication" --logic AND

# Filter by agent
synapse history search "bug" --agent claude --limit 20
```

### View Statistics

```bash
# Overall statistics
synapse history stats

# Per-agent statistics
synapse history stats --agent gemini
```

When token data exists in observation metadata, the output includes a TOKEN USAGE section showing input/output token counts and estimated cost (per-agent breakdown when available). Token data is populated by agent-specific parsers in `synapse/token_parser.py` (skeleton -- no parsers shipped yet).

### Export Data

```bash
# Export to JSON
synapse history export --format json > history.json

# Export to CSV
synapse history export --format csv --agent claude > claude_tasks.csv

# Export to file
synapse history export --format json --output export.json
```

### Cleanup

```bash
# Delete entries older than 30 days
synapse history cleanup --days 30

# Keep database under 100MB
synapse history cleanup --max-size 100

# Preview what would be deleted
synapse history cleanup --days 30 --dry-run

# Skip VACUUM after deletion (faster)
synapse history cleanup --days 30 --no-vacuum
```

### Trace Task

Trace a task across history and file modifications:

```bash
synapse trace <task_id>
```

Shows task history combined with file-safety records for the specified task.

## Settings Management

### Initialize Settings

```bash
# Interactive - prompts for scope selection
synapse init

# Output:
# ? Where do you want to create .synapse/?
#   ❯ User scope (~/.synapse/)
#     Project scope (./.synapse/)
```

Creates or updates `.synapse/` directory by merging all files from `synapse/templates/.synapse/` into the target. User-generated data (agents/, databases, sessions/, workflows/, worktrees/) is preserved — only template files are overwritten.

### Edit Settings (Interactive TUI)

```bash
# Interactive TUI for editing settings
synapse config

# Use legacy questionary-based interface instead of Rich TUI
synapse config --no-rich

# Edit specific scope directly (skip scope selection prompt)
synapse config --scope user     # Edit ~/.synapse/settings.json
synapse config --scope project  # Edit ./.synapse/settings.json

# View current settings (read-only)
synapse config show                    # Show merged settings from all scopes
synapse config show --scope user       # Show user settings only
synapse config show --scope project    # Show project settings only
```

**TUI Categories:**
- **Environment Variables**: `SYNAPSE_HISTORY_ENABLED`, `SYNAPSE_FILE_SAFETY_ENABLED`, `SYNAPSE_LEARNING_MODE_ENABLED`, `SYNAPSE_LEARNING_MODE_TRANSLATION`, `SYNAPSE_PROACTIVE_MODE_ENABLED`, etc.
- **Instructions**: Agent-specific initial instruction files
- **Approval Mode**: `required` (prompt before sending) or `auto` (no prompt)
- **A2A Protocol**: `flow` mode (auto/roundtrip/oneway)
- **Resume Flags**: CLI flags that indicate session resume mode
- **List Display**: Configure `synapse list` columns

### Settings File Format

`.synapse/settings.json`:
```json
{
  "env": {
    "SYNAPSE_HISTORY_ENABLED": "true",
    "SYNAPSE_FILE_SAFETY_ENABLED": "true",
    "SYNAPSE_FILE_SAFETY_DB_PATH": ".synapse/file_safety.db"
  },
  "approvalMode": "required",
  "hooks": {
    "on_idle": "",
    "on_task_completed": ""
  },
  "shutdown": {
    "timeout_seconds": 30,
    "graceful_enabled": true
  },
  "delegate_mode": {
    "deny_file_locks": true
  },
  "list": {
    "columns": ["ID", "NAME", "STATUS", "CURRENT", "TRANSPORT", "WORKING_DIR"]
  }
}
```

**Available Settings:**

| Variable | Description | Default |
|----------|-------------|---------|
| `SYNAPSE_HISTORY_ENABLED` | Enable task history | `true` (v0.3.13+) |
| `SYNAPSE_FILE_SAFETY_ENABLED` | Enable file safety | `true` |
| `SYNAPSE_FILE_SAFETY_DB_PATH` | File safety DB path | `.synapse/file_safety.db` |
| `SYNAPSE_FILE_SAFETY_RETENTION_DAYS` | Lock history retention days | `30` |
| `SYNAPSE_UDS_DIR` | UDS socket directory | `/tmp/synapse-a2a/` |
| `SYNAPSE_LONG_MESSAGE_THRESHOLD` | Character threshold for file storage | `200` |
| `SYNAPSE_LONG_MESSAGE_TTL` | TTL for message files (seconds) | `3600` |
| `SYNAPSE_LONG_MESSAGE_DIR` | Directory for message files | System temp |
| `SYNAPSE_SHARED_MEMORY_ENABLED` | Enable shared memory | `true` |
| `SYNAPSE_SHARED_MEMORY_DB_PATH` | Shared memory DB path | `~/.synapse/memory.db` |
| `SYNAPSE_LEARNING_MODE_ENABLED` | Enable prompt improvement feedback (independent flag) | `false` |
| `SYNAPSE_LEARNING_MODE_TRANSLATION` | Enable Japanese-to-English translation (independent flag) | `false` |
| `SYNAPSE_PROACTIVE_MODE_ENABLED` | Enable proactive mode (mandatory Synapse feature usage for every task) | `false` |
| `SYNAPSE_REGISTRY_DIR` | Local registry directory | `~/.a2a/registry` |
| `SYNAPSE_REPLY_TARGET_DIR` | Reply target persistence directory | `~/.a2a/reply` |
| `SYNAPSE_EXTERNAL_REGISTRY_DIR` | External registry directory | `~/.a2a/external` |
| `SYNAPSE_HISTORY_DB_PATH` | History database path | `~/.synapse/history/history.db` |
| `SYNAPSE_SKILLS_DIR` | Central skill store directory | `~/.synapse/skills` |

Deprecated key:
- `delegation` was removed in v0.3.19. Use `synapse send` for inter-agent communication.

**list.columns:**

Configure which columns to display in `synapse list`:

| Column | Description |
|--------|-------------|
| `ID` | Runtime ID (e.g., `synapse-claude-8100`) |
| `NAME` | Custom name if set |
| `TYPE` | Agent type (claude, gemini, etc.) |
| `ROLE` | Role description |
| `STATUS` | READY/WAITING/PROCESSING/DONE/SHUTTING_DOWN |
| `CURRENT` | Current task preview |
| `TRANSPORT` | UDS/TCP communication status |
| `WORKING_DIR` | Working directory |
| `EDITING_FILE` | Currently locked file (requires file-safety) |

**approvalMode:**

| Value | Description |
|-------|-------------|
| `required` | Show approval prompt before sending initial instructions (default) |
| `auto` | Skip approval prompt, send instructions automatically |

## Instructions Management

Manage initial instructions sent to agents at startup.

```bash
# Show instruction content for an agent type
synapse instructions show claude
synapse instructions show gemini
synapse instructions show  # Shows default

# List instruction files used
synapse instructions files claude
# Output shows file locations:
#   - .synapse/default.md       (project directory)

# Send initial instructions to a running agent (useful after --resume)
synapse instructions send claude

# Preview what would be sent without actually sending
synapse instructions send claude --preview

# Send to specific Runtime ID
synapse instructions send synapse-claude-8100
```

**Use case:** If you started an agent with `--resume` (which skips initial instructions) and later need the A2A protocol information, use `synapse instructions send <agent>` to inject the instructions.

**Optional instruction files:** Additional instruction files are automatically appended based on settings:
- `file-safety.md` — appended when `SYNAPSE_FILE_SAFETY_ENABLED=true`
- `learning.md` — appended when either `SYNAPSE_LEARNING_MODE_ENABLED=true` or `SYNAPSE_LEARNING_MODE_TRANSLATION=true` is set (the two flags are independent). `SYNAPSE_LEARNING_MODE_ENABLED` adds a PROMPT IMPROVEMENT section; `SYNAPSE_LEARNING_MODE_TRANSLATION` adds a JP-to-EN LEARNING section (English pattern template, slot mapping, assembled prompt with JP paraphrase, quick alternatives). Either flag alone or both together enable `learning.md` injection and TIPS. The RESPONSE section uses normal formatting (no separators or section headers); structured format (━━━ separators, numbered sub-sections) is only for the learning feedback sections (PROMPT IMPROVEMENT / JP → EN LEARNING / TIPS). Template uses `{{#learning_mode}}`/`{{#learning_translation}}` Mustache conditionals for layout switching.
- `proactive.md` — appended when `SYNAPSE_PROACTIVE_MODE_ENABLED=true`. Injects a mandatory per-task checklist requiring agents to use shared memory, file safety, canvas, and broadcast for every task regardless of size. See the Features reference for details.

## Logs

View agent log output:

```bash
# Show last 50 lines of Claude logs
synapse logs claude

# Follow logs in real-time
synapse logs gemini -f

# Show last 100 lines
synapse logs codex -n 100
```

**Parameters:**
- `profile`: Agent profile name (claude, gemini, codex, opencode, copilot)
- `-f, --follow`: Follow log output in real-time (like `tail -f`)
- `-n, --lines`: Number of lines to show (default: 50)

Log files are stored in `~/.synapse/logs/`.

## External Agent Management

Connect to and manage external A2A-compatible agents accessible via HTTP/HTTPS.

### Add External Agent

```bash
# Discover and add by URL
synapse external add https://agent.example.com

# Add with custom alias
synapse external add https://agent.example.com --alias myagent
```

**Parameters:**
- `url`: Agent URL (must serve `/.well-known/agent.json`)
- `--alias, -a`: Short alias for the agent (auto-generated from name if not specified)

### List External Agents

```bash
synapse external list
```

Shows: ALIAS, NAME, URL, LAST SEEN.

### Show Agent Details

```bash
synapse external info myagent
```

Shows: Name, Alias, URL, Description, Added date, Last Seen, Capabilities, Skills.

### Send Message to External Agent

```bash
# Send message
synapse external send myagent "Analyze this data"

# Send and wait for completion
synapse external send myagent "Process this file" --wait
```

**Parameters:**
- `alias`: Agent alias
- `message`: Message to send
- `--wait, -w`: Wait for task completion

### Remove External Agent

```bash
synapse external remove myagent
```

External agents are stored persistently in `~/.a2a/external/`.

## Authentication

Manage API key authentication for secure A2A communication.

### Setup (Recommended)

```bash
synapse auth setup
```

Generates API key and admin key, then shows setup instructions including environment variable exports and curl examples.

### Generate API Key

```bash
# Generate a single key
synapse auth generate-key

# Generate multiple keys
synapse auth generate-key -n 3

# Output in export format
synapse auth generate-key -e
synapse auth generate-key -n 3 -e
```

**Parameters:**
- `-n, --count`: Number of keys to generate (default: 1)
- `-e, --export`: Output in `export SYNAPSE_API_KEYS=...` format

### Enable Authentication

```bash
export SYNAPSE_AUTH_ENABLED=true
export SYNAPSE_API_KEYS=<key>
export SYNAPSE_ADMIN_KEY=<admin_key>
synapse claude
```

### Reset Settings

```bash
# Interactive scope selection
synapse reset

# Reset specific scope
synapse reset --scope user
synapse reset --scope project
synapse reset --scope both

# Force reset without confirmation
synapse reset --scope both -f
```

**Parameters:**
- `--scope`: Which settings to reset (`user`, `project`, or `both`)
- `-f, --force`: Skip confirmation prompt

Resets `settings.json` to defaults and re-copies skills from `.claude` to `.agents`.

## Shared Memory

Cross-agent knowledge sharing via a user-global SQLite database (`~/.synapse/memory.db`).

Enabled by default (`SYNAPSE_SHARED_MEMORY_ENABLED=true`). To disable: `SYNAPSE_SHARED_MEMORY_ENABLED=false`.

### Save Memory

```bash
# Save a knowledge entry (UPSERT on key — updates if key already exists)
synapse memory save auth-pattern "Use OAuth2 with PKCE flow"

# Save with tags for categorization
synapse memory save auth-pattern "Use OAuth2 with PKCE flow" --tags auth,security

# Save and broadcast notification to all cwd agents
synapse memory save auth-pattern "Use OAuth2 with PKCE flow" --notify
```

**Parameters:**
- `key`: Unique key for this memory (e.g., `auth-pattern`). Used as the UPSERT key.
- `content`: Memory content text.
- `--tags`: Comma-separated tags for categorization.
- `--notify`: After saving, broadcast a notification to all agents in the current working directory.

**Author:** Automatically set to `$SYNAPSE_AGENT_ID` (the agent's own ID).

### List Memories

```bash
# List all memories (most recently updated first)
synapse memory list

# Filter by author
synapse memory list --author synapse-claude-8100

# Filter by tags
synapse memory list --tags arch,security

# Limit results
synapse memory list --limit 10
```

### Show Memory Details

```bash
# Show full details of a memory by key or ID
synapse memory show auth-pattern
synapse memory show <uuid>
```

### Search Memories

```bash
# Search across key, content, and tags (LIKE matching)
# Results are bounded (default limit: 100, ordered by most recently updated)
synapse memory search "OAuth2"
synapse memory search "database"
```

### Delete Memory

```bash
# Delete with confirmation prompt
synapse memory delete auth-pattern

# Delete without confirmation
synapse memory delete auth-pattern --force
```

### Memory Statistics

```bash
# Show total count, per-author, and per-tag breakdown
synapse memory stats
```

### Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SYNAPSE_SHARED_MEMORY_ENABLED` | Enable shared memory | `true` |
| `SYNAPSE_SHARED_MEMORY_DB_PATH` | Database file path | `~/.synapse/memory.db` |

**Storage:** `~/.synapse/memory.db` (SQLite with WAL mode, user-global)

## Plan Approval

Review and approve agent plans before implementation.

```bash
# Approve a plan
synapse approve <task_id>

# Reject with reason
synapse reject <task_id> --reason "Use OAuth instead of JWT"
```

**Plan mode:** When `metadata.plan_mode = true` is set in a send request, the agent creates a plan without implementing.

## Team Start (Auto-Spawn Panes)

Start multiple agents in split terminal panes.

**Default behavior:** The 1st agent takes over the current terminal (handoff via `os.execvp`), and remaining agents start in new panes. Use `--all-new` to start all agents in new panes (current terminal stays).

Agent specs use `profile[:name[:role[:skill_set[:port]]]]` format. `--no-setup --headless` are always added to spawned agents. Ports are pre-allocated by the parent process to avoid race conditions when multiple agents of the same type start simultaneously.

```bash
# Default: claude=current terminal, gemini=new pane
synapse team start claude gemini

# With names, roles, and skill sets
synapse team start claude:Reviewer:code-review:reviewer gemini:Searcher

# All agents in new panes (current terminal remains)
synapse team start claude gemini --all-new

# Horizontal layout
synapse team start claude gemini --layout horizontal

# Pass tool-specific arguments after '--' (automation args: unattended/permission-skip args such as --dangerously-skip-permissions, --approval-mode=yolo, --full-auto)
# Keep teams homogeneous when forwarding CLI-specific args to all agents.
synapse team start claude claude -- --dangerously-skip-permissions
synapse team start gemini gemini -- --approval-mode=yolo
synapse team start codex codex -- --full-auto
synapse team start copilot copilot -- --allow-all-tools

# Worktree isolation (Synapse-level flag, before '--'; creates per-agent worktrees for ALL agent types)
synapse team start claude gemini --worktree
synapse team start claude gemini codex -w my-feature  # Named prefix: my-feature-claude-0, my-feature-gemini-1, etc.
```

**Supported terminals:** tmux, iTerm2, Terminal.app (tabs), Ghostty (split panes via Cmd+D), zellij. Falls back to sequential start if unsupported. **Ghostty Note:** Ghostty uses AppleScript to target the focused tab. Do not switch tabs while the team is being spawned.

### Team Start via A2A API

Agents can spawn teams programmatically via the `/team/start` endpoint:

```bash
curl -X POST http://localhost:8100/team/start \
  -H "Content-Type: application/json" \
  -d '{"agents": ["gemini", "codex"], "layout": "split"}'

# With tool_args (passed through to the underlying CLI tool; automation args are recommended for unattended agents)
curl -X POST http://localhost:8100/team/start \
  -H "Content-Type: application/json" \
  -d '{"agents": ["gemini", "gemini"], "tool_args": ["--approval-mode=yolo"]}'
# Note: tool_args are passed to ALL agents. Keep teams homogeneous when using CLI-specific args:
# Claude: ["--dangerously-skip-permissions"], Gemini: ["--approval-mode=yolo"], Codex: ["--full-auto"], Copilot: ["--allow-all-tools"]
```

### Spawn via A2A API

Agents can spawn other agents programmatically via the `/spawn` endpoint:

```bash
curl -X POST http://localhost:8100/spawn \
  -H "Content-Type: application/json" \
  -d '{"profile": "gemini", "name": "Helper"}'
# Response: {"agent_id": "synapse-gemini-8110", "port": 8110, "terminal_used": "tmux", "status": "submitted"}

# With skill_set and tool_args
curl -X POST http://localhost:8100/spawn \
  -H "Content-Type: application/json" \
  -d '{"profile": "gemini", "skill_set": "dev-set", "tool_args": ["--approval-mode=yolo"]}'
# Per-CLI tool_args: Claude ["--dangerously-skip-permissions"], Gemini ["--approval-mode=yolo"], Codex ["--full-auto"], Copilot ["--allow-all-tools"]

# With worktree isolation (works for all agent types)
curl -X POST http://localhost:8100/spawn \
  -H "Content-Type: application/json" \
  -d '{"profile": "gemini", "name": "Worker", "worktree": true}'
# Named worktree:
curl -X POST http://localhost:8100/spawn \
  -H "Content-Type: application/json" \
  -d '{"profile": "claude", "name": "Impl", "worktree": "feat-auth"}'
# Response with worktree: {"agent_id": "...", "port": ..., "terminal_used": "...", "status": "submitted", "worktree_path": ".synapse/worktrees/feat-auth", "worktree_branch": "worktree-feat-auth", "worktree_base_branch": "origin/main"}

# On failure: {"status": "failed", "reason": "No available port"}
```

## Session Save/Restore

Save running team configurations as named snapshots and restore them later. Each session captures agent profiles, names, roles, skill sets, worktree settings, and `session_id` (CLI conversation identifier) as a JSON file.

### Save Session

```bash
# Save all agents in current directory as a session (project scope by default)
synapse session save my-team

# Save to user scope (~/.synapse/sessions/)
synapse session save my-team --user

# Save agents matching a specific working directory
synapse session save my-team --workdir /path/to/project
```

**Scope filter behavior:**
- Default (project): captures agents whose `working_dir` matches `CWD`, saves to `.synapse/sessions/`
- `--user`: captures all running agents regardless of directory, saves to `~/.synapse/sessions/`
- `--workdir DIR`: captures agents matching the specified directory, saves to `DIR/.synapse/sessions/`

**`session_id` capture:** Each agent's CLI conversation identifier (if available) is read from the registry and stored in the session JSON. This enables `--resume` during restore to target the exact conversation.

### List Sessions

```bash
# List all saved sessions (project + user)
synapse session list

# List user-scope sessions only
synapse session list --user

# List project-scope sessions only
synapse session list --project
```

Output columns: NAME, AGENTS (count), SCOPE, WORKING_DIR, CREATED. Rich table in TTY, plain text otherwise.

### Show Session Details

```bash
synapse session show my-team
```

Displays session name, scope, working directory, creation timestamp, agent count, and per-agent details (profile, name, role, skill_set, worktree, session_id).

### Restore Session

```bash
# Restore a saved session (spawns all agents)
synapse session restore my-team

# Override worktree setting for all agents
synapse session restore my-team --worktree
synapse session restore my-team -w

# Resume each agent's previous CLI session (conversation history)
synapse session restore my-team --resume

# Combine resume with worktree and tool args
synapse session restore my-team --resume --worktree -- --dangerously-skip-permissions

# Pass tool args to spawned agents (after '--')
synapse session restore my-team -- --dangerously-skip-permissions
```

Each agent in the session is spawned via `spawn_agent()`. The `--worktree` / `-w` flag overrides the saved worktree setting for all agents. Tool args after `--` are passed through to the underlying CLI.

**`--resume` flag:**

When `--resume` is specified, each agent receives CLI-specific resume arguments built from `build_resume_args()`. If the session snapshot includes a `session_id` for an agent, the resume targets that specific conversation; otherwise, the latest session is resumed.

| Profile | With `session_id` | Without `session_id` |
|---------|-------------------|---------------------|
| claude | `--resume <id>` | `--continue` |
| gemini | `--resume <id>` | `--resume` |
| codex | `resume <id>` | `resume --last` |
| copilot | `--resume` | `--resume` |
| opencode | *(no support)* | *(no support)* |

**Shell-level fallback:** If the resume command exits with a non-zero status within 10 seconds (e.g., session ID not found), the agent is automatically retried without resume args. This prevents a missing session from blocking the entire restore. Failures after 10 seconds (e.g., a long-running agent crashing) do not trigger the fallback.

### Delete Session

```bash
# Delete with confirmation prompt
synapse session delete my-team

# Delete without confirmation
synapse session delete my-team --force
synapse session delete my-team -f
```

### Session Name Rules

Session names must start with an alphanumeric character and contain only alphanumeric characters, dots, hyphens, or underscores (same rules as worktree names).

### Storage

```text
.synapse/sessions/<name>.json        # Project scope (default)
~/.synapse/sessions/<name>.json      # User scope (--user)
DIR/.synapse/sessions/<name>.json    # Custom project scope (--workdir DIR)
```

## Workflow Automation

Define multi-step agent workflows as YAML files and execute them sequentially.

### Create Workflow Template

```bash
# Generate a template YAML file
synapse workflow create review-and-test
```

Creates a starter YAML at the project scope (`.synapse/workflows/review-and-test.yaml`) with example steps that you can customize. Also auto-generates a matching skill (SKILL.md) in `.claude/skills/` and `.agents/skills/` so the workflow is discoverable as a slash command.

### List Workflows

```bash
# List all saved workflows (project + user)
synapse workflow list

# List project-scope workflows only
synapse workflow list --project

# List user-scope workflows only
synapse workflow list --user
```

### Show Workflow Details

```bash
# Show step-by-step details of a workflow
synapse workflow show review-and-test
```

Displays workflow name, description, scope, and each step's target, message, priority, and response mode.

### Run Workflow

```bash
# Execute all steps sequentially
synapse workflow run review-and-test

# Preview steps without executing
synapse workflow run review-and-test --dry-run

# Continue executing remaining steps even if one fails
synapse workflow run review-and-test --continue-on-error

# Auto-spawn agents that are not running (target used as profile name)
synapse workflow run review-and-test --auto-spawn
```

Steps are executed in order. Each step sends a message to the specified target agent via direct A2A HTTP (`/tasks/send-priority`) using the configured priority and response mode. When a step uses `response_mode: wait`, the runner polls the target's task status until completion (up to 10 minutes). If the target returns HTTP 409 (agent busy), the runner retries up to 5 times with a 2-second interval. By default, execution stops on the first failure unless `--continue-on-error` is set.

**Persistent execution history:** Workflow runs are persisted to SQLite (`.synapse/workflow_runs.db`, WAL mode). Run history survives process restarts — on startup the in-memory run list is merged with the DB (in-memory entries take precedence). Old runs can be pruned from the DB via age-based cleanup.

When `--auto-spawn` is passed (or the workflow/step has `auto_spawn: true`), any target agent that is not already running will be spawned automatically before sending the message.

### Delete Workflow

```bash
# Delete with confirmation prompt
synapse workflow delete review-and-test

# Delete without confirmation
synapse workflow delete review-and-test --force
```

Deleting a workflow also removes its auto-generated skill directories (if present).

### Sync Workflow Skills

```bash
# Sync all workflow YAMLs to skill directories and remove orphans
synapse workflow sync
```

Generates or updates SKILL.md files in `.claude/skills/<name>/` and `.agents/skills/<name>/` for every workflow YAML. Removes auto-generated skill directories whose workflow YAML no longer exists. Hand-written skills (without the autogen marker) are never overwritten or removed.

### YAML Format

```yaml
name: review-and-test
description: "Send review to Claude, then tests to Gemini"
trigger: "when code review and testing are needed"
auto_spawn: true
steps:
  - target: claude
    message: "Review the changes"
    priority: 4
    response_mode: wait
  - target: gemini
    message: "Write tests"
    response_mode: silent
    auto_spawn: true
  - kind: subworkflow
    workflow: post-impl-checks
```

**Top-level fields:**

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | Yes | — | Workflow identifier |
| `description` | No | `""` | Human-readable description |
| `trigger` | No | `""` | Keywords describing when to use this workflow (included in auto-generated skill description) |
| `auto_spawn` | No | `false` | Auto-spawn missing agents for all steps |

**Step fields:**

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `kind` | No | `send` | Step type: `send` or `subworkflow` |
| `target` | Yes | — | Agent target (name, type, ID) |
| `message` | Yes | — | Message to send |
| `priority` | No | `3` | Priority level (1-5) |
| `response_mode` | No | `notify` | `wait`, `notify`, or `silent` |
| `auto_spawn` | No | `false` | Enable auto-spawn for this step's target if not running (additive — cannot opt out of workflow/CLI-level auto-spawn) |
| `workflow` | Yes for `subworkflow` | — | Child workflow name to run inline |

For `kind: subworkflow`, set `workflow` and omit `target` / `message`. Nested workflows are expanded recursively, cycles are rejected, and nesting depth is limited to 10.

### Storage

```text
.synapse/workflows/<name>.yaml        # Project scope (default)
~/.synapse/workflows/<name>.yaml      # User scope
.synapse/workflow_runs.db             # Persistent execution history (SQLite, WAL)
```

## Skill Management

Manage skills across scopes with a central store (`~/.synapse/skills/`).

### Interactive TUI

```bash
synapse skills
```

### Non-Interactive Commands

```bash
# List and browse
synapse skills list                                # All scopes
synapse skills list --scope synapse                # Central store only
synapse skills show <name>                         # Skill details

# Manage
synapse skills delete <name> [--force]
synapse skills move <name> --to <scope>

# Central store operations
synapse skills import <name> [--from user|project] # Import to ~/.synapse/skills/
synapse skills deploy <name> --agent claude,codex --scope user  # Deploy from central store
synapse skills add <repo>                          # Install from repo (npx skills wrapper)
synapse skills create [--name <name>]              # Create new skill template

# Skill sets (named groups)
synapse skills set list
synapse skills set show <name>

### Apply Skill Set to Running Agent

Apply a skill set to a running agent. This command copies skill files to the agent's skill directory, updates the registry, and re-injects skill set information via A2A.

```bash
synapse skills apply <target> <set_name> [--dry-run]
```

**Parameters:**
- `target`: Target agent (name, ID, type-port, or agent type)
- `set_name`: Name of the skill set to apply (e.g., `developer`, `architect`)
- `--dry-run`: Preview changes without applying them

**Example:**
```bash
synapse skills apply my-claude manager
synapse skills apply gemini-8110 developer --dry-run
```

**Default Skill Sets (6):**

| Set | Description | Skills (+ synapse-a2a base) |
|-----|-------------|----------------------------|
| `architect` | System architecture and design — design docs, API contracts, code review | system-design, api-design, code-review, project-docs |
| `developer` | Implementation and quality — test-first development, refactoring, code simplification | test-first, refactoring, code-simplifier, agent-memory |
| `reviewer` | Code review and security — structured reviews, security audits, code simplification | code-review, security-audit, code-simplifier |
| `frontend` | Frontend development — React/Next.js performance, component composition, design systems, accessibility | react-performance, frontend-design, react-composition, web-accessibility |
| `manager` | Multi-agent management — task delegation, progress monitoring, quality verification, cross-review orchestration, re-instruction | synapse-manager, task-planner, agent-memory, code-review, synapse-reinst |
| `documentation` | Documentation expert — audit, restructure, synchronize, and maintain project documentation | project-docs, doc-organizer, api-design, agent-memory |

**Skill Set in Initial Instructions:** When an agent starts with a skill set (via `--skill-set` or interactive selection), the skill set details (name, description, included skills) are automatically included in the agent's initial instructions. This allows the agent to understand its assigned capabilities.

### Skill Scopes

| Scope | Location | Description |
|-------|----------|-------------|
| **Synapse** | `~/.synapse/skills/` | Central store (deploy to agents from here) |
| **User** | `~/.claude/skills/`, `~/.agents/skills/` | User-wide skills |
| **Project** | `./.claude/skills/`, `./.agents/skills/` | Project-local skills |
| **Plugin** | `./plugins/*/skills/` | Read-only plugin skills |

### Agent Skill Directories

| Agent | Directory |
|-------|-----------|
| Claude | `.claude/skills/` |
| Codex | `.agents/skills/` |
| Gemini | `.agents/skills/` |
| OpenCode | `.agents/skills/` |
| Copilot | `.agents/skills/` |

## CI Monitoring and Auto-Fix Skills

Automated hooks and companion skills for monitoring CI, merge conflicts, and code reviews.

### CI Monitoring Hooks

PostToolUse hooks in `.claude/hooks/` automatically launch background monitors after `git push` or `gh pr create`:

- **`check-ci-trigger.sh`**: Detects `git push` and `gh pr create` in Bash tool invocations, then launches:
  - **`poll-ci.sh`**: Polls GitHub Actions until the run completes. Reports pass/fail via `systemMessage`. On failure, suggests `/fix-ci` (up to 2 auto-fix attempts before recommending manual intervention).
  - **`poll-pr-status.sh`**: Checks PR mergeable state (conflict detection) and waits for CodeRabbit review. Reports merge conflicts (suggests `/fix-conflict`) and classifies review comments by severity (suggests `/fix-review` for actionable issues).

### Check CI Status

```
/check-ci          # Show CI checks + merge conflict state + CodeRabbit review
/check-ci --fix    # Show status and suggest fix commands for issues found
/check-ci --wait   # Report if CI is still running
```

Reports:
- GitHub Actions check results (pass/fail/running/pending)
- Merge conflict state (MERGEABLE / CONFLICTING / computing)
- CodeRabbit review comment count and classification

With `--fix`, suggests `/fix-conflict`, `/fix-ci`, or `/fix-review` in priority order.

### Fix CI Failures

```
/fix-ci             # Auto-diagnose and fix CI failures
/fix-ci --dry-run   # Preview fixes without applying
```

Workflow: fetch failed logs -> categorize (format/lint/type/test) -> apply targeted fixes -> verify locally -> commit and push. Max 1 retry per failure category.

### Fix Merge Conflicts

```
/fix-conflict             # Auto-resolve merge conflicts
/fix-conflict --dry-run   # Show conflicts without resolving
```

Workflow: fetch base branch -> test merge -> identify conflicts -> analyze both sides -> resolve -> verify (ruff + pytest) -> commit and push. Aborts on binary conflicts or >10 conflicting files.

### Fix CodeRabbit Review Comments

```
/fix-review             # Auto-fix actionable CodeRabbit comments
/fix-review --dry-run   # Preview without applying
/fix-review --all       # Also attempt suggestion-category fixes
```

Workflow: fetch PR reviews from `coderabbitai[bot]` -> classify comments (Bug/Security, Style, Suggestion) -> apply fixes for actionable categories -> verify locally -> commit and push.

**Comment Classification:**
- **Bug/Security** (auto-fix): issues with `⚠️ Potential issue`, `🐛 Bug`, `🔒 Security` headers or bug-related keywords
- **Style** (auto-fix): nitpicks, formatting, naming issues; delegates to `ruff check --fix` and `ruff format` when applicable
- **Suggestion** (report only): refactoring ideas, performance hints; only auto-fixed with `--all` flag

## Canvas Board

Canvas is a shared visual dashboard where agents post rich content cards rendered in the browser. The UI is a single-page application (SPA) with five views navigated via hash routing:

- **`#/`** (Canvas view) — Spotlight layout showing the latest card prominently
  - **`#/history`** (History sub-view) — Grid layout with filters, live feed, and agent messages (sub-item under Canvas in sidebar navigation)
- **`#/dashboard`** (Dashboard view) — Operational overview with expandable summary+detail widgets (Agents, Tasks, File Locks, Worktrees, Memory, Errors)
- **`#/admin`** (Agent Control) — Browser-based agent management: clickable agent table rows for selection (with role, skill set, working directory), textarea input with Cmd+Enter, reply-based response via `synapse reply` (agent replies are received at Canvas's `/tasks/send` endpoint), section titles (Select Agent, Response), sticky table headers, IME composition handling
- **`#/system`** (System panel) — Configuration view (tips, saved agents, skills, skill sets, sessions, workflows, environment)

### Post Cards

```bash
# Post a Mermaid diagram
synapse canvas post mermaid "graph TD; A-->B" --title "Architecture" --pinned

# Post markdown
synapse canvas post markdown "## Summary\nAll tests pass" --title "Report"

# Post a table
synapse canvas post table '{"headers":["Test","Status"],"rows":[["auth","pass"],["api","pass"]]}' --title "Results"

# Post code with language hint (syntax highlighted via highlight.js)
synapse canvas post code "def hello(): pass" --lang python --title "Snippet"

# Post a Chart.js chart (supports bar, line, pie, doughnut, radar, polarArea, scatter, bubble)
synapse canvas post chart '{"type":"bar","data":{"labels":["A","B"],"datasets":[{"data":[10,20]}]}}' --title "Metrics"
synapse canvas post chart '{"type":"pie","data":{"labels":["Pass","Fail"],"datasets":[{"data":[95,5]}]}}' --title "Results"

# Post a diff (rendered as side-by-side comparison)
synapse canvas post diff "@@ -1 +1 @@\n-old\n+new" --title "Changes"

# Post HTML (sandboxed iframe with theme sync, auto-resize, dark mode)
synapse canvas post html "<h1>Hello</h1><p>Rich content</p>" --title "HTML Card"

# Post an interactive artifact (sandboxed iframe for full HTML/JS/CSS applications)
synapse canvas post artifact '<html><body><button onclick="alert(1)">Click</button></body></html>' --title "App"

# Read body from file
synapse canvas post mermaid "" --file diagram.mmd --title "From File"

# Upsert: update an existing card by ID (or create if not found)
synapse canvas post markdown "Updated content" --title "Report" --card-id my-report-1

# Add tags for categorisation
synapse canvas post markdown "Notes" --title "Review" --tags "review,auth"

# Override agent display name
synapse canvas post markdown "Hello" --title "Greeting" --agent-name "Reviewer"

# Post a progress tracker
synapse canvas post progress '{"current": 3, "total": 7, "label": "Migration", "steps": ["Schema", "Data", "Indexes", "Views", "Triggers", "Constraints", "Verify"], "status": "in_progress"}' --title "Migration Progress"

# Post terminal output (preserves ANSI escape codes)
synapse canvas post terminal "$(cat build.log)" --title "Build Output"

# Post a dependency graph (nodes + edges)
synapse canvas post dependency-graph '{"nodes": [{"id": "auth", "group": "core"}, {"id": "api", "group": "core"}, {"id": "ui", "group": "frontend"}], "edges": [{"from": "ui", "to": "api"}, {"from": "api", "to": "auth"}]}' --title "Module Dependencies"

# Post a cost summary
synapse canvas post cost '{"agents": [{"name": "claude", "input_tokens": 50000, "output_tokens": 12000, "cost": 0.45}, {"name": "gemini", "input_tokens": 30000, "output_tokens": 8000, "cost": 0.12}], "total_cost": 0.57, "currency": "USD"}' --title "Session Cost"

# Post a link preview (fetches Open Graph metadata and renders as a rich card)
synapse canvas link "https://example.com/article" --title "Reference"

# Post raw JSON (composite cards with multiple content blocks)
synapse canvas post-raw '{"type":"render","agent_id":"cli","content":[{"format":"markdown","body":"# Title"},{"format":"code","body":"x=1","lang":"python"}],"title":"Composite"}'
```

**Supported formats (25):** mermaid, markdown, html, artifact, table, json, diff, code, chart, image, log, status, metric, checklist, timeline, alert, file-preview, trace, tip, progress, terminal, dependency-graph, cost, link-preview, plan

### Templates

Templates control how composite content blocks are displayed. Each template has its own `template_data` schema. The `CanvasMessage` fields `template` (str) and `template_data` (dict) select and configure the layout.

**6 templates:** briefing, comparison, dashboard, steps, slides, plan

```bash
# Post a briefing (structured report with sections referencing content blocks)
synapse canvas briefing '{"title":"Sprint","sections":[{"title":"Tests","blocks":[0]}],"content":[{"format":"markdown","body":"## Results"}]}' --pinned
synapse canvas briefing --file report.json --title "CI Report"

# Post a plan card (Mermaid DAG + step list with status tracking)
synapse canvas plan '{"plan_id":"plan-auth","status":"proposed","mermaid":"graph TD; A[Design]-->B[Implement]-->C[Test]","steps":[{"id":"s1","subject":"Design","agent":"claude","status":"pending"},{"id":"s2","subject":"Implement","agent":"codex","status":"pending","blocked_by":["s1"]},{"id":"s3","subject":"Test","agent":"gemini","status":"pending","blocked_by":["s2"]}]}' --title "Auth Plan"
synapse canvas plan --file plan.json --title "Migration Plan"

# Post via post-raw with template field (works for all 6 templates)
synapse canvas post-raw '{"type":"render","agent_id":"cli","template":"comparison","template_data":{"sides":[{"label":"Before","blocks":[0]},{"label":"After","blocks":[1]}]},"content":[{"format":"code","body":"old","lang":"python"},{"format":"code","body":"new","lang":"python"}],"title":"Diff"}'
```

**Template data schemas:**

| Template | Required `template_data` | Description |
|----------|--------------------------|-------------|
| briefing | `{"sections": [{"title": str, "blocks?": [int]}], "summary?": str}` | Structured report with collapsible sections |
| comparison | `{"sides": [{"label": str, "blocks": [int]}], "layout?": "side-by-side"\|"stacked", "summary?": str}` | 2-to-4-way side-by-side or stacked comparison |
| dashboard | `{"widgets": [{"title": str, "blocks": [int], "size?": "1x1"\|"2x1"\|"1x2"\|"2x2"}], "cols?": int}` | Grid layout with resizable widget cells (1-4 columns) |
| steps | `{"steps": [{"title": str, "blocks?": [int], "done?": bool, "description?": str}], "summary?": str}` | Linear workflow with completion tracking |
| slides | `{"slides": [{"title?": str, "blocks": [int], "notes?": str}]}` | Page-by-page navigation |
| plan | `{"plan_id": str, "status": str, "steps": [{"id": str, "subject": str, "agent?": str, "status": str, "blocked_by?": [str]}], "mermaid?": str}` | Task DAG with Mermaid visualization and step tracking |

### Template Selection Guide

- `briefing`: use for implementation reports, review notes, release summaries, and any output that benefits from sections + summaries
- `comparison`: use for before/after diffs, option trade-offs, and architecture choices with parallel evidence
- `steps`: use for rollout plans, migration procedures, bug-fix sequences, and checklist-driven execution
- `slides`: use for walkthroughs, demos, and content that should be consumed one page at a time
- `dashboard`: use for operational snapshots with multiple small widgets, counts, and mixed status blocks
- `plan`: use for task DAGs with dependency visualization and step-level status tracking

Rule of thumb:
- One block, one idea: plain `synapse canvas post`
- Many blocks, structured story: choose a template

### Rendering Details

| Format | Renderer | Notes |
|--------|----------|-------|
| code | highlight.js 11.x | Syntax highlighting; set `--lang` for best results |
| chart | Chart.js 4.x | All chart types: bar, line, pie, doughnut, radar, polarArea, scatter, bubble |
| diff | Side-by-side | Parsed into left (deletions) / right (additions) columns |
| html | Sandboxed iframe | `allow-scripts`; theme sync via `postMessage` (`--bg`/`--fg`/`--border` CSS vars), auto-resize via ResizeObserver, dark mode support, full document normalization |
| artifact | Sandboxed iframe | Interactive HTML/JS/CSS applications (like Claude.ai Artifacts); full document in sandboxed `allow-scripts` iframe |
| image | `<img>` tag | PNG, JPEG, SVG, GIF, WebP via URL or Base64 data URI (up to 2MB) |
| mermaid | Mermaid 11.x | Diagrams rendered client-side; theme-synced with light/dark toggle (Catppuccin dark / Indigo light palettes, brand accent `#4051b5`) |
| progress | Progress bar + steps | `status`: in_progress, completed, failed, paused |
| terminal | ANSI terminal | Renders raw terminal output with ANSI escape codes |
| dependency-graph | Force-directed graph | Nodes with optional `group` colouring; directed edges |
| cost | Cost summary table | Per-agent token counts and costs with total row |
| link-preview | Open Graph card | Fetches OG metadata from URL; renders title, description, and thumbnail |

### Manage Cards

```bash
synapse canvas list                      # List all cards
synapse canvas list --agent-id claude    # Filter by agent
synapse canvas list --type markdown      # Filter by content type
synapse canvas list --search "Auth"      # Search by title
synapse canvas delete <card_id> --agent-id <id>  # Delete own card
synapse canvas clear                     # Clear all cards
synapse canvas clear --agent-id <id>     # Clear agent's cards
```

### Server Management

```bash
synapse canvas serve [--port 3000]       # Start server foreground
synapse canvas open                      # Open in browser (auto-starts server)
synapse canvas status                    # Show server status (version, PID, mismatch detection)
synapse canvas logs [-n 50] [-f]         # View server logs
synapse canvas stop [--port/-p 3000]     # Stop server (verifies process identity before kill)
```

**Auto-start:** The server starts automatically when you post the first card or run `canvas open`. Stale Canvas processes (e.g., leftover from a previous session) are detected and auto-replaced. Cards are auto-cleaned after 1 hour (pinned cards are exempt).

**Process management:** PID file is stored at `~/.synapse/canvas.pid`. `canvas status` cross-checks the PID file against `/api/health` to detect mismatches and compares `asset_hash` from `/api/health` against local static assets to flag stale-asset servers. `canvas stop` verifies the target PID is actually a Canvas process before sending SIGTERM, with automatic SIGKILL escalation if the process does not exit within the timeout. Stale process replacement during auto-start also escalates from SIGTERM to SIGKILL when needed.

**Canvas proxy:** Each agent's A2A server exposes `/canvas/cards` endpoints, so agents can post cards through their own port without knowing the Canvas server port.

## MCP Bootstrap Server

```bash
# Start MCP server over stdio (options auto-resolved from $SYNAPSE_AGENT_ID)
synapse mcp serve

# Module entrypoint (recommended for client configs — uses repo-pinned version)
uv run --directory /path/to/synapse-a2a python -m synapse.mcp
```

**Defaults:** `--agent-id` defaults to `$SYNAPSE_AGENT_ID` or `synapse-mcp`. `--agent-type` is auto-extracted from the agent ID if not specified.

**MCP methods supported:** `initialize`, `resources/list`, `resources/read`, `tools/list`, `tools/call` (for `bootstrap_agent`, `list_agents`, and `analyze_task`).

### MCP Tool: list_agents

List all running Synapse agents with status and connection info. Equivalent to `synapse list --json` but accessible via MCP protocol.

```json
// JSON-RPC tools/call request
{
  "name": "list_agents",
  "arguments": {
    "status": "READY"
  }
}
```

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `status` | string | No | Filter by status (READY, PROCESSING, WAITING, DONE, etc.) |

**Response fields:** `agent_id`, `agent_type`, `name`, `role`, `skill_set`, `port`, `status`, `pid`, `working_dir`, `endpoint`, `transport`, `current_task_preview`, `task_received_at`.

### MCP Tool: analyze_task

Analyze a user prompt and suggest team/task splits when the work is large enough to benefit from multi-agent collaboration. Part of the Smart Suggest feature.

```json
// JSON-RPC tools/call request
{
  "name": "analyze_task",
  "arguments": {
    "prompt": "Refactor the auth module to use OAuth2 with JWT tokens"
  }
}
```

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `prompt` | string | Yes | User instruction to analyze for team/task split suggestions |

**Triggers:** The tool checks for changed file count, multi-directory changes, missing tests, prompt length, and keyword matches (e.g., "refactor", "migrate", "review"). Configuration is loaded from `.synapse/suggest.yaml` with sensible defaults.

**Response:** Returns `suggestion` (with recommended agents, tasks, and plan) when triggers match, or `null` with a `reason` when no suggestion is warranted.

**Minimal PTY bootstrap:** When Synapse detects a Synapse MCP server config entry for Claude Code, Codex, Gemini CLI, OpenCode, or Copilot, full PTY instruction injection is replaced with a minimal bootstrap message (agent ID, port, and pointers to MCP resources). Approval prompts are kept. Non-Synapse MCP entries do not trigger the switch. Copilot MCP config is read from `~/.copilot/mcp-config.json`.

**Copilot MCP support:** Copilot agents can use the `bootstrap_agent` and `analyze_task` MCP tools but cannot consume MCP resources/prompts.

**Copilot submit confirmation:** Bracketed paste is disabled for Copilot (the CLI does not enable bracketed paste mode). Input is sent character-by-character through Ink's useInput, with `/` replaced by fullwidth solidus `\uff0f` to prevent slash-command autocomplete. Before sending the submit sequence (`\r`), Synapse disables ICRNL on the PTY master so that CR is not converted to LF (Ink treats these as different events). In interactive mode, writes go through an inject pipe merged into pty._copy's select loop. Submit confirmation uses adaptive nudge timing (0.1 s / 0.2 s for long messages) and the retry loop continues until the visible prompt advances or the injected text disappears, including cases where Copilot reuses the same paste placeholder label across retries.

## Self-Learning Pipeline

### Learn (Analyze Observations)

```bash
# Analyze observations and persist learned instincts
synapse learn [--observation-db-path <path>] [--db-path <path>] [--project-hash <hash>]
```

Runs `PatternAnalyzer.analyze_and_save()` to scan the observation store for recurring patterns (repeated errors, successful sender collaborations, frequent status transitions) and persist them as instincts. Existing instincts are updated with merged sources and increased confidence rather than duplicated.

### Instinct Status

```bash
# List learned instincts ordered by confidence
synapse instinct [--scope project|global] [--domain <domain>] [--min-confidence <float>] [--project-hash <hash>] [--limit <n>] [--db-path <path>]
```

Displays instincts with their ID, confidence score, scope, domain, trigger, and action. Use filters to narrow results by scope (`project`/`global`), domain (e.g., `debugging`, `testing`, `workflow`), or minimum confidence threshold.

### Instinct Promote

```bash
# Promote a project-scoped instinct to global scope
synapse instinct promote <instinct_id> [--db-path <path>]
```

Changes an instinct's scope from `project` to `global`, making it available across all projects.

### Evolve (Generate Skills from Instincts)

```bash
# Preview skill candidates (dry-run)
synapse evolve [--db-path <path>]

# Generate SKILL.md files for each candidate
synapse evolve --generate [--output-dir <dir>] [--db-path <path>]
```

Clusters instincts by domain and identifies viable skill candidates (requires 2+ instincts per domain with average confidence >= 0.5). With `--generate`, writes `SKILL.md` files to `.synapse/evolved/skills/<name>/`, `.claude/skills/<name>/`, and `.agents/skills/<name>/`.

## Storage Locations

```text
~/.a2a/registry/     # Running agents (auto-cleaned)
~/.a2a/reply/        # Reply target persistence (auto-cleaned per agent)
~/.a2a/external/     # External A2A agents (persistent)
~/.synapse/skills/   # Central skill store
~/.synapse/sessions/ # Saved sessions (user scope)
~/.synapse/workflows/ # Saved workflows (user scope)
~/.synapse/agents/   # Saved agent definitions (user scope)
~/.synapse/canvas.pid # Canvas server PID file (stale process detection)
~/.synapse/          # User-level settings and logs
.synapse/            # Project-level settings
.synapse/sessions/   # Saved sessions (project scope)
.synapse/workflows/  # Saved workflows (project scope)
~/.synapse/memory.db   # Shared memory knowledge base (user-global)
~/.synapse/canvas.db   # Canvas card storage (user-global)
.synapse/workflow_runs.db # Workflow execution history (project-local, SQLite WAL)
.synapse/observations.db  # Observation events for self-learning (project-local)
.synapse/instincts.db     # Learned instincts / patterns (project-local)
.synapse/evolved/skills/  # Auto-generated skills from instinct evolution
.synapse/worktrees/  # Git worktrees for isolated agent workspaces (auto-managed)
/tmp/synapse-a2a/    # Unix Domain Sockets (UDS) for inter-agent communication
/tmp/.synapse-ci/    # CI monitoring state (fix counters, report dedup)
```

**Note:** UDS socket location can be customized with `SYNAPSE_UDS_DIR` environment variable.
