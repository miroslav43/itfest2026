"""
ESP32 / ESP32-CAM network scanner.

Scans the local subnet (auto-detected or passed via --subnet) in parallel,
fingerprints each responding host, and optionally patches .env with the
discovered IPs.

Usage:
    python find_devices.py                        # auto-detect subnet
    python find_devices.py --subnet 10.210.85     # explicit /24 prefix
    python find_devices.py --update-env           # also write IPs to .env
    python find_devices.py --timeout 0.5          # faster (less reliable on bad WiFi)
"""
import argparse
import ipaddress
import re
import socket
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import httpx

ENV_PATH = Path(__file__).parent / ".env"
TIMEOUT  = 2.5      # seconds per probe (ESP /json reads 3 distance sensors ≈ 1.5s)
WORKERS  = 100      # parallel probes


# ── Fingerprinting ────────────────────────────────────────────────────────────

def _probe(ip: str, timeout: float) -> dict | None:
    """
    Try the known ESP endpoints on port 80.
    Returns a dict with "ip", "type", "details" or None if unreachable.

    Strategy: first try /status (plain text, instant response on both boards)
    to quickly detect ESP32 devices, then use /json for classification if needed.
    """
    base = f"http://{ip}"

    def get(path: str, t: float | None = None) -> httpx.Response | None:
        try:
            r = httpx.get(f"{base}{path}", timeout=t or timeout)
            return r if r.status_code == 200 else None
        except Exception:
            return None

    # ── Phase 1: /status probe (text response, lighter than /json) ──────────
    r = get("/status")
    if not r:
        return None   # host not responding at all — skip expensive probes

    text = r.text

    # ESP32 sensor board /status contains "ESP32 STATUS" and "M1:"
    if "ESP32 STATUS" in text and "M1:" in text:
        # Classify as sensor board — optionally fetch full /json for details
        details: dict = {"status_snippet": text[:120]}
        rj = get("/json")
        if rj:
            try:
                data = rj.json()
                sensors = data.get("sensors", {})
                dist = sensors.get("distance", {})
                dht = sensors.get("dht11", {})
                details = {
                    "sensor1_cm": dist.get("sensor1_cm"),
                    "dht_temp": dht.get("temperature"),
                    "mq135_raw": sensors.get("mq135", {}).get("raw"),
                }
            except Exception:
                pass
        return {
            "ip": ip,
            "type": "ESP32_SENSORS",
            "label": "ESP32 Sensor/Motor board",
            "details": details,
        }

    # ESP32-CAM /status contains "ESP32-CAM STATUS"
    if "ESP32-CAM" in text:
        details = {"status_snippet": text[:120]}
        rj = get("/json")
        if rj:
            try:
                data = rj.json()
                details = {
                    "rssi": data.get("rssi"),
                    "flash": data.get("flash"),
                    "free_heap": data.get("free_heap"),
                }
            except Exception:
                pass
        return {
            "ip": ip,
            "type": "ESP32_CAM",
            "label": "ESP32-CAM",
            "details": details,
        }

    # ── Phase 2: try /capture for cameras that don't have our /status ─────────
    r = get("/capture")
    if r and r.headers.get("content-type", "").startswith("image/"):
        return {
            "ip": ip,
            "type": "ESP32_CAM",
            "label": "ESP32-CAM",
            "details": {"capture_size_bytes": len(r.content)},
        }

    # ── Phase 3: generic ESP32 detection ──────────────────────────────────────
    if "ESP32" in text or "esp32" in text.lower():
        return {
            "ip": ip,
            "type": "ESP32_UNKNOWN",
            "label": "ESP32 (unknown role)",
            "details": {"snippet": text[:80]},
        }

    return None


# ── Subnet detection ──────────────────────────────────────────────────────────

