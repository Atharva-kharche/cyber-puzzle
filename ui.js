/**
 * ui.js
 * Manages the Heads Up Display (HUD), DOM interactions, and overlays.
 */

import { formatTime } from './utils.js';

export class UIManager {
    constructor() {
        // DOM Elements - Overlays
        this.loadingScreen = document.getElementById('loading-screen');
        this.pauseOverlay = document.getElementById('pause-overlay');
        this.victoryOverlay = document.getElementById('victory-overlay');
        
        // DOM Elements - HUD Stats
        this.fpsCounter = document.getElementById('fps-counter');
        this.aiStatus = document.getElementById('ai-status');
        this.timerDisplay = document.getElementById('timer-display');
        this.moveCounter = document.getElementById('move-counter');
        this.bestScoreDisplay = document.getElementById('best-score');
        
        // DOM Elements - Buttons
        this.btnEasy = document.getElementById('btn-easy');
        this.btnMedium = document.getElementById('btn-medium');
        this.btnHard = document.getElementById('btn-hard');
        this.btnShuffle = document.getElementById('btn-shuffle');
        this.btnMirror = document.getElementById('btn-mirror');
        this.btnSettings = document.getElementById('btn-settings');
        this.btnSound = document.getElementById('btn-sound');
        this.btnPlayAgain = document.getElementById('btn-play-again');

        // Timer State
        this.timerInterval = null;
        this.secondsElapsed = 0;
        this.isTimerRunning = false;

        // Callbacks (To be bound by app.js)
        this.onGridChange = null;
        this.onShuffle = null;
        this.onMirrorToggle = null;
        this.onSoundToggle = null;

        this.bindEvents();
    }

    /**
     * Binds click events to all HUD buttons.
     */
    bindEvents() {
        // Grid Size Selection
        const gridBtns = [this.btnEasy, this.btnMedium, this.btnHard];
        gridBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                gridBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const size = parseInt(e.target.getAttribute('data-grid'), 10);
                if (this.onGridChange) this.onGridChange(size);
            });
        });

        // Action Buttons
        this.btnShuffle.addEventListener('click', () => {
            if (this.onShuffle) this.onShuffle();
        });

        this.btnMirror.addEventListener('click', () => {
            if (this.onMirrorToggle) this.onMirrorToggle();
        });

        this.btnSound.addEventListener('click', () => {
            if (this.onSoundToggle) {
                const isMuted = this.onSoundToggle();
                this.btnSound.innerText = isMuted ? '🔇 SOUND: OFF' : '🔊 SOUND: ON';
                this.btnSound.style.color = isMuted ? '#888' : 'var(--cyan)';
                this.btnSound.style.borderColor = isMuted ? '#888' : 'var(--cyan)';
            }
        });

        this.btnPlayAgain.addEventListener('click', () => {
            this.hideVictory();
            if (this.onShuffle) this.onShuffle();
        });

        // Listen for Camera Errors dispatched from camera.js
        window.addEventListener('cameraError', (e) => {
            const statusText = document.getElementById('loading-status');
            if (statusText) {
                statusText.innerText = e.detail.message;
                statusText.style.color = 'var(--danger)';
                statusText.style.animation = 'none'; // Stop pulsing
            }
        });
    }

    // ============================================================================
    // TIMER & STATS LOGIC
    // ============================================================================

    startTimer() {
        if (this.isTimerRunning) return;
        this.isTimerRunning = true;
        this.timerInterval = setInterval(() => {
            this.secondsElapsed++;
            this.timerDisplay.innerText = formatTime(this.secondsElapsed);
        }, 1000);
    }

    stopTimer() {
        if (!this.isTimerRunning) return;
        clearInterval(this.timerInterval);
        this.isTimerRunning = false;
    }

    resetTimer() {
        this.stopTimer();
        this.secondsElapsed = 0;
        this.timerDisplay.innerText = "00:00";
    }

    updateMoves(moves) {
        this.moveCounter.innerText = moves;
    }

    updateFPS(fps) {
        this.fpsCounter.innerText = fps;
        // Color code FPS to alert if performance drops
        if (fps >= 55) {
            this.fpsCounter.className = 'value success';
        } else if (fps >= 30) {
            this.fpsCounter.className = 'value cyan';
        } else {
            this.fpsCounter.className = 'value warning'; // Red if lagging severely
        }
    }

    updateAIStatus(isTracking) {
        if (isTracking) {
            this.aiStatus.innerText = 'LOCKED';
            this.aiStatus.className = 'value success';
            this.hidePause();
        } else {
            this.aiStatus.innerText = 'SEARCHING';
            this.aiStatus.className = 'value warning';
            this.showPause();
        }
    }

    updateBestScore(scoreData) {
        if (!scoreData) {
            this.bestScoreDisplay.innerText = '--:-- | 0 moves';
        } else {
            this.bestScoreDisplay.innerText = `${formatTime(scoreData.time)} | ${scoreData.moves} moves`;
        }
    }

    // ============================================================================
    // OVERLAY MANAGEMENT
    // ============================================================================

    hideLoading() {
        this.loadingScreen.classList.remove('active');
        this.loadingScreen.classList.add('hidden');
    }

    showPause() {
        // Don't show pause screen if victory is currently active or loading is active
        if (!this.victoryOverlay.classList.contains('hidden') || !this.loadingScreen.classList.contains('hidden')) return;
        this.pauseOverlay.classList.remove('hidden');
        this.pauseOverlay.classList.add('active');
    }

    hidePause() {
        this.pauseOverlay.classList.remove('active');
        this.pauseOverlay.classList.add('hidden');
    }

    showVictory(time, moves) {
        document.getElementById('victory-time').innerText = formatTime(time);
        document.getElementById('victory-moves').innerText = moves;
        this.victoryOverlay.classList.remove('hidden');
        this.victoryOverlay.classList.add('active');
    }

    hideVictory() {
        this.victoryOverlay.classList.remove('active');
        this.victoryOverlay.classList.add('hidden');
    }
}