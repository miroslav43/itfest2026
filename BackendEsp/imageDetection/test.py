"""
Wi-Fi AP proximity tracker.

Scans for a target SSID (or BSSID), converts RSSI → estimated distance,
and shows a live trend so you can physically walk toward the AP.

Works on macOS (airport utility) and Linux (nmcli).

Usage:
    python test.py
"""
import platform
import re
import subprocess
import time
from collections import deque
from pathlib import Path

# ── Configuration ─────────────────────────────────────────────────────────────

TARGET_SSID  = "HGGuest"
TARGET_BSSID = None          # set to e.g. "aa:bb:cc:dd:ee:ff" to match by MAC

# RSSI (dBm) measured at exactly 1 metre from the AP.
# Calibrate by standing 1 m away and recording the RSSI; typical range: -40 to -55.
A = -45

# Path-loss exponent:  2.0 = open space,  2.5–3.5 = indoor walls
N = 2.8

# How many readings to average (smooths out momentary spikes)
HISTORY_SIZE = 5

SCAN_INTERVAL = 3   # seconds between scans

# ── Distance model ────────────────────────────────────────────────────────────

def rssi_to_distance(rssi: float, a: float = A, n: float = N) -> float:
    """Log-distance path-loss model: d = 10^((A - rssi) / (10 * N))."""
    return 10 ** ((a - rssi) / (10 * n))

# ── Display helpers ───────────────────────────────────────────────────────────

def signal_bars(rssi: float) -> str:
    """Return a visual strength indicator with a label."""
    if rssi >= -50:
        return "▓▓▓▓▓  Excellent"
    if rssi >= -60:
        return "▓▓▓▓░  Good"
    if rssi >= -70:
        return "▓▓▓░░  Fair"
    if rssi >= -80:
        return "▓▓░░░  Poor"
    return "▓░░░░  Very poor"

def trend_label(history: deque) -> str:
    """Compare the newest reading against the oldest in the window."""
    if len(history) < 2:
        return "…  Collecting data"
    delta = history[-1] - history[0]   # positive = signal improved = closer
    if delta > 2:
        return "↑  Getting CLOSER"
    if delta < -2:
        return "↓  Moving FARTHER"
    return "→  Stable"

# ── Platform-specific scanners ────────────────────────────────────────────────

# airport CLI was removed in macOS 15 Sequoia; try both known paths anyway
_AIRPORT_PATHS = [
    "/System/Library/PrivateFrameworks/Apple80211.framework"
    "/Versions/Current/Resources/airport",
    "/usr/sbin/airport",
]
_BSSID_RE = re.compile(
    r"^(.+?)\s+"
    r"([\da-fA-F]{2}:[\da-fA-F]{2}:[\da-fA-F]{2}"
    r":[\da-fA-F]{2}:[\da-fA-F]{2}:[\da-fA-F]{2})"
    r"\s+(-\d+)"
)


def _scan_macos() -> list[dict]:
    """
    Scan on macOS.  Three methods tried in order:

    1. CoreWLAN scan with Location Services → full SSID + BSSID + RSSI.
    2. CoreWLAN connected-interface fallback → RSSI only (no Location needed).
       Reported under TARGET_SSID so find_target() still matches it.
       Works when you are already connected to the target AP.
    3. airport CLI → for macOS < 15 Sequoia (where the binary still exists).

    macOS Sequoia hides SSIDs/BSSIDs from scan results unless Terminal
    has Location Services access.
    Enable:  System Settings → Privacy & Security → Location Services
             → scroll to bottom → enable for Terminal (or your IDE).
    """
    # ── Method 1: CoreWLAN full scan (requires Location Services) ────────────
    try:
        import CoreWLAN  # type: ignore[import]

        iface = CoreWLAN.CWInterface.interface()
        if iface is not None:
            networks, _ = iface.scanForNetworksWithName_includeHidden_error_(
                None, True, None
            )
            named = [
                {
                    "ssid":  str(net.ssid()),
                    "bssid": str(net.bssid()),
                    "rssi":  int(net.rssiValue()),
                }
                for net in (networks or [])
                if net.ssid() is not None and net.bssid() is not None
            ]
            if named:
                return named

            # SSIDs are None → Location Services not granted.
            # Fall back to connected-interface RSSI so we can still track
            # the AP we're currently associated to.
            rssi = iface.rssiValue()
            if rssi != 0:
                print(
                    "[note] SSID hidden — Location Services not enabled for "
                    "this terminal.\n"
                    "       Tracking connected AP via RSSI only. SSID match "
                    f"assumed to be '{TARGET_SSID}'.\n"
                    "       To fix: System Settings → Privacy & Security → "
                    "Location Services → enable Terminal."
                )
                return [{"ssid": TARGET_SSID, "bssid": "??:??:??:??:??:??", "rssi": rssi}]

    except ImportError:
        pass   # fall through to airport CLI
    except Exception as exc:
        print(f"[warn] CoreWLAN error: {exc}")

    # ── Method 2: airport CLI (removed in macOS 15 Sequoia) ──────────────────
    for path in _AIRPORT_PATHS:
        if not Path(path).exists():
            continue
        res = subprocess.run([path, "-s"], capture_output=True, text=True, timeout=10)
        networks = []
        for line in res.stdout.splitlines():
            m = _BSSID_RE.match(line)
            if m:
                networks.append({
                    "ssid":  m.group(1).strip(),
                    "bssid": m.group(2),
                    "rssi":  int(m.group(3)),
                })
        if networks:
            return networks

    print(
        "[error] No Wi-Fi scanner available.\n"
        "        Install CoreWLAN bindings:  pip install pyobjc-framework-CoreWLAN"
    )
    return []


