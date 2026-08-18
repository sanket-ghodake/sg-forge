#!/usr/bin/env bash
set -e
export GOFLAGS="-buildvcs=false"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

# Run from workspace root inside container
cd /app

# Ensure dependencies are installed for JS/TS
ensure_js_deps() {
  if [ ! -d "node_modules" ] || [ ! -d "node_modules/.bin" ]; then
    echo -e "${YELLOW}⚠️ node_modules not found or incomplete. Installing packages...${RESET}"
    bun install --frozen-lockfile
  fi
}

# Ensure dependencies are downloaded for Go
ensure_go_deps() {
  if [ -d "sandbox/apps/reference-go" ]; then
    echo -e "${BLUE}* Resolving Go dependencies...${RESET}"
    (cd sandbox/apps/reference-go && go mod download)
  fi
}


run_format() {
  echo -e "${BLUE}=========================================${RESET}"
  echo -e "${CYAN}      RUNNING FORMATTERS                 ${RESET}"
  echo -e "${BLUE}=========================================${RESET}"

  ensure_js_deps

  echo -e "\n${BLUE}* Formatting JS/TS (Biome)...${RESET}"
  if command -v biome &>/dev/null; then
    biome format --write core/ packages/ test/ || echo -e "${RED}Biome format failed${RESET}"
  else
    bunx @biomejs/biome format --write core/ packages/ test/ || echo -e "${RED}Biome format failed${RESET}"
  fi

  echo -e "\n${BLUE}* Formatting Python (Ruff)...${RESET}"
  ruff format sandbox/apps/reference-python/ || echo -e "${RED}Ruff format failed${RESET}"

  if command -v go &>/dev/null && [ -d "sandbox/apps/reference-go" ]; then
    echo -e "\n${BLUE}* Formatting Go...${RESET}"
    (cd sandbox/apps/reference-go && go fmt ./...) || echo -e "${RED}Go fmt failed${RESET}"
  fi

  echo -e "\n${BLUE}* Formatting SQL (SQLFluff)...${RESET}"
  sqlfluff format core/src/database/ --dialect postgres || echo -e "${RED}SQLFluff format failed${RESET}"

  echo -e "${GREEN}✓ Formatting completed!${RESET}"
}

run_lint() {
  echo -e "${BLUE}=========================================${RESET}"
  echo -e "${CYAN}      RUNNING LINTERS & BOUNDARY CHECKS  ${RESET}"
  echo -e "${BLUE}=========================================${RESET}"

  ensure_js_deps
  ensure_go_deps
  FAILED=0

  echo -e "\n${BLUE}* Linting JS/TS (Biome)...${RESET}"
  if command -v biome &>/dev/null; then
    biome ci core/ packages/ test/ || FAILED=1
  else
    bunx @biomejs/biome ci core/ packages/ test/ || FAILED=1
  fi

  echo -e "\n${BLUE}* Linting Python (Ruff)...${RESET}"
  ruff check sandbox/apps/reference-python/ || FAILED=1

  if [ -d "sandbox/apps/reference-go" ]; then
    echo -e "\n${BLUE}* Linting Go (golangci-lint)...${RESET}"
    (cd sandbox/apps/reference-go && golangci-lint run --timeout=5m ./...) || FAILED=1
  fi

  echo -e "\n${BLUE}* Linting SQL Schemas (SQLFluff)...${RESET}"
  sqlfluff lint core/src/database/ --dialect postgres || FAILED=1

  echo -e "\n${BLUE}* Checking Architecture Boundaries (Dependency-Cruiser)...${RESET}"
  depcruise --config .dependency-cruiser.json core packages sandbox || FAILED=1

  if [ $FAILED -ne 0 ]; then
    echo -e "\n${RED}❌ Linters and/or architectural checks failed!${RESET}"
    exit 1
  else
    echo -e "\n${GREEN}✓ All linting and architectural boundary checks passed!${RESET}"
  fi
}

run_security() {
  echo -e "${BLUE}=========================================${RESET}"
  echo -e "${CYAN}      RUNNING SECURITY AUDITS            ${RESET}"
  echo -e "${BLUE}=========================================${RESET}"

  FAILED=0

  echo -e "\n${BLUE}* Scanning for Secrets (Gitleaks)...${RESET}"
  # Run gitleaks locally on workspace filesystem
  gitleaks detect --verbose --source . --redact || FAILED=1

  echo -e "\n${BLUE}* Scanning Vulnerabilities (Trivy)...${RESET}"
  # Check lockfiles, filesystem dependencies, and container configs
  trivy fs --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed . || FAILED=1

  echo -e "\n${BLUE}* Static Application Security Testing (Semgrep)...${RESET}"
  # Scan source code for insecure postMessage origins or SQL vulnerabilities
  if [ -f .semgrep.yml ]; then
    semgrep scan --config .semgrep.yml --metrics=off || FAILED=1
  else
    semgrep scan --config auto --metrics=off || FAILED=1
  fi

  if [ -d "sandbox/apps/reference-go" ]; then
    echo -e "\n${BLUE}* Checking Go Dependencies (Govulncheck)...${RESET}"
    (cd sandbox/apps/reference-go && govulncheck ./...) || FAILED=1
  fi

  if [ $FAILED -ne 0 ]; then
    echo -e "\n${RED}❌ Security scan identified potential vulnerabilities or leaks!${RESET}"
    exit 1
  else
    echo -e "\n${GREEN}✓ All security audits passed successfully!${RESET}"
  fi
}

run_test() {
  echo -e "${BLUE}=========================================${RESET}"
  echo -e "${CYAN}      RUNNING UNIT & INTEGRATION TESTS   ${RESET}"
  echo -e "${BLUE}=========================================${RESET}"

  ensure_js_deps
  FAILED=0

  echo -e "\n${BLUE}* Running Bun Tests with Coverage...${RESET}"
  # Mock environment variable for database URL so test suite executes
  DATABASE_URL=${DATABASE_URL:-"postgres://lifeos:password123@localhost:5432/org_db"} \
  bun test --coverage || FAILED=1

  if [ -d "sandbox/apps/reference-go" ]; then
    echo -e "\n${BLUE}* Running Go tests...${RESET}"
    (cd sandbox/apps/reference-go && go test -cover ./...) || FAILED=1
  fi

  if [ $FAILED -ne 0 ]; then
    echo -e "\n${RED}❌ Test suite run failed!${RESET}"
    exit 1
  else
    echo -e "\n${GREEN}✓ All tests passed with coverage generation!${RESET}"
  fi
}

run_docs() {
  echo -e "${BLUE}=========================================${RESET}"
  echo -e "${CYAN}      BUILDING DOCUMENTATION (MkDocs)    ${RESET}"
  echo -e "${BLUE}=========================================${RESET}"
  mkdocs build || { echo -e "${RED}MkDocs build failed${RESET}"; exit 1; }
  echo -e "${GREEN}✓ Documentation build completed!${RESET}"
}

# Command dispatching
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

