/**
 * tracker.js
 * Optimized for low-end hardware and minimal physical strain.
 */

import { lerp } from './utils.js';

export class HandTracker {
    constructor() {
        this.handsAI = null;
        this.isInitialized = false;
        
        this.handVisible = false;
        this.cursor = { x: 0.5, y: 0.5 };
        
        this.smoothPinchDist = 0.1;
        this.isPinching = false;
        this.canGrab = true;
        
        this.PINCH_THRESHOLD = 0.06; 
        this.OPEN_THRESHOLD = 0.10;  
        
        this.CURSOR_SMOOTHING = 0.5;
        this.PINCH_SMOOTHING = 0.7;

        this.onTrackingUpdate = null;
        this.onTrackingLost = null;
        this.lostTimer = null;
    }

    async initialize() {
        if (this.isInitialized) return;

        this.handsAI = new window.Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        this.handsAI.setOptions({
            maxNumHands: 1, 
            // CRITICAL FIX: Changed from 1 to 0. This uses the 'Lite' AI model, 
            // which is drastically faster and should fix your 12 FPS issue.
            modelComplexity: 0, 
            minDetectionConfidence: 0.4,
            minTrackingConfidence: 0.3 
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
            
            if (this.lostTimer) {
                clearTimeout(this.lostTimer);
                this.lostTimer = null;
            }

            const hand = results.multiHandLandmarks[0];
            const indexTip = hand[8];
            const thumbTip = hand[4];

            // 1. Calculate raw center
            let rawX = 1.0 - ((indexTip.x + thumbTip.x) / 2);
            let rawY = (indexTip.y + thumbTip.y) / 2;

            // 2. MULTIPLIER FIX: Multiply movement by 1.5x. 
            // You now only need to move your hand a short distance to cross the whole screen.
            rawX = (rawX - 0.5) * 1.5 + 0.5;
            rawY = (rawY - 0.5) * 1.5 + 0.5;

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
            if (this.handVisible && !this.lostTimer) {
                this.lostTimer = setTimeout(() => {
                    this.handVisible = false;
                    this.isPinching = false;
                    this.canGrab = true;
                    
                    if (this.onTrackingLost) {
                        this.onTrackingLost();
                    }
                    this.lostTimer = null;
                }, 400); 
            }
        }
    }
}
