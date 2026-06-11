export interface AudioSettings {
    volume: number; // 0..1 master volume
    muted: boolean;
    music: boolean;
}

const AUDIO_SETTINGS_KEY = 'tanksalot_audio_v1';
const DEFAULT_SETTINGS: AudioSettings = { volume: 0.6, muted: false, music: true };

export class SoundManager {
    protected ctx: AudioContext;
    private masterGain: GainNode;
    private musicGain: GainNode;
    private settings: AudioSettings;
    private noiseBufferCache: Map<number, AudioBuffer> = new Map();

    // Music sequencer state
    private musicTimer: ReturnType<typeof setInterval> | null = null;
    private nextNoteTime: number = 0;
    private noteIndex: number = 0;

    constructor() {
        // Handle browser compatibility
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();

        this.settings = this.loadSettings();

        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.22; // Music sits under the SFX
        this.musicGain.connect(this.masterGain);

        this.applyVolume();
    }

    // --- Settings (persisted) ---

    private loadSettings(): AudioSettings {
        try {
            const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
            if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
        } catch {
            // Storage unavailable or corrupted; fall through to defaults
        }
        return { ...DEFAULT_SETTINGS };
    }

    private persistSettings() {
        try {
            localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.settings));
        } catch {
            // Storage unavailable; settings stay session-only
        }
    }

    private applyVolume() {
        this.masterGain.gain.value = this.settings.muted ? 0 : this.settings.volume * 0.5;
    }

    public getSettings(): Readonly<AudioSettings> {
        return this.settings;
    }

    public setVolume(volume: number) {
        this.settings.volume = Math.max(0, Math.min(1, volume));
        this.applyVolume();
        this.persistSettings();
    }

    public setMuted(muted: boolean) {
        this.settings.muted = muted;
        this.applyVolume();
        this.persistSettings();
    }

    public toggleMute(): boolean {
        this.setMuted(!this.settings.muted);
        return this.settings.muted;
    }

    public setMusicEnabled(enabled: boolean) {
        this.settings.music = enabled;
        this.persistSettings();
        if (enabled) this.startMusic();
        else this.stopMusic();
    }

    private resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // --- Sound effects ---

    private noiseBuffer(duration: number): AudioBuffer {
        // Round to 2 decimal places to get cache hits for near-identical durations
        const key = Math.round(duration * 100);
        const cached = this.noiseBufferCache.get(key);
        if (cached) return cached;
        const size = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
        const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
        this.noiseBufferCache.set(key, buffer);
        return buffer;
    }

    private playNoise(duration: number, gainVal: number, filterType: BiquadFilterType, filterFreq: number, freqEnd?: number) {
        this.resume();
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer(duration);

        const filter = this.ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.setValueAtTime(filterFreq, this.ctx.currentTime);
        if (freqEnd !== undefined) {
            filter.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), this.ctx.currentTime + duration);
        }

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start();
    }

    private playTone(type: OscillatorType, freq: number, duration: number, gainVal: number, freqEnd?: number) {
        this.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (freqEnd !== undefined) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    public playFire() {
        // Launch whoosh: pitch sweep + air burst
        this.playTone('triangle', 420, 0.25, 0.3, 90);
        this.playNoise(0.15, 0.12, 'bandpass', 1800, 400);
    }

    public playExplosion() {
        // Boom: deep rumble + filtered noise blast
        this.playTone('sawtooth', 110, 0.6, 0.4, 25);
        this.playNoise(0.5, 0.35, 'lowpass', 900, 100);
    }

    public playHit() {
        // Metallic clank
        this.playTone('square', 700, 0.08, 0.15, 300);
        this.playTone('sine', 1100, 0.12, 0.1);
    }

    public playUI() {
        // Blip
        this.playTone('sine', 600, 0.05, 0.1);
    }

    public playSizzle() {
        this.playNoise(0.1, 0.05, 'highpass', 3000);
    }

    // --- Background music: simple chiptune loop (Am - G - F - E) ---

    // [melody Hz or 0 for rest, bass Hz], eighth notes at 112 BPM
    private static readonly TRACK: [number, number][] = (() => {
        const A4 = 440.0, B4 = 493.88, C5 = 523.25, D5 = 587.33, E5 = 659.26;
        const G4 = 392.0, F4 = 349.23, E4 = 329.63;
        const A2 = 110.0, G2 = 98.0, F2 = 87.31, E2 = 82.41;
        const bars: [number[], number][] = [
            [[A4, C5, E5, C5, A4, C5, E5, C5], A2],
            [[G4, B4, D5, B4, G4, B4, D5, B4], G2],
            [[F4, A4, C5, A4, F4, A4, C5, A4], F2],
            [[E4, G4, B4, G4, E4, G4, B4, E5], E2]
        ];
        const track: [number, number][] = [];
        bars.forEach(([notes, bass]) => notes.forEach(n => track.push([n, bass])));
        return track;
    })();

    public startMusic() {
        if (!this.settings.music || this.musicTimer) return;
        this.resume();
        this.noteIndex = 0;
        this.nextNoteTime = this.ctx.currentTime + 0.1;

        // Lookahead scheduler: queue notes slightly ahead of playback time
        this.musicTimer = setInterval(() => this.scheduleMusic(), 50);
    }

    public stopMusic() {
        if (this.musicTimer) {
            clearInterval(this.musicTimer);
            this.musicTimer = null;
        }
    }

    public isMusicPlaying(): boolean {
        return this.musicTimer !== null;
    }

    private scheduleMusic() {
        const SECONDS_PER_NOTE = 60 / 112 / 2; // Eighth notes at 112 BPM
        const LOOKAHEAD = 0.15;

        while (this.nextNoteTime < this.ctx.currentTime + LOOKAHEAD) {
            const [melody, bass] = SoundManager.TRACK[this.noteIndex % SoundManager.TRACK.length];
            this.scheduleNote('square', melody, this.nextNoteTime, SECONDS_PER_NOTE * 0.9, 0.16);
            if (this.noteIndex % 2 === 0) {
                this.scheduleNote('triangle', bass, this.nextNoteTime, SECONDS_PER_NOTE * 1.8, 0.3);
            }
            this.nextNoteTime += SECONDS_PER_NOTE;
            this.noteIndex++;
        }
    }

    private scheduleNote(type: OscillatorType, freq: number, when: number, duration: number, gainVal: number) {
        if (freq <= 0) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, when);

        gain.gain.setValueAtTime(gainVal, when);
        gain.gain.exponentialRampToValueAtTime(0.01, when + duration);

        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(when);
        osc.stop(when + duration);
    }
}
