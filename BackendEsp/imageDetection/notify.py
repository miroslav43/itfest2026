"""
macOS desktop notifications via osascript.
Drop-in replacement for Linux notify-send.
"""
import subprocess


def send_notification(title: str, body: str) -> None:
    """Fire a macOS notification banner. Non-blocking, errors are silently swallowed."""
    script = (
        f'display notification "{body}" with title "{title}" '
        f'sound name "Ping"'
    )
    try:
        subprocess.Popen(
            ["osascript", "-e", script],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception as exc:
        print(f"[NOTIFY] osascript failed: {exc}")
