# Mochi-Puff -- AI 3D Virtual Pet and GPU Fur Companion

An interactive, living 3D virtual pet powered by WebGL2/GPGPU fur physics and multimodal AI. Users can interact, pet, play, talk via voice, and build a lasting relationship with Mochi-Puff.

---

## Key Highlights

### 1. Ultra-Minimal Home Screen
- Pure Focus on the Pet: The home screen features only the 3D creature, an auto-hiding voice subtitle bubble, and a minimal bottom chat bar.
- Enter to Send: Type your message and press Enter to chat.
- Discreet Settings Button: A single glassmorphic gear button in the top-right corner opens all controls, customizations, and settings.
- Zero Clutter: Chat history is housed cleanly inside the Settings modal.

### 2. First-Time Onboarding Setup Wizard
- Pops up automatically when launching the application for the first time.
- Quick configuration of:
  - Creature Name (default: Mochi-Puff)
  - Preferred Conversation Language (Auto-Detect, English, Korean)
  - Personality Tone (Playful, Gentle, Mischievous, Intellectual, Shy)
  - Google Gemini API Key (stored securely in browser local storage)
- Can be re-launched at any time from Settings -> Pet -> Rerun First-Time Setup Wizard.

### 3. Standalone Desktop Application (EXE, DMG, and Launchers)
Mochi-Puff can be run and packaged directly as a native standalone desktop application for Windows and macOS:

#### Packaging Standalone Native Executables (EXE and DMG):
- Build Windows EXE (Portable / Installer):
  ```bash
  npm run build:exe
  ```
  This creates a portable executable and an installable Windows installer in `dist-desktop/`. The installed app opens in its own window and starts its local server invisibly.
- Build macOS DMG & App Bundle:
  ```bash
  npm run build:dmg
  ```
- Or run the cross-platform packaging script:
  ```bash
  chmod +x build_desktop.sh
  ./build_desktop.sh
  ```
  Packaged binaries and installer files are placed in `dist-desktop/`.

#### Windows Standalone Desktop Launcher:
Double-click `Mochi-Puff.bat`.
- Automatically checks prerequisites and starts the local Node.js server.
- Opens the application in dedicated app mode using Microsoft Edge, Google Chrome, or Brave (`--app=http://localhost:3000`).

#### Linux Desktop Launcher:
Run the desktop runner script:
```bash
chmod +x run_desktop.sh
./run_desktop.sh
```
- Starts the server and opens Chrome or Chromium in dedicated app mode (`--app=http://localhost:3000`).

#### Progressive Web App (PWA) Desktop Install:
- Open `http://localhost:3000` in Google Chrome, Microsoft Edge, or Brave.
- Click the "Install Mochi-Puff" icon in the browser address bar.
- The app will be installed to your desktop and start menu with a custom icon, offline service worker, and dedicated window frame.

### 4. Real-Time 3D Creature and GPU Fur Simulation
- GPGPU Spring-Mass Hair Physics: Tens of thousands of simulated hair strands reacting dynamically to creature head tilt, bounce, stretching, drag, and touch.
- Real-Time Lip-Sync and Mouth Articulation: An inner mouth cavity and tongue articulated in real-time through Web Audio API spectral amplitude analysis.
- Voice-Synchronized Fur Coat Vibration: The creature's fur coat gently puffs and vibrates in harmony with the pitch and volume of spoken speech.
- Emotional States and Reactive Expressions:
  - 7 Distinct Moods: happy, curious, surprised, sleepy, sad, excited, loving
  - Dynamic procedural eye pupils, blinking, eyelids, and rosy cheek blush.
- Physical 3D Tricks and Reactions: Petting, poking, dragging, bouncing, stretching, head-tilting, and yawning.

### 5. Multimodal Voice and AI Intelligence
- Default Google Gemini API Models:
  - Speech-to-Text (STT): gemini-3.5-transcribe
  - Text Conversation (LLM): gemini-2.5-flash-lite / gemini-3.1-flash-lite
  - Text-to-Speech (TTS): gemini-3.8-flash-lite-tts (Puck, Kore, Zephyr, Fenrir, Charon)
- Bilingual: Full native support for English and Korean.
- Push-to-Talk and Interruption: Tap or hold the mic button to talk; tap "Stop" anytime to interrupt speech.
- Spontaneous Chat: Off by default; enable it in Settings -> Pet & Voice if you want Mochi-Puff to initiate occasional conversations.

### 6. User Gemini API Key & Custom OpenAI-Compatible Endpoints
- Direct Gemini API Key Entry: Type your Google Gemini API key directly into Settings -> AI Endpoints to power default models. Stored locally in your browser.
- Independent Custom Endpoints: Configure separate custom OpenAI-compatible endpoints:
  1. Chat LLM: Google Gemini or custom OpenAI-compatible URL (e.g. http://localhost:11434/v1, vLLM, DeepSeek, Groq, OpenAI).
  2. Speech-to-Text (STT): Google Gemini gemini-3.5-transcribe or OpenAI-compatible /audio/transcriptions (e.g. Whisper-1, local whisper.cpp).
  3. Text-to-Speech (TTS): Google Gemini gemini-3.8-flash-lite-tts or OpenAI-compatible /audio/speech (e.g. tts-1, Kokoro, MeloTTS).

### 7. Persistent Memory and Interactive Customization
- Long-Term Memory: Remembers user facts, preferences, and pet name across sessions.
- Memory Inspection: View and delete individual saved memories in Settings -> Memories.
- Interactive 3D Physical Tricks: Trigger real-time gestures and expressions (Happy Bounce, Big Stretch, Fur Shimmy Wiggle, Floof Puff Up, Curious Head Tilt, Cozy Yawn) in Settings -> Pet Tricks.
- Accessories and Styling: Crown, bow, round glasses, sprout, French beret, and angel halo; customizable eye colors and fur coats (Sakura Mochi, Golden Fluff, Midnight Velvet, Matcha Puff).
- Default Scene: Cozy Desk environment with WebGPU Fur physics enabled by default.

---

## Automated Setup for Linux Ubuntu

An automated setup script is provided for Ubuntu 20.04 / 22.04 / 24.04 LTS:

```bash
# 1. Run the automated setup script
./setup_ubuntu.sh
```

The script will:
- Check and install required system build tools (curl, build-essential, git).
- Install Node.js v20 LTS and npm if not already present.
- Create your .env configuration file.
- Install project dependencies (npm install).
- Build the production assets (npm run build).
- Generate an optional systemd service (mochi-puff.service) for running as a daemon.

### Starting the Application

#### Development Mode:
```bash
npm run dev
```
Open http://localhost:3000 in your browser or launch `./run_desktop.sh`.

#### Production Mode:
```bash
npm run build
npm start
```

#### Run as a Background Service (Ubuntu Systemd):
```bash
sudo cp mochi-puff.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mochi-puff
sudo systemctl status mochi-puff
```

---

## Environment Variables

Configure `.env` (optional when entering the key directly in the UI):

```bash
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Custom OpenAI-compatible API Key (Optional)
CUSTOM_API_KEY=your_custom_key_here

# Server Port
PORT=3000
```

---

## Navigation and Controls

- Chat: Type a message in the bottom input bar and press Enter to send.
- Voice: Click or hold Talk to record voice input.
- Chat History: Stored and viewable in Settings -> Chat History (with Clear All option).
- Settings: Click Settings (top-right gear) to access chat history, customizations, AI endpoints, tricks, and memories.
- Petting: Click and drag on Mochi-Puff with your mouse or touch to pet, drag, and tickle!
