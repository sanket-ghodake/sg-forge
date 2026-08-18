#!/usr/bin/env bash
set -e

# Always execute from the repository root directory
cd "$(dirname "$0")/.."

# Check if portable scc executable exists
if [ -f "portables/scc/scc" ]; then
  SCC_CMD="portables/scc/scc"
elif command -v scc &>/dev/null; then
  SCC_CMD="scc"
else
  echo "Error: scc executable not found in portables/scc/scc or PATH" >&2
  exit 1
fi

echo "================================================================="
echo "        SG FORGE ACCURATE SOURCE CODE METRICS MATRIX             "
echo "================================================================="
echo "Excluding node_modules, portables, .next, dist, .venv, and compiled browser bundles..."
echo ""

$SCC_CMD --exclude-dir node_modules,portables,dist,.next,graphify-out,.venv,.node_env,out,build,site,logs --exclude-file dashboard.js,forge-sdk.js "$@" .
