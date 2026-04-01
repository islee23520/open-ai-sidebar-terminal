# Messaging Reference

Detailed reference for inter-agent messaging in Synapse A2A, covering sending, receiving, priorities, status, and interactive controls.

## Sending Messages

`synapse send` is the recommended way to communicate between agents. It works reliably from any environment, including sandboxed agents.

```bash
synapse send gemini "Please review this code" --notify
synapse send claude "What is the status?" --wait
synapse send codex-8120 "Fix this bug" --silent --priority 3
```

### Sender Identification

- `--from` is auto-detected from the `SYNAPSE_AGENT_ID` environment variable (set by Synapse at startup), so you can usually omit it.
- If auto-detection fails (e.g., sandboxed environments like Codex), specify explicitly: `--from $SYNAPSE_AGENT_ID`.
- When using `--from`, always use the Runtime ID format (`synapse-<type>-<port>`). Custom names and agent types are not accepted here because the Runtime ID is the canonical identifier used for routing.

### Target Resolution

Targets are matched in priority order:

1. **Custom name** (highest): `my-claude` -- exact match, case-sensitive
2. **Exact Runtime ID**: `synapse-claude-8100`
3. **Type-port shorthand**: `claude-8100`, `codex-8120`, `opencode-8130`, `copilot-8140`
4. **Type only**: `claude`, `gemini`, `codex`, `opencode`, `copilot` -- works only when a single instance of that type is running

When multiple agents of the same type are running, a type-only target (e.g., `claude`) fails with an ambiguity error and lists runnable `synapse send` commands for each match. Use a custom name or type-port shorthand instead.

### Working Directory Check

`synapse send` and `synapse interrupt` verify that the sender's working directory matches the target's. A mismatch likely means the agents are working on different projects, so the command exits with code 1 and prints a warning:

```text
Warning: Target agent "my-claude" is in a different directory:
  Sender:  /home/user/project-a
  Target:  /home/user/project-b
Agents in current directory:
  gemini (gemini) - READY
Use --force to send anyway.
```

If no agents are running in the sender's directory, the warning suggests `synapse spawn` instead. To bypass the check intentionally:

```bash
synapse send my-claude "Cross-project message" --force
synapse interrupt my-claude "Urgent" --force
```

### Response Modes

Choose the response mode based on whether you need a result:

| Flag | Behavior | When to use |
|------|----------|-------------|
| `--notify` | Async notification on completion (default) | General task delegation |
| `--wait` | Synchronous blocking until reply | Questions, reviews, analysis -- anything where you need an immediate answer |
| `--silent` | Fire-and-forget, no notification | Informational messages, delegated work where results are checked separately |

```bash
# Block until reply arrives
synapse send gemini "What is the best approach?" --wait

# Default async notification
synapse send gemini "Run tests and report" --notify

# No notification needed
synapse send codex "FYI: Build completed" --silent
```

### Roundtrip Communication (--wait)

For request-response patterns, the sender blocks with `--wait` and the receiver replies with `synapse reply`:

```bash
# Sender: blocks until reply received
synapse send gemini "Analyze this data" --wait

# Receiver: auto-routes to the waiting sender
synapse reply "Analysis result: ..."
```

Synapse automatically tracks senders who expect a reply (marked with `[REPLY EXPECTED]` in the delivered message). `synapse reply` knows who to respond to without additional configuration.

### Broadcasting to All Agents

Send a message to every agent sharing the same working directory:

```bash
synapse broadcast "Status check"
synapse broadcast "Urgent: stop all work" --priority 4
synapse broadcast "FYI: Build completed" --silent
```

Broadcast only targets agents in the same working directory as the sender, preventing unintended cross-project messages.

### Message Files and Attachments

For long messages that exceed shell argument limits, use `--message-file` or `--stdin`:

```bash
synapse send claude --message-file /tmp/review.txt --silent
echo "long message" | synapse send claude --stdin --silent
synapse send claude --message-file - --silent   # '-' reads from stdin
```

Messages over 100 KB are automatically written to temp files (threshold configurable via `SYNAPSE_SEND_MESSAGE_THRESHOLD`).

To attach files to a message:

```bash
synapse send claude "Review this" --attach src/main.py --wait
synapse send claude "Review these" --attach src/a.py --attach src/b.py --wait
```

## Receiving and Replying to Messages

Incoming A2A messages appear with the `A2A:` prefix:

```
A2A: [From: NAME (SENDER_ID)] [Task: XXXXXXXX] [REPLY EXPECTED] <message content>
```

- **From**: The sender's display name and Runtime ID.
- **REPLY EXPECTED**: The sender is blocking, waiting for your response.

Fallback formats when sender info is unavailable:
- `A2A: [From: SENDER_ID] <message content>`
- `A2A: <message content>` (backward-compatible)

When `[REPLY EXPECTED]` is present, reply with `synapse reply` so the sender can unblock. Do not manually include `[REPLY EXPECTED]` in outgoing messages -- Synapse adds it automatically when `--wait` is used.

### Replying

```bash
# Auto-routes to the last sender expecting a reply
synapse reply "Here is my analysis..."

# Send a failed reply (task could not be completed)
synapse reply --fail "Quota exceeded"

# When multiple senders are pending
synapse reply --list-targets
synapse reply "Here is my analysis..." --to <sender_id>

# In sandboxed environments (like Codex), specify your Runtime ID
synapse reply "Here is my analysis..." --from $SYNAPSE_AGENT_ID
```

