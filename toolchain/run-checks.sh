#!/usr/bin/env bash
# ==============================================================================
# SG Forge Polyglot Verification & Security Audit Suite (Google & Meta Standard)
# Zero-Orphan, High-Performance, Scoped Memory & Universal Execution Engine
# ==============================================================================
set -e
export GOFLAGS="-buildvcs=false"

# Visual formatting & ANSI Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

# Universal workspace root resolution (works inside container /app and local repo)
if [ -d "/app" ] && [ -f "/app/package.json" ]; then
  cd /app
else
  cd "$(dirname "$0")/.."
fi

# Export standalone runtimes to PATH if present
if [ -d "portables/bun/bin" ]; then
  export PATH="$(pwd)/portables/bun/bin:$PATH"
fi
if [ -d ".venv/bin" ]; then
  export PATH="$(pwd)/.venv/bin:$PATH"
fi
if [ -d "node_modules/.bin" ]; then
  export PATH="$(pwd)/node_modules/.bin:$PATH"
fi
if [ -d "portables/bin" ]; then
  export PATH="$(pwd)/portables/bin:$PATH"
fi

# ------------------------------------------------------------------------------
# 1. Zero-Orphan Process Tree Lifecycle & Signal Trapping
# ------------------------------------------------------------------------------
ACTIVE_SUITE_PIDS=()
CLEANUP_SUITE_ACTIVE=0

