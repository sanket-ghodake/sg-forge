#!/usr/bin/env bash
# ==============================================================================
# SG Forge Platform Orchestrator (2026 Tech Stack)
# Universal Lifecycle, Setup, Dynamic Namespacing & Runtime Engine
# ==============================================================================
set -e

# Always run from the monorepo root context
cd "$(dirname "$0")"

# ------------------------------------------------------------------------------
# Terminal Aesthetics & ANSI Colors
# ------------------------------------------------------------------------------
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# Auto-add localized Bun runtime if present
if [ -d "portables/bun/bin" ]; then
  export PATH="$(pwd)/portables/bun/bin:$PATH"
fi

# ------------------------------------------------------------------------------
# Terminal Control & Universal Signal Trapping (Ctrl+C / Ctrl+X)
# ------------------------------------------------------------------------------
ORIG_STTY=""
if [ -t 0 ] && command -v stty &>/dev/null; then
  ORIG_STTY=$(stty -g 2>/dev/null || true)
  # Map Ctrl+C to SIGINT and Ctrl+X to SIGQUIT so both instantly interrupt
  stty intr ^C quit ^X 2>/dev/null || true
fi

restore_terminal() {
  if [ -n "$ORIG_STTY" ] && command -v stty &>/dev/null; then
    stty "$ORIG_STTY" 2>/dev/null || true
  fi
}

PORTABLE_PIDS=()
CLEANUP_RUNNING=0

