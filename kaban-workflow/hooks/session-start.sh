#!/usr/bin/env bash
# SessionStart hook for kaban-workflow plugin
# Checks kaban CLI availability and board status, injects context

# Check if kaban CLI is installed
if ! command -v kaban &>/dev/null; then
    # No kaban installed, output minimal context
    python3 -c '
import json
output = {
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": "Note: kaban CLI not installed. Install to enable persistent task tracking."
    }
}
print(json.dumps(output))
'
    exit 0
fi

# Get board status
STATUS_OUTPUT=$(kaban status 2>&1)
STATUS_CODE=$?

# Get in-progress tasks
IN_PROGRESS=$(kaban list --column in_progress --json 2>/dev/null | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    tasks = data.get("data", [])
    if tasks:
        for t in tasks[:3]:
            print(f"- [{t[\"id\"][:8]}] {t[\"title\"]}")
except:
    pass
' 2>/dev/null)

# Build context message
python3 - "$STATUS_CODE" "$STATUS_OUTPUT" "$IN_PROGRESS" <<'PYTHON_SCRIPT'
import json
import sys

status_code = int(sys.argv[1])
status_output = sys.argv[2]
in_progress = sys.argv[3]

if status_code != 0:
    # No board or error
    context = """SessionStart:resume hook success: No kaban board in this directory.
Use `kaban init` to create one for persistent task tracking."""
else:
    # Board exists
    context = f"""SessionStart:resume hook success: Success
{status_output}"""

    if in_progress.strip():
        context += f"""

**In-progress tasks:**
{in_progress}

Resume these tasks? Use `kaban list` for full details."""

output = {
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": context
    }
}

print(json.dumps(output))
PYTHON_SCRIPT

exit 0
