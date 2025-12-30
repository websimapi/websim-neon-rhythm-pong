/**
 * Handles WebAudio API for procedural generation and beat detection.
 */
export class AudioManager {
    constructor() {
        this.ctx = null;
        this.analyser = null;
        this.source = null;
        this.buffers = {};
        this.isPlaying = false;
        this.bpm = 100; // Default
        this.targetBpm = 100;
        this.lastBeatTime = 0;
        this.beatThreshold = 0.6; // For analyzing custom audio
        this.mode = 'procedural'; // 'procedural' or 'upload'
        
        // Beat Tracking for Gameplay
        this.scheduledBeats = []; // Times of recent/upcoming beats

        // Procedural sequencing
        this.nextNoteTime = 0;
        this.current16thNote = 0;
        this.scheduleAheadTime = 0.1;
        this.lookahead = 25.0; // ms
        this.timerID = null;
        
        // Callbacks
        this.onBeat = null;
    }

    async init() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        
        // Create a gain node for master volume
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.8;
        this.masterGain.connect(this.ctx.destination);

        await this.loadAssets();
    }

    async loadAssets() {
        const paths = {
            'gameover': '/voice_gameover.mp3',
            'powerup': '/voice_powerup.mp3',
            'perfect': '/voice_perfect.mp3'
        };

        for (const [key, path] of Object.entries(paths)) {
            try {
                const response = await fetch(path);
                const arrayBuffer = await response.arrayBuffer();
                this.buffers[key] = await this.ctx.decodeAudioData(arrayBuffer);
            } catch (e) {
                console.error('Audio asset missing:', path);
            }
        }
    }

    playSample(name) {
        if (!this.ctx || !this.buffers[name]) return;
        
        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers[name];
        
        // Create a separate gain for samples to mix them nicely
        const sfxGain = this.ctx.createGain();
        sfxGain.gain.value = 1.2; // Boost voices slightly
        sfxGain.connect(this.masterGain);
        
        source.connect(sfxGain);
        source.start(0);
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setMode(mode, fileBuffer = null) {
        this.mode = mode;
        if (mode === 'upload' && fileBuffer) {
            this.setupUploadedAudio(fileBuffer);
        }
    }

    async setupUploadedAudio(arrayBuffer) {
        if (this.source) {
            this.source.stop();
            this.source.disconnect();
        }
        
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.source = this.ctx.createBufferSource();
        this.source.buffer = audioBuffer;
        this.source.loop = true;
        this.source.connect(this.analyser);
        this.analyser.connect(this.masterGain);
        
        this.source.start(0);
        this.isPlaying = true;
        
        // Start analysis loop
        this.analyzeLoop();
    }

    startProcedural() {
        this.isPlaying = true;
        this.nextNoteTime = this.ctx.currentTime;
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        clearTimeout(this.timerID);
        if (this.source) {
            try { this.source.stop(); } catch(e){}
        }
    }

    // --- Procedural Engine ---

    scheduler() {
        if (!this.isPlaying) return;

        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.current16thNote, this.nextNoteTime);
            this.nextNote();
        }
        this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += 0.25 * secondsPerBeat; // 16th notes
        this.current16thNote = (this.current16thNote + 1) % 16;
    }

    scheduleNote(beatNumber, time) {
        // Track Beat Times for Sync
        if (beatNumber % 4 === 0) {
            this.scheduledBeats.push(time);
            // Cleanup old beats
            this.scheduledBeats = this.scheduledBeats.filter(t => t > this.ctx.currentTime - 1.0);
        }

        // Simple Techno Pattern
        // Kick on 0, 4, 8, 12
        if (beatNumber % 4 === 0) {
            this.triggerKick(time);
            if (this.onBeat) this.onBeat('kick');
        }
        
        // HiHat on off-beats
        if (beatNumber % 4 === 2) {
            this.triggerHiHat(time);
        }

        // Bass Pulse
        if (beatNumber % 2 === 0) {
            this.triggerBass(time, 110); // A2
        }
    }

    triggerKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

        osc.start(time);
        osc.stop(time + 0.5);
    }

    triggerHiHat(time) {
        // White noise buffer
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(time);
    }

    triggerBass(time, freq) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, time);
        filter.frequency.linearRampToValueAtTime(800, time + 0.1);
        filter.frequency.linearRampToValueAtTime(200, time + 0.2);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.linearRampToValueAtTime(0, time + 0.25);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(time);
        osc.stop(time + 0.3);
    }

    playSfx(type) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        
        if (type === 'hit') {
            // High ping
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, t);
            osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
            
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.5, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t);
            osc.stop(t + 0.2);
        } else if (type === 'powerup') {
            const osc = this.ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, t);
            osc.frequency.linearRampToValueAtTime(880, t + 0.3);
             const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.1, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.3);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t);
            osc.stop(t + 0.3);
        }
    }

    setBpm(bpm) {
        // Smoothly adjust, or instant? Instant is better for responsive mechanics
        this.bpm = bpm;
    }

    checkSync() {
        if (!this.ctx) return 0;
        const now = this.ctx.currentTime;
        // Check if we are close to a beat
        // Look through scheduled beats
        const window = 0.15; // 150ms leniency
        
        for (let t of this.scheduledBeats) {
            const diff = Math.abs(t - now);
            if (diff < window) {
                return 1 - (diff / window); // Return "accuracy" 0 to 1
            }
        }
        return 0;
    }

    // --- Analysis Loop for Uploaded Music ---
    analyzeLoop() {
        if (!this.isPlaying || this.mode !== 'upload') return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        // Low freq average (Bass)
        let sum = 0;
        const bassBins = 10;
        for (let i = 0; i < bassBins; i++) {
            sum += dataArray[i];
        }
        const average = sum / bassBins;
        const normalized = average / 255;

        // Beat Detection
        const now = this.ctx.currentTime;
        if (normalized > this.beatThreshold && now > this.lastBeatTime + 0.25) { // 0.25s debounce ~240bpm max
            this.lastBeatTime = now;
            if (this.onBeat) this.onBeat('kick');
        }

        requestAnimationFrame(() => this.analyzeLoop());
    }
}