#!/usr/bin/env bash
# ==============================================================================
# Enterprise Pre-Commit Quality & Security Gate (Google-Grade Architecture)
# ==============================================================================
set -e

# Visual colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

echo -e "${BLUE}==============================================================================${RESET}"
echo -e "${CYAN}${BOLD}   ⚡ ENTERPRISE PRE-COMMIT VALIDATION SUITE (GOOGLE-GRADE STANDARDS)       ${RESET}"
echo -e "${BLUE}==============================================================================${RESET}"

# Ensure execution from repository root
cd "$(dirname "$0")/.."

# Export standalone runtimes to PATH
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
# 1. Identify all staged files (excluding deletions)
# ------------------------------------------------------------------------------
STAGED_FILES=()
while IFS= read -r line; do
  [ -n "$line" ] && STAGED_FILES+=("$line")
done < <(git diff --cached --name-only --diff-filter=d 2>/dev/null || true)

if [ ${#STAGED_FILES[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ No staged files found. Skipping pre-commit checks.${RESET}"
  exit 0
fi

# ------------------------------------------------------------------------------
# 2. LAYER 0: Instant In-Memory Hygiene & Security Guards (< 20ms)
# ------------------------------------------------------------------------------
L0_FAILED=0
L0_ERRORS=()

# A. Sensitive file / credential file blocklist
for file in "${STAGED_FILES[@]}"; do
  # Block un-templated .env files
  if [[ "$file" =~ (^|/)\.env(\.[a-zA-Z0-9_-]+)?$ && "$file" != *".example"* && "$file" != *".template"* ]]; then
    L0_ERRORS+=("❌ Prohibited environment secret file staged: '$file' (Use .env.example instead)")
    L0_FAILED=1
  fi
  # Block private keys, keystores, and certificate stores
  if [[ "$file" =~ \.(pem|key|pkcs12|pfx|p12|kdbx|keystore|jks)$ ]]; then
    L0_ERRORS+=("❌ Prohibited private key / certificate archive staged: '$file'")
    L0_FAILED=1
  fi
  # Block standard SSH key basenames
  if [[ "$file" =~ (^|/)(id_rsa|id_dsa|id_ed25519|id_ecdsa)(|\.pub)$ ]]; then
    L0_ERRORS+=("❌ Prohibited SSH key file staged: '$file'")
    L0_FAILED=1
  fi
  # Block binary SQLite / database dumps in source tracking
  if [[ "$file" =~ \.(sqlite|sqlite3|db|dump|sql\.gz)$ && ! "$file" =~ ^(test|fixtures)/ ]]; then
    L0_ERRORS+=("❌ Prohibited database dump / binary SQLite staged: '$file'")
    L0_FAILED=1
  fi
done

# B. Large staged file limit (Max 1024 KB to prevent permanent git bloat)
MAX_FILE_BYTES=1048576
for file in "${STAGED_FILES[@]}"; do
  if [ -f "$file" ]; then
    size_bytes=$(git cat-file -s ":$file" 2>/dev/null || wc -c < "$file" 2>/dev/null || echo 0)
    if [ "$size_bytes" -gt "$MAX_FILE_BYTES" ]; then
      size_kb=$((size_bytes / 1024))
      L0_ERRORS+=("❌ Staged file exceeds maximum repository limit (1024 KB): '$file' (${size_kb} KB)")
      L0_FAILED=1
    fi
  fi
done

# C. Merge conflict markers
if git diff --cached 2>/dev/null | grep -qE '^\+(<{7}( .+)?|={7}[[:space:]]*$|>{7}( .+)?|\|{7}( .+)?)'; then
  L0_ERRORS+=("❌ Merge conflict markers detected in staged changes! Resolve conflicts before committing.")
  L0_FAILED=1
fi

# D. Trojan Source & Invisible Unicode Injection (CVE-2021-42574)
PYTHON_BIN="python3"
if [ -f ".venv/bin/python3" ]; then
  PYTHON_BIN=".venv/bin/python3"
fi

if command -v "$PYTHON_BIN" &>/dev/null; then
  BIDI_CHECK=$(git diff --cached -U0 2>/dev/null | "$PYTHON_BIN" -c '
import sys, re
# Target CVE-2021-42574 BiDi override & isolate injection attacks
bidi_pattern = re.compile(r"[\u202A-\u202E\u2066-\u2069\u200B\u200E\u200F]")
errors = []
cur_file = ""
for line in sys.stdin:
    if line.startswith("+++ b/"):
        cur_file = line.strip()[6:]
    elif line.startswith("+") and not line.startswith("+++"):
        matches = bidi_pattern.findall(line)
        if matches:
            errors.append(f"{cur_file}: dangerous unicode codepoints {[hex(ord(c)) for c in matches]}")
if errors:
    print(f"Found {len(errors)} dangerous unicode occurrences: {errors[:3]}")
    sys.exit(1)
' 2>&1) || {
    L0_ERRORS+=("❌ Trojan Source / Invisible Unicode characters detected (CVE-2021-42574) in staged diffs: $BIDI_CHECK")
    L0_FAILED=1
  }
fi

# E. File Mode / Executable Bit Hygiene
# Detect accidental chmod +x on non-script files
while IFS= read -r stage_entry; do
  if [ -n "$stage_entry" ]; then
    mode=$(echo "$stage_entry" | awk '{print $1}')
    fpath=$(echo "$stage_entry" | awk '{print $4}')
    if [ "$mode" = "100755" ]; then
      if [[ ! "$fpath" =~ \.(sh|py|bat|cmd)$ && ! "$fpath" =~ ^(\.husky/|scripts/|portables/) ]]; then
        L0_ERRORS+=("❌ Non-script file has executable permission bit set (mode 100755): '$fpath' (Run: chmod 644 '$fpath')")
        L0_FAILED=1
      fi
    fi
  fi
done < <(git ls-files --stage -- "${STAGED_FILES[@]}")

# F. Case Collision Detection (Monorepo Cross-Platform Protection)
declare -A LOWERCASE_MAP
for file in "${STAGED_FILES[@]}"; do
  lower_name=$(echo "$file" | tr '[:upper:]' '[:lower:]')
  if [ -n "${LOWERCASE_MAP[$lower_name]}" ] && [ "${LOWERCASE_MAP[$lower_name]}" != "$file" ]; then
    L0_ERRORS+=("❌ Case-collision detected: '$file' and '${LOWERCASE_MAP[$lower_name]}' differ only in casing")
    L0_FAILED=1
  fi
  LOWERCASE_MAP[$lower_name]="$file"
done

# G. Stale Loose Files & MkDocs Navigation Sync
for file in "${STAGED_FILES[@]}"; do
  if [[ "$file" =~ ^[^/]+\.(py|tmp|bak|log)$ && "$file" != "run.sh" ]]; then
    L0_ERRORS+=("❌ Stale loose file in repository root: '$file' (violates Core Rule 9)")
    L0_FAILED=1
  fi
  if [[ "$file" == "core/src/backend/dev-dashboard/dashboard.js" ]]; then
    L0_ERRORS+=("❌ Generated runtime bundle tracked in git: '$file'")
    L0_FAILED=1
  fi
  if [[ "$file" =~ ^docs/.*\.md$ && "$file" != "docs/index.md" && ! "$file" =~ ^docs/archive/ ]]; then
    rel_doc="${file#docs/}"
    if [ -f "mkdocs.yml" ] && ! grep -q "$rel_doc" mkdocs.yml; then
      L0_ERRORS+=("❌ Staged markdown document missing from mkdocs.yml navigation index: '$file'")
      L0_FAILED=1
    fi
  fi
done

# H. Relative Import Enforcer (Shift-Left Architectural Hygiene)
for file in "${STAGED_FILES[@]}"; do
  if [[ "$file" =~ \.(ts|tsx|js|jsx)$ && "$file" != "test/unit/relativeImports.test.ts" && ! "$file" =~ ^test/apps/ && ! "$file" =~ ^scripts/replace-relative-imports ]]; then
    if [ -f "$file" ]; then
      rel_violations=$(grep -nE "(from[[:space:]]+|import[[:space:]]*\(|require[[:space:]]*\()[[:space:]]*[\'\"][.][.]?/" "$file" 2>/dev/null | grep -vE '\.(css|scss|sass)' || true)
      if [ -n "$rel_violations" ]; then
        L0_ERRORS+=("❌ Relative import path detected in '$file' (Use path alias @/... instead):")
        while IFS= read -r vline; do
          [ -n "$vline" ] && L0_ERRORS+=("     $vline")
        done <<< "$rel_violations"
        L0_FAILED=1
      fi
    fi
  fi
done

if [ $L0_FAILED -ne 0 ]; then
  echo -e "\n${RED}${BOLD}==============================================================================${RESET}"
  echo -e "${RED}${BOLD}   🚨 LAYER 0 HYGIENE & REPOSITORY INTEGRITY CHECKS FAILED                   ${RESET}"
  echo -e "${RED}${BOLD}==============================================================================${RESET}"
  for err in "${L0_ERRORS[@]}"; do
    echo -e "  ${RED}$err${RESET}"
  done
  echo -e "${RED}==============================================================================${RESET}"
  exit 1
fi

echo -e "${GREEN}✓ Layer 0: Hygiene, Secrets, Trojan Source, and Integrity checks passed (0ms).${RESET}"

# ------------------------------------------------------------------------------
# 3. Categorize staged files for Language-Specific AST Linters & Security
# ------------------------------------------------------------------------------
STAGED_JS_TS=()
STAGED_PY=()
STAGED_SQL=()
STAGED_GO=()
STAGED_DEPS_SRC=()
LOCKFILES_CHANGED=false
GO_DEPS_CHANGED=false
STAGED_LOCKFILES=()

for file in "${STAGED_FILES[@]}"; do
  if [[ "$file" =~ \.(js|jsx|ts|tsx|json|css)$ ]]; then
    STAGED_JS_TS+=("$file")
  fi
  if [[ "$file" =~ \.py$ ]]; then
    STAGED_PY+=("$file")
  fi
  if [[ "$file" =~ \.sql$ ]]; then
    STAGED_SQL+=("$file")
  fi
  if [[ "$file" =~ \.go$ ]]; then
    STAGED_GO+=("$file")
  fi
  if [[ "$file" =~ ^(core|packages|sandbox)/.*\.(js|jsx|ts|tsx)$ ]]; then
    STAGED_DEPS_SRC+=("$file")
  fi
  if [[ "$file" == "package-lock.json" || "$file" == "bun.lock" || "$file" == "package.json" ]]; then
    LOCKFILES_CHANGED=true
    STAGED_LOCKFILES+=("$file")
  fi
  if [[ "$file" == "sandbox/apps/reference-go/go.mod" || "$file" == "sandbox/apps/reference-go/go.sum" ]]; then
    GO_DEPS_CHANGED=true
  fi
done

# ------------------------------------------------------------------------------
# 4. Check tool availability
# ------------------------------------------------------------------------------
HAS_DOCKER=false
if command -v docker &>/dev/null; then
  HAS_DOCKER=true
fi

has_biome() { command -v biome &>/dev/null || command -v bunx &>/dev/null; }
has_ruff() { command -v ruff &>/dev/null; }
has_sqlfluff() { command -v sqlfluff &>/dev/null; }
has_depcruise() { command -v depcruise &>/dev/null; }
has_go() { command -v golangci-lint &>/dev/null && command -v go &>/dev/null; }
has_gitleaks() { command -v gitleaks &>/dev/null; }
has_semgrep() { command -v semgrep &>/dev/null; }
has_trivy() { command -v trivy &>/dev/null; }
has_govulncheck() { command -v govulncheck &>/dev/null && command -v go &>/dev/null; }
has_tsc() { command -v tsc &>/dev/null; }

# Determine which checks need container fallback
NEED_CONTAINER=false
CONTAINER_COMMANDS=()
CONTAINER_JOB_NAMES=()

ensure_docker_image() {
  if [ "$HAS_DOCKER" = true ]; then
    if ! docker image inspect sgforge-toolchain:latest &>/dev/null; then
      echo -e "${BLUE}Building toolchain container image...${RESET}"
      docker compose -f toolchain/docker-compose.yml build toolchain
    fi
  else
    echo -e "${YELLOW}⚠️ Warning: Docker is not running or not installed, but some checks require container fallback.${RESET}"
  fi
}

# ------------------------------------------------------------------------------
# 5. Check Runners (Local native execution)
# ------------------------------------------------------------------------------
check_biome() {
  if command -v biome &>/dev/null; then
    biome ci "${STAGED_JS_TS[@]}"
  elif command -v bunx &>/dev/null; then
    bunx @biomejs/biome ci "${STAGED_JS_TS[@]}"
  fi
}

check_ruff() {
  ruff check "${STAGED_PY[@]}" && ruff format --check "${STAGED_PY[@]}"
}

check_sqlfluff() {
  sqlfluff lint "${STAGED_SQL[@]}" --dialect postgres
}

check_depcruise() {
  depcruise --config .dependency-cruiser.json "${STAGED_DEPS_SRC[@]}"
}

check_golangci() {
  (cd sandbox/apps/reference-go && golangci-lint run --timeout=5m ./...)
}

check_gitleaks() {
  gitleaks protect --staged --verbose --redact
}

check_semgrep() {
  if [ -f .semgrep.yml ]; then
    semgrep scan --config .semgrep.yml --metrics=off --error --skip-unknown-extensions "${sast_files[@]}"
  else
    semgrep scan --config p/security-audit --metrics=off --error --skip-unknown-extensions "${sast_files[@]}"
  fi
}

check_trivy() {
  local failed=0
  for lockfile in "${STAGED_LOCKFILES[@]}"; do
    echo -e "${BLUE}Scanning $lockfile...${RESET}"
    trivy fs --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed "$lockfile" || failed=1
  done
  return $failed
}

check_govulncheck() {
  (cd sandbox/apps/reference-go && govulncheck ./...)
}

check_tsc() {
  local staged_ts_src=()
  for file in "${STAGED_JS_TS[@]}"; do
    if [[ "$file" =~ ^(core/src|packages)/.*\.tsx?$ ]]; then
      staged_ts_src+=("$file")
    fi
  done
  
  if [ ${#staged_ts_src[@]} -eq 0 ]; then
    return 0
  fi
  
  local failed=0
  local errors=()

  # 1. Frontend tsc check if frontend files staged
  local has_frontend=false
  for file in "${staged_ts_src[@]}"; do
    if [[ "$file" =~ ^core/src/frontend/ ]]; then
      has_frontend=true
      break
    fi
  done

  if [ "$has_frontend" = true ]; then
    local fe_output
    fe_output=$(cd core/src/frontend && tsc --noEmit 2>&1) || true
    while IFS= read -r line; do
      if [ -n "$line" ]; then
        for file in "${staged_ts_src[@]}"; do
          local rel_fe="${file#core/src/frontend/}"
          if [[ "$line" == *"$rel_fe"* || "$line" == *"$file"* ]]; then
            errors+=("$line")
            failed=1
          fi
        done
      fi
    done <<< "$fe_output"
  fi

  # 2. Backend / packages tsc check if backend/packages files staged
  local staged_backend_src=()
  for file in "${staged_ts_src[@]}"; do
    if [[ "$file" =~ ^(core/src/backend/|packages/) ]]; then
      staged_backend_src+=("$file")
    fi
  done

  if [ ${#staged_backend_src[@]} -gt 0 ]; then
    local be_output
    be_output=$(tsc --noEmit --incremental --tsBuildInfoFile .tsbuildinfo 2>&1) || true
    while IFS= read -r line; do
      if [ -n "$line" ]; then
        for file in "${staged_backend_src[@]}"; do
          if [[ "$line" == *"$file"* ]]; then
            errors+=("$line")
            failed=1
          fi
        done
      fi
    done <<< "$be_output"
  fi
  
  if [ $failed -eq 1 ]; then
    echo -e "${RED}TypeScript compilation errors detected in staged source files:${RESET}"
    for err in "${errors[@]}"; do
      echo -e "  $err"
    done
    return 1
  fi
  return 0
}

# ------------------------------------------------------------------------------
# 6. Parallel Job Orchestrator
# ------------------------------------------------------------------------------
TEMP_DIR=$(mktemp -d -t precommit-XXXXXX)
CONTAINER_LOGS_DIR=".precommit_container_logs"

cleanup() {
  rm -rf "$TEMP_DIR" "$CONTAINER_LOGS_DIR"
}
trap cleanup EXIT

job_names=()
job_pids=()
job_start_times=()
job_log_files=()

run_job() {
  local name="$1"
  shift
  local log_file="$TEMP_DIR/job_${#job_names[@]}.log"
  
  ( "$@" ) > "$log_file" 2>&1 &
  local pid=$!
  
  job_names+=("$name")
  job_pids+=("$pid")
  job_start_times+=($(date +%s))
  job_log_files+=("$log_file")
}

prepare_container_checks() {
  local container_script_file="$CONTAINER_LOGS_DIR/run_checks.sh"
  
  cat << 'EOF' > "$container_script_file"
#!/usr/bin/env bash
export GOFLAGS="-buildvcs=false"
git config --global --add safe.directory /app
EOF

  for i in "${!CONTAINER_COMMANDS[@]}"; do
    local cmd="${CONTAINER_COMMANDS[$i]}"
    cat << EOF >> "$container_script_file"
( $cmd ) > /app/$CONTAINER_LOGS_DIR/job_$i.log 2>&1 &
pid_$i=\$!
EOF
  done

  for i in "${!CONTAINER_COMMANDS[@]}"; do
    cat << EOF >> "$container_script_file"
exit_code_$i=0
wait \$pid_$i || exit_code_$i=\$?
echo \$exit_code_$i > /app/$CONTAINER_LOGS_DIR/job_$i.exit
EOF
  done

  chmod -R 777 "$CONTAINER_LOGS_DIR"
  sync 2>/dev/null || true
}

run_container_checks() {
  docker compose -f toolchain/docker-compose.yml run --rm --entrypoint "bash" toolchain "/app/$CONTAINER_LOGS_DIR/run_checks.sh"
}

schedule_check() {
  local name="$1"
  local local_func="$2"
  local has_tool_func="$3"
  local container_cmd="$4"
  local condition="${5:-true}"
  
  if [ "$condition" = "false" ]; then
    return 0
  fi
  
  if $has_tool_func; then
    run_job "$name" "$local_func"
  elif [ -n "$container_cmd" ] && [ "$HAS_DOCKER" = true ]; then
    CONTAINER_COMMANDS+=("$container_cmd")
    CONTAINER_JOB_NAMES+=("$name")
    NEED_CONTAINER=true
  else
    if [ -n "$container_cmd" ]; then
      run_job "$name" bash -c "echo -e \"${RED}❌ Error: $name is not available locally and Docker is not running.${RESET}\" && exit 1"
    fi
  fi
}

# ------------------------------------------------------------------------------
# 7. Dispatch Layer 1 & Layer 2 Active Checks in Parallel
# ------------------------------------------------------------------------------
run_biome=false
run_ruff=false
run_sqlfluff=false
run_depcruise=false
run_golangci=false
run_semgrep=false
run_trivy=false
run_govulncheck=false
run_tsc=false

if [ ${#STAGED_JS_TS[@]} -gt 0 ]; then
  run_biome=true
  run_semgrep=true
  for file in "${STAGED_JS_TS[@]}"; do
    if [[ "$file" =~ \.tsx?$ ]]; then
      run_tsc=true
      break
    fi
  done
fi

if [ ${#STAGED_PY[@]} -gt 0 ]; then
  run_ruff=true
  run_semgrep=true
fi

if [ ${#STAGED_SQL[@]} -gt 0 ]; then
  run_sqlfluff=true
fi

if [ ${#STAGED_DEPS_SRC[@]} -gt 0 ]; then
  run_depcruise=true
fi

if [ ${#STAGED_GO[@]} -gt 0 ]; then
  run_golangci=true
  run_semgrep=true
fi

if [ "$LOCKFILES_CHANGED" = true ]; then
  run_trivy=true
fi

if [ "$GO_DEPS_CHANGED" = true ]; then
  run_govulncheck=true
fi

# Setup container directory if needed
rm -rf "$CONTAINER_LOGS_DIR"
mkdir -p "$CONTAINER_LOGS_DIR"

sast_files=()
sast_files+=("${STAGED_JS_TS[@]}")
sast_files+=("${STAGED_PY[@]}")
sast_files+=("${STAGED_GO[@]}")

# Schedule all checks simultaneously
schedule_check "JS/TS Lint & Format (Biome)" check_biome has_biome "bunx @biomejs/biome ci ${STAGED_JS_TS[*]}" "$run_biome"
schedule_check "Python Lint & Format (Ruff)" check_ruff has_ruff "ruff check ${STAGED_PY[*]} && ruff format --check ${STAGED_PY[*]}" "$run_ruff"
schedule_check "SQL Schema Lint (SQLFluff)" check_sqlfluff has_sqlfluff "sqlfluff lint ${STAGED_SQL[*]} --dialect postgres" "$run_sqlfluff"
schedule_check "Architecture Boundaries (Dep-Cruiser)" check_depcruise has_depcruise "depcruise --config .dependency-cruiser.json ${STAGED_DEPS_SRC[*]}" "$run_depcruise"
schedule_check "Go Metalinter (golangci-lint)" check_golangci has_go "cd sandbox/apps/reference-go && golangci-lint run --timeout=5m ./..." "$run_golangci"
schedule_check "Secret Leak Detection (Gitleaks)" check_gitleaks has_gitleaks "gitleaks protect --staged --verbose --redact" "true"
schedule_check "SAST Vulnerability Scan (Semgrep)" check_semgrep has_semgrep "if [ -f .semgrep.yml ]; then semgrep scan --config .semgrep.yml --metrics=off --error --skip-unknown-extensions ${sast_files[*]}; else semgrep scan --config p/security-audit --metrics=off --error --skip-unknown-extensions ${sast_files[*]}; fi" "$run_semgrep"

trivy_container_cmd="failed=0; for lockfile in ${STAGED_LOCKFILES[*]}; do trivy fs --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed \$lockfile || failed=1; done; exit \$failed"
schedule_check "Dependency Supply-Chain Audit (Trivy)" check_trivy has_trivy "$trivy_container_cmd" "$run_trivy"
schedule_check "Go Vulnerability Audit (Govulncheck)" check_govulncheck has_govulncheck "cd sandbox/apps/reference-go && govulncheck ./..." "$run_govulncheck"
schedule_check "TypeScript Type Safety (tsc)" check_tsc has_tsc "" "$run_tsc"

if [ "$NEED_CONTAINER" = true ]; then
  ensure_docker_image
  prepare_container_checks
  run_job "Containerized Validation Suite" run_container_checks
fi

# ------------------------------------------------------------------------------
# 8. Collect Parallel Results & Render Report
# ------------------------------------------------------------------------------
GLOBAL_FAILED=0
results=()

for i in "${!job_pids[@]}"; do
  pid="${job_pids[$i]}"
  name="${job_names[$i]}"
  log_file="${job_log_files[$i]}"
  start_time="${job_start_times[$i]}"
  
  exit_code=0
  wait "$pid" || exit_code=$?
  
  end_time=$(date +%s)
  duration=$((end_time - start_time))
  
  if [ "$name" = "Containerized Validation Suite" ]; then
    if [ $exit_code -ne 0 ]; then
      echo -e "\n${RED}⚠️ Container runner error. Logs:${RESET}"
      cat "$log_file" 2>/dev/null || true
    fi
    
    for j in "${!CONTAINER_JOB_NAMES[@]}"; do
      c_name="${CONTAINER_JOB_NAMES[$j]}"
      c_exit_file="$CONTAINER_LOGS_DIR/job_$j.exit"
      c_log_file="$CONTAINER_LOGS_DIR/job_$j.log"
      
      c_exit=1
      if [ -f "$c_exit_file" ]; then
        c_exit=$(cat "$c_exit_file")
      fi
      
      if [ "$c_exit" -ne 0 ]; then
        results+=("${RED}❌ [FAIL] $c_name (Containerized)${RESET}")
        GLOBAL_FAILED=1
        echo -e "\n${RED}==============================================================================${RESET}"
        echo -e "${RED}   DETAILED FAILURE: $c_name (Containerized)${RESET}"
        echo -e "${RED}==============================================================================${RESET}"
        if [ -f "$c_log_file" ]; then
          cat "$c_log_file"
        else
          echo "No output log generated."
        fi
        echo -e "${RED}------------------------------------------------------------------------------${RESET}"
      else
        results+=("${GREEN}✅ [PASS] $c_name (Containerized)${RESET}")
      fi
    done
  else
    if [ $exit_code -ne 0 ]; then
      results+=("${RED}❌ [FAIL] $name (${duration}s)${RESET}")
      GLOBAL_FAILED=1
      echo -e "\n${RED}==============================================================================${RESET}"
      echo -e "${RED}   DETAILED FAILURE: $name${RESET}"
      echo -e "${RED}==============================================================================${RESET}"
      cat "$log_file" 2>/dev/null || true
      echo -e "${RED}------------------------------------------------------------------------------${RESET}"
    else
      results+=("${GREEN}✅ [PASS] $name (${duration}s)${RESET}")
    fi
  fi
done

# ------------------------------------------------------------------------------
# 9. Output Enterprise Summary Report
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}==============================================================================${RESET}"
echo -e "${CYAN}${BOLD}                    PRE-COMMIT VALIDATION REPORT                              ${RESET}"
echo -e "${BLUE}==============================================================================${RESET}"
for result in "${results[@]}"; do
  echo -e "  $result"
done
echo -e "${BLUE}==============================================================================${RESET}"

if [ $GLOBAL_FAILED -ne 0 ]; then
  echo -e "\n${RED}${BOLD}❌ Pre-commit validation failed! Please resolve all issues before committing.${RESET}"
  exit 1
else
  echo -e "\n${GREEN}${BOLD}✓ All pre-commit quality & security gates passed successfully!${RESET}"
  exit 0
fi