def _local_subnet() -> str:
    """
    Return the first non-loopback /24 prefix of the machine's IP
    (e.g. '10.210.85' from '10.210.85.12').
    """
    # macOS / Linux: use socket to get outbound IP
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        parts = ip.split(".")
        if parts[0] not in ("127", "169"):
            return ".".join(parts[:3])
    except Exception:
        pass

    # Fallback: parse `ifconfig` output
    try:
        out = subprocess.check_output(["ifconfig"], text=True, stderr=subprocess.DEVNULL)
        for match in re.finditer(r"inet (\d+\.\d+\.\d+\.\d+)", out):
            ip = match.group(1)
            if not ip.startswith("127.") and not ip.startswith("169."):
                return ".".join(ip.split(".")[:3])
    except Exception:
        pass

    return "192.168.1"


# ── .env patcher ─────────────────────────────────────────────────────────────

def _update_env(esp_ip: str | None, cam_ip: str | None) -> None:
    if not ENV_PATH.exists():
        print(f"[ENV] {ENV_PATH} not found, skipping update.")
        return

    text = ENV_PATH.read_text()

    if esp_ip:
        text = re.sub(r"^ESP_IP=.*$", f"ESP_IP={esp_ip}", text, flags=re.MULTILINE)
        print(f"[ENV] ESP_IP set to {esp_ip}")
    if cam_ip:
        text = re.sub(r"^CAM_IP=.*$", f"CAM_IP={cam_ip}", text, flags=re.MULTILINE)
        print(f"[ENV] CAM_IP set to {cam_ip}")

    ENV_PATH.write_text(text)
    print(f"[ENV] Saved {ENV_PATH}")


# ── Main ──────────────────────────────────────────────────────────────────────

def scan(subnet: str, timeout: float) -> list[dict]:
    ips = [f"{subnet}.{i}" for i in range(1, 255)]
    found: list[dict] = []

    print(f"\nScanning {subnet}.1 – {subnet}.254  ({len(ips)} hosts, {WORKERS} parallel) …\n")

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(_probe, ip, timeout): ip for ip in ips}
        done = 0
        for fut in as_completed(futures):
            done += 1
            result = fut.result()
            if result:
                found.append(result)
                _print_device(result)
            # Simple progress every 50 hosts
            if done % 50 == 0:
                print(f"  … {done}/{len(ips)} checked, {len(found)} device(s) found so far")

    return found


def _print_device(d: dict) -> None:
    icon = "📷" if d["type"] == "ESP32_CAM" else "🔧" if d["type"] == "ESP32_SENSORS" else "❓"
    print(f"\n  {icon}  {d['label']}")
    print(f"     IP      : {d['ip']}")
    print(f"     Details : {d['details']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Scan local network for ESP32 devices")
    parser.add_argument("--subnet",     default=None,  help="IP prefix, e.g. 10.210.85")
    parser.add_argument("--timeout",    type=float, default=TIMEOUT)
    parser.add_argument("--update-env", action="store_true",
                        help="Write found IPs back to .env automatically")
    args = parser.parse_args()

    subnet = args.subnet or _local_subnet()
    print(f"Local subnet detected: {subnet}.0/24")

    found = scan(subnet, args.timeout)

    print(f"\n{'═'*55}")
    print(f"  Scan complete — {len(found)} ESP device(s) found on {subnet}.x")
    print(f"{'═'*55}\n")

    if not found:
        print("  Nothing found. Check that your Mac is on the same WiFi as the ESP32s.")
        sys.exit(1)

    # Categorise
    esp_ip = next((d["ip"] for d in found if d["type"] == "ESP32_SENSORS"), None)
    cam_ip = next((d["ip"] for d in found if d["type"] == "ESP32_CAM"),     None)

    for d in found:
        _print_device(d)

    print()
    if esp_ip: print(f"  ESP_IP = {esp_ip}")
    if cam_ip: print(f"  CAM_IP = {cam_ip}")
    print()

    if args.update_env:
        _update_env(esp_ip, cam_ip)
    else:
        print("  Tip: run with --update-env to automatically patch .env")


if __name__ == "__main__":
    main()
