/**
 * camera.js
 * Manages the webcam hardware, video stream, and frame synchronization.
 */

export class CameraManager {
    /**
     * @param {HTMLVideoElement} videoElement - The hidden video element to attach the stream to.
     * @param {Function} onFrameCallback - The function to call when a new frame is ready for AI processing.
     */
    constructor(videoElement, onFrameCallback) {
        this.videoElement = videoElement;
        this.onFrameCallback = onFrameCallback;
        this.stream = null;
        this.isActive = false;
        this.animationFrameId = null;
        
        // Ensure video plays inline (required for iOS Safari)
        this.videoElement.setAttribute('playsinline', '');
        this.videoElement.muted = true;
    }

    /**
     * Requests camera permissions and starts the hardware stream.
     * @returns {Promise<boolean>} True if successful, false if permission denied/error.
     */
    async start() {
        if (this.isActive) return true;

        // Optimize constraints for tracking: 720p is the sweet spot for MediaPipe.
        // Higher resolutions (1080p/4K) throttle the CPU, while 720p maintains 60 FPS tracking.
        const constraints = {
            video: {
                facingMode: 'user', // Front-facing camera
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 60, max: 60 }
            },
            audio: false // Explicitly disable audio to prevent feedback loops and save bandwidth
        };

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            
            // Wait for the video metadata to load before playing
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    resolve();
                };
            });

            await this.videoElement.play();
            this.isActive = true;
            
            // Start the frame processing loop
            this.processFrames();
            
            return true;
        } catch (error) {
            console.error("Camera Access Error:", error);
            this.handleCameraError(error);
            return false;
        }
    }

    /**
     * Stops the webcam and clears hardware locks.
     */
    stop() {
        if (!this.isActive) return;

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.videoElement.srcObject = null;
        this.isActive = false;
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * The continuous loop that feeds video frames to the AI tracker.
     */
    async processFrames() {
        if (!this.isActive) return;

        // Use requestVideoFrameCallback if available (Chrome/Edge/Safari), fallback to rAF
        // rVFC is significantly more efficient because it only fires when the webcam hardware actually captures a new frame.
        if ('requestVideoFrameCallback' in this.videoElement) {
            this.videoElement.requestVideoFrameCallback(async () => {
                if (this.isActive) {
                    await this.onFrameCallback(this.videoElement);
                    this.processFrames();
                }
            });
        } else {
            // Fallback for older browsers (Firefox)
            this.animationFrameId = requestAnimationFrame(async () => {
                if (this.isActive && this.videoElement.readyState >= 2) {
                    await this.onFrameCallback(this.videoElement);
                }
                this.processFrames();
            });
        }
    }

    /**
     * Handles specific hardware errors for better UX.
     * @param {Error} error 
     */
    handleCameraError(error) {
        let message = "An unknown camera error occurred.";
        
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
            message = "Camera access was denied. Please allow camera permissions in your browser settings to play.";
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            message = "No webcam detected. Please connect a camera and reload the page.";
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            message = "Your webcam is currently being used by another application (e.g., Zoom, Teams). Please close it and try again.";
        }

        // Dispatch a custom event so the UI module can display the error message
        const event = new CustomEvent('cameraError', { detail: { message } });
        window.dispatchEvent(event);
    }
}