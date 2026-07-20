/**
 * app.js
 * The main application controller. Initializes all modules, wires up callbacks,
 * and manages the decoupled render/inference game loops.
 */

import { CameraManager } from './camera.js';
import { HandTracker } from './tracker.js';
import { PuzzleGame } from './puzzle.js';
import { Renderer } from './renderer.js';
import { AudioManager } from './audio.js';
import { UIManager } from './ui.js';
import { ParticleSystem } from './particles.js';
import { saveScoreIfBest, getBestScore } from './utils.js';

class CyberPuzzleApp {
    constructor() {
        // Initialize Modules
        this.ui = new UIManager();
        this.audio = new AudioManager();
        this.puzzle = new PuzzleGame();
        this.particles = new ParticleSystem();
        this.tracker = new HandTracker();
        
        // DOM References for Rendering
        this.video = document.getElementById('webcam');
        const mainCanvas = document.getElementById('game-canvas');
        const offscreenCanvas = document.getElementById('offscreen-buffer');
        
        this.renderer = new Renderer(mainCanvas, offscreenCanvas, this.puzzle);
        this.camera = new CameraManager(this.video, (vid) => this.tracker.processFrame(vid));

        // Application State
        this.trackerState = null;
        this.isGameActive = false;
        this.isMirrored = true; // Default to mirror mode for intuitive controls
        
        this.bindEvents();
    }

    /**
     * Wires up the Pub/Sub callbacks between the UI, Puzzle logic, and AI Tracker.
     */
    bindEvents() {
        // --- UI Interactions ---
        this.ui.onGridChange = (size) => {
            this.audio.init(); // Satisfy browser autoplay policies
            this.audio.playGrab();
            this.startNewGame(size);
        };

        this.ui.onShuffle = () => {
            this.audio.init();
            this.audio.playDrop();
            this.startNewGame(this.puzzle.gridSize);
        };

        this.ui.onSoundToggle = () => {
            this.audio.init();
            return this.audio.toggleMute();
        };

        this.ui.onMirrorToggle = () => {
            this.audio.init();
            this.audio.playGrab();
            this.isMirrored = !this.isMirrored;
            // Toggle CSS transform on the canvas to mirror visual output
            const canvas = document.getElementById('game-canvas');
            canvas.style.transform = this.isMirrored ? 'scaleX(1)' : 'scaleX(-1)';
        };

        // --- Puzzle Logic Hooks ---
        this.puzzle.onMove = (moves) => {
            this.ui.updateMoves(moves);
            
            // First move starts the timer
            if (moves === 1 && this.isGameActive) {
                this.ui.startTimer();
            }
        };

        this.puzzle.onWin = () => {
            this.handleVictory();
        };

        // --- AI Tracking Hooks ---
        this.tracker.onTrackingUpdate = (state) => {
            this.trackerState = state;
            this.ui.updateAIStatus(true);
            this.handleGameLogic(); // Process drag & drop mechanics
        };

        this.tracker.onTrackingLost = () => {
            this.trackerState = null;
            this.ui.updateAIStatus(false);
            
            // Drop any currently held tile if tracking is lost
            if (this.puzzle.draggedTileIndex !== -1) {
                this.puzzle.draggedTileIndex = -1;
            }
        };
    }

    /**
     * Bootstraps the application, requests camera permissions, and starts the loops.
     */
    async start() {
        // 1. Initialize Neural Network (Pre-compiles WebGL shaders to prevent lag)
        await this.tracker.initialize();

        // 2. Start Camera Hardware
        const cameraStarted = await this.camera.start();
        
        if (cameraStarted) {
            this.ui.hideLoading();
            this.startNewGame(3); // Start with Easy mode (3x3)
            
            // 3. Kick off the visual render loop
            this.renderLoop(performance.now());
        }
    }

