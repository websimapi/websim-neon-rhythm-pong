export class GameEngine {
    constructor(audio, input, renderer) {
        this.audio = audio;
        this.input = input;
        this.renderer = renderer;
        
        this.running = false;
        this.score = 0;
        this.multiplier = 1;
        this.combo = 0;
        
        this.paddle = { x: 0.5, width: 0.2, height: 20, targetX: 0.5 };
        this.opponent = { x: 0.5, width: 0.2, height: 20 };
        this.ball = { x: 0, y: 0, vx: 0, vy: 0, radius: 12, active: false };
        this.powerups = []; // {x, y, type, radius, color}
        this.beatLines = []; // Y positions of falling beat markers
        
        // Physics constants relative to screen size
        this.speedBase = 0.008; // Base Ball Speed factor
        
        // Beat tracking
        this.lastBeatTime = 0;
        
        // Difficulty
        this.bpm = 120;
    }

    start() {
        this.running = true;
        this.score = 0;
        this.combo = 0;
        this.multiplier = 1;
        this.updateUI();
        
        this.resetBall();
        
        // Hook audio
        this.audio.onBeat = (type) => this.handleBeat(type);
        if (this.audio.mode === 'procedural') {
            this.audio.startProcedural();
        }
    }
    
    resetBall() {
        this.ball.x = this.renderer.width / 2;
        this.ball.y = this.renderer.height / 2;
        // Pixel based velocity
        const speed = this.renderer.height / 120; // Scale speed with height
        this.ball.vx = (Math.random() > 0.5 ? 1 : -1) * speed * 0.5; 
        this.ball.vy = -speed; // Send to opponent first
        this.ball.active = true;
    }

    handleBeat(type) {
        // Visual pulse
        this.renderer.bgPulse = 1.0;
        
        // Spawn Visual Beat Line at top
        this.beatLines.push({ y: 0, alpha: 0.8 });

        // Spawn Powerup logic?
        if (this.combo > 5 && Math.random() < 0.1) {
            this.spawnPowerup();
        }
    }
    
    spawnPowerup() {
        const types = [
            { id: 'size', color: '#00ff00' },
            { id: 'slow', color: '#0000ff' },
            { id: 'points', color: '#ffff00' }
        ];
        const t = types[Math.floor(Math.random() * types.length)];
        
        this.powerups.push({
            x: Math.random() * this.renderer.width,
            y: -50,
            radius: 15,
            type: t.id,
            color: t.color,
            vy: 3 // Speed
        });
    }

    update(dt) {
        if (!this.running) return;

        // 1. Update Player Paddle
        const targetPixelX = this.input.pointerX * this.renderer.width;
        const currentPixelX = this.paddle.x * this.renderer.width;
        const newPixelX = currentPixelX + (targetPixelX - currentPixelX) * 0.2;
        this.paddle.x = newPixelX / this.renderer.width;

        // 2. Update Opponent (AI)
        // AI chases ball with reaction delay / smoothness
        if (this.ball.active) {
            const ballNormX = this.ball.x / this.renderer.width;
            const lerpSpeed = 0.08; // AI Speed
            this.opponent.x += (ballNormX - this.opponent.x) * lerpSpeed;
        }
        
        // 3. Update Ball
        if (this.ball.active) {
            this.ball.x += this.ball.vx * dt * 60; 
            this.ball.y += this.ball.vy * dt * 60;
            
            // Side Wall collisions
            if (this.ball.x < this.ball.radius) {
                this.ball.x = this.ball.radius;
                this.ball.vx *= -1;
                this.audio.playSfx('hit');
            } else if (this.ball.x > this.renderer.width - this.ball.radius) {
                this.ball.x = this.renderer.width - this.ball.radius;
                this.ball.vx *= -1;
                this.audio.playSfx('hit');
            }

            // Opponent Collision (Top)
            const aiY = 50;
            const aiW = this.opponent.width * this.renderer.width;
            const aiLeft = (this.opponent.x * this.renderer.width) - aiW/2;
            const aiRight = aiLeft + aiW;

            if (this.ball.y - this.ball.radius <= aiY + this.opponent.height/2 && 
                this.ball.y + this.ball.radius >= aiY - this.opponent.height/2 &&
                this.ball.vy < 0) {
                
                if (this.ball.x >= aiLeft - this.ball.radius && this.ball.x <= aiRight + this.ball.radius) {
                    this.ball.vy *= -1;
                    // Add slight random deflection
                    this.ball.vx += (Math.random() - 0.5) * 2;
                    this.audio.playSfx('hit');
                    this.renderer.createExplosion(this.ball.x, this.ball.y, '#ff0055');
                }
            } else if (this.ball.y < 0) {
                 // Hit top wall (AI missed - shouldn't happen often with simple AI, but bounce anyway)
                 this.ball.vy *= -1;
                 this.audio.playSfx('hit');
            }
            
            // Player Paddle Collision
            const paddleY = this.renderer.height - 50;
            const paddleW = this.paddle.width * this.renderer.width;
            const paddleLeft = (this.paddle.x * this.renderer.width) - paddleW/2;
            const paddleRight = paddleLeft + paddleW;
            
            if (this.ball.y + this.ball.radius >= paddleY - this.paddle.height/2 && 
                this.ball.y - this.ball.radius <= paddleY + this.paddle.height/2 &&
                this.ball.vy > 0) {
                
                if (this.ball.x >= paddleLeft - this.ball.radius && this.ball.x <= paddleRight + this.ball.radius) {
                    // HIT!
                    this.handleHit(this.ball.x - (paddleLeft + paddleW/2));
                }
            }
            
            // Death
            if (this.ball.y > this.renderer.height + 50) {
                this.gameOver();
            }
        }
        
        // 3. Update Beat Lines
        const lineSpeed = this.renderer.height * 0.6; // Screen height per ~1.6s
        for (let i = this.beatLines.length - 1; i >= 0; i--) {
            let line = this.beatLines[i];
            line.y += lineSpeed * dt;
            line.alpha -= 0.3 * dt;
            if (line.y > this.renderer.height || line.alpha <= 0) {
                this.beatLines.splice(i, 1);
            }
        }

        // 4. Update Powerups
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            let p = this.powerups[i];
            p.y += p.vy;
            
            // Check collision with paddle
            const paddleY = this.renderer.height - 50;
            const paddleW = this.paddle.width * this.renderer.width;
            const paddleX = this.paddle.x * this.renderer.width;
            
            // Simple dist check
            const dx = p.x - paddleX;
            const dy = p.y - paddleY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < p.radius + paddleW/2 && Math.abs(dy) < 20) {
                this.activatePowerup(p.type);
                this.powerups.splice(i, 1);
                this.audio.playSample('powerup');
            } else if (p.y > this.renderer.height) {
                this.powerups.splice(i, 1);
            }
        }
    }
    
    activatePowerup(type) {
        if (type === 'points') {
            this.score += 500;
        } else if (type === 'size') {
            this.paddle.width = Math.min(0.5, this.paddle.width * 1.5);
            setTimeout(() => this.paddle.width = 0.2, 5000);
        } else if (type === 'slow') {
            const oldVx = this.ball.vx;
            const oldVy = this.ball.vy;
            this.ball.vx *= 0.5;
            this.ball.vy *= 0.5;
            setTimeout(() => {
                this.ball.vx = oldVx;
                this.ball.vy = oldVy;
            }, 3000);
        }
        this.updateUI();
    }

    handleHit(offsetFromCenter) {
        // Basic bounce
        this.ball.vy *= -1;
        // Add horizontal english based on where it hit the paddle
        this.ball.vx += offsetFromCenter * 0.1;
        
        // Rhythm Check
        // We check if a beat occurred recently (within 100ms)
        const now = this.audio.ctx.currentTime;
        const timeSinceBeat = now - this.audio.lastBeatTime;
        // Or check against predicted next beat
        
        // Simplified "Rhythm" bonus: High energy = better score
        let isRhythmHit = false;
        
        // If the background is still pulsing from a beat (pulse decays from 1.0)
        if (this.renderer.bgPulse > 0.5) {
            isRhythmHit = true;
        }
        
        if (isRhythmHit) {
            this.combo++;
            this.multiplier = Math.min(8, 1 + Math.floor(this.combo / 5));
            this.score += 100 * this.multiplier;
            this.renderer.createExplosion(this.ball.x, this.ball.y, '#00ff00'); // Green perfect
            this.audio.playSample('perfect');
            this.displayFloatingText("PERFECT", this.ball.x, this.ball.y);
        } else {
            this.score += 50 * this.multiplier;
            this.renderer.createExplosion(this.ball.x, this.ball.y, '#00f3ff'); // Blue normal
        }
        
        // Escalation: Increase speed slightly every hit
        const speedCap = 15;
        if (Math.abs(this.ball.vy) < speedCap) this.ball.vy *= 1.05;
        if (Math.abs(this.ball.vx) < speedCap) this.ball.vx *= 1.05;

        this.audio.playSfx('hit');
        this.updateUI();
    }
    
    displayFloatingText(text, x, y) {
        // Ideally pass this to renderer, but for simplicity:
        // We will just let the combo counter handle excitement
    }

    gameOver() {
        this.running = false;
        this.audio.stop();
        this.audio.playSample('gameover');
        
        document.getElementById('final-score').innerText = this.score;
        document.getElementById('game-over-overlay').classList.remove('hidden');
        document.getElementById('game-over-overlay').style.display = 'block';
    }

    updateUI() {
        document.getElementById('score-val').innerText = this.score;
        document.getElementById('multiplier-val').innerText = this.multiplier + 'x';
        
        const comboEl = document.getElementById('combo-display');
        const comboVal = document.getElementById('combo-val');
        if (this.combo > 1) {
            comboEl.style.opacity = 1;
            comboEl.style.transform = `translateX(-50%) scale(${1 + (this.combo%10)/10})`;
            comboVal.innerText = this.combo;
        } else {
            comboEl.style.opacity = 0;
        }
    }
}