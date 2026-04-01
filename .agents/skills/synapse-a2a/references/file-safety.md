# File Safety Reference

File Safety prevents conflicts when multiple agents edit the same files.

## MANDATORY: Checklist Before Edit/Write

Before using Edit, Write, sed, awk, or ANY file modification:

- [ ] Check locks: `synapse file-safety locks`
- [ ] Lock file: `synapse file-safety lock <file> <agent_id> --intent "..."`
- [ ] Verify lock: `synapse file-safety locks`

**If lock fails (another agent has it): DO NOT edit. Work on something else.**

## Enable File Safety

```bash
# Via environment variable
export SYNAPSE_FILE_SAFETY_ENABLED=true
synapse claude

# Via settings.json
synapse init
# Edit .synapse/settings.json
```

## Quick Reference

| Action        | Command                                                    |
|---------------|------------------------------------------------------------|
| Check locks   | `synapse file-safety locks`                                |
| Lock file     | `synapse file-safety lock <file> <agent_id> --intent "..."` |
| Unlock file   | `synapse file-safety unlock <file> <agent_id>`             |
| Record change | `synapse file-safety record <file> <agent_id> <task_id> --type MODIFY` |
| File history  | `synapse file-safety history <file> [--limit N]`           |
| Recent changes| `synapse file-safety recent [--agent <name>] [--limit N]`  |
| Status        | `synapse file-safety status`                               |
| Cleanup old   | `synapse file-safety cleanup --days 30 [--force]`          |
| Cleanup locks | `synapse file-safety cleanup-locks [--force]`              |
| Debug info    | `synapse file-safety debug`                                |

## Commands

### Check Status

```bash
# Overall statistics
synapse file-safety status

# List active locks
synapse file-safety locks
synapse file-safety locks --agent claude
```

### Lock/Unlock Files

```bash
# Acquire lock
synapse file-safety lock /path/to/file.py claude --intent "Refactoring" --duration 300

# Wait for lock if held by another agent
synapse file-safety lock /path/to/file.py claude --wait

# Wait with timeout and custom retry interval
synapse file-safety lock /path/to/file.py claude --wait --wait-timeout 60 --wait-interval 5

# Release lock
synapse file-safety unlock /path/to/file.py claude
```

### View File History

```bash
# File modification history
synapse file-safety history /path/to/file.py
synapse file-safety history /path/to/file.py --limit 10

# Recent modifications (all files)
synapse file-safety recent
synapse file-safety recent --agent claude --limit 20
```

### Record Modifications

```bash
synapse file-safety record /path/to/file.py claude task-123 \
  --type MODIFY \
  --intent "Bug fix"
```

### Cleanup Old Records

```bash
# Clean records older than 30 days
synapse file-safety cleanup --days 30

# Force cleanup without confirmation
synapse file-safety cleanup --days 30 --force
```

### Cleanup Stale Locks

Remove locks held by dead processes:

```bash
# Show and clean stale locks (prompts for confirmation)
synapse file-safety cleanup-locks

# Force cleanup without confirmation
synapse file-safety cleanup-locks --force
```

Detects locks whose owning process (PID) is no longer running and removes them.

### Debug

Show troubleshooting information:

```bash
synapse file-safety debug
```

Displays:
- Environment variables (`SYNAPSE_FILE_SAFETY_ENABLED`, `SYNAPSE_FILE_SAFETY_RETENTION_DAYS`, etc.)
- Settings file locations and status
- Database path, enabled status, active locks count, total modifications
- Instruction file locations
- Log file locations
- Debug tips (enable debug logging, file logging)

## Complete Workflow

### Before Editing

1. Check if file is locked:
   ```bash
   synapse file-safety locks
   ```

2. Acquire lock (REQUIRED):
   ```bash
   synapse file-safety lock /path/to/file.py <agent_name> --intent "Description"
   ```

3. Verify you have the lock:
   ```bash
   synapse file-safety locks
   ```

### After Editing

1. Record modification:
   ```bash
   synapse file-safety record /path/to/file.py <agent_name> <task_id> --type MODIFY
   ```

2. Release lock:
   ```bash
   synapse file-safety unlock /path/to/file.py <agent_name>
   ```

## Error Handling

### File Locked by Another Agent

```text
Error: File is locked by gemini (expires: 2026-01-09T12:00:00)
```

**Solutions:**
1. Wait for lock to expire
2. Work on different files first
3. Coordinate with lock holder: `synapse send gemini "What's your progress on src/auth.py?" --wait`

## Why This Matters

- Without locks, two agents editing the same file = DATA LOSS
- Your changes may be overwritten without warning
- Other agents' work may be destroyed
- **EVERY EDIT NEEDS A LOCK. NO EXCEPTIONS.**

## Storage

- Default DB: `~/.synapse/file_safety.db` (SQLite)
- Project-level: `.synapse/file_safety.db`
- Configure via `SYNAPSE_FILE_SAFETY_DB_PATH`
