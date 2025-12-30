import { AudioManager } from './audio.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { GameEngine } from './game.js';

// Initialization
const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);
const input = new InputManager(canvas);
const audio = new AudioManager();
const game = new GameEngine(audio, input, renderer);

// Resize handling
window.addEventListener('resize', () => {
    renderer.resize();
});
renderer.resize();

// UI Handling
const startOverlay = document.getElementById('start-overlay');
const gameOverScreen = document.getElementById('game-over-overlay');
const restartBtn = document.getElementById('restart-btn');

// Initialize Attract Mode
game.startAttractMode();

// Start Game Interaction
function startGame() {
    if (game.attractMode) {
        audio.init().then(() => {
            audio.resume();
            startOverlay.classList.add('hidden');
            game.start();
        });
    }
}

// Global click/tap listener for start
startOverlay.addEventListener('click', startGame);
startOverlay.addEventListener('touchstart', (e) => {
    // e.preventDefault();
    startGame();
});

// Restart Game
restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    gameOverScreen.style.display = 'none'; // Ensure it goes away
    game.start();
});

// Main Loop
let lastTime = 0;
function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // Safety check to prevent NaN propagation or huge jumps
    if (isNaN(dt) || dt > 0.1) dt = 0.016;

    if (game.running) {
        renderer.clear();
        
        // Visual Beat Pulse Decay
        renderer.bgPulse *= 0.95;
        renderer.drawBackground(renderer.bgPulse);
        
        // Entities
        // Player
        const paddleX = game.paddle.x * renderer.width;
        const paddleY = renderer.height - 50;
        const paddleW = game.paddle.width * renderer.width;
        const paddleH = game.paddle.height;
        renderer.drawPaddle(paddleX, paddleY, paddleW, paddleH, '#00f3ff', game.paddleCharged);
        
        // Opponent
        const aiX = game.opponent.x * renderer.width;
        const aiY = 50;
        const aiW = game.opponent.width * renderer.width;
        const aiH = game.opponent.height;
        renderer.drawPaddle(aiX, aiY, aiW, aiH, '#ff0055', false);

        renderer.drawBeatLines(game.beatLines);

        if (game.ball.active) {
            renderer.drawBall(game.ball.x, game.ball.y, game.ball.radius, '#ff00ff');
        }
        
        renderer.drawPowerUps(game.powerups);
        renderer.updateAndDrawParticles();
        
        game.update(dt);
    }
    
    requestAnimationFrame(loop);
}

// Start the game loop immediately for attract mode
requestAnimationFrame(loop);