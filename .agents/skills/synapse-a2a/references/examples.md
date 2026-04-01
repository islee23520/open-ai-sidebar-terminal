# Multi-Agent Workflow Examples

## Basic Setup

### Start Multiple Agents

```bash
# Terminal 1: Start Claude with File Safety (History is enabled by default since v0.3.13)
SYNAPSE_FILE_SAFETY_ENABLED=true synapse claude

# Terminal 2: Start Codex
SYNAPSE_FILE_SAFETY_ENABLED=true synapse codex

# Terminal 3: Start OpenCode
SYNAPSE_FILE_SAFETY_ENABLED=true synapse opencode

# Terminal 4: Monitor
synapse list
```

## Communication Examples

### Simple Message (Fire-and-forget)

```bash
# Delegate a task (no reply needed)
synapse send codex "Please refactor the authentication module" --silent
```

### Request with Reply

```bash
# Ask a question and wait for response
synapse send gemini "What is the best approach for caching?" --wait
```

### With Priority

```bash
# Urgent follow-up
synapse send gemini "Status update?" --priority 4 --wait
# Emergency interrupt
synapse send codex "STOP" --priority 5
```

### Broadcast to All Agents

```bash
# Ask all agents in the same directory for a status check
synapse broadcast "Status check - what are you working on?" --wait
# Notify all agents of a completed build
synapse broadcast "FYI: Build passed, main branch updated" --silent
# Urgent broadcast to stop all work
synapse broadcast "STOP: Critical bug found in shared module" --priority 4
```

## File Coordination Example

### Delegating File Edit with Lock

```bash
# 1. Check Codex is ready
synapse list

# 2. Check file is not locked
synapse file-safety locks

# 3. Send task
synapse send codex "Please refactor src/auth.py. Acquire file lock before editing." --silent
# 4. Monitor progress
synapse file-safety locks
synapse history list --agent codex --limit 5
```

### Handling Lock Conflict

If a file is locked:

```text
File src/auth.py is locked by gemini (expires: 12:30:00)

Options:
1. Wait for lock to expire
2. Work on different files first
3. Check with lock holder:
   synapse send gemini "What's your progress on src/auth.py?" --wait
```

## Collaborative Development

### Code Review Workflow

```bash
# Terminal 1 (Claude): Implement feature
# Make changes to src/feature.py

# Send for review (wait for feedback)
synapse send codex "Please review the changes in src/feature.py" --wait
# Terminal 2 (Codex): Reply after reviewing
synapse reply "LGTM. Two suggestions: ..."
```

### Parallel Research

```bash
# Ask multiple agents simultaneously (no reply needed - they'll work independently)
synapse send gemini "Research best practices for authentication" --silent
synapse send codex "Check how other projects implement this pattern" --silent
```

## Monitoring Tasks

### Watch Agent Status

```bash
synapse list
```

### View Task History

```bash
# Recent tasks
synapse history list --limit 10

# By agent
synapse history list --agent codex

# Search
synapse history search "auth" --agent codex
```

### Check Git Changes

```bash
git status
git log --oneline -5
git diff
```

## Shared Memory Workflow

### Saving and Sharing Knowledge

```bash
# Agent discovers a pattern and saves it for others
synapse memory save auth-pattern "Use OAuth2 with PKCE flow for all auth" --tags auth,security

# Save with broadcast notification so other agents learn immediately
synapse memory save db-schema "Use UUID primary keys, not auto-increment" --tags database,architecture --notify

# Update existing knowledge (UPSERT on key)
synapse memory save auth-pattern "Use OAuth2 with PKCE flow; add refresh token rotation" --tags auth,security
```

### Searching and Retrieving Knowledge

```bash
# Search before starting a task
synapse memory search "auth"
synapse memory search "database"

# View full details of a specific memory
synapse memory show auth-pattern

# List all memories by a specific agent
synapse memory list --author synapse-gemini-8110

# List memories with specific tags
synapse memory list --tags architecture
```

### Multi-Agent Knowledge Sharing

