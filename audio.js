/**
 * renderer.js
 * Handles all HTML5 Canvas drawing operations.
 * Highly optimized for 60 FPS rendering.
 */

import { lerp } from './utils.js';

export class Renderer {
    /**
     * @param {HTMLCanvasElement} mainCanvas - The visible `<canvas>` element.
     * @param {HTMLCanvasElement} offscreenCanvas - The hidden `<canvas>` used for buffering.
     * @param {PuzzleGame} puzzle - The instance of the puzzle logic.
     */
    constructor(mainCanvas, offscreenCanvas, puzzle) {
        this.canvas = mainCanvas;
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // alpha: false optimizes rendering if background is opaque
        
        this.offscreenCanvas = offscreenCanvas;
        // willReadFrequently is crucial here because we read from this buffer constantly to slice the image
        this.offCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
        
        this.puzzle = puzzle;

        // Animated drop logic (magnetic snapping)
        this.animatingTiles = new Map(); 

        // Handle canvas resizing
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    /**
     * Resizes internal canvases to match the display size of the main canvas.
     */
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.offscreenCanvas.width = rect.width;
        this.offscreenCanvas.height = rect.height;
    }

    /**
     * Main Render Loop. Should be called exactly once per frame.
     * @param {HTMLVideoElement} video - The raw webcam feed.
     * @param {Object} trackerState - { cursor, isPinching, landmarks }
     */
    render(video, trackerState) {
        // 1. Buffer the video frame to the offscreen canvas (and mirror it)
        this.updateOffscreenBuffer(video);

        // 2. Clear main canvas (not strictly needed if drawing full screen, but good practice)
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const tileW = this.canvas.width / this.puzzle.gridSize;
        const tileH = this.canvas.height / this.puzzle.gridSize;

        // 3. Draw the puzzle grid
        this.drawGrid(tileW, tileH);

        // 4. Draw the dragged tile floating above everything
        if (trackerState && trackerState.isPinching && this.puzzle.draggedTileIndex !== -1) {
            this.drawDraggedTile(trackerState.cursor, tileW, tileH);
        }

        // 5. Draw Cyber Hand Skeleton
        if (trackerState && trackerState.landmarks) {
            this.drawHandSkeleton(trackerState.landmarks);
            this.drawCursorIndicator(trackerState);
        }
    }

