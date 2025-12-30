export class GameEngine {
    constructor(audio, input, renderer) {
        this.audio = audio;
        this.input = input;
        this.renderer = renderer;
        
        this.running = false;
        this.score = 0;
        this.multiplier = 1;
        this.combo = 0;
        this.playerLives = 3;
        this.cpuLives = 3;
        this.attractMode = false;
        
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

        // AI Profiles
        this.aiProfiles = [
            { name: 'Standard', speed: 0.08, prediction: 0.0, error: 0.02 },
            { name: 'Sniper', speed: 0.05, prediction: 1.0, error: 0.0 }, // Predicts perfectly, slower move
            { name: 'Rusher', speed: 0.18, prediction: 0.0, error: 0.15 }, // Fast but jittery/imperfect
            { name: 'Tank', speed: 0.03, prediction: 1.2, error: 0.0 }, // Very slow, predicts ahead
            { name: 'Glitch', speed: 0.25, prediction: -0.1, error: 0.25 } // Extremely fast, erratic
        ];
        this.currentAi = this.aiProfiles[0];
        this.playerAi = this.aiProfiles[0];
    }

    start() {
        this.running = true;
        this.attractMode = false;
        this.score = 0;
        this.combo = 0;
        this.multiplier = 1;
        this.playerLives = 3;
        this.cpuLives = 3;
        
        // Randomize CPU AI
        this.currentAi = this.aiProfiles[Math.floor(Math.random() * this.aiProfiles.length)];
        console.log("VS CPU:", this.currentAi.name);
        
        this.updateUI();
        
        // Reset positions
        this.opponent.x = 0.5;
        this.paddle.x = 0.5;
        this.paddle.width = 0.2; // Reset size powerups
        
        this.resetBall();
        
        // Hook audio
        this.audio.onBeat = (type) => this.handleBeat(type);
        if (this.audio.mode === 'procedural') {
            this.audio.startProcedural();
        }
    }

    startAttractMode() {
        this.running = true;
        this.attractMode = true;
        this.score = 0;
        this.playerLives = 3;
        this.cpuLives = 3;
        
        // Randomize both AIs for attract mode
        this.currentAi = this.aiProfiles[Math.floor(Math.random() * this.aiProfiles.length)];
        this.playerAi = this.aiProfiles[Math.floor(Math.random() * this.aiProfiles.length)];
        
        this.resetBall();
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

    updateAI(paddle, profile) {
        if (!this.ball.active) return;
        
        let targetX = this.ball.x;

        // Prediction: Calculate where ball will intersect paddle's Y plane
        const paddleY = (paddle === this.opponent) ? 50 : this.renderer.height - 50;
        const distY = paddleY - this.ball.y;
        const movingTowards = (paddle === this.opponent) ? (this.ball.vy < 0) : (this.ball.vy > 0);
        
        if (movingTowards && profile.prediction !== 0) {
            const ticks = distY / (this.ball.vy || 0.001);
            if (ticks > 0) {
                targetX += this.ball.vx * ticks * profile.prediction;
            }
        }
        
        // Artificial Error/Jitter
        const time = Date.now() / 1000;
        const noise = Math.sin(time * 5 + (paddle === this.opponent ? 0 : 4)) * this.renderer.width * profile.error;
        targetX += noise;
        
        // Normalize & Clamp
        let targetNorm = targetX / this.renderer.width;
        const halfWidth = paddle.width / 2;
        targetNorm = Math.max(halfWidth, Math.min(1 - halfWidth, targetNorm));
        
        // Move with profile speed
        paddle.x += (targetNorm - paddle.x) * profile.speed;
    }

    update(dt) {
        if (!this.running) return;

        // 1. Update Player Paddle
        if (this.attractMode && this.ball.active) {
            this.updateAI(this.paddle, this.playerAi);
        } else {
            const targetPixelX = this.input.pointerX * this.renderer.width;
            const currentPixelX = this.paddle.x * this.renderer.width;
            const newPixelX = currentPixelX + (targetPixelX - currentPixelX) * 0.2;
            this.paddle.x = newPixelX / this.renderer.width;
        }

        // 2. Update Opponent (AI)
        if (this.ball.active) {
            this.updateAI(this.opponent, this.currentAi);
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
            } else if (this.ball.y + this.ball.radius < 0) {
                // CPU missed: lose a life and reset ball
                if (this.attractMode) {
                    this.resetBall();
                } else {
                    if (this.cpuLives > 0) {
                        this.cpuLives -= 1;
                    }
                    this.score += 200; // reward player for getting past CPU
                    this.resetBall();
                    this.updateUI();
                }
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
            
            // Death / player miss
            if (this.ball.y - this.ball.radius > this.renderer.height) {
                if (this.attractMode) {
                     this.resetBall();
                } else {
                    if (this.playerLives > 0) {
                        this.playerLives -= 1;
                    }
                    if (this.playerLives <= 0) {
                        this.gameOver();
                    } else {
                        this.resetBall();
                        this.updateUI();
                    }
                }
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
        const now = this.audio.ctx ? this.audio.ctx.currentTime : 0;
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
        const el = document.createElement('div');
        el.className = 'floating-text';
        el.innerText = text;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        document.getElementById('game-container').appendChild(el);
        
        // Trigger reflow
        el.offsetHeight; 
        
        el.style.top = (y - 100) + 'px';
        el.style.opacity = '0';
        
        setTimeout(() => el.remove(), 800);
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

        // Update lives HUD
        const playerLivesEl = document.getElementById('player-lives');
        const cpuLivesEl = document.getElementById('cpu-lives');
        if (playerLivesEl) {
            playerLivesEl.innerHTML = '';
            for (let i = 0; i < 3; i++) {
                const dot = document.createElement('div');
                dot.className = 'life-dot' + (i < this.playerLives ? '' : ' off');
                playerLivesEl.appendChild(dot);
            }
        }
        if (cpuLivesEl) {
            cpuLivesEl.innerHTML = '';
            for (let i = 0; i < 3; i++) {
                const dot = document.createElement('div');
                dot.className = 'life-dot' + (i < this.cpuLives ? '' : ' off');
                cpuLivesEl.appendChild(dot);
            }
        }
    }
}