    /**
     * Resets the board and initiates a fresh puzzle.
     * @param {number} size 
     */
    startNewGame(size) {
        this.isGameActive = true;
        this.particles.clear();
        this.ui.hideVictory();
        this.ui.resetTimer();
        
        this.puzzle.initialize(size);
        
        const bestScore = getBestScore(size);
        this.ui.updateBestScore(bestScore);
    }

    /**
     * Translates raw AI hand coordinates into puzzle grid interactions.
     * Called asynchronously whenever the AI finishes processing a frame.
     */
    handleGameLogic() {
        if (!this.isGameActive || !this.trackerState) return;

        const cursor = this.trackerState.cursor;
        const hoverIndex = this.puzzle.getIndexFromNormalizedCoords(cursor.x, cursor.y);

        if (this.trackerState.isPinching) {
            // Attempt to grab a tile
            if (this.puzzle.draggedTileIndex === -1 && hoverIndex !== -1) {
                const pickedUp = this.puzzle.pickTile(hoverIndex);
                if (pickedUp) this.audio.playGrab();
            }
        } else {
            // Attempt to drop a tile
            if (this.puzzle.draggedTileIndex !== -1) {
                const previousTargetValue = hoverIndex !== -1 ? this.puzzle.tiles[hoverIndex] : null;
                const dropped = this.puzzle.dropTile(hoverIndex);
                
                if (dropped) {
                    // Check if the drop resulted in a locked (correct) placement
                    if (this.puzzle.tiles[hoverIndex] === hoverIndex) {
                        this.audio.playLock();
                        // Calculate screen coordinates for the spark emission
                        const tileW = this.renderer.canvas.width / this.puzzle.gridSize;
                        const tileH = this.renderer.canvas.height / this.puzzle.gridSize;
                        const col = hoverIndex % this.puzzle.gridSize;
                        const row = Math.floor(hoverIndex / this.puzzle.gridSize);
                        this.particles.emitSparks((col * tileW) + (tileW/2), (row * tileH) + (tileH/2));
                    } else {
                        this.audio.playDrop();
                    }
                }
            }
        }
    }

    /**
     * Triggers the victory sequence.
     */
    handleVictory() {
        this.isGameActive = false;
        this.ui.stopTimer();
        this.audio.playVictory();
        
        // Save score if it's a new personal best
        const isNewBest = saveScoreIfBest(this.puzzle.gridSize, this.ui.secondsElapsed, this.puzzle.moves);
        
        if (isNewBest) {
            this.ui.updateBestScore({ time: this.ui.secondsElapsed, moves: this.puzzle.moves });
        }

        // Emit Confetti from the center of the screen
        const cw = this.renderer.canvas.width;
        const ch = this.renderer.canvas.height;
        this.particles.emitConfetti(cw / 2, ch);

        // Display the victory overlay
        this.ui.showVictory(this.ui.secondsElapsed, this.puzzle.moves);
    }

    /**
     * The continuous drawing loop. Runs at the monitor's refresh rate (e.g., 60/144 FPS).
     * @param {number} timestamp 
     */
    renderLoop(timestamp) {
        // Calculate dynamic FPS
        if (!this.lastTime) this.lastTime = timestamp;
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        // Update FPS counter in UI (every ~10 frames to avoid flickering)
        if (Math.random() < 0.1) {
            const currentFps = Math.round(1000 / deltaTime);
            this.ui.updateFPS(currentFps);
        }

        // Draw the puzzle, video feed, and cyber HUD
        this.renderer.render(this.video, this.trackerState);
        
        // Draw custom particles on top
        this.particles.render(this.renderer.ctx);

        // Schedule next frame
        requestAnimationFrame((ts) => this.renderLoop(ts));
    }
}

// ============================================================================
// APPLICATION BOOTSTRAP
// ============================================================================

window.onload = () => {
    const app = new CyberPuzzleApp();
    // Wait for a brief moment to allow CSS/Fonts to fully paint before kicking off heavy WebGL compilation
    setTimeout(() => {
        app.start();
    }, 500);
};