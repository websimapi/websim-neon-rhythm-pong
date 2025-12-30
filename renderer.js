export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false }); // Optimization
        this.width = canvas.width;
        this.height = canvas.height;
        this.particles = [];
        
        // Dynamic styling
        this.bgPulse = 0;
        this.chromaticOffset = 0;
        
        // Cache images/assets if needed
        this.bgImage = new Image();
        this.bgImage.src = '/bg_noise.png';
    }

    resize() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
    }

    clear() {
        this.ctx.fillStyle = `rgba(5, 5, 5, 0.4)`; // Trail effect
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawBackground(beatIntensity) {
        // Draw Noise Texture
        if (this.bgImage.complete) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.05 + (beatIntensity * 0.05);
            this.ctx.globalCompositeOperation = 'overlay';
            
            // Tile the noise slightly to ensure coverage or just stretch
            // Stretcing is cheaper for full screen canvas
            this.ctx.drawImage(this.bgImage, 0, 0, this.width, this.height);
            this.ctx.restore();
        }

        // Grid
        this.ctx.save();
        this.ctx.strokeStyle = `rgba(0, 243, 255, ${0.1 + beatIntensity * 0.2})`;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        
        // Vertical perspective lines
        for (let i = 0; i <= 10; i++) {
            const x = (i / 10) * this.width;
            // Perspective transform emulation (Tunnel center)
            const vanishX = this.width / 2;
            const vanishY = this.height * 0.5;
            
            // Floor
            this.ctx.moveTo(x, this.height);
            this.ctx.lineTo(vanishX + (x - vanishX) * 0.1, vanishY + 20);
            
            // Ceiling
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(vanishX + (x - vanishX) * 0.1, vanishY - 20);
        }
        
        // Horizontal moving lines (pseudo-3d)
        const time = performance.now() / 1000;
        const offset = (time * 150) % 150;
        
        // Floor lines
        for (let i = 0; i < 8; i++) {
            // Exponential spacing for depth
            const dist = (i * 150 + offset);
            const y = this.height - dist * (dist/1000); // curve
            if (y > this.height * 0.5) {
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.width, y);
            }
        }
        
        // Ceiling lines
        for (let i = 0; i < 8; i++) {
            const dist = (i * 150 + offset);
            const y = dist * (dist/1000);
            if (y < this.height * 0.5) {
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.width, y);
            }
        }
        
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawPaddle(x, y, width, height, color, isCharged) {
        this.ctx.save();
        this.ctx.shadowBlur = isCharged ? 40 : 20;
        this.ctx.shadowColor = isCharged ? '#00ff00' : color;
        this.ctx.fillStyle = isCharged ? '#ccff00' : color;
        this.ctx.fillRect(x - width/2, y - height/2, width, height);
        
        // Inner core
        this.ctx.fillStyle = "#fff";
        this.ctx.fillRect(x - width/2 + 2, y - height/2 + 2, width - 4, height - 4);
        
        if (isCharged) {
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x - width/2 - 4, y - height/2 - 4, width + 8, height + 8);
        }

        this.ctx.restore();
    }

    drawBall(x, y, radius, color) {
        this.ctx.save();
        
        // Chromatic Aberration for ball
        if (this.chromaticOffset > 0) {
            this.ctx.globalCompositeOperation = 'screen';
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            this.ctx.beginPath();
            this.ctx.arc(x - this.chromaticOffset, y, radius, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
            this.ctx.beginPath();
            this.ctx.arc(x + this.chromaticOffset, y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalCompositeOperation = 'source-over';
        } else {
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = color;
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
        
        // Decay chromatic aberration
        this.chromaticOffset *= 0.9;
    }
    
    drawBeatLines(lines) {
        // Visual indicator of the "Rhythm Line" falling
        if (!lines || lines.length === 0) return;

        this.ctx.save();
        this.ctx.lineWidth = 2;
        
        lines.forEach(line => {
            const y = line.y;
            if (y > 0 && y < this.height) {
                this.ctx.strokeStyle = `rgba(255, 0, 255, ${line.alpha || 0.3})`;
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.width, y);
                this.ctx.stroke();
            }
        });
        this.ctx.restore();
    }

    drawPowerUps(powerups) {
        powerups.forEach(p => {
            this.ctx.save();
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = p.color;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
            this.ctx.fill();
            
            // Icon or text
            this.ctx.fillStyle = 'black';
            this.ctx.font = '10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(p.type[0].toUpperCase(), p.x, p.y);
            this.ctx.restore();
        });
    }

    createExplosion(x, y, color) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1.0,
                color: color,
                size: Math.random() * 4 + 1
            });
        }
        this.chromaticOffset = 5; // Trigger effect
    }

    updateAndDrawParticles() {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();
    }
}