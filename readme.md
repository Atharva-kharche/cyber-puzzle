# Cyber Puzzle AI 🧩🤖

**Developed by:** Atharva Pradip Kharche 

A high-performance, AI-driven interactive puzzle application. This project leverages computer vision to allow users to solve dynamic live-video puzzles using real-time hand gestures. Engineered with a focus on 60 FPS performance, modular architecture, and modern UI/UX principles, it serves as a robust showcase of advanced frontend computer engineering and optimization techniques.

## ✨ Features

* **Real-Time Hand Tracking:** Utilizes MediaPipe Hands for accurate, low-latency gesture recognition.
* **Hysteresis Grab Logic:** Custom temporal smoothing (Exponential Moving Average) and deadzone thresholds prevent "jittering" and accidental drops.
* **Procedural Audio Synthesis:** Zero-dependency sound effects generated natively via the Web Audio API (Oscillators/Gain Nodes).
* **Hardware Accelerated Render Loop:** Decoupled AI inference and Canvas rendering loops ensure the UI and particle systems remain at 60 FPS even if the AI tracker drops frames.
* **Glassmorphism UI:** Modern, responsive cyberpunk aesthetic using CSS backdrop filters and GPU-accelerated transitions.
* **Dynamic Difficulties:** Instantly switch between Easy (3x3), Medium (4x4), and Hard (5x5) grid modes.
* **State Persistence:** Automatically saves your best times and lowest move counts using `localStorage`.

## 📂 Project Structure

/cyber-puzzle-ai
│
├── index.html          # Main layout and semantic UI structure
├── style.css           # Glassmorphism styling and hardware-accelerated animations
│
├── /js                 # ES6 Modules
│   ├── app.js          # Main controller, event bindings, and decoupled render loop
│   ├── camera.js       # Webcam hardware manager using requestVideoFrameCallback
│   ├── tracker.js      # MediaPipe AI wrapper and EMA smoothing mathematics
│   ├── puzzle.js       # Core game state, grid math, and win-condition logic
│   ├── renderer.js     # Optimized HTML5 Canvas drawing and double-buffering
│   ├── particles.js    # Custom 2D particle engine for visual flair
│   ├── audio.js        # Procedural Web Audio API sound synthesis
│   ├── ui.js           # DOM manipulation and overlay state manager
│   └── utils.js        # Pure functions for lerping, math, and storage
│
└── README.md           # Project documentation