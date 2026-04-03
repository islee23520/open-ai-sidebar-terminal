# Collaboration Reference

This document covers agent naming, external agents, authentication, session resume, and path configuration — the pieces that make multi-agent collaboration work smoothly.

## Agent Naming

Custom names and roles make agents easier to identify and address, especially when running multiple instances of the same type.

### Assigning Names and Roles

```bash
# Start with name and role
synapse claude --name my-claude --role "code reviewer"

# Start with skill set
synapse claude --skill-set dev-set

# Start with saved agent definition (--agent / -A)
synapse claude --agent calm-lead
synapse claude --agent calm-lead --role "override role"  # CLI args override saved values

# Role from file (@prefix reads file content as role)
synapse claude --name reviewer --role "@./roles/reviewer.md"
synapse gemini --role "@~/my-roles/analyst.md"

# Skip interactive name/role setup
synapse claude --no-setup

# Update name/role after agent is running
synapse rename synapse-claude-8100 --name my-claude --role "test writer"
synapse rename my-claude --role "documentation"  # Change role only
synapse rename my-claude --clear                 # Clear name and role
```

Once named, use the custom name for all operations:

```bash
synapse send my-claude "Review this code"
synapse jump my-claude
synapse kill my-claude
```

### Name vs ID

- **Display/Prompts**: Shows name if set, otherwise ID (e.g., `Kill my-claude (PID: 1234)?`)
- **Internal processing**: Always uses Runtime ID (`synapse-claude-8100`)
- **Target resolution**: Name has highest priority when matching targets

### Target Resolution Priority

When using commands like `synapse send`, `synapse status`, `synapse kill`, `synapse jump`, or `synapse rename`, targets resolve in this order:

1. **Custom name** (highest priority): `my-claude`
2. **Full Runtime ID**: `synapse-claude-8100`
3. **Type-port shorthand**: `claude-8100`
4. **Agent type** (only if a single instance exists): `claude`

Custom names are case-sensitive. Agent type resolution uses fuzzy partial matching, so `clau` can match `claude` when only one instance is running.

## External Agent Management

External agents let you connect to A2A-compatible services running outside your local Synapse environment — useful for reaching remote analysis servers, cloud-hosted agents, or teammates' agents.

```bash
# Discover and add an external agent
synapse external add https://agent.example.com --alias myagent

# List registered external agents
synapse external list

# Show agent details (capabilities, skills)
synapse external info myagent

# Send message to external agent
synapse external send myagent "Analyze this data"
synapse external send myagent "Process file" --wait  # Wait for completion

# Remove agent
synapse external remove myagent
```

External agents are stored persistently in `~/.a2a/external/`, so they survive restarts and remain available across sessions.

## Authentication

API key authentication protects A2A communication, which matters when agents are exposed beyond localhost or when you want to prevent unauthorized message injection.

```bash
# Interactive setup (generates keys + shows instructions)
synapse auth setup

# Generate API key(s)
synapse auth generate-key
synapse auth generate-key -n 3 -e  # 3 keys in export format

# Enable authentication
export SYNAPSE_AUTH_ENABLED=true
export SYNAPSE_API_KEYS=<key>
export SYNAPSE_ADMIN_KEY=<admin_key>
synapse claude
```

Without authentication enabled, any process that can reach the agent's port can send it messages. Enabling auth ensures only holders of a valid API key can interact with your agents — important for shared networks or production-like setups.

## Resume Mode

Resume mode starts an agent without sending initial instructions. This is valuable for session recovery — the agent picks up its existing context instead of receiving a fresh identity injection that could conflict with prior state.

```bash
synapse claude -- --resume
synapse gemini -- --resume
synapse codex -- resume        # Codex: resume is a subcommand
synapse opencode -- --continue
synapse copilot -- --continue
```

To inject instructions later (e.g., after confirming the agent is in a clean state):

```bash
synapse instructions send <agent>
```

The reason each tool has a different flag is that resume/continue is handled by the underlying CLI tool itself — Synapse passes the flag through after `--`.

## Path Overrides

When running multiple environments, CI pipelines, or isolated test suites, you can override storage paths via environment variables to prevent collisions:

| Variable | Default | Purpose |
|----------|---------|---------|
| `SYNAPSE_REGISTRY_DIR` | `~/.a2a/registry` | Running agent registry |
| `SYNAPSE_REPLY_TARGET_DIR` | `~/.a2a/reply` | Reply target persistence |
| `SYNAPSE_EXTERNAL_REGISTRY_DIR` | `~/.a2a/external` | External agent storage |
| `SYNAPSE_HISTORY_DB_PATH` | `~/.synapse/history/history.db` | Task history database |
| `SYNAPSE_SKILLS_DIR` | `~/.synapse/skills` | Central skill store |
| `SYNAPSE_SHARED_MEMORY_DB_PATH` | `~/.synapse/memory.db` | Shared memory database |
| `SYNAPSE_SHARED_MEMORY_ENABLED` | `true` | Enable/disable shared memory |

Overriding these paths keeps parallel environments from stepping on each other's state — for example, a CI run using `SYNAPSE_REGISTRY_DIR=/tmp/ci-registry` avoids interfering with a developer's local agents.
