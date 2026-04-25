import json
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse


HOST = os.environ.get("SHAREROOM_REMOTE_AGENT_HOST", "127.0.0.1")
PORT = int(os.environ.get("SHAREROOM_REMOTE_AGENT_PORT", "7788"))

DEPENDENCY_ERROR = None

try:
    from pynput.keyboard import Controller as KeyboardController
    from pynput.keyboard import Key
    from pynput.mouse import Button
    from pynput.mouse import Controller as MouseController
except Exception as exc:  # pragma: no cover - import failure path
    KeyboardController = None
    Key = None
    Button = None
    MouseController = None
    DEPENDENCY_ERROR = str(exc)


KEYBOARD = KeyboardController() if KeyboardController else None
MOUSE = MouseController() if MouseController else None

SPECIAL_KEYS = {
    "Enter": lambda: Key.enter,
    "Escape": lambda: Key.esc,
    "Backspace": lambda: Key.backspace,
    "Tab": lambda: Key.tab,
    "Delete": lambda: Key.delete,
    "ArrowUp": lambda: Key.up,
    "ArrowDown": lambda: Key.down,
    "ArrowLeft": lambda: Key.left,
    "ArrowRight": lambda: Key.right,
    "Home": lambda: Key.home,
    "End": lambda: Key.end,
    "PageUp": lambda: Key.page_up,
    "PageDown": lambda: Key.page_down,
    " ": lambda: Key.space,
    "Space": lambda: Key.space,
}


def is_private_host(hostname):
    if not hostname:
        return False

    hostname = hostname.lower()
    if hostname in {"localhost", "127.0.0.1", "::1"}:
        return True

    parts = hostname.split(".")
    if len(parts) != 4 or any(not part.isdigit() for part in parts):
        return False

    octets = [int(part) for part in parts]
    if octets[0] == 10:
        return True
    if octets[0] == 172 and 16 <= octets[1] <= 31:
        return True
    if octets[0] == 192 and octets[1] == 168:
        return True
    return False


def origin_is_allowed(origin):
    if not origin:
        return False

    try:
        parsed = urlparse(origin)
    except Exception:
        return False

    if parsed.scheme not in {"http", "https"}:
        return False

    if parsed.port not in {3000, 3001}:
        return False

    return is_private_host(parsed.hostname or "")


def get_screen_size():
    try:
        import tkinter

        root = tkinter.Tk()
        root.withdraw()
        width = int(root.winfo_screenwidth())
        height = int(root.winfo_screenheight())
        root.destroy()
        return width, height
    except Exception:
        return 0, 0


def clamp01(value):
    try:
        numeric = float(value)
    except Exception:
        numeric = 0.5
    return max(0.0, min(1.0, numeric))


def normalize_scroll(delta):
    try:
        numeric = float(delta)
    except Exception:
        return 0

    if abs(numeric) < 1:
        return 0

    steps = int(round(numeric / 120))
    if steps == 0:
        steps = 1 if numeric > 0 else -1
    return steps


def get_target_point(command):
    screen_width, screen_height = get_screen_size()
    if screen_width <= 0 or screen_height <= 0:
        raise RuntimeError("无法获取当前屏幕尺寸")

    x = int(round((screen_width - 1) * clamp01(command.get("x", 0.5))))
    y = int(round((screen_height - 1) * clamp01(command.get("y", 0.5))))
    return x, y


def resolve_key(command):
    key_value = str(command.get("key", "") or "")
    code = str(command.get("code", "") or "")

    if key_value in SPECIAL_KEYS:
        return SPECIAL_KEYS[key_value]()

    if len(key_value) == 1:
        return key_value.lower()

    if code.startswith("Key") and len(code) == 4:
        return code[-1].lower()

    if code.startswith("Digit") and len(code) == 6:
        return code[-1]

    raise RuntimeError(f"暂不支持的按键: {key_value or code or 'unknown'}")


