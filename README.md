# PxGBA 🎮

**PxGBA** is a visual game creation suite for the **Game Boy Advance (GBA)**. Similar in philosophy to GB Studio, PxGBA allows developers, artists, and designers to create authentic, native GBA games without writing C++ code. Under the hood, it features a visual editor built with **React**, **Vite**, and **Electron**, which generates C++ code compiled using the **Butano Engine** and the **devkitARM** compiler toolchain.

Why is it called PxGBA? Because I made a pixel art tool called Px, which was what this project started out as, but I wanted to make a game engine for GBA games, so I added game engine features to Px. I eventually decided to release it as a game engine for the Game Boy Advance, and I named it PxGBA.

---

## 📖 Table of Contents
- [Architecture](#-architecture)
- [Key Features](#-key-features)
- [Prerequisites](#-prerequisites)
- [Getting Started (Development)](#-getting-started-development)
- [Production Builds & Desktop Packaging](#-production-builds--desktop-packaging)
- [Compilation Backend API](#-compilation-backend-api)
- [Workspace Directory Structure](#-workspace-directory-structure)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## 🏗️ Architecture

PxGBA operates as an integrated desktop application that bridges modern web technologies with native Game Boy Advance hardware constraints.

```
┌────────────────────────────────────────────────────────┐
│                      Electron App                      │
│                                                        │
│   ┌──────────────┐           ┌────────────────────┐    │
│   │ Main Process │──────────>│ Express Server     │    │
│   │ (main.cjs)   │           │ (api/server.js)    │    │
│   │ - Window mgmt│           │ - /compile         │    │
│   │ - Server mgmt│           │ - /proxy-oga       │    │
│   └──────┬───────┘           └─────────┬──────────┘    │
│          │                             │               │
│   ┌──────┴───────┐           ┌─────────┴──────────┐    │
│   │ Renderer     │           │ Build Tools        │    │
│   │ (dist/)      │           │ ├─ buildTools/     │    │
│   │ React SPA    │           │ │  ├─ butano/      │    │
│   └──────────────┘           │ │  └─ devkitARM/   │    │
│                              │ └─ node_modules/   │    │
│                              └────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

1. **Frontend (React + Vite)**: A feature-rich visual canvas where you design levels, place actors, compose visual node scripts, and edit palettes.
2. **Backend (Express)**: A local microservice that acts as an asset search proxy (bypassing CORS) and manages the C++ compilation jobs.
3. **Electron Wrapper**: Packages both frontend and backend into a single double-clickable native application. It automatically boots the local backend server, injects the necessary environment variables (`DEVKITARM`, `DEVKITPRO`), and manages workspace paths.
4. **Compiler Chain**: The backend extracts your game metadata, generates structured C++ files compatible with the [Butano Engine](https://github.com/GValiente/butano), runs `make`, and executes `devkitARM` tools to yield a runnable `.gba` ROM file.

---

## ✨ Key Features

### 🛠️ Visual Level Editors & Processors
* **Level Generators & Wizards**: Instantly kickstart projects with pre-configured level structures. Support includes:
  * **Platformer**: Procedural layout, sky and cloud background options.
  * **Metroidvania**: Multi-connected rooms and exploration layouts.
  * **Beat 'em Up**: Layered depth and combat-ready zones.
  * **SHMUP**: Vertical/horizontal scrolling configurations, mode-7 layout options.
  * **Racing**: 3D Mode-7 rendering, timed laps, checkpoint gates, and 3-2-1 countdown sequence configurations.
* **Intro & Scene Types**: Dedicated **Intro/Logo Scenes** (no actors, button-press transition) and **Pause Scenes** (hooks into the start button automatically).
* **Layer Constraint Checker**: Automatic warning and playtesting block system when a scene exceeds strict GBA layer hardware limits (maximum of 3 layers with HUD disabled, 2 layers with HUD enabled; 1 layer reserved for text/dialogs).

### 👾 Smart Actor & Logic Designer
* **Prebuilt Actor Behaviors**: Drop-in logic for a variety of entities:
  * *Movement*: Left/right flips (no moonwalking), customizable jump & double-jump, bounce mechanics.
  * *Puzzles*: Pushable blocks, push targets (triggers solved when pushed block makes contact), ice blocks (frictionless sliding), crumbling platforms.
  * *Obstacles & Helpers*: Boost pads, checkpoint gates, turrets (target player/closest actor, rate-of-fire configurations), conveyor belts.
  * *Combat Assist & Companions*: Pet assist actors that follow or orbit the player and attack nearby enemies on player action.
  * *Pickups*: Shield/barrier, ammunition, magnets (attract collectibles), XP orbs, grenades/explosives.
* **Global Actors**: Configure and animate an actor once and reuse its configurations across all game scenes.

### 🔀 Visual Node-Based Scripting
* Powered by **React Flow**, the visual script editor replaces writing raw code with functional nodes.
* Create multi-choice dialogs using the **Menu Script Node**.
* Set local/scene variables, check logic gates, switch scenes, trigger sound effects, and manage conditional flags.
* Visual scripts are automatically grouped by scene for clean organization.

### 🎨 Colors & Assets
* **Full 256-Color Palette System**: Robust color pickers and swatch configurations that match GBA color parameters.
* **Asset Integration**: In-app search client linking directly to OpenGameArt (OGA) for sprites and tiles, and ModArchive for tracker-based `.mod` music compositions.

---

## ⚙️ Prerequisites

To run and build PxGBA, ensure you have:
* **Node.js**: `v20.0.0` or later
* **npm**: `v10.0.0` or later
* **Platform Dependencies**:
  * **Windows**: [7-Zip](https://7-zip.org/) (fallback for devkitARM archive extraction).
  * **Linux**: `build-essential` (for GCC compiler utilities) and `libfuse2` (to launch compiled AppImages).
  * **macOS**: Xcode Command Line Tools (`xcode-select --install`).

---

## 🚀 Getting Started (Development)

### 1. Clone & Install Core Frontend Dependencies
```bash
git clone https://github.com/your-username/pxgba.git
cd pxgba
npm install
```

### 2. Install Compiler Backend Dependencies
```bash
cd api
npm install
cd ..
```

### 3. Setup the Local Toolchains (devkitARM + Butano)
PxGBA is bundled with the toolchains required for building, however, it can also automatically download, extract, and compile the required tools (`devkitARM` and `devkitpro` pacman tools) for your current platform:
```bash
npm run desktop:setup
```
> [!TIP]
> If you already have a global configuration of `devkitARM` on your computer, you can skip the setup script and set the `DEVKITARM` and `DEVKITPRO` environment variables in your operating system. PxGBA will locate and use them automatically.

### 4. Run the Dev Environment
To spawn Vite's dev server and launch the Electron application concurrently, run:
```bash
npm run electron:dev
```

If you only want to test the frontend web application inside a browser, run:
```bash
npm run dev
```

---

## 📦 Production Builds & Desktop Packaging

You can package PxGBA into single-file executable installers for Windows, Linux, and macOS.

### Step 1: Pre-requisite Check
Make sure the bundled toolchains are included, or run this command if you need to setup the toolchains first:
```bash
npm run desktop:setup
```

### Step 2: Build the Application
Run the build script corresponding to your target platform:

```bash
# Build for Windows (Generates an NSIS installer and a portable zip)
npm run electron:build:win

# Build for Linux (Generates an AppImage and a tarball)
npm run electron:build:linux

# Build all configured targets (cross-platform, requires toolchains)
npm run electron:build:all
```
Your compiled desktop installers will be placed inside the `release/` directory.

---

## 🔌 Compilation Backend API

When running in production or dev, the Electron app starts a local Express server on port `3001` (by default). This server exposes several endpoints:

### 1. `POST /compile`
Initiates a background compilation task by uploading a zipped Butano project.
* **Payload**: Form-Data
  * `project`: (File) The zipped C++ project folder.
  * `html5`: (String `"true"` or `"false"`) Compiles and returns a zipped web-playable build with the bundled Iodine-GBA emulator.
  * `exe`: (String `"true"` or `"false"`) Bundles the `.gba` ROM with a portable windows emulator (`mGBA`).
  * `bgColor` / `containerColor` / `credits`: Used for styling the HTML5 web player.
* **Response**: `202 Accepted` returning a `jobId` for async status polling:
  ```json
  { "jobId": "8f8e02d6-444f-4d92-95f7-33d9cb4219c6" }
  ```

### 2. `GET /compile-status/:jobId`
Used to poll compilation status.
* **Response**:
  ```json
  {
    "status": "ready",
    "downloadUrl": "/downloads/8f8e02d6-444f-4d92-95f7-33d9cb4219c6_game.gba",
    "error": null
  }
  ```

### 3. `GET /proxy-oga`
Proxies requests to OpenGameArt.org and ModArchive.org.
* **Parameters**: `?url=<targetUrl>`
* **Description**: Bypasses CORS browser security policies to query sprite databases and download audio trackers directly from the React client. When offline or server issues occur, it automatically feeds mock asset fallbacks (mock images, mock tracker music) to the UI.

### 4. `GET /game.pxg`
Serves the default template project package to seed new user workspaces.

---

## 📂 Workspace Directory Structure

```
pxgba/
├── api/                       # Express compilation server & proxies
│   ├── buildTools/            # local devkitARM & Butano repositories
│   ├── server.js              # Express API handlers
│   └── mockData.js            # Offline mock responses for OGA/ModArchive
├── dist/                      # Production compiled React frontend (built by Vite)
├── electron/                  # Electron main and preload processes
│   ├── main.cjs               # Handles app window, environment, & server fork
│   └── preload.cjs            # Electron IPC preload definitions
├── public/                    # Static assets & default templates
│   └── game.pxg               # Base template binary file
├── scripts/                   # Download & packing helper scripts
│   ├── download-build-tools.cjs
│   └── bundle-iodine.cjs
├── src/                       # Frontend application code
│   ├── components/            # Visual editors & dashboards
│   │   ├── ActorsPanel.jsx    # Actor configuration panel
│   │   ├── ScenesPanel.jsx    # Scene configuration and Level Generators
│   │   ├── ScriptEditor.jsx   # React-Flow visual node scripting
│   │   └── MusicEditor.jsx    # Tracker-based sequencer & audio controls
│   ├── context/               # Global React state and Context wrappers
│   └── main.jsx               # Entrypoint script
├── index.html                 # Main web container
├── vite.config.js             # Vite compiler definitions
└── DESKTOP_BUILD.md           # Developer guide for compiler setup
```

---

## 🛠️ Troubleshooting

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| **`make` not found / compilation fails** | The devkitARM toolchain has not been set up yet. | Run `npm run desktop:setup` to download the dependencies locally. |
| **CORS errors on search** | Search API is query-restricted in browser tabs. | Ensure the local backend API server is running on `http://localhost:3001` or that you are running within the Electron wrapper. |
| **White screen on Electron launch** | The frontend code has not been compiled. | Run `npm run build` before executing a production packaging script. |
| **AppImage sandbox errors on Linux** | Chromium sandbox issues in sandboxed OS configurations. | Electron is pre-configured with `--no-sandbox` flags on Linux to bypass this fallback. Ensure your distro has `libfuse2` installed. |
| **Too many layers warning** | Exceeded GBA console sprite/tile hardware rendering capabilities. | Restrict active scene layers to 3 (without HUD) or 2 (with HUD). PxGBA will combine groups during ROM compile. |

---

## 📄 License

This project is licensed under the MIT License - see the `LICENSE` file (if present) or package files for details.

Developed with ❤️ by **LIFTED PIXEL** ([liftedpixel.ca](https://liftedpixel.ca)).
