/**
 * tracker.js
 * Handles MediaPipe Hands AI, gesture recognition, and temporal smoothing.
 */

import { lerp } from './utils.js';

export class HandTracker {
    constructor() {
        this.handsAI = null;
        this.isInitialized = false;
        
        // Tracking State
        this.handVisible = false;
        this.cursor = { x: 0.5, y: 0.5 }; // Normalized 0.0 to 1.0
        
        // Pinch & Grab State (Hysteresis implementation)
        this.smoothPinchDist = 0.1;
        this.isPinching = false;
        this.canGrab = true;
        
        // Thresholds (Tuned for precise gameplay)
        this.PINCH_THRESHOLD = 0.04; // Distance to trigger a grab
        this.OPEN_THRESHOLD = 0.08;  // Distance required to unlock the next grab
        
        // Smoothing factors (0.0 to 1.0) - Lower = smoother but more delay
        this.CURSOR_SMOOTHING = 0.6;
        this.PINCH_SMOOTHING = 0.7;

        // Callbacks
        this.onTrackingUpdate = null;
        this.onTrackingLost = null;
    }

    /**
     * Initializes the MediaPipe Hands neural network.
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) return;

        // window.Hands is available because we loaded the MediaPipe script in index.html
        this.handsAI = new window.Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        this.handsAI.setOptions({
            maxNumHands: 1, // Restrict to 1 hand to keep CPU usage low and puzzle logic simple
            modelComplexity: 1, // 0 = Fast/Inaccurate, 1 = Balanced (Best for 60fps), 2 = Slow/Accurate
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7
        });

        this.handsAI.onResults((results) => this.processResults(results));
        
        // Force a dummy frame through the network to "warm up" the WebGL shaders
        // This prevents a massive lag spike when the user's hand first appears
        //await this.handsAI.initialize(); 
        
        this.isInitialized = true;
    }

    /**
     * Feeds a video frame into the neural network.
     * @param {HTMLVideoElement} videoElement 
     */
    async processFrame(videoElement) {
        if (!this.isInitialized) return;
        await this.handsAI.send({ image: videoElement });
    }

    /**
     * Callback fired by MediaPipe when frame analysis is complete.
     * @param {Object} results - The raw AI output data
     */
    processResults(results) {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const hand = results.multiHandLandmarks[0];
            
            // Extract index tip (8) and thumb tip (4)
            const indexTip = hand[8];
            const thumbTip = hand[4];

            // 1. Calculate Raw Cursor Position (Centered between thumb and index)
            // X is mirrored (1.0 - x) because the webcam feed is mirrored for a natural feel
            const rawX = 1.0 - ((indexTip.x + thumbTip.x) / 2);
            const rawY = (indexTip.y + thumbTip.y) / 2;

            // 2. Calculate Raw Pinch Distance
            const dx = (1.0 - indexTip.x) - (1.0 - thumbTip.x);
            const dy = indexTip.y - thumbTip.y;
            const rawDist = Math.hypot(dx, dy);

            // 3. Apply Temporal Smoothing (Exponential Moving Average)
            if (!this.handVisible) {
                // Instantly snap to position if hand just entered the frame
                this.cursor.x = rawX;
                this.cursor.y = rawY;
                this.smoothPinchDist = rawDist;
                this.handVisible = true;
            } else {
                // Smooth interpolation to kill camera jitter
                this.cursor.x = lerp(this.cursor.x, rawX, 1 - this.CURSOR_SMOOTHING);
                this.cursor.y = lerp(this.cursor.y, rawY, 1 - this.CURSOR_SMOOTHING);
                this.smoothPinchDist = lerp(this.smoothPinchDist, rawDist, 1 - this.PINCH_SMOOTHING);
            }

            // 4. Hysteresis Grab Logic (Anti-Flicker)
            if (this.smoothPinchDist > this.OPEN_THRESHOLD) {
                this.canGrab = true; // Hand is fully open, unlock grabbing
            }

            if (this.smoothPinchDist < this.PINCH_THRESHOLD) {
                if (!this.isPinching && this.canGrab) {
                    this.isPinching = true;
                    this.canGrab = false; // Lock grabs until fingers open again
                }
            } else if (this.smoothPinchDist > this.PINCH_THRESHOLD + 0.01) {
                // The +0.01 creates a tiny mechanical "deadzone" before releasing
                this.isPinching = false;
            }

            // Fire update callback for the main game loop
            if (this.onTrackingUpdate) {
                this.onTrackingUpdate({
                    cursor: this.cursor,
                    isPinching: this.isPinching,
                    canGrab: this.canGrab,
                    landmarks: hand // Pass raw landmarks for drawing the cyber skeleton
                });
            }

        } else {
            // Hand left the camera view
            if (this.handVisible) {
                this.handVisible = false;
                this.isPinching = false;
                this.canGrab = true;
                
                if (this.onTrackingLost) {
                    this.onTrackingLost();
                }
            }
        }
    }
}