#!/usr/bin/env python3
"""
Serve PickleMatch on your local network.

Why this exists: a badge's QR code holds a link back to the page it was made
on. Open the app as a file, or at localhost, and that link only works on this
computer -- a phone scanning the badge gets nowhere. Started this way, the app
is reachable at this machine's network address, so any phone on the same Wi-Fi
can scan a badge and see the verify screen.

    python serve.py            # or double-click serve.bat on Windows
    PORT=9000 python serve.py  # pick a different port

Everything is served from this folder, read-only, to your local network only
-- anyone on the same Wi-Fi can open it while it runs. Press Ctrl+C to stop.
"""
import http.server
import os
import socket
import socketserver
import sys
import webbrowser

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
FIRST_PORT = int(os.environ.get("PORT", "8000"))
PORT_TRIES = 12


def lan_ip():
    """This machine's address on the local network, or None if offline."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # No packets are sent; this just asks the OS which interface it would
        # use to reach the internet, which is the one the phone shares.
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        return None if ip.startswith("127.") else ip
    except OSError:
        return None
    finally:
        sock.close()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Serve fresh files every time, so edits show up on reload without
        # having to bump the ?v= numbers in index.html.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass  # keep the window readable


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def start():
    last_error = None
    for port in range(FIRST_PORT, FIRST_PORT + PORT_TRIES):
        try:
            return Server(("0.0.0.0", port), Handler), port
        except OSError as exc:
            last_error = exc
    raise SystemExit(
        f"Could not find a free port between {FIRST_PORT} and "
        f"{FIRST_PORT + PORT_TRIES - 1}.\n{last_error}"
    )


def main():
    httpd, port = start()
    ip = lan_ip()
    here = f"http://localhost:{port}/"
    shared = f"http://{ip}:{port}/" if ip else None

    line = "=" * 58
    print(f"\n{line}\n  PickleMatch is running\n{line}")
    if shared:
        print(f"  On this computer : {here}")
        print(f"  On your phone    : {shared}")
        print("\n  Open the phone address on BOTH, so the badges you make")
        print("  carry a link your phone can actually open.")
    else:
        print(f"  On this computer : {here}")
        print("\n  No network address found, so you are offline or on a")
        print("  network that blocks it. Badge QR codes will only open on")
        print("  this computer until you reconnect.")
    print("\n  Windows may ask to allow Python through the firewall.")
    print("  Allow it on Private networks, or your phone cannot connect.")
    print(f"\n  Serving: {DIRECTORY}")
    print("  Press Ctrl+C to stop.\n" + line + "\n")

    try:
        webbrowser.open(shared or here)
    except Exception:
        pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    sys.exit(main())
