/**
 * audio.js
 * Synthesizes retro/cyberpunk sound effects using the Web Audio API.
 * Zero external assets required. Highly optimized.
 */

export class AudioManager {
    constructor() {
        this.audioCtx = null;
        this.isMuted = false;
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            this.audioCtx = new AudioContext();
            this.isInitialized = true;
        } else {
            console.warn("Web Audio API is not supported in this browser.");
            this.isMuted = true;
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }

    resume() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    playGrab() {
        if (this.isMuted || !this.audioCtx) return;
        this.resume();
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.05);
        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.05);
    }

    playDrop() {
        if (this.isMuted || !this.audioCtx) return;
        this.resume();
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
    }

    playLock() {
        if (this.isMuted || !this.audioCtx) return;
        this.resume();
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
        osc.frequency.setValueAtTime(900, this.audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);
        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.3);
    }

    playVictory() {
        if (this.isMuted || !this.audioCtx) return;
        this.resume();
        const frequencies = [440, 554.37, 659.25, 880];
        frequencies.forEach((freq, index) => {
            const osc = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();
            osc.type = index % 2 === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
            const duration = 1.5 + (index * 0.2);
            gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, this.audioCtx.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
            osc.connect(gainNode);
            gainNode.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + duration);
        });
    }
}