cleanup_background_processes() {
  local exit_code=$?
  if [ "$CLEANUP_RUNNING" -eq 1 ]; then
    return
  fi
  CLEANUP_RUNNING=1

  if [ ${#PORTABLE_PIDS[@]} -gt 0 ]; then
    echo -e "\n${YELLOW}Gracefully shutting down background processes...${RESET}"
    for pid in "${PORTABLE_PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        pkill -P "$pid" 2>/dev/null || true
        kill -TERM "$pid" 2>/dev/null || true
      fi
    done
    sleep 0.3
    for pid in "${PORTABLE_PIDS[@]}"; do
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

  restore_terminal
  return "$exit_code"
}

handle_signal() {
  local sig_name="$1"
  echo -e "\n${YELLOW}⚠️ Received ${sig_name} (Ctrl+C / Ctrl+X). Aborting execution...${RESET}"
  cleanup_background_processes
  restore_terminal
  exit 130
}

# Signal traps for universal Ctrl+C (SIGINT) and Ctrl+X (SIGQUIT) support
trap cleanup_background_processes EXIT
trap 'handle_signal "SIGINT"' INT
trap 'handle_signal "SIGQUIT"' QUIT
trap 'handle_signal "SIGTERM"' TERM
trap 'handle_signal "SIGHUP"' HUP

# Safe interactive read helper handling Ctrl+C, Ctrl+X, and exit keystrokes
read_input() {
  local prompt="$1"
  local var_name="$2"
  local val=""
  if ! read -r -p "$prompt" val; then
    echo ""
    echo -e "${YELLOW}Operation cancelled.${RESET}"
    cleanup_background_processes
    exit 0
  fi
  # Detect Ctrl+X ($'\x18'), Ctrl+C ($'\x03'), or quit words
  if [[ "$val" == *$'\x18'* ]] || [[ "$val" == *$'\x03'* ]] || [ "$val" = "q" ] || [ "$val" = "Q" ] || [ "$val" = "x" ] || [ "$val" = "X" ] || [ "$val" = "exit" ] || [ "$val" = "quit" ]; then
    echo -e "${YELLOW}Operation cancelled.${RESET}"
    cleanup_background_processes
    exit 0
  fi
  eval "$var_name=\"\$val\""
}

# ------------------------------------------------------------------------------
# Environment Loader Helper
# ------------------------------------------------------------------------------
load_env_config() {
  local platform="${1:-docker}"
  local env_type="${2:-dev}"
  local env_suffix="development"
  if [ "$env_type" = "sandbox" ] || [ "$env_type" = "prod" ] || [ "$env_type" = "production" ]; then
    env_suffix="production"
  fi

  local cli_project_name="$PROJECT_NAME"
  local cli_app_env="$APP_ENV"

  local env_file="config/envs/${platform}.${env_suffix}.env"
  if [ -f "$env_file" ]; then
    set -a
    source "$env_file"
    set +a
  fi

  if [ -n "$cli_project_name" ]; then
    PROJECT_NAME="$cli_project_name"
  else
    PROJECT_NAME="${PROJECT_NAME:-sgforge}"
  fi

  if [ -n "$cli_app_env" ]; then
    APP_ENV="$cli_app_env"
  else
    APP_ENV="${APP_ENV:-$env_suffix}"
  fi

  COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$PROJECT_NAME}"
  DB_CONTAINER_NAME="${PROJECT_NAME}-${APP_ENV}-db"
}

# Load default development environment on script start
load_env_config "docker" "dev"

# ------------------------------------------------------------------------------
# Rich Help Screen
# ------------------------------------------------------------------------------
show_help() {
  echo -e "${CYAN}${BOLD}╔═══════════════════════════════════════════════════════════════════════════╗${RESET}"
  echo -e "${CYAN}${BOLD}║              SG FORGE RUNTIME & LIFECYCLE ORCHESTRATOR                    ║${RESET}"
  echo -e "${CYAN}${BOLD}╚═══════════════════════════════════════════════════════════════════════════╝${RESET}"
  echo ""
  echo -e "${BOLD}USAGE:${RESET}"
  echo -e "  ./run.sh ${GREEN}<command>${RESET} [target] [options...]"
  echo ""
  echo -e "${BOLD}LIFECYCLE & ONBOARDING:${RESET}"
  echo -e "  ${GREEN}./run.sh setup${RESET}                Interactive setup wizard (Docker or Portable)"
  echo -e "  ${GREEN}./run.sh setup docker${RESET}         Setup full containerized stack"
  echo -e "  ${GREEN}./run.sh setup portable${RESET}       Setup local fast Bun environment"
  echo ""
  echo -e "${BOLD}DAILY EXECUTION COMMANDS:${RESET}"
  echo -e "  ${GREEN}./run.sh dev${RESET}                  Start dev stack with hot-reloading (interactive)"
  echo -e "  ${GREEN}./run.sh dev docker${RESET}           Start containerized stack"
  echo -e "  ${GREEN}./run.sh dev portable${RESET}         Start local Bun stack (blazing fast)"
  echo -e "  ${GREEN}./run.sh start [docker|port]${RESET}  Alias for starting the platform stack"
  echo -e "  ${GREEN}./run.sh sandbox${RESET}              Start production simulation build"
  echo ""
  echo -e "${BOLD}DIAGNOSTICS & MONITORING:${RESET}"
  echo -e "  ${GREEN}./run.sh doctor${RESET}               Pre-flight system audit (Docker, Ports, RAM, Disk)"
  echo -e "  ${GREEN}./run.sh status${RESET} (or ${GREEN}ps${RESET})        Live health & RAM/CPU resource metrics"
  echo -e "  ${GREEN}./run.sh logs [svc]${RESET}           Stream live logs (e.g., ./run.sh logs app)"
  echo ""
  echo -e "${BOLD}MANAGEMENT & OPERATIONS:${RESET}"
  echo -e "  ${GREEN}./run.sh stop${RESET}                 Stop all running containers & processes cleanly"
  echo -e "  ${GREEN}./run.sh restart${RESET}              Graceful stop and restart of current stack"
  echo -e "  ${GREEN}./run.sh clean${RESET}                Prune dangling images & build caches (preserves DB & images)"
  echo -e "  ${GREEN}./run.sh purge${RESET} (or ${GREEN}clean --all${RESET})  Complete wipe: removes all images, DB volumes & caches"
  echo ""
  echo -e "${BOLD}POLYGLOT TOOLCHAIN & BUILDS:${RESET}"
  echo -e "  ${GREEN}./run.sh toolchain <cmd>${RESET}      Run checks: lint | format | security | test | docs | all"
  echo -e "  ${GREEN}./run.sh build [app|go|...]${RESET}   Build targeted microservice image"
  echo ""
  echo -e "${BOLD}KEYBOARD SHORTCUTS & SIGNALS:${RESET}"
  echo -e "  ${YELLOW}Ctrl+C${RESET} or ${YELLOW}Ctrl+X${RESET}        Gracefully stop running servers or abort any interactive task"
  echo ""
  echo -e "${BOLD}ENVIRONMENT-DRIVEN REBRANDING:${RESET}"
  echo -e "  Configure ${CYAN}PROJECT_NAME${RESET} in ${BLUE}config/envs/docker.development.env${RESET} to"
  echo -e "  instantly re-brand all container, network, and volume namespaces."
  echo ""
}

# ------------------------------------------------------------------------------
# Prerequisite & Runtime Checkers
# ------------------------------------------------------------------------------
ensure_bun() {
  if ! command -v bun &>/dev/null; then
    echo -e "${BLUE}Localized Bun runtime not found. Auto-downloading portable Bun...${RESET}"
    mkdir -p portables
    local OS_TYPE
    OS_TYPE="$(uname -s)"
    if [ "$OS_TYPE" = "Darwin" ] || [ "$OS_TYPE" = "Linux" ]; then
      curl -fsSL https://bun.sh/install | BUN_INSTALL="$(pwd)/portables/bun" bash >/dev/null 2>&1 || true
      export PATH="$(pwd)/portables/bun/bin:$PATH"
    fi
  fi
  if ! command -v bun &>/dev/null; then
    echo -e "${RED}❌ Failed to auto-provision Bun runtime. Please ensure internet access or install Bun.${RESET}"
    return 1
  fi
  return 0
}

check_port() {
  local port=$1
  if command -v lsof &>/dev/null; then
    if lsof -Pi :"$port" -sTCP:LISTEN -t &>/dev/null; then
      return 1
    fi
  elif command -v nc &>/dev/null; then
    if nc -z 127.0.0.1 "$port" &>/dev/null; then
      return 1
    fi
  fi
  return 0
}

check_docker_daemon() {
  if ! command -v docker &>/dev/null; then
    echo -e "${RED}❌ Docker CLI is not installed on this machine.${RESET}"
    echo -e "${YELLOW}Install Docker Engine / Docker Desktop: https://docs.docker.com/get-docker/${RESET}"
    return 1
  fi

  if ! docker info &>/dev/null; then
    echo -e "${YELLOW}⚠️ Docker daemon is not active or accessible by user $(whoami).${RESET}"
    if command -v systemctl &>/dev/null; then
      echo -e "${CYAN}Attempting to start and enable Docker service via systemctl...${RESET}"
      if sudo systemctl enable --now docker containerd 2>/dev/null; then
        echo -e "${GREEN}✓ Docker service started & enabled for boot persistence.${RESET}"
        sleep 2
      else
        echo -e "${YELLOW}Please start Docker manually:${RESET}"
        echo -e "  ${BOLD}sudo systemctl enable --now docker containerd${RESET}"
        echo -e "  ${BOLD}sudo usermod -aG docker \$USER && newgrp docker${RESET}"
        return 1
      fi
    else
      echo -e "${YELLOW}Please ensure Docker Desktop / Docker daemon is running.${RESET}"
      return 1
    fi
  fi

  return 0
}

# ------------------------------------------------------------------------------
# 1. SETUP COMMAND (Interactive or Direct)
# ------------------------------------------------------------------------------
cmd_setup() {
  local target_mode="$1"
  
  if [ -z "$target_mode" ]; then
    echo -e "${BLUE}======================================================${RESET}"
    echo -e "${CYAN}${BOLD}       SG FORGE AUTOMATED DEVELOPER ONBOARDING        ${RESET}"
    echo -e "${BLUE}======================================================${RESET}"
    echo ""
    echo -e "Select your preferred development setup:"
    echo -e "  1) ${GREEN}Docker Stack${RESET}    - Zero host tools, 100% containerized isolation"
    echo -e "  2) ${GREEN}Portable Stack${RESET}  - Local Bun runtime (faster build & iteration)"
    echo -e "  3) ${YELLOW}Cancel${RESET}"
    echo ""
    read_input "Enter choice [1-3] (or q/Ctrl+C/Ctrl+X to cancel): " setup_choice
    case $setup_choice in
      1) target_mode="docker" ;;
      2) target_mode="portable" ;;
      3|q|Q|x|X|cancel) echo -e "${YELLOW}Setup cancelled.${RESET}"; exit 0 ;;
      *) echo -e "${RED}Invalid choice.${RESET}"; exit 1 ;;
    esac
    echo ""
  fi

  load_env_config "$target_mode" "dev"

  echo -e "${CYAN}${BOLD}Starting SG Forge Setup [Target: ${target_mode}] [Brand: ${PROJECT_NAME}]...${RESET}"
  echo ""

  echo -e "${BLUE}[1/5] Checking Docker Engine & daemon status...${RESET}"
  if ! check_docker_daemon; then
    echo -e "${RED}❌ Docker check failed. Please resolve Docker engine prerequisites and retry.${RESET}"
    exit 1
  fi
  echo -e "${GREEN}✓ Docker Engine is active and responsive.${RESET}"

  echo -e "${BLUE}[2/5] Initializing localized Bun runtime & dependencies...${RESET}"
  if ! ensure_bun; then
    exit 1
  fi
  bun install --silent || bun install
  git config core.hooksPath .husky 2>/dev/null || true
  chmod +x .husky/* .husky/_/* toolchain/*.sh 2>/dev/null || true

  echo -e "${BLUE}[3/5] Setting up isolated Docker network (${PROJECT_NAME}-network)...${RESET}"
  docker network create "${PROJECT_NAME}-network" 2>/dev/null || true
  docker network create "${PROJECT_NAME}-portal-net" 2>/dev/null || true
  docker network create "${PROJECT_NAME}-db-core-net" 2>/dev/null || true
  echo -e "${GREEN}✓ Container networks and storage configured.${RESET}"

  echo -e "${BLUE}[4/5] Spawning database container (${DB_CONTAINER_NAME}) & seeding schemas...${RESET}"
  docker compose -f docker/development/docker-compose.yaml up -d db
  echo -e "Waiting for PostgreSQL database container to be healthy..."
  until docker exec "${DB_CONTAINER_NAME}" pg_isready -U lifeos -d org_db &>/dev/null; do
    sleep 1
  done
  echo -e "${GREEN}✓ Database container ready.${RESET}"
  bun core/src/database/initialize-local-db.ts

  echo -e "${BLUE}[5/5] Bundling Forge SDK & Dev Dashboard assets...${RESET}"
  bun build --target=browser --format=iife --outfile=core/src/frontend/public/sdk/forge-sdk.js packages/sdk/forge-sdk.ts
  bun build --target=browser --outfile=core/src/backend/dev-dashboard/dashboard.js core/src/backend/dev-dashboard/dashboard.tsx
  echo -e "${GREEN}✓ Browser SDK and UI assets compiled successfully.${RESET}"

  echo ""
  echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════════════${RESET}"
  echo -e "${GREEN}${BOLD}       🎉 SG FORGE SETUP COMPLETED SUCCESSFULLY!                       ${RESET}"
  echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════════════${RESET}"
  echo ""
  echo -e "Launch the platform anytime using:"
  if [ "$target_mode" = "docker" ]; then
    echo -e "  ${CYAN}${BOLD}./run.sh dev docker${RESET}     (Containerized stack with hot-reloading)"
  else
    echo -e "  ${CYAN}${BOLD}./run.sh dev portable${RESET}   (Local fast Bun developer stack)"
  fi
  echo -e "  ${CYAN}./run.sh doctor${RESET}         (Run diagnostics)"
  echo -e "  ${CYAN}./run.sh status${RESET}         (Monitor live RAM and container status)"
  echo ""
  exit 0
}

# ------------------------------------------------------------------------------
# 2. DOCTOR COMMAND (Pre-flight System Diagnostics)
# ------------------------------------------------------------------------------
cmd_doctor() {
  load_env_config "docker" "dev"

  echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════════════════════${RESET}"
  echo -e "${CYAN}${BOLD}                 SG FORGE SYSTEM PRE-FLIGHT DOCTOR                     ${RESET}"
  echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════════════════════${RESET}"
  echo ""
  local has_error=0

  # 1. Dynamic Namespace
  echo -e "• Active Namespace: ${GREEN}${PROJECT_NAME}${RESET} (Environment: ${APP_ENV})"

  # 2. Docker Engine
  echo -n "• Docker Engine Status: "
  if docker info &>/dev/null; then
    echo -e "${GREEN}Active & Accessible${RESET}"
  else
    echo -e "${RED}Inactive / Permission Denied${RESET}"
    has_error=1
  fi

  # 3. Systemd Auto-Start
  echo -n "• Docker Reboot Persistence (systemd): "
  if command -v systemctl &>/dev/null; then
    if systemctl is-enabled docker &>/dev/null; then
      echo -e "${GREEN}Enabled (Auto-starts on reboot)${RESET}"
    else
      echo -e "${YELLOW}Disabled (Run: sudo systemctl enable docker)${RESET}"
    fi
  else
    echo -e "${DIM}N/A (Non-systemd host)${RESET}"
  fi

  # 4. Bun Runtime
  echo -n "• Localized Bun Runtime: "
  if command -v bun &>/dev/null; then
    echo -e "${GREEN}$(bun --version)${RESET}"
  else
    echo -e "${YELLOW}Not extracted (Will auto-download on ./run.sh setup)${RESET}"
  fi

  # 5. RAM Check
  echo -n "• Available System RAM: "
  if command -v free &>/dev/null; then
    local free_ram
    free_ram=$(free -m | awk '/^Mem:/{print $7}')
    if [ "$free_ram" -gt 1024 ]; then
      echo -e "${GREEN}${free_ram} MB (Sufficient)${RESET}"
    else
      echo -e "${YELLOW}${free_ram} MB (Low memory warning, >1024MB recommended)${RESET}"
    fi
  else
    echo -e "${GREEN}OK${RESET}"
  fi

  # 6. Disk Space
  echo -n "• Available Disk Space: "
  local free_disk
  free_disk=$(df -h . | awk 'NR==2 {print $4}')
  echo -e "${GREEN}${free_disk}${RESET}"

  # 7. Port Allocations
  echo "• Application Port Allocations:"
  for port in 3001 3002 3003 5433 8085 8086 8087 8080; do
    if check_port "$port"; then
      echo -e "   - Port ${port}: ${GREEN}Free${RESET}"
    else
      echo -e "   - Port ${port}: ${YELLOW}Occupied / In Use${RESET}"
    fi
  done

  # 8. Environment Files
  echo "• Environment Configuration Files:"
  for env_f in "config/envs/docker.development.env" "config/envs/docker.production.env" "config/envs/portable.development.env"; do
    if [ -f "$env_f" ]; then
      echo -e "   - $env_f: ${GREEN}Present${RESET}"
    else
      echo -e "   - $env_f: ${YELLOW}Missing (Using defaults)${RESET}"
    fi
  done

  echo ""
  if [ $has_error -eq 0 ]; then
    echo -e "${GREEN}✓ All core platform prerequisites are in optimal state.${RESET}"
  else
    echo -e "${RED}⚠️ Issues detected. Run './run.sh setup' to configure automatically.${RESET}"
  fi
  echo ""
  exit $has_error
}

# ------------------------------------------------------------------------------
# 3. STATUS COMMAND (Live Monitor)
# ------------------------------------------------------------------------------
cmd_status() {
  load_env_config "docker" "dev"

  echo -e "${CYAN}${BOLD}=== SG Forge Platform Status & Resource Monitor ===${RESET}"
  echo -e "Active Brand Namespace: ${GREEN}${PROJECT_NAME}${RESET}"
  echo ""
  echo -e "${BOLD}Running Containers:${RESET}"
  docker ps --filter "name=${PROJECT_NAME}" \
    --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
  
  echo ""
  echo -e "${BOLD}Live RAM & CPU Utilization:${RESET}"
  local container_ids
  container_ids=$(docker ps -q --filter "name=${PROJECT_NAME}" 2>/dev/null || true)
  if [ -n "$container_ids" ]; then
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}" $container_ids
  else
    echo -e "${DIM}No active containers found for project '${PROJECT_NAME}'.${RESET}"
  fi
  echo ""
  exit 0
}

# ------------------------------------------------------------------------------
# 4. LOGS COMMAND
# ------------------------------------------------------------------------------
cmd_logs() {
  local target_svc="$1"
  load_env_config "docker" "dev"

  local compose_file="docker/development/docker-compose.yaml"
  if [ -f "docker/production/docker-compose.yaml" ] && docker ps | grep -q "${PROJECT_NAME}.*prod"; then
    compose_file="docker/production/docker-compose.yaml"
    load_env_config "docker" "sandbox"
  fi

  if [ -n "$target_svc" ]; then
    echo -e "${CYAN}Streaming live logs for: ${GREEN}${target_svc}${RESET} (${compose_file})..."
    docker compose -f "$compose_file" logs -f --tail=100 "$target_svc"
  else
    echo -e "${CYAN}Streaming live logs for all active services...${RESET}"
    docker compose -f "$compose_file" logs -f --tail=50
  fi
  exit 0
}

# ------------------------------------------------------------------------------
# 5. STOP COMMAND (Atomic & Symmetric)
# ------------------------------------------------------------------------------
stop_platform() {
  echo -e "${CYAN}Stopping SG Forge platform services & containers...${RESET}"
  echo ""

  # Cancel any active in-flight docker builds
  pkill -f "docker compose.*build" 2>/dev/null || true
  pkill -f "docker build" 2>/dev/null || true
  pkill -f "docker-buildx" 2>/dev/null || true

  # Tear down development stack
  if [ -f "docker/development/docker-compose.yaml" ]; then
    echo -e "${BLUE}Stopping Docker development containers...${RESET}"
    docker compose -f docker/development/docker-compose.yaml --env-file config/envs/docker.development.env down --remove-orphans 2>/dev/null || true
  fi

  # Tear down production stack
  if [ -f "docker/production/docker-compose.yaml" ]; then
    echo -e "${BLUE}Stopping Docker production containers...${RESET}"
    docker compose -f docker/production/docker-compose.yaml --env-file config/envs/docker.production.env down --remove-orphans 2>/dev/null || true
  fi

  # Tear down toolchain
  if [ -f "toolchain/docker-compose.yml" ]; then
    docker compose -f toolchain/docker-compose.yml down --remove-orphans 2>/dev/null || true
  fi

  # Drain local background PIDs
  cleanup_background_processes

  # Safely release occupied ports
  echo -e "${BLUE}Verifying port releases (3001, 3002, 3003, 5433)...${RESET}"
  for port in 3001 3002 3003 5433; do
    if command -v fuser &>/dev/null; then
      fuser -k "${port}/tcp" 2>/dev/null || true
    fi
  done

  echo -e "${GREEN}✓ All SG Forge services stopped successfully.${RESET}"
}

# ------------------------------------------------------------------------------
# 6. RUN STACK (DOCKER / PORTABLE)
# ------------------------------------------------------------------------------
run_stack() {
  local platform="$1"
  local env="$2"
  shift 2 || true
  local extra_args=("$@")

  load_env_config "$platform" "$env"

  echo -e "${CYAN}Starting SG Forge [Platform: ${platform}] [Environment: ${env}] [Brand: ${PROJECT_NAME}]...${RESET}"
  echo ""

  local docker_dir="docker/development"
  local env_file="config/envs/${platform}.development.env"
  if [ "$env" = "sandbox" ] || [ "$env" = "prod" ] || [ "$env" = "production" ]; then
    docker_dir="docker/production"
    env_file="config/envs/${platform}.production.env"
  fi

  # Port conflict verification
  local ports_to_check=(${PORT:-3001} 3002 3003)
  if [ "$platform" = "portable" ]; then
    ports_to_check+=(5433)
  fi

  local occupied=()
  for port in "${ports_to_check[@]}"; do
    if ! check_port "$port"; then
      occupied+=("$port")
    fi
  done

  if [ ${#occupied[@]} -ne 0 ]; then
    echo -e "${RED}❌ Error: Port(s) required by SG Forge are already occupied: ${occupied[*]}${RESET}"
    echo -e "${YELLOW}Run './run.sh stop' or free these ports before proceeding.${RESET}"
    exit 1
  fi

  # Ensure docker network exists
  docker network create "${PROJECT_NAME}-network" 2>/dev/null || true

  if [ "$platform" = "docker" ]; then
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1

    if [[ "${extra_args[*]}" == *"--build"* ]] || [[ "$env" == *"rebuild"* ]]; then
      echo -e "${BLUE}Rebuilding Docker images and starting services...${RESET}"
      docker compose -f "$docker_dir/docker-compose.yaml" --env-file "$env_file" up --build "${extra_args[@]}"
    else
      echo -e "${BLUE}Starting containerized stack (using layer cache for instant startup)...${RESET}"
      docker compose -f "$docker_dir/docker-compose.yaml" --env-file "$env_file" up "${extra_args[@]}"
    fi

  else
    # Portable / Local execution
    ensure_bun

    echo -e "${BLUE}Configuring PostgreSQL database container...${RESET}"
    docker compose -f docker/development/docker-compose.yaml --env-file "$env_file" up -d db

    echo -e "${BLUE}Waiting for database container to be ready...${RESET}"
    until docker exec "${DB_CONTAINER_NAME}" pg_isready -U lifeos -d org_db >/dev/null 2>&1; do
      sleep 1
    done
    echo -e "${GREEN}Database is ready!${RESET}"

    echo -e "${BLUE}Syncing database schemas...${RESET}"
    bun core/src/database/initialize-local-db.ts

    echo -e "${BLUE}Bundling Forge SDK & Dev Dashboard UI...${RESET}"
    bun build --target=browser --format=iife --outfile=core/src/frontend/public/sdk/forge-sdk.js packages/sdk/forge-sdk.ts
    bun build --target=browser --outfile=core/src/backend/dev-dashboard/dashboard.js core/src/backend/dev-dashboard/dashboard.tsx

    echo -e "${BLUE}Launching SG Forge platform processes...${RESET}"

    # 1. Dev-Dashboard (port 3002)
    if [ "$NODE_ENV" = "development" ]; then
      bun --watch core/src/backend/dev-dashboard/server.ts &
    else
      bun core/src/backend/dev-dashboard/server.ts &
    fi
    PORTABLE_PIDS+=($!)

    # 2. Dynamic Sandbox App Runner
    bun scripts/dynamic-app-runner.ts &
    PORTABLE_PIDS+=($!)

    # 3. Developer Portal Proxy (port 3003)
    if [ "$NODE_ENV" = "development" ]; then
      bun --watch scripts/developer-proxy.ts &
    else
      bun scripts/developer-proxy.ts &
    fi
    PORTABLE_PIDS+=($!)

    # 4. Edge Reverse Proxy & Landing Hub (port 80/443 or fallback 8080/8443)
    if [ "$NODE_ENV" = "development" ]; then
      bun --watch scripts/edge-reverse-proxy.ts &
    else
      bun scripts/edge-reverse-proxy.ts &
    fi
    PORTABLE_PIDS+=($!)

    # 5. Core Next.js Frontend Portal (port 3001)
    if [ "$APP_ENV" = "development" ]; then
      (cd core/src/frontend && bun run dev --port "${PORT:-3001}")
    else
      echo -e "${BLUE}Building core production bundle...${RESET}"
      (cd core/src/frontend && bun run build)
      (cd core/src/frontend && bun run start --port "${PORT:-3001}")
    fi
  fi
}

# ------------------------------------------------------------------------------
# ARGUMENT PARSING & COMMAND ROUTING
# ------------------------------------------------------------------------------
CMD=$(echo "$1" | tr '[:upper:]' '[:lower:]')

case "$CMD" in
  # Onboarding & Setup
  setup|init)
    cmd_setup "$2"
    ;;

  # Diagnostics & Monitor
  doctor)
    cmd_doctor
    ;;
  status|ps)
    cmd_status
    ;;
  logs)
    cmd_logs "$2"
    ;;

  # Service Control
  stop|down)
    stop_platform
    exit 0
    ;;
  restart)
    # Auto-detect currently running stack mode before stopping
    TARGET_PLATFORM="$2"
    TARGET_ENV="$3"
    if [ -z "$TARGET_PLATFORM" ]; then
      if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "${PROJECT_NAME}.*prod"; then
        TARGET_PLATFORM="docker"
        TARGET_ENV="sandbox"
      elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q "${PROJECT_NAME}"; then
        TARGET_PLATFORM="docker"
        TARGET_ENV="dev"
      elif pgrep -f "scripts/edge-reverse-proxy.ts" >/dev/null 2>&1 || pgrep -f "core/src/backend/dev-dashboard/server.ts" >/dev/null 2>&1; then
        TARGET_PLATFORM="portable"
        TARGET_ENV="dev"
      else
        TARGET_PLATFORM="docker"
        TARGET_ENV="dev"
      fi
    fi

    echo -e "${CYAN}Restarting SG Forge platform (Target: ${GREEN}${TARGET_PLATFORM} ${TARGET_ENV}${CYAN})...${RESET}"
    stop_platform
    sleep 1
    run_stack "$TARGET_PLATFORM" "${TARGET_ENV:-dev}" "${@:4}"
    ;;

  # Cleanup & Pruning
  clean|purge|prune)
    load_env_config "docker" "dev"
    local is_full_purge=0
    if [[ "$CMD" == "purge" ]] || [[ "$2" == *"--all"* ]] || [[ "$2" == *"--volumes"* ]] || [[ "$3" == *"--all"* ]]; then
      is_full_purge=1
    fi

    if [ $is_full_purge -eq 1 ]; then
      echo -e "${RED}${BOLD}=======================================================================${RESET}"
      echo -e "${RED}${BOLD}  FULL PLATFORM PURGE: Removing all images, volumes, caches & data     ${RESET}"
      echo -e "${RED}${BOLD}=======================================================================${RESET}"
      echo ""

      # 1. Stop containers and drop attached volumes
      echo -e "${CYAN}[1/6] Stopping containers and detaching compose volumes...${RESET}"
      if [ -f "docker/development/docker-compose.yaml" ]; then
        docker compose -f docker/development/docker-compose.yaml --env-file config/envs/docker.development.env down -v --remove-orphans 2>/dev/null || true
      fi
      if [ -f "docker/production/docker-compose.yaml" ]; then
        docker compose -f docker/production/docker-compose.yaml --env-file config/envs/docker.production.env down -v --remove-orphans 2>/dev/null || true
      fi

      # 2. Force-remove all project named volumes
      echo -e "${CYAN}[2/6] Purging persistent database and node_modules volumes...${RESET}"
      docker volume rm "${PROJECT_NAME}-pgdata" sgforge-pgdata docker_pgdata \
        "${PROJECT_NAME}-root-node-modules" sgforge-root-node-modules \
        "${PROJECT_NAME}-frontend-node-modules" sgforge-frontend-node-modules \
        "${PROJECT_NAME}-next-cache" sgforge-next-cache 2>/dev/null || true

      # 3. Remove all project tagged and untagged Docker images
      echo -e "${CYAN}[3/6] Removing project Docker images...${RESET}"
      local project_imgs
      project_imgs=$(docker images -q --filter "reference=${PROJECT_NAME}*" --filter "reference=sgforge*" 2>/dev/null || true)
      if [ -n "$project_imgs" ]; then
        echo "$project_imgs" | xargs -r docker rmi -f 2>/dev/null || true
      fi

      # 4. System-wide prune of unused images and build caches
      echo -e "${CYAN}[4/6] Pruning unused system images, networks, and build caches...${RESET}"
      docker system prune -a --volumes -f 2>/dev/null || true
      docker builder prune -a -f 2>/dev/null || true

      # 5. Clean local workspace caches & build artifacts
      echo -e "${CYAN}[5/6] Cleaning local Next.js build caches and temporary files...${RESET}"
      rm -rf core/src/frontend/.next core/src/backend/dev-dashboard/dashboard.js volume/ssl logs/*.log 2>/dev/null || true

      # 6. Complete
      echo -e "${CYAN}[6/6] Finalizing clean state...${RESET}"
      echo -e "${GREEN}${BOLD}✓ Full platform purge completed! All images, volumes, and caches removed.${RESET}"
    else
      echo -e "${CYAN}Cleaning SG Forge container data, build caches, and dangling images...${RESET}"
      if [ -f "docker/development/docker-compose.yaml" ]; then
        docker compose -f docker/development/docker-compose.yaml --env-file config/envs/docker.development.env down --remove-orphans 2>/dev/null || true
      fi
      if [ -f "docker/production/docker-compose.yaml" ]; then
        docker compose -f docker/production/docker-compose.yaml --env-file config/envs/docker.production.env down --remove-orphans 2>/dev/null || true
      fi
      docker system prune -f 2>/dev/null || true
      docker builder prune -f 2>/dev/null || true
      echo -e "${GREEN}✓ Lightweight cleanup completed. (Use './run.sh purge' to delete all images & volumes).${RESET}"
    fi
    exit 0
    ;;

  # Targeted microservice builds
  build|make)
    TARGET_APP="$2"
    case "$TARGET_APP" in
      app|portal|dashboard) TARGET_SERVICE="app" ;;
      expenses|reference-expenses) TARGET_SERVICE="reference-expenses" ;;
      go|reference-go) TARGET_SERVICE="reference-go" ;;
      python|reference-python) TARGET_SERVICE="reference-python" ;;
      telemetry|telemetry-dashboard) TARGET_SERVICE="telemetry-dashboard" ;;
      "") TARGET_SERVICE="" ;;
      *) TARGET_SERVICE="$TARGET_APP" ;;
    esac
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    if [ -n "$TARGET_SERVICE" ]; then
      echo -e "${CYAN}Building targeted microservice: ${GREEN}${TARGET_SERVICE}${RESET}..."
      docker compose -f docker/development/docker-compose.yaml --env-file config/envs/docker.development.env build "$TARGET_SERVICE"
    else
      echo -e "${CYAN}Building all microservice containers in parallel...${RESET}"
      docker compose -f docker/development/docker-compose.yaml --env-file config/envs/docker.development.env build --parallel
    fi
    echo -e "${GREEN}✓ Build completed successfully.${RESET}"
    exit 0
    ;;

  # Validation toolchain
  toolchain)
    TC_ACTION="$2"
    if [ -z "$TC_ACTION" ]; then
      TC_ACTION="all"
    fi
    if [[ "$TC_ACTION" != "lint" && "$TC_ACTION" != "format" && "$TC_ACTION" != "security" && "$TC_ACTION" != "test" && "$TC_ACTION" != "docs" && "$TC_ACTION" != "all" ]]; then
      echo -e "${RED}Invalid toolchain command: $TC_ACTION. Expected: lint, format, security, test, docs, all.${RESET}"
      exit 1
    fi
    echo -e "${CYAN}Running SG Forge Toolchain [Action: ${TC_ACTION}]...${RESET}"
    docker network create "${PROJECT_NAME}-network" 2>/dev/null || true
    docker compose -f toolchain/docker-compose.yml build toolchain
    docker compose -f toolchain/docker-compose.yml run --rm "$TC_ACTION"
    exit $?
    ;;

  # Daily Dev & Start Shortcuts
  dev|start)
    MODE="$2"
    if [ -z "$MODE" ]; then
      echo -e "Select execution mode for ${GREEN}Development${RESET}:"
      echo -e "  1) ${GREEN}Docker${RESET}    (Containerized with live reload)"
      echo -e "  2) ${GREEN}Portable${RESET}  (Local Bun processes)"
      read_input "Enter choice [1-2] (or q/Ctrl+C/Ctrl+X to cancel): " dev_choice
      case $dev_choice in
        1) MODE="docker" ;;
        2) MODE="portable" ;;
        q|Q|x|X|cancel) echo -e "${YELLOW}Cancelled.${RESET}"; exit 0 ;;
        *) echo -e "${RED}Invalid choice.${RESET}"; exit 1 ;;
      esac
    fi
    run_stack "$MODE" "dev" "${@:3}"
    ;;

  # Production sandbox simulation
  sandbox|prod|production)
    MODE="$2"
    if [ -z "$MODE" ]; then
      MODE="docker"
    fi
    run_stack "$MODE" "sandbox" "${@:3}"
    ;;

  # Explicit platform execution: ./run.sh docker dev / ./run.sh portable dev
  docker|portable)
    ENV="$2"
    if [ -z "$ENV" ]; then
      ENV="dev"
    fi
    run_stack "$CMD" "$ENV" "${@:3}"
    ;;

  # Help screen
  help|--help|-h)
    show_help
    exit 0
    ;;

  # Interactive Menu when executed without arguments
  "")
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════════════╗${RESET}"
    echo -e "${CYAN}${BOLD}║                     SG FORGE INTERACTIVE MENU                             ║${RESET}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════════════╝${RESET}"
    echo ""
    echo -e "Select action:"
    echo -e "  1) ${GREEN}Quick Setup${RESET} (Automated 1-command bootstrap)"
    echo -e "  2) ${GREEN}Start Development (Docker Mode)${RESET}"
    echo -e "  3) ${GREEN}Start Development (Portable Mode)${RESET}"
    echo -e "  4) ${GREEN}Run System Doctor Diagnostics${RESET}"
    echo -e "  5) ${GREEN}View Stack Status & RAM Usage${RESET}"
    echo -e "  6) ${YELLOW}Stop All Services${RESET}"
    echo -e "  7) ${BLUE}Help & Documentation${RESET}"
    echo ""
    read_input "Enter choice [1-7] (or q/Ctrl+C/Ctrl+X to exit): " menu_choice
    echo ""
    case $menu_choice in
      1) cmd_setup ;;
      2) run_stack "docker" "dev" ;;
      3) run_stack "portable" "dev" ;;
      4) cmd_doctor ;;
      5) cmd_status ;;
      6) stop_platform ;;
      7) show_help ;;
      q|Q|x|X|exit|quit) echo -e "${YELLOW}Exited.${RESET}"; exit 0 ;;
      *) echo -e "${RED}Invalid selection.${RESET}"; exit 1 ;;
    esac
    ;;

  # Unknown command fallback
  *)
    echo -e "${RED}Unknown command: ${CMD}${RESET}"
    echo ""
    show_help
    exit 1
    ;;
esac