def _scan_linux() -> list[dict]:
    """Use nmcli (signal is 0-100 %; converts to approximate dBm)."""
    try:
        result = subprocess.run(
            ["nmcli", "-t", "-f", "SSID,BSSID,SIGNAL", "dev", "wifi", "list"],
            capture_output=True, text=True, timeout=10,
        )
    except FileNotFoundError:
        print("[error] nmcli not found. Install NetworkManager.")
        return []

    if result.returncode != 0:
        print("[error] nmcli scan failed:", result.stderr.strip())
        return []

    networks = []
    for line in result.stdout.strip().splitlines():
        if not line:
            continue
        # BSSID contains colons — split carefully
        parts = line.split(":")
        if len(parts) < 8:
            continue
        try:
            signal = int(parts[7])
        except ValueError:
            continue
        networks.append({
            "ssid":  parts[0],
            "bssid": ":".join(parts[1:7]),
            "rssi":  (signal / 2) - 100,   # percent → approximate dBm
        })
    return networks


def scan_wifi() -> list[dict]:
    """Dispatch to the correct scanner for the current OS."""
    os_name = platform.system()
    if os_name == "Darwin":
        return _scan_macos()
    if os_name == "Linux":
        return _scan_linux()
    print(f"[error] Unsupported OS: {os_name}")
    return []


def find_target(
    networks: list[dict],
    target_ssid: str | None = None,
    target_bssid: str | None = None,
) -> dict | None:
    """Return the first network matching the BSSID (preferred) or SSID."""
    for net in networks:
        if target_bssid and net["bssid"].lower() == target_bssid.lower():
            return net
        if target_ssid and net["ssid"] == target_ssid:
            return net
    return None

# ── Main loop ─────────────────────────────────────────────────────────────────

def main() -> None:
    rssi_history: deque[float] = deque(maxlen=HISTORY_SIZE)

    print(f"Tracking: '{TARGET_SSID}'   (A={A} dBm @ 1 m,  N={N})")
    print("Walk toward the AP — distance decreases as signal improves.\n")

    while True:
        nets   = scan_wifi()
        target = find_target(nets, TARGET_SSID, TARGET_BSSID)

        if target:
            rssi = target["rssi"]
            rssi_history.append(rssi)
            avg_rssi = sum(rssi_history) / len(rssi_history)
            dist     = rssi_to_distance(avg_rssi)

            print(f"  SSID      : {target['ssid']}")
            print(f"  BSSID     : {target['bssid']}")
            print(f"  RSSI      : {rssi:.0f} dBm  (avg {avg_rssi:.1f} dBm)")
            print(f"  Distance  : ~{dist:.2f} m")
            print(f"  Signal    : {signal_bars(rssi)}")
            print(f"  Trend     : {trend_label(rssi_history)}")
        else:
            rssi_history.clear()
            print(f"  AP '{TARGET_SSID}' not found in scan.")

        print("-" * 45)
        time.sleep(SCAN_INTERVAL)


if __name__ == "__main__":
    main()