**Example -- question received (reply expected):**
```
Received: A2A: [From: Claude (synapse-claude-8100)] [REPLY EXPECTED] What is the project structure?
Reply:    synapse reply "The project has src/, tests/..."
```

**Missing reply detection:** If a `--wait` or `--notify` task completes without an explicit `synapse reply`, the task is automatically marked as `MISSING_REPLY` (failed). Always use `synapse reply` or `synapse reply --fail` when `[REPLY EXPECTED]` is present.

**Example -- delegation received (no reply needed):**
```
Received: A2A: [From: Gemini (synapse-gemini-8110)] Run the tests and fix failures
Action:   Do the task. No reply needed unless you have questions.
```

## Priority Levels

| Priority | Description | Use Case |
|----------|-------------|----------|
| 1-2 | Low | Background tasks |
| 3 | Normal | Standard tasks |
| 4 | Urgent | Follow-ups, status checks |
| 5 | Interrupt | Emergency -- sends SIGINT first, bypasses Readiness Gate |

Default priority: `send` = 3 (normal), `broadcast` = 1 (low). Broadcast defaults to low priority because it fans out to all agents, and most broadcast messages are informational rather than urgent.

```bash
# Normal priority (default 3)
synapse send gemini "Analyze this" --wait

# Urgent request
synapse send claude "Urgent review needed" --wait --priority 4

# Soft interrupt (shorthand for send -p 4 --silent)
synapse interrupt gemini "Stop and review"

# Emergency interrupt
synapse send codex "STOP" --priority 5
```

## Agent Status

| Status | Meaning | Color |
|--------|---------|-------|
| READY | Idle, waiting for input | Green |
| WAITING | Awaiting user input (selection, confirmation); auto-expires after `waiting_expiry` seconds (default 10s) | Cyan |
| PROCESSING | Busy handling a task | Yellow |
| DONE | Task completed (auto-clears after 10s) | Blue |
| SHUTTING_DOWN | Graceful shutdown in progress | Red |

### Compound Signal Detection

Status transitions rely on multiple signals beyond PTY output patterns, reducing false transitions:

- **task_active flag**: Reference-counted; incremented on A2A task receipt, decremented on task finalization (completion or failure) and on send error. READY transitions are allowed only when the count reaches 0. If the count is not cleared, `task_protection_timeout` (default 30s, configurable per profile) expires the protection automatically.
- **File locks**: Agents holding file locks remain in PROCESSING even if PTY output looks idle, because releasing file locks prematurely could cause conflicts.
- **WAITING auto-expiry**: WAITING status auto-clears after `waiting_expiry` seconds (default 10s) to prevent stale states from blocking other transitions.

### Checking Status Before Sending

For human operators, run `synapse list` and confirm the target shows `READY`. For AI/scripts, use `synapse list --json` or `synapse status <target> --json`. Also check WORKING_DIR to avoid the working directory mismatch warning:

```bash
synapse list --json
# NAME        TYPE    STATUS      PORT   CURRENT              WORKING_DIR
# my-claude   claude  READY       8100   -                    my-project
# gemini      gemini  PROCESSING  8110   Review code (1m 5s)  my-project
# codex       codex   PROCESSING  8120   Fix tests (30s)      other-project
```

The CURRENT column shows the active task preview with elapsed time (e.g., `Review code (2m 15s)`).

For a comprehensive view of a single agent (uptime, current task, recent messages, file locks):

```bash
synapse status my-claude          # Human-readable
synapse status my-claude --json   # Machine-readable
```

### What Each Status Means for Senders

- **READY**: Safe to send messages.
- **WAITING**: Agent needs user input -- use terminal jump to respond (auto-clears after `waiting_expiry`).
- **PROCESSING**: Busy. Wait, or use `--priority 5` for emergency interrupt.
- **DONE**: Recently completed. Will return to READY shortly.

### Readiness Gate

Messages sent to an agent that has not yet reached READY for the first time are held for up to 30 seconds (`AGENT_READY_TIMEOUT`). This prevents messages from being lost during initialization. If the agent does not become ready in time, the API returns HTTP 503 with `Retry-After: 5`. Priority 5 and reply messages bypass this gate entirely.

## Interactive Controls

For humans, `synapse list` provides keyboard-driven agent management:

| Key | Action |
|-----|--------|
| `1-9` | Select agent row directly |
| Up/Down | Navigate agent rows |
| `Enter` or `j` | Jump to selected agent's terminal |
| `k` | Kill selected agent (with confirmation) |
| `/` | Filter by TYPE, NAME, or WORKING_DIR |
| `ESC` | Clear filter first, then clear selection |
| `q` | Quit |

### Supported Terminals

- **iTerm2** (macOS) -- switches to the correct tab/pane
- **Terminal.app** (macOS) -- switches to the correct tab
- **Ghostty** (macOS) -- activates the application. Targets the focused tab, so avoid switching tabs during spawn.
- **VS Code** integrated terminal -- brings the application/window to the front; does not switch the integrated terminal or change WORKING_DIR
- **tmux** -- switches to the agent's session
- **Zellij** -- activates the terminal app (direct pane focus not supported via CLI)

Terminal jump is especially useful when an agent shows `WAITING` status -- jump to its terminal to respond to the selection prompt.
