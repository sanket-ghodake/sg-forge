#!/usr/bin/env bash
# Move to workspace root
cd "$(dirname "$0")/../../.."

# Delegate to unified root orchestrator setup
exec ./run.sh setup

