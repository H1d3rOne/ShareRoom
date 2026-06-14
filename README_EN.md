<p align="center">
  <h1 align="center">ShareRoom</h1>
  <p align="center">Real-time screen, file & game sharing collaboration rooms</p>
  <p align="center">
    <a href="README.md">简体中文</a> · <strong>English</strong>
  </p>
</p>

---

## Features

- Screen / tab / webpage real-time sharing
- Image, video & audio online preview with streaming playback
- Live stream sharing: Douyin, Bilibili, Migu Video room resolving, plus HLS / FLV direct URLs
- WebRTC P2P voice & video calls
- Gomoku & Landlord online multiplayer games
- Room chat & member management

## Tech Stack

Vue 3 · Vite · Socket.IO · WebRTC · LiveKit (optional) · Express 5

## Quick Start

```bash
# Clone the repository
git clone https://github.com/H1d3rOne/ShareRoom.git
cd ShareRoom

# Install dependencies
npm install
cd server && npm install && cd ..

# Development mode (frontend :3001, signaling :3002)
npm run dev
npm run server

# Production build
npm run build
npm run start
```

### One-Click Deployment

**Requirements:** Linux (apt-based distro) · Node.js >= 16 · npm · Domain name (optional, for Nginx + HTTPS)

```bash
npm run install-all   # Interactive setup (Nginx / HTTPS / Let's Encrypt)
npm run start-all     # Start
npm run stop-all      # Stop
```

The script will guide you through:
1. Installing frontend & backend dependencies
2. Asking whether to configure a domain (enter a domain already resolved to your server)
3. Asking whether to enable HTTPS (auto-installs certbot for Let's Encrypt certificates)
4. Configuring app port (default 3002), Nginx reverse proxy & SSL
5. Falling back to port 8443 if port 443 is occupied

## Screenshots

![Room](screenshots/截屏2026-05-08%2001.54.33.png)
![File Sharing](screenshots/截屏2026-05-08%2001.57.16.png)
![Music Player](screenshots/截屏2026-05-08%2001.58.06.png)
![Landlord Game](screenshots/截屏2026-05-08%2002.00.44.png)
![Gomoku Game](screenshots/截屏2026-05-08%2002.03.32.png)
![Webpage Sharing](screenshots/截屏2026-05-08%2002.12.24.png)

## Usage

1. Click **Create Room** on the home page and share the room code
2. Choose **Screen Share** / **File Share** / **Webpage Share** / **Live Share** from the toolbar
3. For live sharing, keep **Auto Detect** selected and paste a Douyin, Bilibili, or Migu Video live URL, or enter an HLS / FLV stream URL directly
4. Migu Video supports `miguvideo.com` links, links embedded in share text, and plain numeric program IDs
5. Click **Game Share** to open the game menu and start Gomoku or Landlord; when no invite/match is active, click **Game Share** again to close the menu
6. Toggle **Microphone** / **Camera** on the toolbar for voice & video

### Live Stream Resolving

- Douyin, Bilibili, and Migu Video room URLs are resolved by the backend `/api/resolve-livestream` endpoint.
- HLS playlists and FLV streams are proxied through the backend by default to avoid CORS, temporary auth, and mixed-content playback issues.
- Migu Video defaults to `MIGU_RATE_TYPE=3`; when unauthenticated or without entitlement, the upstream service may downgrade the quality automatically.
- To use account entitlements, set these variables before starting the server:

```bash
MIGU_USER_ID=your-user-id \
MIGU_TOKEN=your-token \
MIGU_RATE_TYPE=3 \
npm run start
```

## Tests

```bash
node --check server/server.js
node --test tests/server/livestream-migu.test.mjs
npm run build
```

## Project Structure

```
├── pages/           # Pages (home + room)
├── components/      # Components
├── utils/           # Utility modules
├── server/          # Signaling server + API + live stream resolving/proxying
├── tests/           # node:test static and API tests
├── style.css        # Global styles
└── vite.config.js   # Build config
```

## License

[MIT](LICENSE)
