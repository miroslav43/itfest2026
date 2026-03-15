#!/usr/bin/env zsh
# ─────────────────────────────────────────────────────────────────────────────
#  start-mobile.sh — build APK complet + pornire backend pe WiFi local
#
#  Ce face:
#    1. Detecteaza IP-ul local al laptopului (WiFi)
#    2. Porneste Backend-ul FastAPI pe 0.0.0.0:8000
#    3. Build static Next.js cu NEXT_PUBLIC_API_URL=http://<IP>:8000
#    4. npx cap sync android
#    5. ./gradlew assembleDebug  →  APK gata
#
#  Utilizare:
#    ./start-mobile.sh              # build complet + backend
#    ./start-mobile.sh --no-backend # doar APK, fara sa porneasca backend-ul
#    ./start-mobile.sh --backend-only # doar porneste backend-ul
# ─────────────────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo "${GREEN}✓${NC} $*"; }
warn() { echo "${YELLOW}⚠${NC}  $*"; }
err()  { echo "${RED}✗${NC} $*"; exit 1; }
info() { echo "${CYAN}→${NC} $*"; }
hdr()  { echo; echo "${BOLD}━━━ $* ━━━${NC}"; echo; }

# ── Argumente ────────────────────────────────────────────────────────────────
START_BACKEND=true
BACKEND_ONLY=false

for arg in "$@"; do
  case $arg in
    --no-backend)    START_BACKEND=false ;;
    --backend-only)  BACKEND_ONLY=true ;;
    --help|-h)
      echo "Utilizare: ./start-mobile.sh [--no-backend] [--backend-only]"
      exit 0 ;;
  esac
done

# ── Directoare ───────────────────────────────────────────────────────────────
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
ANDROID_DIR="$FRONTEND_DIR/android"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
LOGS_DIR="$ROOT/logs"
TMP_DIR="/tmp/itfest_mobile"

mkdir -p "$LOGS_DIR" "$TMP_DIR"

hdr "Solemtrix Mobile Build"

# ── 1. Detectare IP WiFi ──────────────────────────────────────────────────────
hdr "Detectare IP local (WiFi)"

LOCAL_IP=""
for iface in en0 en1 en2 en3; do
  ip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
  if [[ -n "$ip" ]]; then
    LOCAL_IP="$ip"
    ok "IP detectat pe $iface: ${BOLD}$LOCAL_IP${NC}"
    break
  fi
done

if [[ -z "$LOCAL_IP" ]]; then
  LOCAL_IP=$(ifconfig | awk '/inet / && !/127\.0\.0\.1/ {print $2; exit}')
fi

[[ -z "$LOCAL_IP" ]] && err "Nu am putut detecta IP-ul local. Esti conectat la WiFi?"

API_URL="http://$LOCAL_IP:8000"
info "Telefonul va accesa backend-ul la: ${BOLD}$API_URL${NC}"
warn "Asigura-te ca telefonul e pe acelasi WiFi ca laptopul!"

# ── 2. Verificare dependinte ─────────────────────────────────────────────────
hdr "Verificare dependinte"

for cmd in python3 node npm; do
  command -v "$cmd" &>/dev/null && ok "$cmd" || err "$cmd nu e gasit"
done

[[ ! -f "$BACKEND_DIR/.env" ]] && cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env" && warn "backend/.env creat din .env.example — completeaza valorile"
[[ ! -d "$FRONTEND_DIR/node_modules" ]] && { info "npm install..."; (cd "$FRONTEND_DIR" && npm install --silent); ok "npm install complet"; } || ok "node_modules exista"

# ── 3. Pornire backend ────────────────────────────────────────────────────────
if $START_BACKEND; then
  hdr "Pornire Backend FastAPI (port 8000)"

  pids=$(lsof -ti tcp:8000 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    warn "Port 8000 ocupat — il eliberez..."
    echo "$pids" | xargs kill -TERM 2>/dev/null || true
    sleep 1
    pids=$(lsof -ti tcp:8000 2>/dev/null || true)
    [[ -n "$pids" ]] && echo "$pids" | xargs kill -KILL 2>/dev/null || true
  fi

  BACKEND_SCRIPT="$TMP_DIR/backend.command"
  cat > "$BACKEND_SCRIPT" <<SCRIPT
#!/usr/bin/env zsh
echo "━━━ Solemtrix Backend — http://$LOCAL_IP:8000 ━━━"
cd "$BACKEND_DIR"
pip install -r requirements.txt -q
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
SCRIPT
  chmod +x "$BACKEND_SCRIPT"
  open -a Terminal "$BACKEND_SCRIPT"
  ok "Backend pornit in fereastra separata"

  info "Astept sa fie gata (max 15s)..."
  for i in $(seq 1 15); do
    sleep 1
    curl -s "http://localhost:8000/docs" &>/dev/null && ok "Backend gata dupa ${i}s" && break
    printf "  %ds...\r" "$i"
  done
  echo
fi

if $BACKEND_ONLY; then
  echo; echo "  Backend:  http://localhost:8000"
  echo "  WiFi:     $API_URL"
  exit 0
fi

# ── 4. Build static Next.js ──────────────────────────────────────────────────
hdr "Build Next.js static"
info "API URL baked in APK: ${BOLD}$API_URL${NC}"
info "Dureaza ~30-60s..."

cd "$FRONTEND_DIR"
[[ -d "out" ]]   && rm -rf out   && warn "Sters out/ vechi"
[[ -d ".next" ]] && rm -rf .next && warn "Sters .next/ cache"

# Citeste cheile din .env.local
GMAPS_KEY=$(grep  'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'   .env.local 2>/dev/null | cut -d= -f2-)
PICO_KEY=$(grep   'NEXT_PUBLIC_PICOVOICE_ACCESS_KEY'  .env.local 2>/dev/null | cut -d= -f2-)

NEXT_PUBLIC_API_URL="$API_URL" \
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="$GMAPS_KEY" \
NEXT_PUBLIC_PICOVOICE_ACCESS_KEY="$PICO_KEY" \
BUILD_TARGET=mobile \
npx next build || err "Build Next.js esuat!"

ok "Build complet → out/"

# ── 5. Capacitor sync ─────────────────────────────────────────────────────────
hdr "Capacitor Sync → Android"
npx cap sync android || err "cap sync esuat!"
ok "Bundle copiat in proiectul Android"

# ── 6. Gradle — build APK ────────────────────────────────────────────────────
hdr "Build APK (Gradle)"
info "Dureaza 2-5 minute la primul build, ~30s dupa..."

cd "$ANDROID_DIR"
./gradlew assembleDebug || err "Gradle build esuat! Verifica erorile de mai sus."

ok "APK generat!"
echo
echo "  ${BOLD}${GREEN}APK se afla la:${NC}"
echo "  ${BOLD}$APK_PATH${NC}"
echo
# Deschide folderul in Finder
open "$(dirname "$APK_PATH")"

# ── 7. Rezumat ────────────────────────────────────────────────────────────────
hdr "Gata!"
echo "  Backend:   ${BOLD}http://localhost:8000${NC}  (accesibil pe WiFi la $API_URL)"
echo "  APK:       ${BOLD}$APK_PATH${NC}"
echo ""
echo "  Instaleaza APK-ul pe telefon:"
echo "    - Trimite fisierul .apk pe telefon (AirDrop, Google Drive, USB)"
echo "    - Sau:  adb install $APK_PATH"
echo ""
warn "Daca IP-ul laptopului se schimba, ruleaza din nou ./start-mobile.sh"
