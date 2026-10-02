from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import frida
except Exception:
    print("frida Python module not found.")
    print("Install with: py -m pip install frida frida-tools")
    raise

PACKAGE = "com.hariwn.legendofcivilizations"
HERE = Path(__file__).resolve().parent
AGENT = HERE / "FM_NEXT_OPPONENT_WATCH.js"
OUT = HERE / "FM_NEXT_OPPONENT_RESULT.jsonl"


def stamp() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def main() -> int:
    if not AGENT.exists():
        print(f"Agent missing: {AGENT}")
        return 2

    print("Forge Master 2.9.0 - next opponent assignment watcher")
    print(f"Package : {PACKAGE}")
    print(f"Output  : {OUT}")
    print("This does not guess a clan name. It records the opponent immediately when the game server assigns it.")
    print()

    device = frida.get_usb_device(timeout=15)
    spawned = False

    try:
        pid = device.get_process(PACKAGE).pid
        print(f"[{stamp()}] attaching to running game pid={pid}")
    except Exception:
        print(f"[{stamp()}] game not running -> starting it")
        pid = device.spawn([PACKAGE])
        spawned = True

    session = device.attach(pid)
    source = AGENT.read_text(encoding="utf-8")
    script = session.create_script(source)

    def on_message(message, data):
        rec = {
            "host_ts": stamp(),
            "frida": message,
        }
        if message.get("type") == "send":
            payload = message.get("payload")
            if isinstance(payload, dict):
                rec = payload | {"host_ts": stamp()}
                typ = payload.get("type")
                if typ == "opponent_assigned":
                    print()
                    print("=" * 64)
                    print("NEW GUILD WAR OPPONENT ASSIGNED")
                    print(f"Name   : {payload.get('opponent_name','')}")
                    print(f"Tag    : {payload.get('opponent_tag','')}")
                    print(f"Tier   : {payload.get('opponent_tier',-1)}")
                    print(f"Server : {payload.get('opponent_server','')}")
                    print(f"Day    : {payload.get('current_day',-1)}")
                    print("=" * 64)
                elif typ == "status":
                    print(f"[{stamp()}] {payload.get('state')}")
                elif typ == "error":
                    print(f"[{stamp()}] agent error: {payload.get('error')}")
        else:
            print(f"[{stamp()}] FRIDA: {message}")

        with OUT.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    script.on("message", on_message)
    script.load()

    if spawned:
        device.resume(pid)

    print("Watcher running. Leave this window open. Ctrl+C to stop.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        try:
            session.detach()
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
