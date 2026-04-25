# ShareRoom Remote Control Agent

This local agent runs on the machine being controlled. The browser room page calls it over `http://127.0.0.1:7788` after the user has approved remote control in the room.

## Install

```bash
python3 -m pip install -r agent/requirements.txt
```

## Run

```bash
npm run remote-agent
```

## Notes

- macOS requires Accessibility permission for Terminal or the Python interpreter to control mouse and keyboard.
- This MVP only supports controlling a full display share reliably. Sharing a single window or browser tab is best-effort only.
- The agent only accepts requests from local or private-network ShareRoom origins on ports `3000` and `3001`.