```bash
# Agent 1 (Claude): Discovers architecture decision
synapse memory save api-style "REST with OpenAPI 3.1, JSON responses" --tags api,architecture --notify

# Agent 2 (Gemini): Receives broadcast, checks memory before implementation
synapse memory search "api"
synapse memory show api-style

# Agent 2 (Gemini): Adds implementation detail
synapse memory save api-auth "Bearer token in Authorization header" --tags api,auth --notify

# Any agent: Check overall knowledge base statistics
synapse memory stats
```

### Cleanup

```bash
# Delete outdated knowledge
synapse memory delete old-pattern --force

# Review what is stored
synapse memory list --limit 20
synapse memory stats
```

## Agent Teams Workflow

### Delegate Mode Setup

```bash
# Terminal 1: Start manager (cannot edit files)
synapse claude --delegate-mode --name manager

# Terminal 2-3: Start worker agents
synapse gemini --name worker-1
synapse codex --name worker-2

# Manager delegates tasks
synapse send worker-1 "Implement auth in src/auth.py"
synapse send worker-2 "Write tests in tests/test_auth.py"
```

### Manager + Worker with Worktree Isolation

Use `--worktree` to give each Worker its own copy of the repository, preventing file conflicts when multiple agents edit code simultaneously. The Manager stays in the main working tree (it delegates, not edits). `--worktree` is a Synapse-level flag that works for **all** agent types.

```bash
# Terminal 1: Manager (delegate-mode — no file editing)
synapse claude --delegate-mode --name manager

# Spawn Workers in isolated worktrees (each gets its own branch)
# --worktree is a Synapse flag — place it before '--', not after
synapse spawn claude --name worker-1 --role "auth implementer" --worktree
synapse spawn gemini --name worker-2 --role "test writer" --worktree

# Confirm readiness — worktree agents show [WT] prefix in WORKING_DIR
synapse list   # Verify worker-1 and worker-2 show STATUS=READY

# Delegate parallel tasks — no file conflicts thanks to worktrees
synapse send worker-1 "Implement OAuth2 in src/auth.py" --silent
synapse send worker-2 "Write tests for src/auth.py in tests/test_auth.py" --silent
# Collect results
synapse send worker-1 "Report your progress" --wait
synapse send worker-2 "Report your progress" --wait
# Cleanup — MUST kill Workers when done (synapse kill also cleans up worktrees)
synapse kill worker-1 -f
synapse kill worker-2 -f

# After killing, handle worktree branches if changes were kept:
# - Merge worktree branch into current branch or create a PR:
#     git merge worktree-<name>
# - Or delete if no changes remain:
#     git branch -d worktree-<name>
```

**Note:** `--worktree` is a Synapse-native flag (not a Claude Code flag). It creates a git worktree at `.synapse/worktrees/<name>/` with a branch named `worktree-<name>`. Works for all agent types (Claude, Gemini, Codex, OpenCode, Copilot). Files listed in `.gitignore` (`.env`, `.venv/`, `node_modules/`) are not copied -- Workers may need `uv sync` or `npm install` before building/testing. On exit: cleanup checks for both uncommitted changes **and** new commits (vs. the base branch tracked via `SYNAPSE_WORKTREE_BASE_BRANCH`); worktrees with neither are auto-deleted along with their branch, worktrees with either prompt to keep or remove. The registry stores `worktree_base_branch` for accurate commit detection. `synapse kill` also handles worktree cleanup.

### Quick Team Start (tmux)

```bash
# Start 3 agents in split panes
synapse team start claude gemini codex --layout split
```

### Sub-Agent Delegation Patterns

Spawn creates child agents for sub-task delegation — preserving context, parallelizing work for speed, and assigning specialist roles for precision. The parent always owns the lifecycle: **spawn → send → evaluate → kill**.

#### Waiting for Readiness

For automation, prefer `synapse status <target> --json` after spawning and poll until the agent shows `STATUS=READY`.

**Note:** Even without polling, the server-side **Readiness Gate** blocks `/tasks/send` requests until the agent finishes initialization. If the agent is not ready within 30 seconds (`AGENT_READY_TIMEOUT`), the API returns HTTP 503 with `Retry-After: 5`. Priority 5 messages and replies bypass this gate. Human operators can still use `synapse list` interactively.

