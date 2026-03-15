#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# find_devices.sh  —  Discover ESP32 & ESP32-CAM on local WiFi
#
# Usage:
#   ./find_devices.sh                   # scan auto-detected subnet
#   ./find_devices.sh 10.210.85         # force subnet prefix
#   ./find_devices.sh --update-env      # also patch .env after finding devices
#   ./find_devices.sh 10.210.85 --update-env
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/imageDetection/find_devices.py"
CONDA_ENV="itfest"

# ── Parse args ────────────────────────────────────────────────────────────────
SUBNET_ARG=""
UPDATE_ENV=""

for arg in "$@"; do
  case "$arg" in
    --update-env) UPDATE_ENV="--update-env" ;;
    --*)          echo "Unknown flag: $arg"; exit 1 ;;
    *)            SUBNET_ARG="--subnet $arg" ;;
  esac
done

# ── Activate conda env ────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       ESP32 Device Discovery Scanner             ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

if ! command -v conda &>/dev/null; then
  echo "ERROR: conda not found. Activate the itfest env manually and run:"
  echo "  python $PYTHON_SCRIPT $SUBNET_ARG $UPDATE_ENV"
  exit 1
fi

# Use conda run so the env doesn't need to be activated in the current shell
conda run -n "$CONDA_ENV" python "$PYTHON_SCRIPT" $SUBNET_ARG $UPDATE_ENV

echo ""
echo "Done."