def execute_key_command(command):
    modifiers = []

    if command.get("ctrlKey"):
        KEYBOARD.press(Key.ctrl)
        modifiers.append(Key.ctrl)
    if command.get("shiftKey"):
        KEYBOARD.press(Key.shift)
        modifiers.append(Key.shift)
    if command.get("altKey"):
        KEYBOARD.press(Key.alt)
        modifiers.append(Key.alt)
    if command.get("metaKey"):
        meta_key = Key.cmd if sys.platform == "darwin" else Key.cmd
        KEYBOARD.press(meta_key)
        modifiers.append(meta_key)

    target_key = resolve_key(command)
    KEYBOARD.press(target_key)
    KEYBOARD.release(target_key)

    for key in reversed(modifiers):
        KEYBOARD.release(key)


def ensure_command_allowed(capture):
    display_surface = str((capture or {}).get("displaySurface", "") or "").strip()
    if display_surface and display_surface != "monitor":
        raise RuntimeError("当前仅支持整屏共享的真实远控，请选择共享整个屏幕")


def execute_command(command, capture):
    if DEPENDENCY_ERROR:
        raise RuntimeError(f"缺少依赖 pynput，请先安装: {DEPENDENCY_ERROR}")

    ensure_command_allowed(capture)

    command_type = str(command.get("type", "") or "").strip()
    if command_type not in {"click", "double-click", "contextmenu", "wheel", "keydown"}:
        raise RuntimeError(f"不支持的命令类型: {command_type or 'unknown'}")

    if command_type == "keydown":
        execute_key_command(command)
        return {"type": command_type}

    x, y = get_target_point(command)
    MOUSE.position = (x, y)

    if command_type == "click":
        MOUSE.click(Button.left, 1)
    elif command_type == "double-click":
        MOUSE.click(Button.left, 2)
    elif command_type == "contextmenu":
        MOUSE.click(Button.right, 1)
    elif command_type == "wheel":
        delta_x = normalize_scroll(command.get("deltaX", 0))
        delta_y = normalize_scroll(command.get("deltaY", 0))
        if delta_x or delta_y:
            MOUSE.scroll(delta_x, -delta_y)

    return {
        "type": command_type,
        "x": x,
        "y": y,
    }


class RequestHandler(BaseHTTPRequestHandler):
    server_version = "ShareRoomRemoteAgent/0.1"

    def log_message(self, format, *args):
        return

    def _send_json(self, status_code, payload):
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))

        origin = self.headers.get("Origin", "")
        if origin_is_allowed(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

        self.end_headers()
        self.wfile.write(encoded)

    def do_OPTIONS(self):
        origin = self.headers.get("Origin", "")
        if not origin_is_allowed(origin):
            self._send_json(403, {"ok": False, "message": "origin not allowed"})
            return

        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path != "/health":
            self._send_json(404, {"ok": False, "message": "not found"})
            return

        screen_width, screen_height = get_screen_size()
        self._send_json(
            200,
            {
                "ok": True,
                "dependencyReady": DEPENDENCY_ERROR is None,
                "dependencyError": DEPENDENCY_ERROR,
                "screenWidth": screen_width,
                "screenHeight": screen_height,
                "requiresAccessibilityPermission": sys.platform == "darwin",
            },
        )

    def do_POST(self):
        if self.path != "/execute":
            self._send_json(404, {"ok": False, "message": "not found"})
            return

        origin = self.headers.get("Origin", "")
        if not origin_is_allowed(origin):
            self._send_json(403, {"ok": False, "message": "origin not allowed"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0") or "0")
            raw_body = self.rfile.read(length)
            payload = json.loads(raw_body.decode("utf-8") or "{}")
            command = payload.get("command") or {}
            capture = payload.get("capture") or {}
            result = execute_command(command, capture)
            self._send_json(200, {"ok": True, "result": result})
        except Exception as exc:  # pragma: no cover - runtime path
            self._send_json(
                500,
                {
                    "ok": False,
                    "message": str(exc),
                    "trace": traceback.format_exc(limit=1),
                },
            )


def main():
    print(f"ShareRoom Remote Agent listening on http://{HOST}:{PORT}")
    if DEPENDENCY_ERROR:
        print("Dependency check failed. Install requirements before using remote control.")
        print(f"Import error: {DEPENDENCY_ERROR}")
    if sys.platform == "darwin":
        print("macOS requires Accessibility permission for Terminal/Python to control mouse and keyboard.")

    server = ThreadingHTTPServer((HOST, PORT), RequestHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