```bash
# Poll until agent is ready (timeout after 30s)
elapsed=0
while ! synapse status Tester --json 2>/dev/null | grep -Eq '"status"[[:space:]]*:[[:space:]]*"READY"'; do
  sleep 1
  elapsed=$((elapsed + 1))
  if [ "$elapsed" -ge 30 ]; then
    echo "ERROR: Tester not READY after ${elapsed}s" >&2
    exit 1
  fi
done
```

For Pattern 3 (multiple agents), wait for all of them:

```bash
# Poll until BOTH agents are ready (single snapshot per iteration)
elapsed=0
while true; do
  tester=$(synapse status Tester --json 2>/dev/null || true)
  fixer=$(synapse status Fixer --json 2>/dev/null || true)
  echo "$tester" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"READY"' \
    && echo "$fixer" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"READY"' \
    && break
  sleep 1
  elapsed=$((elapsed + 1))
  if [ "$elapsed" -ge 30 ]; then
    echo "ERROR: agents not READY after ${elapsed}s" >&2
    exit 1
  fi
done
```

#### Pattern 1: Single-Task Delegation (Happy Path)

Spawn one agent, send one task, verify, kill.

```bash
# Spawn specialist
synapse spawn gemini --name Tester --role "test writer"

# Confirm readiness (re-run until STATUS=READY; this is a point-in-time snapshot)
synapse list   # Verify Tester shows STATUS=READY

# Delegate and wait for result
synapse send Tester "Write unit tests for src/auth.py" --wait
# Evaluate: read reply, then verify artifacts
# (e.g., check git diff or run pytest to confirm tests exist and pass)

# Done — MUST kill
synapse kill Tester -f
# Or graceful kill (sends shutdown request, waits up to 30s): synapse kill Tester
```

#### Pattern 2: Re-Send When Result Is Insufficient

If the result doesn't meet requirements, re-send with refined instructions — don't kill and re-spawn.

```bash
# Spawn
synapse spawn codex --name Reviewer --role "code reviewer"

# Confirm readiness (re-run until STATUS=READY; this is a point-in-time snapshot)
synapse list   # Verify Reviewer shows STATUS=READY

# First attempt
synapse send Reviewer "Review src/server.py for security issues" --wait
# Evaluate: reply is too vague → re-send with specifics
synapse send Reviewer "Also check for SQL injection in the query builder on lines 45-80" --wait
# Evaluate: now the review is thorough — MUST kill
synapse kill Reviewer -f
```

#### Pattern 3: Multiple Specialists for Parallel Subtasks

Spawn N agents for independent subtasks, collect results, verify, kill all.

```bash
# Spawn specialists
synapse spawn gemini --name Tester --role "test writer"
synapse spawn codex --name Fixer --role "bug fixer"

# Confirm readiness of all agents (re-run until both show STATUS=READY)
synapse list   # Verify both Tester and Fixer show STATUS=READY

# Delegate parallel subtasks
synapse send Tester "Write tests for src/auth.py" --silent
synapse send Fixer "Fix the timeout bug in src/server.py" --silent
# Monitor progress, then collect results
synapse send Tester "Report your progress" --wait
synapse send Fixer "Report your progress" --wait
# Evaluate: verify artifacts (e.g., git diff, pytest)

# All done — MUST kill all
synapse kill Tester -f
synapse kill Fixer -f
```

#### How Many Agents to Spawn

1. **User-specified count** → follow it exactly (top priority)
2. **No user specification** → parent decides based on task structure:
   - Single focused subtask → 1 agent
   - Independent parallel subtasks → N agents (one per subtask)

#### Communication Notes

