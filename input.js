export class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.pointerX = 0.5; // Normalized 0 to 1, start at center
        this.isDown = false;
        this.justTapped = false; // Frame-specific tap flag
        
        this.initListeners();
    }

    reset() {
        this.justTapped = false;
    }

    initListeners() {
        // Mouse
        window.addEventListener('mousemove', (e) => this.updatePointer(e.clientX));
        window.addEventListener('mousedown', () => {
            this.isDown = true;
            this.justTapped = true;
        });
        window.addEventListener('mouseup', () => this.isDown = false);

        // Touch
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.isDown = true;
            this.justTapped = true;
            if (e.touches.length > 0) this.updatePointer(e.touches[0].clientX);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent scrolling
            if (e.touches.length > 0) this.updatePointer(e.touches[0].clientX);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.isDown = false;
        });
    }

    updatePointer(clientX) {
        const rect = this.canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        this.pointerX = Math.max(0, Math.min(1, x / rect.width));
    }
}