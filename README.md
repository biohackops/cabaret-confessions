# 🎭 Cabaret Confessions

A 1920s cabaret-themed interactive web app for live events. Guests scan a QR code, submit anonymous confessions, and they appear in real-time on a fullscreen slideshow display.

![cabaret](https://img.shields.io/badge/theme-1920s%20Cabaret-8B0000) ![node](https://img.shields.io/badge/node-%3E%3D18-339933) ![license](https://img.shields.io/badge/license-MIT-D4AF37)

## ✨ Features

- **📱 Guest Landing Page** — Video background, gold shimmer script font, confession form (iOS Safari optimized)
- **📺 Live Slideshow** — Fully responsive display with art deco styling, auto-advancing confessions
- **⚙️ Admin Portal** — Approve/hide/delete confessions, drag-to-reorder, add custom slides, adjust timing
- **📡 Real-time** — Server-Sent Events push all changes to connected displays instantly
- **🎨 Cabaret Design** — Deep lipstick reds, purples, black & gold with shimmer animations

## 🚀 Quick Start

```bash
npm install
node server.js
```

Then open:
| Page | URL |
|---|---|
| Guest Form | http://localhost:3000 |
| Slideshow | http://localhost:3000/slideshow |
| Admin | http://localhost:3000/admin |

## 📱 QR Code Setup

Point your QR code to your machine's network IP (shown in the terminal when the server starts) so guests on the same WiFi can submit confessions from their phones.

## 🎬 Background Video

Place your video file at `public/everafter.MP4`. This plays as a looping muted background on the guest landing page.

## ☁️ Deploy

### Render (Recommended)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Render auto-detects the `render.yaml` blueprint
5. Click **Deploy**

> **Note:** Render's free tier uses an ephemeral filesystem — confessions reset on redeploy. Upgrade to a paid instance for persistent storage, or swap in a database.

### Manual / VPS

```bash
git clone <your-repo-url>
cd cabaret-confessions
npm install
NODE_ENV=production node server.js
```

## 🏗️ Architecture

```
Express Server (server.js)
├── GET  /              → Guest landing page
├── GET  /slideshow     → Fullscreen slideshow
├── GET  /admin         → Admin portal
├── GET  /api/stream    → SSE real-time events
├── *    /api/*         → REST API (confessions, slides, settings)
└── static /public/*    → CSS, JS, video assets
```

**Data**: JSON file persistence at `data/confessions.json`
**Real-time**: Server-Sent Events broadcast to all connected slideshow/admin clients

## 📄 License

MIT
