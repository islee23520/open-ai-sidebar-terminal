# A2A Protocol Reference

This document provides technical details for developers and advanced users.
**For normal agent communication, use `synapse send` and `synapse reply` commands.**

## Message Format

### Receiving Messages

Messages arrive with a simple `A2A:` prefix:

```text
A2A: <message content>
```

### Replying to Messages

Use `synapse reply` to respond:

```bash
synapse reply "<your response>"
synapse reply --fail "<reason>"
synapse reply --list-targets
synapse reply "<your response>" --to <sender_id>
```

The framework automatically handles routing - you don't need to know where the message came from.

## API Endpoints

### A2A Compliant

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/agent.json` | GET | Agent Card |
| `/tasks/send` | POST | Send message (subject to Readiness Gate) |
| `/tasks/{id}` | GET | Get task status |
| `/tasks` | GET | List tasks |
| `/tasks/{id}/cancel` | POST | Cancel task |
| `/status` | GET | READY/PROCESSING status |

### Synapse Extensions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tasks/send-priority` | POST | Send with priority (1-5, 5=interrupt; subject to Readiness Gate) |
| `/tasks/create` | POST | Create task without PTY send (for `--wait`) |
| `/tasks/{id}/reply` | POST | Record an explicit reply on the receiver's local task before routing it back to the sender |
| `/history/update` | POST | Update sender-side history observation (completion callback) |
| `/reply-stack/list` | GET | List sender IDs available for reply (`synapse reply --list-targets`) |
| `/reply-stack/get` | GET | Get sender info without removing (supports `?sender_id=`) |
| `/reply-stack/pop` | GET | Pop sender info from reply map (supports `?sender_id=`) |

## Completion Callback (`--silent` Flow)

When `--silent` is used, the sender does not wait for a reply. However, the receiver still notifies the sender when the task completes (or fails) by calling `POST /history/update` on the sender's server. This updates the sender's history record from `sent` to the final status.

1. **Sender** calls `/tasks/send` on the target agent with `response_mode: "silent"` and sender metadata (endpoint, UDS path, task ID)
2. **Target agent** processes the message until completion
3. **Target agent** calls `POST /history/update` on the sender's endpoint (UDS first, HTTP fallback)
4. **Sender's** history record is updated from `sent` to `completed`/`failed`/`canceled`

**Characteristics:**
- **Best-effort**: Callback failures are logged but do not affect the receiver's processing
- **Transport preference**: Uses UDS (Unix Domain Socket) when available, falls back to HTTP
- **Timeout**: 10 seconds per callback attempt
- **Metadata marker**: Updated observations include `completion_callback: true` in metadata
- **Failure semantics**: Quota/limit output from the receiver is classified as task failure rather than a successful reply body

### Agent Teams Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tasks/{id}/approve` | POST | Approve a plan |
| `/tasks/{id}/reject` | POST | Reject a plan with reason |
| `/team/start` | POST | Start multiple agents in terminal panes (agent-initiated) |
| `/spawn` | POST | Spawn a single agent in a new terminal pane (supports `worktree` field for isolation) |

### Shared Memory Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/memory/list` | GET | List memories (query params: `author`, `tags`, `limit`) |
| `/memory/save` | POST | Save/update memory (`{key, content, tags?, notify?}`) |
| `/memory/search` | GET | Search memories (query param: `q`) |
| `/memory/{id_or_key}` | GET | Get memory by ID or key |
| `/memory/{id_or_key}` | DELETE | Delete memory by ID or key |

### Webhook Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhooks` | POST | Register a webhook for task notifications |
| `/webhooks` | GET | List all registered webhooks |
| `/webhooks` | DELETE | Unregister a webhook (query param: `url`) |
| `/webhooks/deliveries` | GET | Get recent webhook delivery attempts |

### SSE Streaming

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tasks/{id}/subscribe` | GET | Subscribe to task updates via Server-Sent Events |

### Canvas Card Endpoints (served by Canvas server)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cards` | POST | Create a new card |
| `/api/cards` | GET | List cards (with optional filters) |
| `/api/cards` | DELETE | Delete cards |
| `/api/cards/{card_id}/download` | GET | Download card as file (optional `?format=md\|json\|csv\|html\|txt\|native`) |

### Canvas Agent Control Endpoints (served by Canvas server)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/agents` | GET | List agents with status |
| `/api/admin/send` | POST | Send message to agent |
| `/api/admin/replies/{task_id}` | GET | Get replies for a task |
| `/api/admin/tasks/{task_id}` | GET | Get task details |
| `/api/admin/start` | POST | Start agents |
| `/api/admin/stop` | POST | Stop agents |
| `/api/admin/agents/spawn` | POST | Spawn a new agent |
| `/api/admin/agents/{agent_id}` | DELETE | Stop agent by ID |
| `/api/admin/jump/{agent_id}` | POST | Jump to agent's terminal (uses PID-based terminal detection with TTY fallback) |

### Canvas Workflow Endpoints (served by Canvas server)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workflow` | GET | List all workflows with full step details (response includes `project_dir`) |
| `/api/workflow/{name}` | GET | Get a single workflow by name |
| `/api/workflow/run/{name}` | POST | Start a workflow execution (body: `{continue_on_error?}`) |
| `/api/workflow/runs` | GET | List active and recent workflow runs |
| `/api/workflow/runs/{run_id}` | GET | Get the status of a specific workflow run |

**SSE event:** `workflow_update` — broadcast when a workflow run progresses (step completion, status change).

