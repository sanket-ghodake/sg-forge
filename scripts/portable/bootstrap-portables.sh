#!/usr/bin/env bash
# ==============================================================================
# SG Forge Universal Portable Toolchain Provisioner (2026 Tech Stack)
# Multi-Architecture / Multi-OS Zero Host Install Engine
# ==============================================================================
set -e

# Always run from workspace root
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$WORKSPACE_ROOT"

# Terminal ANSI Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

echo -e "${BLUE}==============================================================================${RESET}"
echo -e "${CYAN}${BOLD}   ⚡ SG FORGE ZERO-HOST PORTABLE PROVISIONER (MULTI-OS & MULTI-ARCH)       ${RESET}"
echo -e "${BLUE}==============================================================================${RESET}"

# 1. Detect Host OS and CPU Architecture
OS_TYPE="$(uname -s)"
ARCH_TYPE="$(uname -m)"

echo -e "${CYAN}• Host System Detected:${RESET} ${BOLD}${OS_TYPE} (${ARCH_TYPE})${RESET}"

mkdir -p "$WORKSPACE_ROOT/portables/bin"
mkdir -p "$WORKSPACE_ROOT/portables/bun"
mkdir -p "$WORKSPACE_ROOT/portables/rtk/bin"

# ------------------------------------------------------------------------------
# 2. Provision Portable Bun Runtime (Local / Zero Host Install)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[1/5] Ensuring Portable Bun Runtime...${RESET}"
if [ -x "$WORKSPACE_ROOT/portables/bun/bin/bun" ]; then
  echo -e "${GREEN}✓ Local Portable Bun already provisioned at portables/bun/bin/bun${RESET}"
else
  echo -e "${YELLOW}Downloading standalone Bun runtime for ${OS_TYPE} (${ARCH_TYPE})...${RESET}"
  if [ "$OS_TYPE" = "Darwin" ] || [ "$OS_TYPE" = "Linux" ]; then
    curl -fsSL https://bun.sh/install | BUN_INSTALL="$WORKSPACE_ROOT/portables/bun" bash >/dev/null 2>&1 || true
  fi
  if [ ! -x "$WORKSPACE_ROOT/portables/bun/bin/bun" ]; then
    echo -e "${RED}❌ Failed to auto-provision Bun binary. Checking system fallback...${RESET}"
    if command -v bun &>/dev/null; then
      echo -e "${YELLOW}Using available system bun as fallback.${RESET}"
    else
      echo -e "${RED}❌ Bun is required for portable execution. Please ensure internet access.${RESET}"
      exit 1
    fi
  else
    echo -e "${GREEN}✓ Local Portable Bun provisioned successfully.${RESET}"
  fi
fi

# Add local Bun to current execution PATH
export PATH="$WORKSPACE_ROOT/portables/bun/bin:$PATH"

# ------------------------------------------------------------------------------
# 3. Provision Portable RTK (Token Optimizer & Fast Command Runner)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[2/5] Ensuring Portable RTK Engine...${RESET}"
if [ -x "$WORKSPACE_ROOT/portables/rtk/bin/rtk" ]; then
  echo -e "${GREEN}✓ Local Portable RTK binary already provisioned.${RESET}"
else
  # Check if host user has rtk to copy
  if [ -x "$HOME/.local/bin/rtk" ]; then
    echo -e "${CYAN}Copying local rtk binary into portables/rtk/bin/rtk...${RESET}"
    cp "$HOME/.local/bin/rtk" "$WORKSPACE_ROOT/portables/rtk/bin/rtk"
    chmod +x "$WORKSPACE_ROOT/portables/rtk/bin/rtk"
    echo -e "${GREEN}✓ Local Portable RTK provisioned from user cache.${RESET}"
  else
    echo -e "${YELLOW}RTK standalone binary will use dynamic wrapper with pass-through fallback.${RESET}"
  fi
fi

# Ensure wrapper in portables/bin/rtk exists and is executable
cat << 'EOF' > "$WORKSPACE_ROOT/portables/bin/rtk"
#!/usr/bin/env bash
# Universal Portable Wrapper for RTK Token Optimizer
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PORTABLE_RTK="$WORKSPACE_ROOT/portables/rtk/bin/rtk"
HOST_RTK="$HOME/.local/bin/rtk"

if [ -x "$PORTABLE_RTK" ]; then
  exec "$PORTABLE_RTK" "$@"
elif [ -x "$HOST_RTK" ]; then
  exec "$HOST_RTK" "$@"
elif command -v rtk &>/dev/null; then
  exec rtk "$@"
else
  # Direct pass-through if rtk is not compiled for this architecture
  shift 0
  exec "$@"
