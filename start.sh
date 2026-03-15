#!/usr/bin/env zsh
# ─────────────────────────────────────────────────────────────────────────────
#  start.sh — porneste toate serviciile Itfest2026
#
#  Servicii:
#    1. Backend     (Solemtrix FastAPI + Neon DB)   → http://localhost:8000
#    2. Frontend    (Next.js)                        → http://localhost:3000
#    3. ESP Backend (FastAPI + OpenCV + ESP32/CAM)   → http://localhost:8001
#                                                      http://localhost:8001/dashboard
#
#  Utilizare:
#    ./start.sh                # deschide 3 ferestre Terminal
#    ./start.sh --no-esp       # fara ESP backend
#    ./start.sh --background   # totul in background, logs in logs/
# ─────────────────────────────────────────────────────────────────────────────

# ── Culori ─────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo "${GREEN}✓${NC} $*"; }
warn() { echo "${YELLOW}⚠${NC}  $*"; }
err()  { echo "${RED}✗${NC} $*"; }
info() { echo "${CYAN}→${NC} $*"; }
hdr()  { echo; echo "${BOLD}━━━ $* ━━━${NC}"; echo; }

# ── Argumente ──────────────────────────────────────────────────────────────
START_ESP=true
BACKGROUND=false

for arg in "$@"; do
  case $arg in
    --no-esp)    START_ESP=false ;;
    --background) BACKGROUND=true ;;
    --help|-h)
      echo "Utilizare: ./start.sh [--no-esp] [--background]"
      exit 0 ;;
  esac
done

# ── Directoare ─────────────────────────────────────────────────────────────
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
ESP_DIR="$ROOT/BackendEsp/imageDetection"
LOGS_DIR="$ROOT/logs"
TMP_DIR="/tmp/itfest_start"

mkdir -p "$LOGS_DIR" "$TMP_DIR"

# ─────────────────────────────────────────────────────────────────────────────
hdr "Itfest2026 — Start All Services"
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Verificare dependinte ────────────────────────────────────────────────
hdr "Verificare dependinte"

for cmd in python3 node npm; do
  if command -v "$cmd" &>/dev/null; then
    ok "$cmd disponibil"
  else
    err "$cmd nu e gasit — instaleaza-l si reincerca"
    exit 1
  fi
done

# Verifica conda
if ! command -v conda &>/dev/null; then
  warn "conda nu e in PATH. Caut in locatii comune..."
  for p in \
    "$HOME/miniconda3/bin/conda" \
    "$HOME/anaconda3/bin/conda" \
    "/opt/homebrew/Caskroom/miniconda/base/bin/conda" \
    "/opt/miniconda3/bin/conda"; do
    if [[ -f "$p" ]]; then
      eval "$($p shell.zsh hook 2>/dev/null)"
      ok "conda gasit la $p"
      break
    fi
  done
fi

if ! command -v conda &>/dev/null; then
  err "conda indisponibil — ESP Backend va fi sarit"
  START_ESP=false
elif ! conda env list | grep -q "^itfest"; then
  err "Conda env 'itfest' nu exista"
  warn "  conda create -n itfest python=3.11"
  warn "  pip install -r BackendEsp/imageDetection/requirements.txt"
  START_ESP=false
else
  ok "conda env 'itfest' gasit"
fi

# ── 2. Verificare .env files ────────────────────────────────────────────────
hdr "Verificare fisiere .env"

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  warn "backend/.env creat din .env.example"
  warn "  Completeaza DATABASE_URL si SECRET_KEY in $BACKEND_DIR/.env"
else
  ok "backend/.env exista"
fi

if [[ ! -f "$FRONTEND_DIR/.env.local" ]]; then
  cp "$FRONTEND_DIR/.env.local.example" "$FRONTEND_DIR/.env.local"
  warn "frontend/.env.local creat din .env.local.example"
else
  ok "frontend/.env.local exista"
fi

[[ -f "$ESP_DIR/.env" ]] && ok "ESP .env exista" || warn "ESP .env lipsa"

# ── 3. Verificare node_modules ──────────────────────────────────────────────
hdr "Verificare frontend dependencies"

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  info "Rulez npm install in frontend/..."
  (cd "$FRONTEND_DIR" && npm install)
  ok "npm install complet"