**Execution engine:** Workflow steps are sent directly via A2A HTTP (`/tasks/send-priority`) rather than subprocess. When a step has `response_mode: wait`, the runner polls the target agent's task (`GET /tasks/{id}`) until it reaches a terminal state (completed, failed, canceled) or the 10-minute timeout expires. If the target returns **HTTP 409** (agent busy), the runner retries up to 5 times with a 2-second interval before reporting failure.

**Persistent execution history:** Runs are persisted to `.synapse/workflow_runs.db` (SQLite, WAL mode). The `/api/workflow/runs` and `/api/workflow/runs/{run_id}` endpoints return both in-memory and DB-persisted runs, so run history is available across process restarts.

### External Agent Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/external/discover` | POST | Discover and register external A2A agent |
| `/external/agents` | GET | List registered external agents |
| `/external/agents/{alias}` | GET | Get external agent details |
| `/external/agents/{alias}` | DELETE | Remove external agent |
| `/external/agents/{alias}/send` | POST | Send message to external agent |

## Roundtrip Communication (`--wait` / `--notify` Flow)

When `--wait` or `--notify` is used, Synapse expects an explicit reply:

1. **Sender** calls `/tasks/create` to create a task without PTY send (stores task context)
2. **Sender** calls `/tasks/send` on the target agent with `[REPLY EXPECTED]` marker
3. **Target agent** stores sender routing info in the reply stack, including the receiver-side local task ID when available
4. **Target agent** processes the message and replies via `synapse reply` or `synapse reply --fail`
5. **Reply** first records the explicit reply locally via `/tasks/{id}/reply` when `receiver_task_id` is available, then routes the response back to the sender via `/tasks/send`
6. **Sender** receives either reply artifacts or a structured task error and the roundtrip completes

This flow ensures reliable request-response patterns between agents.

**Failure semantics:**
- `synapse reply --fail "<reason>"` records a failed explicit reply locally and returns a structured `failed` task to the sender (`REPLY_FAILED`)
- If a `--wait` or `--notify` task completes without an explicit `synapse reply`, the receiver-side task is automatically marked as `MISSING_REPLY`
- Legacy reply-stack entries may not include `receiver_task_id`; in that case local reply recording is skipped and missing-reply detection remains the safety net

## Readiness Gate

The `/tasks/send` and `/tasks/send-priority` endpoints enforce a **Readiness Gate** that blocks incoming messages until the agent has finished initialization (first READY state).

| Condition | Behavior |
|-----------|----------|
| Agent initializing (not yet READY) | Waits up to `AGENT_READY_TIMEOUT` (default: 30s) for the agent to become ready |
| Agent still not ready after timeout | Returns **HTTP 503** with `Retry-After: 5` header |
| Priority 5 (emergency interrupt) | **Bypasses** the gate entirely |
| Reply messages (`in_reply_to` set) | **Bypasses** the gate (replies are routed before the check) |

**Caller behavior on 503:**
- CLI callers (`synapse send`) handle retries automatically
- Direct API callers should respect the `Retry-After` header and retry after the indicated seconds

**Configuration:**

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_READY_TIMEOUT` | Seconds to wait for agent readiness before returning 503 | `30` |

## Priority Levels

| Priority | Use Case |
|----------|----------|
| 1-2 | Low priority, background tasks |
| 3 | Normal tasks (`send` default) |
| 4 | Urgent follow-ups |
| 5 | Emergency interrupt (sends SIGINT first, bypasses Readiness Gate) |

**Note:** `broadcast` defaults to priority 1 (low), while `send` defaults to priority 3 (normal).

## Long Message Handling

Messages exceeding the TUI input limit (~200-300 characters) are automatically stored in temporary files. The agent receives a reference message instead:

```text
[LONG MESSAGE - FILE ATTACHED] Path: /tmp/synapse-a2a/messages/<task_id>.txt — Please read this file to get the complete message.
```

**Configuration:**

| Variable | Description | Default |
|----------|-------------|---------|
| `SYNAPSE_LONG_MESSAGE_THRESHOLD` | Character threshold for file storage | `200` |
| `SYNAPSE_LONG_MESSAGE_TTL` | TTL for message files (seconds) | `3600` |
| `SYNAPSE_LONG_MESSAGE_DIR` | Directory for message files | System temp |

**Cleanup:** Files are automatically cleaned up after TTL expires.

## Error Handling

### Agent Not Found

```text
Error: No agent found matching 'xyz'
```
**Solution:** Use `synapse list` to see available agents.

### Multiple Agents Found

```text
Error: Ambiguous target 'codex'. Multiple agents found.
```
**Solution:** Use custom name (e.g., `my-codex`) or specific identifier (e.g., `codex-8120`).

### Agent Not Ready (Initializing)

```text
HTTP 503: Agent not ready (initializing). Retry after a few seconds.
Retry-After: 5
```
**Solution:** The agent is still starting up. Wait a few seconds and retry. Priority 5 messages bypass this check. See "Readiness Gate" section above for details.

### Working Directory Mismatch

```text
Warning: Target agent "my-claude" is in a different directory:
  Sender:  /home/user/project-a
  Target:  /home/user/project-b
Agents in current directory:
  gemini (gemini) - READY
Use --force to send anyway.
```
**Solution:** The target agent is working in a different directory. Either send to an agent in your current directory, use `--force` to bypass the check, or spawn a new agent with `synapse spawn`.

### Agent Not Responding

```text
Error: Agent 'synapse-claude-8100' server on port 8100 is not responding.
```
**Solution:** Restart the agent with `synapse claude`.
