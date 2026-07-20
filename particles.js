/**
 * particles.js
 * A high-performance, lightweight 2D particle system for visual effects.
 * Renders directly to the canvas to avoid DOM manipulation overhead.
 */

class Particle {
    constructor(x, y, vx, vy, size, color, life, decay, gravity, isConfetti = false) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = size;
        this.color = color; // e.g., 'rgba(0, 255, 255, '
        this.alpha = life;
        this.decay = decay;
        this.gravity = gravity;
        this.isConfetti = isConfetti;
        
        // Confetti specific properties for 3D tumbling effect
        this.angle = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 0.2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity; // Apply gravity
        
        // Air resistance / friction
        this.vx *= 0.98;
        this.vy *= 0.98;
        
        this.alpha -= this.decay;
        if (this.isConfetti) {
            this.angle += this.spin;
        }
    }

    draw(ctx) {
        if (this.alpha <= 0) return;
        
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        
        if (this.isConfetti) {
            // Tumbling square effect
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.fillStyle = this.color + '1)';
            // Scale X to simulate 3D flipping
            const flip = Math.abs(Math.sin(this.angle * 2));
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size * flip, this.size);
        } else {
            // Glowing spark effect
            ctx.fillStyle = this.color + this.alpha + ')';
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color + '1)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.colors = [
            'rgba(0, 255, 255, ',   // Cyan
            'rgba(184, 41, 234, ',  // Purple
            'rgba(57, 255, 20, ',   // Neon Green
            'rgba(255, 42, 42, '    // Neon Red
        ];
    }

    /**
     * Updates and draws all active particles.
     * Should be called every frame in the main render loop.
     * @param {CanvasRenderingContext2D} ctx 
     */
    render(ctx) {
        if (this.particles.length === 0) return;

        // Iterate backwards to safely remove dead particles without shifting indices
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update();
            
            if (p.alpha <= 0) {
                this.particles.splice(i, 1); // Remove dead particle
            } else {
                p.draw(ctx);
            }
        }
    }

    /**
     * Emits a burst of sparks. Used when locking a tile into the correct place.
     * @param {number} x - Center X
     * @param {number} y - Center Y
     */
    emitSparks(x, y) {
        const count = 15;
        const color = this.colors[2]; // Green sparks for correct placement
        
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 2;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const size = Math.random() * 3 + 1;
            const life = 1.0;
            const decay = Math.random() * 0.05 + 0.02;
            const gravity = 0.1;

            this.particles.push(new Particle(x, y, vx, vy, size, color, life, decay, gravity, false));
        }
    }

    /**
     * Emits a massive fountain of confetti. Used on the victory screen.
     * @param {number} x - Emission origin X
     * @param {number} y - Emission origin Y
     */
    emitConfetti(x, y) {
        const count = 100;
        
        for (let i = 0; i < count; i++) {
            const color = this.colors[Math.floor(Math.random() * this.colors.length)];
            // Shoot upwards and spread out
            const angle = (Math.random() * Math.PI) - Math.PI; 
            const speed = Math.random() * 15 + 5;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const size = Math.random() * 8 + 4;
            const life = 1.5; // Lasts longer
            const decay = Math.random() * 0.01 + 0.005;
            const gravity = 0.3; // Heavier gravity for falling

            this.particles.push(new Particle(x, y, vx, vy, size, color, life, decay, gravity, true));
        }
    }

    /**
     * Clears all particles immediately.
     */
    clear() {
        this.particles = [];
    }
}