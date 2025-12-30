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
const menu = document.getElementById('menu-overlay');
const gameOverScreen = document.getElementById('game-over-overlay');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const audioUpload = document.getElementById('audio-upload');
const modeProcedural = document.getElementById('mode-procedural');

let selectedMode = 'procedural';

// Mode Selection
modeProcedural.addEventListener('click', () => {
    selectedMode = 'procedural';
    modeProcedural.classList.add('active');
    audioUpload.parentElement.classList.remove('active');
    audio.setMode('procedural');
});

audioUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        selectedMode = 'upload';
        modeProcedural.classList.remove('active');
        audioUpload.parentElement.classList.add('active');
        
        const reader = new FileReader();
        reader.onload = (evt) => {
            audio.setMode('upload', evt.target.result);
        };
        reader.readAsArrayBuffer(file);
    }
});

// Start Game
startBtn.addEventListener('click', async () => {
    await audio.init(); // Must be user triggered
    audio.resume();
    menu.classList.add('hidden');
    game.start();
    loop();
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
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (game.running) {
        renderer.clear();
        
        // Visual Beat Pulse Decay
        renderer.bgPulse *= 0.95;
        renderer.drawBackground(renderer.bgPulse);
        
        // Entities
        const paddleX = game.paddle.x * renderer.width;
        const paddleY = renderer.height - 50;
        const paddleW = game.paddle.width * renderer.width;
        const paddleH = game.paddle.height;
        
        renderer.drawPaddle(paddleX, paddleY, paddleW, paddleH, '#00f3ff');
        
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