else
  ok "node_modules exista"
fi

# ─────────────────────────────────────────────────────────────────────────────
hdr "Pornire servicii"
# ─────────────────────────────────────────────────────────────────────────────

# ── Functie: elibereaza un port daca e ocupat ────────────────────────────────
free_port() {
  local port=$1
  local pids
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    warn "Portul $port e ocupat (PID $pids) — il eliberez..."
    echo "$pids" | xargs kill -TERM 2>/dev/null || true
    sleep 1
    # Daca procesul nu s-a oprit, SIGKILL
    pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    [[ -n "$pids" ]] && echo "$pids" | xargs kill -KILL 2>/dev/null || true
    ok "Port $port eliberat"
  fi
}

# ── Functie: deschide un .command intr-o fereastra Terminal ─────────────────
# Evita complet problemele de quoting din osascript scriind intr-un fisier temp.
launch_in_terminal() {
  local name="$1"
  local script_file="$TMP_DIR/${name}.command"

  # Scrie continutul scriptului
  cat > "$script_file"
  chmod +x "$script_file"

  if $BACKGROUND; then
    zsh "$script_file" >> "$LOGS_DIR/${name}.log" 2>&1 &
    ok "$name pornit in background (PID $!) — log: logs/${name}.log"
  else
    open -a Terminal "$script_file"
    sleep 0.5
    ok "$name pornit intr-o fereastra Terminal"
  fi
}

# ── 4. Backend Solemtrix (port 8000) ──────────────────────────────────────
free_port 8000
info "Pornesc Backend Solemtrix pe port 8000..."

launch_in_terminal "backend" <<SCRIPT
#!/usr/bin/env zsh
echo "━━━ Backend Solemtrix (port 8000) ━━━"
cd "$BACKEND_DIR"
pip install -r requirements.txt -q
echo "Pornesc uvicorn..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
SCRIPT

sleep 1

# ── 5. Frontend Next.js (port 3000) ────────────────────────────────────────
free_port 3000
# Sterge cache-ul vechi .next ca sa eviti erori ENOENT / InvariantError
[[ -d "$FRONTEND_DIR/.next" ]] && { rm -rf "$FRONTEND_DIR/.next"; warn ".next cache sters (rebuild la start)"; }
info "Pornesc Frontend Next.js pe port 3000..."

launch_in_terminal "frontend" <<SCRIPT
#!/usr/bin/env zsh
echo "━━━ Frontend Next.js (port 3000) ━━━"
cd "$FRONTEND_DIR"
npm run dev
SCRIPT

sleep 1

# ── 6. ESP Backend (port 8001) ──────────────────────────────────────────────
if $START_ESP; then
  free_port 8001
  info "Pornesc ESP Backend pe port 8001..."

  # Gaseste calea conda pentru a o activa in fereastra noua
  CONDA_BASE="$(conda info --base 2>/dev/null)"

  launch_in_terminal "esp_backend" <<SCRIPT
#!/usr/bin/env zsh
echo "━━━ ESP Backend (port 8001) ━━━"
source "$CONDA_BASE/etc/profile.d/conda.sh"
conda activate itfest
cd "$ESP_DIR"
python main.py
SCRIPT

else
  warn "ESP Backend SKIP"
fi

# ─────────────────────────────────────────────────────────────────────────────
hdr "Servicii pornite"
echo "  Solemtrix Frontend  →  http://localhost:3000"
echo "  Solemtrix API       →  http://localhost:8000"
echo "  API Docs            →  http://localhost:8000/docs"
if $START_ESP; then
  echo "  ESP Dashboard       →  http://localhost:8001/dashboard"
  echo "  ESP API Docs        →  http://localhost:8001/docs"
fi
echo
echo "  Logs:  $LOGS_DIR/"
echo "  Stop:  ./stop.sh"
echo

# ── 7. Deschide browser dupa 4s ─────────────────────────────────────────────
if ! $BACKGROUND; then
  sleep 4
  open "http://localhost:3000" 2>/dev/null || true
  $START_ESP && { sleep 1; open "http://localhost:8001/dashboard" 2>/dev/null || true; }
fi