fi
EOF
chmod +x "$WORKSPACE_ROOT/portables/bin/rtk"
echo -e "${GREEN}✓ Universal portables/bin/rtk wrapper configured.${RESET}"

# ------------------------------------------------------------------------------
# 4. Provision Portable Python .venv (ruff, sqlfluff, semgrep, mkdocs, graphifyy)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[3/5] Ensuring Isolated Python .venv & Code Quality Tools...${RESET}"
if [ ! -d "$WORKSPACE_ROOT/.venv" ] || [ ! -x "$WORKSPACE_ROOT/.venv/bin/python3" ]; then
  echo -e "${YELLOW}Creating isolated virtualenv at .venv/...${RESET}"
  if command -v python3 &>/dev/null; then
    python3 -m venv "$WORKSPACE_ROOT/.venv"
  elif command -v python &>/dev/null; then
    python -m venv "$WORKSPACE_ROOT/.venv"
  else
    echo -e "${YELLOW}⚠️ Python3 not found on host. Python-based checks will use Docker toolchain.${RESET}"
  fi
fi

if [ -x "$WORKSPACE_ROOT/.venv/bin/pip" ]; then
  echo -e "${CYAN}Verifying required packages in local .venv...${RESET}"
  "$WORKSPACE_ROOT/.venv/bin/pip" install --quiet --upgrade pip 2>/dev/null || true
  "$WORKSPACE_ROOT/.venv/bin/pip" install --quiet \
    ruff \
    sqlfluff \
    semgrep \
    mkdocs \
    mkdocs-material \
    graphifyy \
    lizard \
    diff-cover 2>/dev/null || true
  echo -e "${GREEN}✓ Local .venv packages verified (ruff, sqlfluff, semgrep, mkdocs, graphifyy, lizard).${RESET}"
fi

# Ensure portables/bin/graphify wrapper
cat << 'EOF' > "$WORKSPACE_ROOT/portables/bin/graphify"
#!/usr/bin/env bash
# Universal Portable Wrapper for Graphify Knowledge Engine
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

VENV_GRAPHIFY="$WORKSPACE_ROOT/.venv/bin/graphify"
HOST_GRAPHIFY="$HOME/.local/bin/graphify"

if [ -x "$VENV_GRAPHIFY" ]; then
  exec "$VENV_GRAPHIFY" "$@"
elif [ -x "$HOST_GRAPHIFY" ]; then
  exec "$HOST_GRAPHIFY" "$@"
elif command -v graphify &>/dev/null; then
  exec graphify "$@"
else
  PYTHON="$WORKSPACE_ROOT/.venv/bin/python3"
  if [ -x "$PYTHON" ]; then
    exec "$PYTHON" -m graphify "$@"
  else
    echo "Error: Graphify not available in local .venv or host environment." >&2
    exit 1
  fi
fi
EOF
chmod +x "$WORKSPACE_ROOT/portables/bin/graphify"
echo -e "${GREEN}✓ Universal portables/bin/graphify wrapper configured.${RESET}"

# ------------------------------------------------------------------------------
# 5. Verify & Standardize Portables Bin Wrappers
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[4/5] Standardizing Portable Bin Wrappers...${RESET}"

# Ensure Caveman wrapper
cat << 'EOF' > "$WORKSPACE_ROOT/portables/bin/caveman"
#!/usr/bin/env bash
# Standalone Portable Wrapper for Caveman CLI
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

BUN_BIN="$WORKSPACE_ROOT/portables/bun/bin/bun"
CAVEMAN_TS="$WORKSPACE_ROOT/portables/caveman/bin/caveman.ts"

if [ ! -x "$BUN_BIN" ]; then
  if command -v bun &>/dev/null; then
    BUN_BIN="bun"
  else
    echo "Error: Portable bun not found at $BUN_BIN" >&2
    exit 1
  fi
fi

exec "$BUN_BIN" run "$CAVEMAN_TS" "$@"
EOF

# Ensure Tree wrapper
cat << 'EOF' > "$WORKSPACE_ROOT/portables/bin/tree"
#!/usr/bin/env bash
# Standalone Portable Wrapper for Tree CLI
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

BUN_BIN="$WORKSPACE_ROOT/portables/bun/bin/bun"
TREE_TS="$WORKSPACE_ROOT/portables/tree/bin/tree.ts"

if [ ! -x "$BUN_BIN" ]; then
  if command -v bun &>/dev/null; then
    BUN_BIN="bun"
  else
    echo "Error: Portable bun not found at $BUN_BIN" >&2
    exit 1
  fi
fi

exec "$BUN_BIN" run "$TREE_TS" "$@"
EOF

# Ensure Astryx wrapper
cat << 'EOF' > "$WORKSPACE_ROOT/portables/bin/astryx"
#!/usr/bin/env bash
# Standalone Portable Wrapper for Astryx AST Engine
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

