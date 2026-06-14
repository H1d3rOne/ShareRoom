<p align="center">
  <h1 align="center">ShareRoom</h1>
  <p align="center">A real-time collaboration room for screen, file, webpage, live stream, voice/video, and game sharing.</p>
  <p align="center">
    <a href="README.md">简体中文</a> · <a href="README_EN.md"><strong>English</strong></a>
  </p>
  <p align="center">
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0--only-blue.svg"></a>
    <img alt="Vue" src="https://img.shields.io/badge/Vue-3-42b883.svg">
    <img alt="Vite" src="https://img.shields.io/badge/Vite-4-646cff.svg">
    <img alt="Node" src="https://img.shields.io/badge/Node.js-%3E%3D16-339933.svg">
    <img alt="Socket.IO" src="https://img.shields.io/badge/Socket.IO-4-black.svg">
  </p>
</p>

---

## Table of Contents

- [Features](#features)
- [Feature Overview](#feature-overview)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Start & Stop Scripts](#start--stop-scripts)
- [Live Stream Sharing](#live-stream-sharing)
- [Environment Variables](#environment-variables)
- [Screenshots](#screenshots)
- [Project Structure](#project-structure)
- [Tests](#tests)
- [License](#license)

## Features

| Area | Capabilities |
| --- | --- |
| Shared stage | Screen / tab / webpage sharing, image/video/audio preview, and streaming playback |
| Live streams | Douyin, Bilibili, and Migu Video room resolving, plus direct HLS / FLV URLs |
| Real-time media | WebRTC P2P voice/video calls with optional LiveKit support |
| Games | Gomoku and Landlord multiplayer games; the game menu can be opened/closed with **Game Share** |
| Collaboration | Room chat, member list, admin permissions, and synchronized shared controls |
| Operations | Built-in install, start, stop, and uninstall scripts with optional Nginx + HTTPS setup |

## Feature Overview

ShareRoom is centered around a shared stage. Once an admin starts sharing, room members see the same content, playback state, and interaction results, making it suitable for remote collaboration, group watching, and lightweight online meetings.

### File Sharing

Upload local files and share them in the room. Common images, videos, and audio files can be previewed or played directly, while other file types are displayed as file cards for quick identification, opening, or download.

### Screen Sharing

Share an entire screen, an application window, or a browser tab. It is useful for demos, remote assistance, walkthroughs, synchronized page viewing, and content explanation. Browser screen sharing depends on browser support and is recommended over HTTPS or a local secure context.

### Webpage Sharing

Admins can enter a webpage URL and show it on the shared stage. Recent webpage history is kept for quick reuse, making it convenient to open documents, references, previews, or online content together.

### Live Stream Sharing

Paste Douyin, Bilibili, or Migu Video live URLs and let the backend resolve them into playable video streams. Direct HLS `.m3u8` and FLV `.flv` stream URLs are also supported. Live streams are proxied through the backend to handle CORS, temporary auth, Range requests, and HTTPS mixed-content playback issues.

### Game Sharing

Built-in Gomoku and Landlord games are available. Admins can click **Game Share** to open the game menu and start a match. If there is no active invite or match, clicking **Game Share** again closes the game menu.

### Voice, Video, and Chat

Room members can enable microphone and camera for real-time communication, or use text chat to discuss shared content.

## Tech Stack

- **Frontend:** Vue 3, Vite, hls.js, flv.js, WebRTC
- **Backend:** Node.js, Express 5, Socket.IO
- **Optional realtime service:** LiveKit
- **Tests:** `node:test`
- **Deployment:** Bash scripts, Nginx, Let's Encrypt (optional)

## Quick Start

### Requirements

- Node.js >= 16
- npm
- A modern desktop browser (latest Chrome / Edge / Safari recommended)
- HTTPS or a local secure context is recommended for screen sharing

### Local Development

```bash
git clone https://github.com/H1d3rOne/ShareRoom.git
cd ShareRoom

npm install
cd server && npm install && cd ..

# Start backend and frontend together
./start_dev.sh
```

Default URLs:

- Frontend dev server: `http://127.0.0.1:3001`
- Backend signaling/API: `http://127.0.0.1:3002`

To start them manually in separate terminals:

```bash
node server/server.js   # backend :3002
npx vite                # frontend :3001
```

### Production

```bash
./start.sh
```

Stop the production service:

```bash
./stop.sh
```

The production service listens on `http://127.0.0.1:3002` by default.

## Start & Stop Scripts

### Script Commands

| Command | Description |
| --- | --- |
| `./start_dev.sh` | Start backend `:3002` and frontend `:3001` for development |
| `./start.sh` | Install dependencies, build frontend assets, and start production service in the background |
| `./stop.sh` | Stop the background production service and clean residual processes |
| `./install.sh` | Interactive deployment setup with optional Nginx / HTTPS / Let's Encrypt |
| `./uninstall.sh` | Stop service, remove ShareRoom Nginx config, and clean `.run/` |

### Background Service Scripts

```bash
./start.sh
./stop.sh
```

`start.sh` does the following:

1. Stops any existing ShareRoom process
2. Installs project dependencies
3. Builds frontend assets
4. Starts `node server/server.js` in the background
5. Writes runtime files:
   - PID: `.run/shareroom.pid`
   - Log: `.run/shareroom.log`

View logs:

```bash
tail -f .run/shareroom.log
```

### One-Click Deployment

For Linux servers based on apt distros:

```bash
./install.sh
./start.sh
./stop.sh
```

`install.sh` guides you through:

1. Installing frontend and backend dependencies
2. Asking whether to configure a domain
3. Asking whether to enable HTTPS, and installing certbot for Let's Encrypt certificates
4. Configuring the application port (`3002` by default), Nginx reverse proxy, and SSL
5. Falling back to `8443` if port `443` is occupied

Remove runtime configuration written by ShareRoom:

```bash
./uninstall.sh
```

> `uninstall.sh` does not remove source code, `node_modules`, `dist`, or system Node/npm. It only stops ShareRoom, removes ShareRoom Nginx site files, and cleans `.run/`.

## Live Stream Sharing

Click **Live Share** in the room toolbar and choose one of the following:

- **Auto Detect:** paste a Douyin, Bilibili, or Migu Video live URL
- **Douyin / Bilibili / Migu Video:** explicitly select a platform resolver
- **HLS / FLV:** enter a `.m3u8` or `.flv` stream URL directly

Migu Video supports:

- `https://www.miguvideo.com/...` live URLs
- Migu links embedded in share text
- Plain numeric program IDs, e.g. `608807420`
- Match links with `mgdbId`, e.g. `https://www.miguvideo.com/p/live/120000578412`

Resolving and playback notes:

- Platform room URLs are resolved by the backend `/api/resolve-livestream` endpoint.
- HLS playlists and FLV streams are proxied through the backend by default to avoid CORS, temporary auth, Range request, and HTTPS mixed-content issues.
- Migu Video defaults to `MIGU_RATE_TYPE=3`; when unauthenticated or without entitlement, the upstream service may automatically downgrade the returned quality.

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | No | `3002` | Backend listening port |
| `LIVEKIT_URL` | No | empty | LiveKit server URL; normal WebRTC flow is used when unset |
| `LIVEKIT_API_KEY` | No | empty | LiveKit API key |
| `LIVEKIT_API_SECRET` | No | empty | LiveKit API secret |
| `MIGU_USER_ID` | No | empty | Migu account user ID for entitlement-based resolving |
| `MIGU_TOKEN` | No | empty | Migu account token for entitlement-based resolving |
| `MIGU_RATE_TYPE` | No | `3` | Requested Migu quality; actual quality depends on upstream entitlement |

Example:

```bash
MIGU_USER_ID=your-user-id \
MIGU_TOKEN=your-token \
MIGU_RATE_TYPE=3 \
./start.sh
```

## Screenshots

| Room | File Sharing |
| --- | --- |
| ![Room](screenshots/截屏2026-05-08%2001.54.33.png) | ![File Sharing](screenshots/截屏2026-05-08%2001.57.16.png) |

| Music Player | Landlord Game |
| --- | --- |
| ![Music Player](screenshots/截屏2026-05-08%2001.58.06.png) | ![Landlord Game](screenshots/截屏2026-05-08%2002.00.44.png) |

| Gomoku Game | Webpage Sharing |
| --- | --- |
| ![Gomoku Game](screenshots/截屏2026-05-08%2002.03.32.png) | ![Webpage Sharing](screenshots/截屏2026-05-08%2002.12.24.png) |

## Project Structure

```text
├── App.vue                 # App entry component
├── main.js                 # Vue bootstrap entry
├── router.js               # Frontend routes
├── pages/                  # Pages (home + room)
├── components/             # Reusable components
├── utils/                  # Frontend utilities
├── server/                 # Express / Socket.IO backend
│   ├── server.js           # Signaling, sharing, and live stream APIs
│   ├── miguResolver.js     # Migu Video live stream resolver
│   └── livekit/            # Optional LiveKit integration
├── tests/                  # node:test tests
├── screenshots/            # README screenshots
├── start.sh                # Production background start script
├── stop.sh                 # Production background stop script
├── install.sh              # Interactive server deployment script
├── uninstall.sh            # Runtime config uninstall script
├── vite.config.js          # Vite config
└── package.json            # npm scripts and dependencies
```

## Tests

```bash
node --check server/server.js
node --test tests/server/livestream-migu.test.mjs
npm run build
```

Full test suite:

```bash
npm run test
```

> Some UI static assertions may still reflect older markup. If a failure appears, check whether the failing assertion is an outdated snapshot-style check.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE), SPDX identifier `AGPL-3.0-only`.

If you modify this project and provide it as a network service, AGPL-3.0 requires you to provide the corresponding source code to users.
