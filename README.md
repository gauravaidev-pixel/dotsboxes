# Dots & Boxes — Online Multiplayer

Flask + Flask-SocketIO backend, SVG board, both local (2-player / vs
computer) and online room-based multiplayer in one app.

## Deploy on Render

1. Push this whole `dotsboxes` folder to a GitHub repo.
2. Go to [render.com](https://render.com) → **New +** → **Web Service**.
3. Select your GitHub repo.
4. Settings:
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn --worker-class eventlet -w 1 app:app`
     (already in `Procfile` — Render picks it up automatically)
5. Free instance type is fine for testing.
6. Deploy — you'll get a URL like `https://your-app-name.onrender.com`.

**Important:** keep `-w 1` (a single worker) unless you move the `rooms`
dict to a shared store like Redis — right now rooms only live in that one
worker's memory. Render's free tier gives you exactly one worker anyway,
so this is the right default.

## Add it as a Telegram Mini App

1. Message `@BotFather` on Telegram → `/newbot` (if you don't have one yet).
2. `/mybots` → pick your bot → **Bot Settings** → **Menu Button** →
   paste your Render URL (`https://your-app-name.onrender.com`).
3. Done — the game now opens inside Telegram from the menu button.

## Run locally (PC / Termux)

```bash
pip install -r requirements.txt
python app.py
```

Then open `http://localhost:5000` in a browser.

## Structure

```
app.py                 → Flask + SocketIO backend, all game logic/validation
templates/index.html   → Lobby, waiting room, game screen, winner modal
static/css/style.css   → All UI styling
static/js/main.js      → SVG board renderer, local AI, Socket.IO client
requirements.txt       → Dependencies
Procfile                → Render start command
```

## What changed in this version

- White board background, guide lines for undrawn edges kept at very low
  opacity so the board reads clean
- The most recent move is highlighted in the same player color, just a
  touch lighter with a soft glow, so it's easy to spot
- Player colors are pickable (pink, teal, green, yellow) instead of fixed
- All emoji replaced with SVG icons
- Computer opponent shows a small non-blocking status pill while it
  thinks — the board never dims, blurs, or flashes
- All UI copy is in English
- **Voice chat** for online rooms — peer-to-peer WebRTC audio, opt-in on
  both sides (mic only turns on when you tap "Voice Chat"), with a
  mute/unmute toggle once connected
- **Background music** for local games against the computer — a small
  ambient loop generated entirely in the browser via the Web Audio API
  (no audio files, so nothing to license), with its own play/stop button

### Note on voice chat

- The server only relays the WebRTC handshake messages — audio itself
  flows directly between the two browsers, never through the server.
- Uses a public STUN server only (no TURN server). This works for most
  home/mobile networks, but a small number of strict corporate/carrier
  networks may block the direct connection. Adding a TURN server (e.g.
  a paid Twilio/Xirsys plan, or your own `coturn`) would fix that if you
  run into it.
- `getUserMedia` (microphone access) requires a secure context — this
  works automatically on the `https://...onrender.com` URL Render gives
  you, but won't work over plain `http://` except on `localhost`.

