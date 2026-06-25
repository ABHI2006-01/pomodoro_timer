# 🧘‍♀️ ZenSpace | Calm Pomodoro & Focus

ZenSpace is a premium, aesthetic, and calm productivity dashboard designed to encourage focus and deep work. It combines a customizable Pomodoro timer, a Web Audio API-synthesized ambient mixer, task checklist tracking, and daily focus streaks into a highly polished, glassmorphic single-page application.

---

## ✨ Features

*   **Cozy Rainy Atmosphere**: Features a high-resolution, partially blurred background illustration of a cozy rainy room.
*   **Dreamlike Floating Animation**: The background artwork is animated to float slowly and organic across a 50-second loop with scale padding to prevent edge gaps.
*   **Customizable Pomodoro Clock**:
    *   Presetted focus (25m), short break (5m), and long break (15m) timers.
    *   Accurate `requestAnimationFrame` timing calculation to prevent background tab drift.
    *   SVG circular clock ring that updates smoothly.
    *   Tab Title Integration: See your remaining focus minutes directly in your browser tab name.
*   **Web Audio API Ambient Synthesizer**: All audio is synthesized directly on-the-fly in your browser's audio graph. No assets are downloaded, making it light and robust:
    *   *Deep Rain*: Sub-bass white noise mixed with randomized high-frequency water droplet impulse scheduling.
    *   *Zen Wind*: Pink noise modulated by a slow LFO oscillator sweeping bandpass frequencies.
    *   *Binaural Beats*: Stereo-split low-frequency oscillators (80Hz left, 85Hz right) to induce a 5Hz focus theta state.
    *   *Campfire Crackle*: Combustion lowpass noise combined with randomized triangle wave pops and highpass crackle bursts.
    *   *Alarm Chime*: A beautiful, warm bell arpeggiation (E5 -> A5 -> C#6 -> E6 chime).
*   **Focus Checklist**: Manage your daily tasks, select active tasks to count pomodoro sessions, and track estimated focus intervals.
*   **Analytics Dashboard**: Keep track of total focus minutes today, completed cycles, finished tasks, and streak counters.
*   **Zen Themes**: Switch instantly between Forest Moss, Ocean Slate, Warm Desert, and Cosmic Violet color tokens.

---

## 🛠 Tech Stack

*   **Core**: HTML5 Semantic markup & CSS3 variables.
*   **Styling**: Premium Glassmorphism styling (`backdrop-filter`), sub-pixel text shadows, and custom layouts using a technical designer grid backing.
*   **Fonts**: *Cinzel* (Google Fonts) for branding and *Plus Jakarta Sans* (Google Fonts) for technical UI labels.
*   **Logic**: Pure Vanilla ES6+ JavaScript.
*   **Audio**: Web Audio API Node routing graphs.
*   **Backend**: Zero dependencies.

---

## 🚀 Getting Started

You can run ZenSpace in two ways:

### Option A: Open File Directly (No Installation)
1. Double-click the [`index.html`](index.html) file inside your local directory.
2. It will open in your default browser. *The Web Audio synthesizer runs successfully on the `file://` protocol after your first click interaction!*

### Option B: Local HTTP Server (Recommended)
If you have [Node.js](https://nodejs.org/) installed:
1. Open a terminal in the project directory.
2. Start the lightweight, zero-dependency development server:
   ```bash
   npm start
   # or: node server.js
   ```
3. Open your browser and navigate to **[http://localhost:3000](http://localhost:3000)**.

---

## 📁 File Structure

```text
pomodoro-timer/
├── assets/
│   └── cozy_rainy_bg.jpg      # Active 1920x1080 Full HD background
├── index.html                 # Layout and icons (Inline SVGs)
├── styles.css                 # Glassmorphic layout, fonts, and styling
├── app.js                     # Pomodoro timing loop and Audio Synth
├── server.js                  # Zero-dependency local Node server
├── package.json               # NPM scripts
└── README.md                  # Project documentation (this file)
```

---

## 📝 License

This project is licensed under the MIT License.
