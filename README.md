# ⚡ NEON ARCADE // Cyberpunk Web Gaming Portal

A mobile-first, high-performance, cyberpunk-themed web gaming portal featuring **110 open-source HTML5 / JavaScript games**.

---

## 🎮 Key Features

- **Cyberpunk 2099 Design System**: Neon cyan, hot pink, and cyber yellow glowing aesthetics, chamfered HUD frames, dynamic canvas thumbnails, and synthesized Web Audio sound effects.
- **Mobile-First Optimization**:
  - Touch-optimized controls, swipe gestures, and responsive grid layouts.
  - **On-Screen Cyberpunk Virtual Gamepad**: Floating, translucent D-Pad and Action buttons (A, B, X, Y) with haptic vibration feedback for touchscreen devices.
  - Sticky mobile bottom navigation (Games, Search, Favorites).
  - PWA Support (`manifest.json` + `sw.js` Service Worker) for installability on iOS and Android home screens.
- **110 Open Source Games Catalog**:
  - **Arcade & Retro** (22 games): Snake, Tetris, Space Invaders, Breakout, Pong, Pacman, Asteroids, Frogger, Galaga, Tron, and more.
  - **Puzzle & Brain** (24 games): 2048, Hextris, Minesweeper, Memory Matrix, 15 Puzzle, Sudoku, Sokoban, Lights Out, Connect 4, and more.
  - **Action & Platformer** (18 games): Cyber Runner, Clumsy Bird, Flappy Drone, Doodle Jump, Chrome Dino, Cyber Ninja, Micro Tanks, and more.
  - **Casual & Tap** (16 games): Data Miner Clicker, Stack Skyscraper, Bubble Shooter, Pinball, Whack-A-Glitch, and more.
  - **Board & Strategy** (15 games): Chess, Checkers, Quantum XO, Solitaire, Spider Solitaire, FreeCell, Reversi, Battleship, and more.
  - **Racing & Sports** (15 games): Outrun Highway Racer, Micro Racers, Air Hockey, Ping Pong, Bowling, Hoops Shootout, and more.
- **Clean-Room & 100% Legal**:
  - Every game entry attributes the original author, displays open-source license terms (MIT, CC0, GPL, Apache 2.0), and links directly to its official GitHub repository.
- **Built-in Offline Playable Games**: Includes high-performance, self-contained playable games located in `/public/games/` that run with zero dependencies and work offline.
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

### 3. Mobile Device Testing
To test on your smartphone or tablet on the same Wi-Fi network:
1. Find your computer's local IP address (e.g., `ipconfig` -> `192.168.x.x`).
2. Open `http://<YOUR_LOCAL_IP>:3000` on your mobile browser.
3. Tap **"Add to Home Screen"** to experience the full-screen mobile app experience.

---

## 📂 Project Architecture

```
GameSite/
├── package.json              # Project definition & npm start script
├── server.js                 # Zero-dependency Node.js HTTP server & API
├── README.md                 # Documentation
└── public/
    ├── index.html            # Main Cyberpunk portal application
    ├── manifest.json         # PWA Web App manifest
    ├── sw.js                 # Service Worker for caching & offline support
    ├── css/
    │   ├── cyberpunk.css     # Cyberpunk UI, theme variables, grid & HUD styles
    │   └── gamepad.css       # Virtual touch controller styles
    ├── js/
    │   ├── app.js            # Frontend logic, instant search, filters, favorites, SFX
    │   ├── games-data.js     # 110 open-source games database with metadata & licenses
    │   └── gamepad.js        # On-screen D-Pad & Action buttons keyboard event emulator
    ├── assets/
    │   └── icons/            # SVG icons & app emblems
    └── games/                # Self-contained, built-in playable games
        ├── 2048/             # Cyber 2048
        ├── snake/            # Cyber Snake Overdrive
        ├── neon-tetris/      # Neon Blocks
        ├── space-invaders/   # Matrix Defense
        ├── breakout/         # Neon Brick Breaker
        ├── pong-cyber/       # Pong 2099
        ├── flappy-cyber/     # Flappy Drone
        ├── hextris/          # Hextris Pulse
        ├── minesweeper/      # Core Defusal
        ├── memory-matrix/    # Neural Match
        ├── tic-tac-toe/      # Quantum XO with Minimax AI
        └── cyber-runner/     # Neon Rooftops Infinite Runner
```

---

## 📜 Legal & Open Source Compliance

All games listed in **Neon Arcade** are released under open-source licenses (MIT, CC0, GPL-3.0, BSD). Each game card in the portal and in the game player HUD displays:
- Author / Development team credit
- Explicit open-source license badge
- Direct link to the open-source GitHub repository
