#!/usr/bin/env zsh
# stop.sh — opreste toate serviciile Itfest2026

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

ok()   { echo "${GREEN}✓${NC} $*"; }
warn() { echo "${YELLOW}⚠${NC}  $*"; }

kill_port() {
  local port=$1
  local name=$2
  local pid
  pid=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    kill -TERM $pid 2>/dev/null || true
    ok "Oprit $name (port $port, PID $pid)"
  else
    warn "$name nu rula pe portul $port"
  fi
}

echo "Opresc serviciile Itfest2026..."
kill_port 3000 "Frontend (Next.js)"
kill_port 8000 "Backend (Solemtrix API)"
kill_port 8001 "ESP Backend"

# Opreste si orice proces python main.py ramas
pkill -f "BackendEsp/imageDetection/main.py" 2>/dev/null && ok "ESP python process oprit" || true

echo "Gata."
