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
        this.cursor = { x: 0.5, y: 0.5 };
        
        // Pinch & Grab State
        this.smoothPinchDist = 0.1;
        this.isPinching = false;
        this.canGrab = true;
        
        // THRESHOLD FIX: Increased so you don't have to pinch as tightly!
        this.PINCH_THRESHOLD = 0.06; 
        this.OPEN_THRESHOLD = 0.10;  
        
        this.CURSOR_SMOOTHING = 0.6;
        this.PINCH_SMOOTHING = 0.7;

        this.onTrackingUpdate = null;
        this.onTrackingLost = null;
    }

    async initialize() {
        if (this.isInitialized) return;

        this.handsAI = new window.Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        this.handsAI.setOptions({
            maxNumHands: 1, 
            modelComplexity: 1,
            // CONFIDENCE FIX: Lowered to 0.5 so it stops losing your hand during a pinch
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.handsAI.onResults((results) => this.processResults(results));
        await this.handsAI.initialize(); 
        
        this.isInitialized = true;
    }

    async processFrame(videoElement) {
        if (!this.isInitialized) return;
        await this.handsAI.send({ image: videoElement });
    }

    processResults(results) {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const hand = results.multiHandLandmarks[0];
            
            const indexTip = hand[8];
            const thumbTip = hand[4];

            const rawX = 1.0 - ((indexTip.x + thumbTip.x) / 2);
            const rawY = (indexTip.y + thumbTip.y) / 2;

            const dx = (1.0 - indexTip.x) - (1.0 - thumbTip.x);
            const dy = indexTip.y - thumbTip.y;
            const rawDist = Math.hypot(dx, dy);

            if (!this.handVisible) {
                this.cursor.x = rawX;
                this.cursor.y = rawY;
                this.smoothPinchDist = rawDist;
                this.handVisible = true;
            } else {
                this.cursor.x = lerp(this.cursor.x, rawX, 1 - this.CURSOR_SMOOTHING);
                this.cursor.y = lerp(this.cursor.y, rawY, 1 - this.CURSOR_SMOOTHING);
                this.smoothPinchDist = lerp(this.smoothPinchDist, rawDist, 1 - this.PINCH_SMOOTHING);
            }

            if (this.smoothPinchDist > this.OPEN_THRESHOLD) {
                this.canGrab = true; 
            }

            if (this.smoothPinchDist < this.PINCH_THRESHOLD) {
                if (!this.isPinching && this.canGrab) {
                    this.isPinching = true;
                    this.canGrab = false; 
                }
            } else if (this.smoothPinchDist > this.PINCH_THRESHOLD + 0.01) {
                this.isPinching = false;
            }

            if (this.onTrackingUpdate) {
                this.onTrackingUpdate({
                    cursor: this.cursor,
                    isPinching: this.isPinching,
                    canGrab: this.canGrab,
                    landmarks: hand 
                });
            }

        } else {
            // Hand left the camera view
            if (this.handVisible) {
                this.handVisible = false;
                
                // Do NOT reset the pinch state immediately, acts as a grace period
                if (this.onTrackingLost) {
                    this.onTrackingLost();
                }
            }
        }
    }
}