    /**
     * Flips and draws the raw video frame into memory.
     */
    updateOffscreenBuffer(video) {
        if (!video || video.readyState < 2) return;
        
        this.offCtx.save();
        // Mirror the X axis so it acts like a real mirror
        this.offCtx.translate(this.offscreenCanvas.width, 0);
        this.offCtx.scale(-1, 1);
        
        // Draw video stretching to fill (object-fit: cover equivalent logic can be added here if aspect ratios mismatch)
        this.offCtx.drawImage(video, 0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        this.offCtx.restore();
    }

    /**
     * Renders all idle and locked tiles to the main canvas.
     */
    drawGrid(tileW, tileH) {
        const lockedTiles = this.puzzle.getLockedTiles();

        for (let i = 0; i < this.puzzle.tiles.length; i++) {
            // Skip drawing the tile that is currently being picked up
            if (i === this.puzzle.draggedTileIndex) continue;

            const originalSlice = this.puzzle.tiles[i];
            
            // Calculate destination (where it is on the screen right now)
            const destPos = this.puzzle.getColRowFromIndex(i);
            const dx = destPos.col * tileW;
            const dy = destPos.row * tileH;

            // Calculate source (where this piece of the image originally came from)
            const srcPos = this.puzzle.getColRowFromIndex(originalSlice);
            const sx = srcPos.col * tileW;
            const sy = srcPos.row * tileH;

            // Draw the slice from the offscreen buffer
            this.ctx.drawImage(this.offscreenCanvas, sx, sy, tileW, tileH, dx, dy, tileW, tileH);

            // Draw Grid Lines / Borders
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(dx, dy, tileW, tileH);

            // Visual feedback: Locked pieces glow green
            if (lockedTiles.includes(i)) {
                this.ctx.save();
                this.ctx.strokeStyle = 'rgba(57, 255, 20, 0.6)'; // Neon Green
                this.ctx.lineWidth = 4;
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = 'rgba(57, 255, 20, 1)';
                this.ctx.strokeRect(dx + 2, dy + 2, tileW - 4, tileH - 4); // Inset slightly
                
                // Slight green tint over the locked tile
                this.ctx.fillStyle = 'rgba(57, 255, 20, 0.1)';
                this.ctx.fillRect(dx, dy, tileW, tileH);
                this.ctx.restore();
            }
        }
    }

    /**
     * Draws the tile currently held by the player.
     */
    drawDraggedTile(cursor, tileW, tileH) {
        const originalSlice = this.puzzle.draggedOriginalValue;
        const srcPos = this.puzzle.getColRowFromIndex(originalSlice);
        
        const sx = srcPos.col * tileW;
        const sy = srcPos.row * tileH;

        // Center the dragged tile on the hand cursor
        const floatX = (cursor.x * this.canvas.width) - (tileW / 2);
        const floatY = (cursor.y * this.canvas.height) - (tileH / 2);

        this.ctx.save();
        // Make the floating tile slightly transparent
        this.ctx.globalAlpha = 0.85;
        this.ctx.drawImage(this.offscreenCanvas, sx, sy, tileW, tileH, floatX, floatY, tileW, tileH);
        
        // Cyberpunk Electric Glow Border
        this.ctx.globalAlpha = 1.0;
        this.ctx.strokeStyle = '#00ffff'; // Cyan
        this.ctx.lineWidth = 4;
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = '#00ffff';
        this.ctx.strokeRect(floatX, floatY, tileW, tileH);
        this.ctx.restore();
    }

    /**
     * Renders the MediaPipe hand landmarks in a futuristic wireframe style.
     */
    drawHandSkeleton(landmarks) {
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(184, 41, 234, 0.8)'; // Purple connections
        this.ctx.lineWidth = 2;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#b829ea';

        // MediaPipe Hands Landmark Connections map
        const connections = [
            [0,1],[1,2],[2,3],[3,4], // Thumb
            [0,5],[5,6],[6,7],[7,8], // Index
            [5,9],[9,10],[10,11],[11,12], // Middle
            [9,13],[13,14],[14,15],[15,16], // Ring
            [13,17],[0,17],[17,18],[18,19],[19,20] // Pinky & Palm base
        ];

        // Batch rendering lines (Performance optimization)
        this.ctx.beginPath();
        for (const [startIdx, endIdx] of connections) {
            const p1 = landmarks[startIdx];
            const p2 = landmarks[endIdx];
            
            // X coordinates must be mirrored! (1 - x)
            this.ctx.moveTo((1 - p1.x) * w, p1.y * h);
            this.ctx.lineTo((1 - p2.x) * w, p2.y * h);
        }
        this.ctx.stroke();

        // Draw glowing nodes at the joints
        this.ctx.fillStyle = '#00ffff'; // Cyan nodes
        this.ctx.shadowColor = '#00ffff';
        this.ctx.beginPath();
        for (const p of landmarks) {
            this.ctx.moveTo((1 - p.x) * w, p.y * h);
            this.ctx.arc((1 - p.x) * w, p.y * h, 3, 0, Math.PI * 2);
        }
        this.ctx.fill();
        
        this.ctx.restore();
    }

    /**
     * Draws the dynamic pinch line between thumb and index finger.
     */
    drawCursorIndicator(trackerState) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        const indexTip = trackerState.landmarks[8];
        const thumbTip = trackerState.landmarks[4];

        this.ctx.save();
        this.ctx.lineWidth = 3;
        
        // Color coding: Red = Locked/Grabbing, Green = Open/Ready
        if (trackerState.isPinching) {
            this.ctx.strokeStyle = '#ff2a2a'; // Danger Red
            this.ctx.shadowColor = '#ff2a2a';
        } else if (trackerState.canGrab) {
            this.ctx.strokeStyle = '#39ff14'; // Success Green
            this.ctx.shadowColor = '#39ff14';
        } else {
            this.ctx.strokeStyle = '#ffff33'; // Warning Yellow (Resetting)
            this.ctx.shadowColor = '#ffff33';
        }
        
        this.ctx.shadowBlur = 15;
        this.ctx.beginPath();
        this.ctx.moveTo((1 - thumbTip.x) * w, thumbTip.y * h);
        this.ctx.lineTo((1 - indexTip.x) * w, indexTip.y * h);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
}