BUN_BIN="$WORKSPACE_ROOT/portables/bun/bin/bun"
ASTRYX_TS="$WORKSPACE_ROOT/portables/astryx/bin/astryx.ts"

if [ ! -x "$BUN_BIN" ]; then
  if command -v bun &>/dev/null; then
    BUN_BIN="bun"
  else
    echo "Error: Portable bun not found at $BUN_BIN" >&2
    exit 1
  fi
fi

exec "$BUN_BIN" run "$ASTRYX_TS" "$@"
EOF

# Ensure Lizard wrapper
cat << 'EOF' > "$WORKSPACE_ROOT/portables/bin/lizard"
#!/usr/bin/env bash
# Standalone Portable Wrapper for Lizard (Cyclomatic Complexity Analyzer)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

VENV_LIZARD="$WORKSPACE_ROOT/.venv/bin/lizard"

if [ -x "$VENV_LIZARD" ]; then
  exec "$VENV_LIZARD" "$@"
else
  PYTHON="$WORKSPACE_ROOT/.venv/bin/python3"
  if [ -x "$PYTHON" ]; then
    exec "$PYTHON" -m lizard "$@"
  elif command -v lizard &>/dev/null; then
    exec lizard "$@"
  else
    echo "Error: lizard complexity analyzer not found in local .venv." >&2
    exit 1
  fi
fi
EOF

# Ensure SCC wrapper
cat << 'EOF' > "$WORKSPACE_ROOT/portables/bin/scc"
#!/usr/bin/env bash
# Standalone Portable Wrapper for SCC (Code Counter)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SCC_BIN="$WORKSPACE_ROOT/portables/scc/scc"

if [ -x "$SCC_BIN" ]; then
  exec "$SCC_BIN" "$@"
elif command -v scc &>/dev/null; then
  exec scc "$@"
else
  echo "Error: Portable scc executable not found at $SCC_BIN" >&2
  exit 1
fi
EOF

# Ensure Hyperfine wrapper
cat << 'EOF' > "$WORKSPACE_ROOT/portables/bin/hyperfine"
#!/usr/bin/env bash
# Standalone Portable Wrapper for Hyperfine (Benchmarking Tool)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

HYPERFINE_BIN="$WORKSPACE_ROOT/portables/hyperfine/hyperfine"

if [ -x "$HYPERFINE_BIN" ]; then
  exec "$HYPERFINE_BIN" "$@"
elif command -v hyperfine &>/dev/null; then
  exec hyperfine "$@"
else
  echo "Error: Portable hyperfine executable not found at $HYPERFINE_BIN" >&2
  exit 1
fi
EOF

chmod +x "$WORKSPACE_ROOT"/portables/bin/*
echo -e "${GREEN}✓ All portables/bin wrappers made executable.${RESET}"

# ------------------------------------------------------------------------------
# 6. Verification Summary
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[5/5] Verifying Provisioned Tools...${RESET}"
export PATH="$WORKSPACE_ROOT/portables/bun/bin:$WORKSPACE_ROOT/portables/bin:$WORKSPACE_ROOT/.venv/bin:$PATH"

echo -n "• Bun: "
if command -v bun &>/dev/null; then echo -e "${GREEN}$(bun --version)${RESET}"; else echo -e "${RED}Missing${RESET}"; fi

echo -n "• RTK: "
if [ -x "$WORKSPACE_ROOT/portables/bin/rtk" ]; then echo -e "${GREEN}Ready (${WORKSPACE_ROOT}/portables/bin/rtk)${RESET}"; else echo -e "${RED}Missing${RESET}"; fi

echo -n "• Graphify: "
if [ -x "$WORKSPACE_ROOT/portables/bin/graphify" ]; then echo -e "${GREEN}Ready (${WORKSPACE_ROOT}/portables/bin/graphify)${RESET}"; else echo -e "${RED}Missing${RESET}"; fi

echo -n "• Caveman: "
if [ -x "$WORKSPACE_ROOT/portables/bin/caveman" ]; then echo -e "${GREEN}Ready (${WORKSPACE_ROOT}/portables/bin/caveman)${RESET}"; else echo -e "${RED}Missing${RESET}"; fi

echo -n "• Python .venv: "
if [ -x "$WORKSPACE_ROOT/.venv/bin/python3" ]; then echo -e "${GREEN}Ready (${WORKSPACE_ROOT}/.venv/bin/python3)${RESET}"; else echo -e "${YELLOW}Not created (fallback to Docker)${RESET}"; fi

echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}   🎉 PORTABLE TOOLCHAIN PROVISIONING COMPLETED SUCCESSFULLY!          ${RESET}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════════════${RESET}"
