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
        this.forceSnapshot = false; 
        this.isMirrored = true; 
        
        this.bindEvents();
    }

    bindEvents() {
        // --- UI Interactions ---
        this.ui.onGridChange = (size) => {
            this.audio.init(); 
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
            const canvas = document.getElementById('game-canvas');
            canvas.style.transform = this.isMirrored ? 'scaleX(1)' : 'scaleX(-1)';
        };

        // --- Puzzle Logic Hooks ---
        this.puzzle.onMove = (moves) => {
            this.ui.updateMoves(moves);
            
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
            this.handleGameLogic(); 
        };

        this.tracker.onTrackingLost = () => {
            this.ui.updateAIStatus(false);
        };
    }

    async start() {
        await this.tracker.initialize();

        const cameraStarted = await this.camera.start();
        
        if (cameraStarted) {
            this.ui.hideLoading();
            
            // KICK OFF RENDERER IMMEDIATELY so the user sees the live camera feed
            this.renderLoop(performance.now());

            // WARM-UP DELAY: Give the physical webcam 1.5 seconds to turn on, 
            // adjust auto-exposure, and balance colors BEFORE we take the first snapshot.
            setTimeout(() => {
                this.startNewGame(3); 
            }, 1500);
        }
    }

    startNewGame(size) {
        this.isGameActive = true;
        this.forceSnapshot = true; 
        this.particles.clear();
        this.ui.hideVictory();
        this.ui.resetTimer();
        
        this.puzzle.initialize(size);
        
        const bestScore = getBestScore(size);
        this.ui.updateBestScore(bestScore);
    }

    handleGameLogic() {
        if (!this.isGameActive || !this.trackerState) return;

        const cursor = this.trackerState.cursor;
        const hoverIndex = this.puzzle.getIndexFromNormalizedCoords(cursor.x, cursor.y);

        if (this.trackerState.isPinching) {
            if (this.puzzle.draggedTileIndex === -1 && hoverIndex !== -1) {
                const pickedUp = this.puzzle.pickTile(hoverIndex);
                if (pickedUp) this.audio.playGrab();
            }
        } else {
            if (this.puzzle.draggedTileIndex !== -1) {
                const dropped = this.puzzle.dropTile(hoverIndex);
                
                if (dropped) {
                    if (this.puzzle.tiles[hoverIndex] === hoverIndex) {
                        this.audio.playLock();
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

    handleVictory() {
        this.isGameActive = false; 
        this.ui.stopTimer();
        this.audio.playVictory();
        
        const isNewBest = saveScoreIfBest(this.puzzle.gridSize, this.ui.secondsElapsed, this.puzzle.moves);
        
        if (isNewBest) {
            this.ui.updateBestScore({ time: this.ui.secondsElapsed, moves: this.puzzle.moves });
        }

        const cw = this.renderer.canvas.width;
        const ch = this.renderer.canvas.height;
        this.particles.emitConfetti(cw / 2, ch);

        this.ui.showVictory(this.ui.secondsElapsed, this.puzzle.moves);
    }

    renderLoop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        if (Math.random() < 0.1) {
            const currentFps = Math.round(1000 / deltaTime);
            this.ui.updateFPS(currentFps);
        }

        this.renderer.render(this.video, this.trackerState, this.isGameActive, this.forceSnapshot);
        
        // SAFETY CHECK: Only turn off the snapshot override IF the video is actually delivering light/pixels.
        // readyState >= 2 means the browser has enough data to draw the current frame.
        if (this.forceSnapshot && this.video.readyState >= 2) {
            this.forceSnapshot = false; 
        }
        
        this.particles.render(this.renderer.ctx);

        requestAnimationFrame((ts) => this.renderLoop(ts));
    }
}

// ============================================================================
// APPLICATION BOOTSTRAP
// ============================================================================

window.onload = () => {
    const app = new CyberPuzzleApp();
    setTimeout(() => {
        app.start();
    }, 500);
};
