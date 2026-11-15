# ⚡ NEON ARCADE // Cyberpunk Web Gaming Portal

A mobile-first, high-performance, cyberpunk-themed web gaming portal featuring **16 verified open-source HTML5 / JavaScript games**.

---

## 🎮 Key Features

- **Cyberpunk 2099 Design System**: Neon cyan, hot pink, and cyber yellow glowing aesthetics, chamfered HUD frames, dynamic canvas thumbnails, and synthesized Web Audio sound effects.
- **Mobile-First Fullscreen Player**:
  - Touch-optimized controls, swipe gestures, and responsive grid layouts.
  - Dedicated 100dvh full-screen player sheet on mobile devices with safe-area insets.
  - **On-Screen Cyberpunk Virtual Gamepad**: Floating, translucent D-Pad and Action buttons (A, B, X, Y) with synthetic keyboard events and directional hold-repeat for touchscreen devices.
  - Safe storage abstraction (`storage-guard.js`) with in-memory fallback to ensure crash immunity.
  - PWA Support (`manifest.json` + `sw.js` Service Worker) for installability on iOS and Android home screens.
- **Verified Open Source Games Catalog**:
  - **Arcade & Retro**: Snake, Tetris, Space Invaders, Breakout, Pong 2099.
  - **Puzzle & Brain**: 2048, Hextris, Minesweeper, Memory Matrix, Word Cipher.
  - **Action & Platformer**: Cyber Runner, Clumsy Bird, Flappy Drone.
  - **Board & Strategy**: Quantum XO, Mahjong Solitaire.
  - **Casual & Cards**: Klondike Solitaire.
- **Clean-Room & 100% Legal**:
  - Every game entry attributes the original author, displays open-source license terms (MIT, GPL-3.0), and links directly to its official repository.
  - Future expansion candidates are organized in `public/js/catalog-roadmap.json`.
- **Built-in Offline Playable Games**: Includes 14 self-contained playable games located in `/public/games/` that run with zero dependencies and work offline.
- **Zero External Dependencies**: Powered by a custom, lightweight Node.js server that runs out-of-the-box with `node server.js` (no `npm install` needed!).

---

## 🚀 Quick Start

### 1. Launch the Server
In your terminal, navigate to the project directory and run:

```bash
node server.js
```
*(or `npm start`)*

### 2. Open in Browser
Visit:
```
http://localhost:3000
```

### 3. Run Automated Validation
```bash
npm test
```

### 4. Mobile Device Testing
To test on your smartphone or tablet on the same Wi-Fi network:
1. Find your computer's local IP address (e.g., `ipconfig` -> `192.168.x.x`).
2. Open `http://<YOUR_LOCAL_IP>:3000` on your mobile browser.
3. Tap **"Add to Home Screen"** to experience the full-screen mobile app experience.

---

## 📂 Project Architecture

```
GameSite/
├── package.json              # Project definition & npm test/start scripts
├── server.js                 # Zero-dependency Node.js HTTP server & API
├── README.md                 # Documentation
├── scripts/
│   └── validate-catalog.mjs  # Automated catalog validation script
└── public/
    ├── index.html            # Main Cyberpunk portal application
    ├── manifest.json         # PWA Web App manifest
    ├── sw.js                 # Service Worker for caching & offline support
    ├── data/
    │   └── games.json        # Authoritative JSON games catalog (16 verified games)
    ├── css/
    │   ├── cyberpunk.css     # Cyberpunk UI, theme variables, grid & HUD styles
    │   └── gamepad.css       # Virtual touch controller styles
    ├── js/
    │   ├── app.js            # Frontend logic, routing, search, filters, favorites, SFX
    │   ├── games-data.js     # Client catalog wrapper matching games.json
    │   ├── gamepad.js        # On-screen D-Pad & Action buttons keyboard event emulator
    │   ├── storage-guard.js  # Fault-tolerant storage wrapper with in-memory fallback
    │   └── catalog-roadmap.json # Backlog of candidate games for future porting
    ├── assets/
    │   ├── icons/            # SVG icons & app emblems
    │   └── thumbs/           # WebP game thumbnails + fallback.svg
    └── games/                # Self-contained, built-in playable games (14 games)
```

---

## 📜 License & Attributions

All core platform code is licensed under the [MIT License](LICENSE).
Individual games retain their respective open-source licenses as declared in `public/data/games.json`.
