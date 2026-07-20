/**
 * puzzle.js
 * Core game logic, state management, grid mathematics, and win detection.
 */

export class PuzzleGame {
    constructor() {
        this.gridSize = 3; // Default to Easy (3x3)
        this.tiles = [];   // Array representing the current grid state
        this.moves = 0;
        this.isComplete = false;
        
        // Drag State
        this.draggedTileIndex = -1;
        this.draggedOriginalValue = -1;
        
        // Callbacks
        this.onMove = null;
        this.onWin = null;
    }

    /**
     * Initializes a new puzzle of the specified size and shuffles it.
     * @param {number} size - Grid dimensions (3, 4, or 5)
     */
    initialize(size) {
        this.gridSize = size;
        this.moves = 0;
        this.isComplete = false;
        this.draggedTileIndex = -1;
        this.draggedOriginalValue = -1;
        
        // Create ordered array: [0, 1, 2, ..., (size*size)-1]
        const totalTiles = this.gridSize * this.gridSize;
        this.tiles = Array.from({ length: totalTiles }, (_, i) => i);
        
        this.shuffle();

        if (this.onMove) this.onMove(this.moves);
    }

    /**
     * Shuffles the tiles.
     * Note: Because this is a "Swap Any Tile" puzzle (not a sliding 15-puzzle), 
     * EVERY random permutation is 100% solvable. We don't need inversion parity checks.
     */
    shuffle() {
        const totalTiles = this.tiles.length;
        
        // Fisher-Yates Shuffle Algorithm (O(n) time complexity)
        for (let i = totalTiles - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            // Swap
            [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
        }

        // Extremely rare edge case: The shuffle accidentally solved the puzzle. Reshuffle.
        if (this.checkWinCondition()) {
            this.shuffle();
        }
    }

    /**
     * Converts a normalized cursor position (0.0 to 1.0) into a 1D array index.
     * @param {number} normX - X coordinate (0.0 to 1.0)
     * @param {number} normY - Y coordinate (0.0 to 1.0)
     * @returns {number} The index in the tiles array, or -1 if out of bounds.
     */
    getIndexFromNormalizedCoords(normX, normY) {
        if (normX < 0 || normX >= 1 || normY < 0 || normY >= 1) {
            return -1; // Out of bounds
        }

        const col = Math.floor(normX * this.gridSize);
        const row = Math.floor(normY * this.gridSize);
        
        return (row * this.gridSize) + col;
    }

    /**
     * Converts a 1D array index into 2D Grid coordinates.
     * @param {number} index 
     * @returns {Object} { col, row }
     */
    getColRowFromIndex(index) {
        return {
            col: index % this.gridSize,
            row: Math.floor(index / this.gridSize)
        };
    }

    /**
     * Picks up a tile to start dragging.
     * @param {number} index - The grid slot being picked up.
     * @returns {boolean} True if successfully picked up.
     */
    pickTile(index) {
        if (this.isComplete || index === -1) return false;
        
        // Optimization: Don't let the user pick up a tile that is already perfectly placed!
        // This acts as a gameplay reward/lock mechanism.
        if (this.tiles[index] === index) return false;

        this.draggedTileIndex = index;
        this.draggedOriginalValue = this.tiles[index];
        return true;
    }

    /**
     * Drops the currently dragged tile into a target slot, swapping them.
     * @param {number} targetIndex - The grid slot to drop onto.
     * @returns {boolean} True if a valid swap occurred.
     */
    dropTile(targetIndex) {
        if (this.draggedTileIndex === -1) return false;
        
        let swapped = false;

        // Ensure we are dropping on a valid slot, and not just dropping it back where we picked it up,
        // AND ensure the target slot isn't already a locked/correct tile.
        if (targetIndex !== -1 && 
            targetIndex !== this.draggedTileIndex && 
            this.tiles[targetIndex] !== targetIndex) 
        {
            // Swap the values in the state array
            const temp = this.tiles[this.draggedTileIndex];
            this.tiles[this.draggedTileIndex] = this.tiles[targetIndex];
            this.tiles[targetIndex] = temp;
            
            this.moves++;
            swapped = true;
            
            if (this.onMove) this.onMove(this.moves);
            
            // Check if that move solved the puzzle
            if (this.checkWinCondition()) {
                this.isComplete = true;
                if (this.onWin) this.onWin();
            }
        }

        // Reset drag state
        this.draggedTileIndex = -1;
        this.draggedOriginalValue = -1;
        
        return swapped;
    }

    /**
     * Verifies if every tile is in its correct original position.
     * @returns {boolean} True if puzzle is solved.
     */
    checkWinCondition() {
        for (let i = 0; i < this.tiles.length; i++) {
            if (this.tiles[i] !== i) return false;
        }
        return true;
    }

    /**
     * Returns an array of indices for tiles that are currently in their correct spots.
     * Used by the renderer to draw the "locked green glow" effect.
     * @returns {Array<number>}
     */
    getLockedTiles() {
        const locked = [];
        for (let i = 0; i < this.tiles.length; i++) {
            if (this.tiles[i] === i && !this.isComplete) {
                locked.push(i);
            }
        }
        return locked;
    }
}