#!/usr/bin/env bash
# Token-efficient log appender
# Usage: ./.agents/hooks/append-log.sh "brief summary"

LOG_FILE="logs/WORKLOGS.md"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M")

if [ ! -f "$LOG_FILE" ]; then
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "# WORKLOGS" > "$LOG_FILE"
    echo "" >> "$LOG_FILE"
fi

# Ensure file ends with a newline character before appending
if [ -s "$LOG_FILE" ] && [ "$(tail -c 1 "$LOG_FILE")" != $'\n' ]; then
    echo "" >> "$LOG_FILE"
fi

# Remove trailing empty lines
sed -i -e :a -e '/^\n*$/{$d;N;ba' -e '}' "$LOG_FILE" 2>/dev/null || true

echo "$TIMESTAMP | $1" >> "$LOG_FILE"