- Use `synapse send ...` (not `synapse reply`) for all communication with spawned agents ([#237](https://github.com/s-hiraoku/synapse-a2a/issues/237)). `--from` is auto-detected from `$SYNAPSE_AGENT_ID` (set by Synapse at startup, e.g., `synapse-claude-8100`).
- **Pane auto-close:** All supported terminals automatically close spawned panes when the agent terminates.
- **Stdout capture:** `synapse spawn` prints `<agent_id> <port>` to stdout; warnings go to stderr, so command substitution captures only the clean output:
  ```bash
  result=$(synapse spawn gemini --name Helper --role "helper")
  agent_id=$(echo "$result" | awk '{print $1}')  # e.g., synapse-gemini-8110
  port=$(echo "$result" | awk '{print $2}')       # e.g., 8110
  ```
  This works in all terminals but is most useful with `tmux` where the spawning shell remains interactive.

## CI Monitoring and Auto-Fix Workflow

### Automatic CI Monitoring (via hooks)

After `git push` or `gh pr create`, PostToolUse hooks automatically launch background monitors:

```text
git push
  └─ check-ci-trigger.sh (PostToolUse hook)
       ├─ poll-ci.sh          → polls GitHub Actions → reports pass/fail
       └─ poll-pr-status.sh   → checks merge conflicts + CodeRabbit review
```

You receive `systemMessage` notifications:
- `[CI Monitor] CI PASSED on feature/x (abc1234)` — all green
- `[CI Monitor] CI FAILED on feature/x (abc1234)` — suggests `/fix-ci`
- `[PR Monitor] Merge conflict detected on PR #42` — suggests `/fix-conflict`
- `[PR Monitor] CodeRabbit review on PR #42` — classifies comments, suggests `/fix-review`

### Manual CI Check and Fix

```bash
# 1. Check current CI status manually
/check-ci

# 2. If issues found, fix them in priority order:
/fix-conflict        # Resolve merge conflicts first (if any)
/fix-ci              # Fix CI failures (lint, format, type, test)
/fix-review          # Address CodeRabbit review comments

# 3. Preview without applying changes
/fix-ci --dry-run
/fix-conflict --dry-run
/fix-review --dry-run

# 4. Check status again after fixes
/check-ci
```

### Typical Fix Cycle

```text
git push
  → CI fails (lint error)
  → [CI Monitor] suggests /fix-ci
  → /fix-ci → applies ruff fix → verifies → pushes
  → CI passes
  → [PR Monitor] CodeRabbit has 2 bugs, 1 style issue
  → /fix-review → fixes bugs + style → verifies → pushes
  → CI passes, review clean
```

## Canvas Template Workflows

### Briefing for Structured Status Reports

```bash
synapse canvas briefing '{"title":"Sprint Review","sections":[{"title":"Summary","blocks":[0]},{"title":"Risks","blocks":[1]}],"content":[{"format":"markdown","body":"## Summary\nAuth fixes merged."},{"format":"alert","body":{"severity":"warning","message":"Visual QA still pending","source":"Release"}}]}' --title "Sprint Review"
```

### Comparison for Before/After Reviews

```bash
synapse canvas post-raw '{"type":"render","agent_id":"cli","title":"Dashboard Cleanup","template":"comparison","template_data":{"layout":"side-by-side","sides":[{"label":"Before","blocks":[0]},{"label":"After","blocks":[1]}]},"content":[{"format":"markdown","body":"Old dashboard with dense multi-column layout."},{"format":"markdown","body":"New dashboard with vertical widgets and clean layout."}]}'
```

### Steps for Execution Plans

```bash
synapse canvas post-raw '{"type":"render","agent_id":"cli","title":"Release Plan","template":"steps","template_data":{"steps":[{"title":"Write tests","blocks":[0],"done":true},{"title":"Implement fix","blocks":[1],"done":true},{"title":"Run visual QA","blocks":[2],"done":false}]},"content":[{"format":"markdown","body":"Regression tests added."},{"format":"markdown","body":"Canvas bug fixes applied."},{"format":"markdown","body":"Pending final browser review."}]}'
```

## Troubleshooting

### Agent Not Responding

1. Check status:
   ```bash
   synapse list
   ```

2. If PROCESSING for too long:
   ```bash
   synapse send <agent> "Status?" --priority 4 --wait
   ```

3. Emergency stop:
   ```bash
   synapse send <agent> "STOP" --priority 5
   ```

### Agent Not Found

```bash
# List available agents
synapse list

# Start missing agent
synapse codex  # in new terminal
```