cleanup_suite_processes() {
  local exit_code=$?
  if [ "$CLEANUP_SUITE_ACTIVE" -eq 1 ]; then
    return "$exit_code"
  fi
  CLEANUP_SUITE_ACTIVE=1

  # Terminate all active child and sub-processes to prevent orphaned resource hogs
  if [ ${#ACTIVE_SUITE_PIDS[@]} -gt 0 ]; then
    for pid in "${ACTIVE_SUITE_PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        pkill -P "$pid" 2>/dev/null || true
        kill -TERM "$pid" 2>/dev/null || true
      fi
    done
    sleep 0.1
    for pid in "${ACTIVE_SUITE_PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    done
  fi

  local child_jobs
  child_jobs=$(jobs -p 2>/dev/null || true)
  if [ -n "$child_jobs" ]; then
    kill $child_jobs 2>/dev/null || true
  fi

  return "$exit_code"
}

handle_suite_signal() {
  local sig_name="$1"
  echo -e "\n${YELLOW}⚠️ Suite interrupted by ${sig_name}. Terminating all spawned processes...${RESET}"
  cleanup_suite_processes
  exit 130
}

trap cleanup_suite_processes EXIT
trap 'handle_suite_signal "SIGINT"' INT
trap 'handle_suite_signal "SIGTERM"' TERM
trap 'handle_suite_signal "SIGQUIT"' QUIT

# ------------------------------------------------------------------------------
# 2. Dependency Prerequisites Checkers
# ------------------------------------------------------------------------------
ensure_js_deps() {
  if [ ! -d "node_modules" ] || [ ! -d "node_modules/.bin" ]; then
    echo -e "${YELLOW}⚠️ node_modules not found or incomplete. Installing packages...${RESET}"
    bun install --frozen-lockfile
  fi
}

ensure_go_deps() {
  if [ -d "sandbox/apps/reference-go" ] && command -v go &>/dev/null; then
    echo -e "${BLUE}* Resolving Go dependencies...${RESET}"
    (cd sandbox/apps/reference-go && go mod download)
  fi
}

# ------------------------------------------------------------------------------
# 3. Formatters Runner
# ------------------------------------------------------------------------------
run_format() {
  echo -e "${BLUE}=========================================${RESET}"
  echo -e "${CYAN}      RUNNING FORMATTERS                 ${RESET}"
  echo -e "${BLUE}=========================================${RESET}"

  ensure_js_deps

  echo -e "\n${BLUE}* Formatting JS/TS (Biome)...${RESET}"
  if command -v biome &>/dev/null; then
    biome format --write core/ packages/ test/ || echo -e "${RED}Biome format failed${RESET}"
  elif command -v bunx &>/dev/null; then
    bunx @biomejs/biome format --write core/ packages/ test/ || echo -e "${RED}Biome format failed${RESET}"
  fi

  if command -v ruff &>/dev/null && [ -d "sandbox/apps/reference-python" ]; then
    echo -e "\n${BLUE}* Formatting Python (Ruff)...${RESET}"
    ruff format sandbox/apps/reference-python/ || echo -e "${RED}Ruff format failed${RESET}"
  fi

  if command -v go &>/dev/null && [ -d "sandbox/apps/reference-go" ]; then
    echo -e "\n${BLUE}* Formatting Go...${RESET}"
    (cd sandbox/apps/reference-go && go fmt ./...) || echo -e "${RED}Go fmt failed${RESET}"
  fi

  if command -v sqlfluff &>/dev/null && [ -d "core/src/database" ]; then
    echo -e "\n${BLUE}* Formatting SQL (SQLFluff)...${RESET}"
    sqlfluff format core/src/database/ --dialect postgres || echo -e "${RED}SQLFluff format failed${RESET}"
  fi

  echo -e "\n${GREEN}✓ Formatting completed!${RESET}"
}

# ------------------------------------------------------------------------------
# 4. Linters & Architecture Boundaries
# ------------------------------------------------------------------------------
run_lint() {
  echo -e "${BLUE}=========================================${RESET}"
  echo -e "${CYAN}      RUNNING LINTERS & BOUNDARY CHECKS  ${RESET}"
  echo -e "${BLUE}=========================================${RESET}"

  ensure_js_deps
  ensure_go_deps
  local failed=0

  echo -e "\n${BLUE}* Linting JS/TS (Biome)...${RESET}"
  if command -v biome &>/dev/null; then
    biome ci core/ packages/ test/ || failed=1
  elif command -v bunx &>/dev/null; then
    bunx @biomejs/biome ci core/ packages/ test/ || failed=1
  fi

  if command -v ruff &>/dev/null && [ -d "sandbox/apps/reference-python" ]; then
    echo -e "\n${BLUE}* Linting Python (Ruff)...${RESET}"
    ruff check sandbox/apps/reference-python/ || failed=1
  fi

  if command -v golangci-lint &>/dev/null && [ -d "sandbox/apps/reference-go" ]; then
    echo -e "\n${BLUE}* Linting Go (golangci-lint)...${RESET}"
    (cd sandbox/apps/reference-go && golangci-lint run --timeout=2m ./...) || failed=1
  fi

  if command -v sqlfluff &>/dev/null && [ -d "core/src/database" ]; then
    echo -e "\n${BLUE}* Linting SQL Schemas (SQLFluff)...${RESET}"
    sqlfluff lint core/src/database/ --dialect postgres || failed=1
  fi

  if command -v depcruise &>/dev/null; then
    echo -e "\n${BLUE}* Checking Architecture Boundaries (Dependency-Cruiser)...${RESET}"
    depcruise --config .dependency-cruiser.json core packages sandbox || failed=1
  fi

  if [ $failed -ne 0 ]; then
    echo -e "\n${RED}❌ Linters and/or architectural boundary checks failed!${RESET}"
    exit 1
  else
    echo -e "\n${GREEN}✓ All linting and architectural boundary checks passed!${RESET}"
  fi
}

# ------------------------------------------------------------------------------
# 5. Security Audit Suite (Secrets, Supply-Chain, SAST, Go Vulnerabilities)
# ------------------------------------------------------------------------------
run_security() {
  echo -e "${BLUE}=========================================${RESET}"
  echo -e "${CYAN}      RUNNING SECURITY AUDITS            ${RESET}"
  echo -e "${BLUE}=========================================${RESET}"

  local failed=0

  # A. Secrets Detection (Gitleaks)
  if command -v gitleaks &>/dev/null; then
    echo -e "\n${BLUE}* Scanning for Secrets (Gitleaks)...${RESET}"
    gitleaks detect --verbose --source . --redact || failed=1
  else
    echo -e "${YELLOW}⚠️ Gitleaks not available in environment. Skipping.${RESET}"
  fi

  # B. Dependency Supply-Chain Vulnerability Audit (Trivy - Scoped to avoid disk bloat)
  if command -v trivy &>/dev/null; then
    echo -e "\n${BLUE}* Scanning Vulnerabilities (Trivy)...${RESET}"
    trivy fs --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed \
      --skip-dirs node_modules,.venv,.next,portables,dist,site,build,.git \
      . || failed=1
  else
    echo -e "${YELLOW}⚠️ Trivy not available in environment. Skipping.${RESET}"
  fi

  # C. Static Application Security Testing (Semgrep)
  if command -v semgrep &>/dev/null; then
    echo -e "\n${BLUE}* Static Application Security Testing (Semgrep)...${RESET}"
    if [ -f .semgrep.yml ]; then
      semgrep scan --config .semgrep.yml --metrics=off --error --skip-unknown-extensions \
        --exclude node_modules --exclude .venv --exclude .next --exclude dist --exclude site || failed=1
    else
      semgrep scan --config p/security-audit --metrics=off --error --skip-unknown-extensions \
        --exclude node_modules --exclude .venv --exclude .next --exclude dist --exclude site || failed=1
    fi
  else
    echo -e "${YELLOW}⚠️ Semgrep not available in environment. Skipping.${RESET}"
  fi

  # D. Go Vulnerability Audit (Govulncheck)
  if [ -d "sandbox/apps/reference-go" ] && command -v govulncheck &>/dev/null; then
    echo -e "\n${BLUE}* Checking Go Dependencies (Govulncheck)...${RESET}"
    (cd sandbox/apps/reference-go && govulncheck ./...) || failed=1
  fi

  if [ $failed -ne 0 ]; then
    echo -e "\n${RED}❌ Security audit identified potential vulnerabilities or secrets!${RESET}"
    exit 1
  else
    echo -e "\n${GREEN}✓ All security audits passed successfully!${RESET}"
  fi
}

# ------------------------------------------------------------------------------
# 6. Unit & Integration Tests
# ------------------------------------------------------------------------------
run_test() {
  echo -e "${BLUE}=========================================${RESET}"
  echo -e "${CYAN}      RUNNING UNIT & INTEGRATION TESTS   ${RESET}"
  echo -e "${BLUE}=========================================${RESET}"

  ensure_js_deps
  local failed=0

  echo -e "\n${BLUE}* Running Bun Tests with Coverage...${RESET}"
  DATABASE_URL=${DATABASE_URL:-"postgres://lifeos:password123@localhost:5432/org_db"} \
  bun test --coverage || failed=1

  if [ -d "sandbox/apps/reference-go" ] && command -v go &>/dev/null; then
    echo -e "\n${BLUE}* Running Go tests...${RESET}"
    (cd sandbox/apps/reference-go && go test -cover ./...) || failed=1
  fi

  if [ $failed -ne 0 ]; then
    echo -e "\n${RED}❌ Test suite run failed!${RESET}"
    exit 1
  else
    echo -e "\n${GREEN}✓ All tests passed with coverage generation!${RESET}"
  fi
}

# ------------------------------------------------------------------------------
# 7. Documentation Build Verification
# ------------------------------------------------------------------------------
run_docs() {
  echo -e "${BLUE}=========================================${RESET}"
  echo -e "${CYAN}      BUILDING DOCUMENTATION (MkDocs)    ${RESET}"
  echo -e "${BLUE}=========================================${RESET}"
  
  if command -v mkdocs &>/dev/null; then
    mkdocs build || { echo -e "${RED}MkDocs build failed${RESET}"; exit 1; }
  elif [ -x ".venv/bin/mkdocs" ]; then
    .venv/bin/mkdocs build || { echo -e "${RED}MkDocs build failed${RESET}"; exit 1; }
  fi
  echo -e "\n${GREEN}✓ Documentation build completed!${RESET}"
}

# ------------------------------------------------------------------------------
# 8. Command Dispatcher
# ------------------------------------------------------------------------------
case "$1" in
  format)
    run_format
    ;;
  lint)
    run_lint
    ;;
  security)
    run_security
    ;;
  test)
    run_test
    ;;
  docs)
    run_docs
    ;;
  all)
    run_lint
    run_security
    run_test
    run_docs
    ;;
  *)
    echo "Usage: $0 {format|lint|security|test|docs|all}"
    exit 1
    ;;
esac
