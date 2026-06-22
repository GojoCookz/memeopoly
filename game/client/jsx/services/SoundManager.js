const AudioContext = window.AudioContext || window.webkitAudioContext;

class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.musicEnabled = false;
        this.volume = 0.5;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new AudioContext();
            this.initialized = true;
        } catch (e) {}
    }

    play(type) {
        if (!this.enabled || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        switch (type) {
            case 'diceRoll': this._diceRoll(); break;
            case 'diceLand': this._diceLand(); break;
            case 'coin': this._coin(); break;
            case 'buy': this._buy(); break;
            case 'rent': this._rent(); break;
            case 'jail': this._jail(); break;
            case 'go': this._go(); break;
            case 'hop': this._hop(); break;
            case 'click': this._click(); break;
            case 'fanfare': this._fanfare(); break;
            case 'fart': this._fart(); break;
        }
    }

    _osc(freq, duration, type = 'sine', gainVal = 0.3) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(gainVal * this.volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    _noise(duration, gainVal = 0.2) {
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 3000;
        gain.gain.setValueAtTime(gainVal * this.volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        source.start();
    }

    _diceRoll() {
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                this._noise(0.05, 0.15);
                this._osc(200 + Math.random() * 400, 0.03, 'square', 0.1);
            }, i * 60);
        }
    }

    _diceLand() {
        this._osc(300, 0.15, 'sine', 0.4);
        this._osc(450, 0.1, 'triangle', 0.3);
        this._noise(0.08, 0.25);
    }

    _coin() {
        this._osc(1200, 0.08, 'sine', 0.3);
        setTimeout(() => this._osc(1600, 0.15, 'sine', 0.25), 80);
    }

    _buy() {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => {
            setTimeout(() => this._osc(f, 0.12, 'sine', 0.25), i * 80);
        });
    }

    _rent() {
        this._osc(200, 0.3, 'sawtooth', 0.15);
        this._osc(150, 0.4, 'sine', 0.2);
    }

    _jail() {
        this._osc(300, 0.2, 'square', 0.2);
        setTimeout(() => this._osc(200, 0.3, 'square', 0.2), 200);
        setTimeout(() => this._osc(150, 0.4, 'square', 0.2), 400);
    }

    _go() {
        const notes = [392, 440, 494, 523, 587, 659];
        notes.forEach((f, i) => {
            setTimeout(() => this._osc(f, 0.1, 'sine', 0.2), i * 60);
        });
    }

    _hop() {
        this._osc(400 + Math.random() * 200, 0.06, 'sine', 0.15);
    }

    _click() {
        this._osc(800, 0.03, 'square', 0.1);
    }

    _fanfare() {
        const notes = [523, 659, 784, 1047, 784, 1047];
        notes.forEach((f, i) => {
            setTimeout(() => this._osc(f, 0.2, 'triangle', 0.3), i * 120);
        });
    }

    _fart() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.3 * this.volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
        this._noise(0.3, 0.1);
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

export const soundManager = new SoundManager();
