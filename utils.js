/**
 * utils.js
 * Contains pure functions for math, easing, and data persistence.
 */

// ============================================================================
// MATH & INTERPOLATION
// ============================================================================

/**
 * Linear Interpolation (Lerp)
 * Used for temporal smoothing of the hand cursor to eliminate camera jitter.
 * @param {number} start - Current value
 * @param {number} end - Target value
 * @param {number} amt - Interpolation factor (0.0 to 1.0)
 * @returns {number} Smoothed value
 */
export function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

/**
 * Calculate Euclidean distance between two 2D points.
 * Used for pinch detection and snapping calculations.
 * Math.hypot is highly optimized in V8/SpiderMonkey engines.
 * @param {Object} p1 - {x, y}
 * @param {Object} p2 - {x, y}
 * @returns {number} Distance
 */
export function getDistance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

// ============================================================================
// ANIMATION EASING
// ============================================================================

/**
 * Exponential Ease Out
 * Creates a magnetic "snap" effect that starts fast and smoothly decelerates.
 * Used when a puzzle tile is dropped and slides into its grid slot.
 * @param {number} x - Progress of animation (0.0 to 1.0)
 * @returns {number} Eased progress
 */
export function easeOutExpo(x) {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

/**
 * Elastic Ease Out
 * Adds a slight "bounce" effect. Useful for UI popups or tile placement.
 * @param {number} x - Progress of animation (0.0 to 1.0)
 * @returns {number} Eased progress
 */
export function easeOutElastic(x) {
    const c4 = (2 * Math.PI) / 3;
    return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
}

// ============================================================================
// DATA PERSISTENCE (LOCAL STORAGE)
// ============================================================================

const STORAGE_PREFIX = 'cyber_puzzle_best_';

/**
 * Formats seconds into a MM:SS string.
 * @param {number} totalSeconds 
 * @returns {string} Formatted time
 */
export function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Retrieves the best score for a specific grid size.
 * @param {number} gridSize - The current grid size (3, 4, or 5)
 * @returns {Object|null} { time: number, moves: number }
 */
export function getBestScore(gridSize) {
    try {
        const data = localStorage.getItem(`${STORAGE_PREFIX}${gridSize}`);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.warn("LocalStorage is disabled or unavailable.");
        return null;
    }
}

/**
 * Saves a new score if it beats the previous best.
 * "Best" is determined primarily by lowest time, then lowest moves.
 * @param {number} gridSize - Current grid size
 * @param {number} time - Seconds taken
 * @param {number} moves - Number of moves made
 * @returns {boolean} True if a new high score was set
 */
export function saveScoreIfBest(gridSize, time, moves) {
    const currentBest = getBestScore(gridSize);
    let isNewBest = false;

    if (!currentBest) {
        isNewBest = true;
    } else {
        // Compare: lower time is better. If time is tied, lower moves is better.
        if (time < currentBest.time || (time === currentBest.time && moves < currentBest.moves)) {
            isNewBest = true;
        }
    }

    if (isNewBest) {
        try {
            localStorage.setItem(`${STORAGE_PREFIX}${gridSize}`, JSON.stringify({ time, moves }));
        } catch (e) {
            console.warn("Failed to save score to LocalStorage.");
        }
    }
    
    return isNewBest;
}

// ============================================================================
// PERFORMANCE OPTIMIZATIONS
// ============================================================================

/**
 * Throttle Function
 * Ensures a function is only called once every X milliseconds.
 * Useful for limiting the rate of UI updates or resize events to prevent CPU spikes.
 * @param {Function} func 
 * @param {number} limit 
 * @returns {Function}
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}