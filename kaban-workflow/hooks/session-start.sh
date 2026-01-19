#!/usr/bin/env bash
# SessionStart hook for kaban-workflow plugin
# Checks kaban CLI availability and board status, injects context

set -euo pipefail

output_json() {
    local context="$1"
    if command -v jq &>/dev/null; then
        jq -n --arg ctx "$context" '{
            hookSpecificOutput: {
                hookEventName: "SessionStart",
                additionalContext: $ctx
            }
        }'
    else
        # Fallback: manual JSON (escape quotes and newlines)
        local escaped
        escaped=$(printf '%s' "$context" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')
        printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$escaped"
    fi
}

# Check if kaban CLI is installed
if ! command -v kaban &>/dev/null; then
    output_json "Note: kaban CLI not installed. Install to enable persistent task tracking."
    exit 0
fi

# Get board status
if ! STATUS_OUTPUT=$(kaban status 2>&1); then
    output_json "SessionStart:resume hook success: No kaban board in this directory.
Use \`kaban init\` to create one for persistent task tracking."
    exit 0
fi

# Get in-progress tasks (requires jq)
IN_PROGRESS=""
if command -v jq &>/dev/null; then
    if TASKS_JSON=$(kaban list --column in_progress --json 2>/dev/null); then
        IN_PROGRESS=$(echo "$TASKS_JSON" | jq -r '
            if type == "array" and length > 0 then
                .[:3] | .[] | "- [\(.id[0:8])] \(.title)"
            else
                empty
            end
        ' 2>/dev/null || true)
    fi
fi

# Build context message
CONTEXT="SessionStart:resume hook success: Success
$STATUS_OUTPUT"

if [ -n "$IN_PROGRESS" ]; then
    CONTEXT="$CONTEXT

**In-progress tasks:**
$IN_PROGRESS

Resume these tasks? Use \`kaban list\` for full details."
fi

output_json "$CONTEXT"
exit 0
