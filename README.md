# Taskman

**Simple to-do list PWA with random task picking**

A lightweight, offline-capable Progressive Web App for managing tasks — with a fun twist: it can randomly pick a task for you when you're feeling overwhelmed or indecisive.

https://taskman.xyz

## Features

- Add, edit, complete and delete tasks
- Persistent storage (IndexedDB or localStorage)
- Works offline (PWA + service worker)
- "Pick for me" button — randomly selects one of your pending tasks
- Clean, minimal interface (mobile-first)
- Installable on phone/desktop as a standalone app

## Screenshots

<!-- You can add 2–4 screenshots here later -->
<!-- Example: -->
<!-- ![Task list view](screenshots/tasks.png) -->
<!-- ![Random pick modal](screenshots/pick.png) -->

## Demo

(once deployed)

→ [https://adampluck.github.io/taskman/](https://adampluck.github.io/taskman/)  
→ or any other hosting you choose (Netlify, Vercel, Cloudflare Pages, GitHub Pages, etc.)

## Tech Stack

- HTML5 / CSS (vanilla or lightweight framework)
- JavaScript (vanilla or with minimal dependencies)
- Progressive Web App features:
  - Service Worker
  - Web App Manifest
  - IndexedDB / localStorage for persistence

## Development

```bash
# 1. Clone the repo
git clone https://github.com/adampluck/taskman.git
cd taskman

# 2. Open in browser (no build step needed if vanilla)
open index.html    # macOS
xdg-open index.html # Linux
start index.html   # Windows

# or use a simple local server (recommended)
npx serve .        # or python -m http.server 8000
