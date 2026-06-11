import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameEngine } from '../src/core/GameEngine';
import { SoundManager } from '../src/core/SoundManager';
import { TerrainSystem } from '../src/systems/TerrainSystem';

// Mock Canvas and Context for Node environment
class MockContext {
    clearRect() { }
    beginPath() { }
    moveTo() { }
    lineTo() { }
    closePath() { }
    fill() { }
    arc() { }
    save() { }
    restore() { }
    translate() { }
    rotate() { }
    drawImage() { }
    fillRect() { }
    stroke() { }
    measureText() { return { width: 0 }; }
    fillText() { }
    getImageData() {
        return { data: new Uint8ClampedArray(4) }; // Always transparent
    }
}

class MockCanvas {
    width = 800;
    height = 600;
    getContext() { return new MockContext(); }
    addEventListener() { }
    removeEventListener() { }
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
}

// Global mocks
global.HTMLCanvasElement = MockCanvas as any;
global.HTMLImageElement = class { src = ''; onload = () => {}; } as any;

// Mock window and document
global.window = {
    AudioContext: class {
        createGain() { return { connect: () => {}, gain: { value: 0 } }; }
        createOscillator() { return { connect: () => {}, start: () => {}, stop: () => {}, frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }; }
        destination: {}
        currentTime: 0
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    innerWidth: 800,
    innerHeight: 600
} as any;

global.document = {
    createElement: (tag: string) => {
        if (tag === 'canvas') return new MockCanvas();
        if (tag === 'img') return new global.HTMLImageElement();
        if (tag === 'div') return {
             style: {},
             classList: { add: () => {}, remove: () => {} },
             appendChild: () => {},
             innerHTML: '',
             querySelector: () => ({ addEventListener: () => {}, style: {}, value: '' }),
             querySelectorAll: () => [],
             addEventListener: () => {},
        };
        return { style: {} };
    },
    getElementById: (id: string) => {
        return {
            style: { display: '' },
            innerHTML: '',
            classList: { add: () => {}, remove: () => {} },
            appendChild: () => {},
            addEventListener: () => {},
            querySelector: () => null,
        };
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    body: { appendChild: () => {} }
} as any;

// Mock SoundManager to avoid AudioContext issues
vi.mock('../src/core/SoundManager', () => {
    return {
        SoundManager: class {
            constructor() {}
            playUI() {}
            playShoot() {}
            playExplosion() {}
            playImpact() {}
            playEngine() {}
            stopEngine() {}
            getSettings() { return { volume: 0.6, muted: false, music: false }; }
            setVolume() {}
            setMuted() {}
            setMusicEnabled() {}
            startMusic() {}
            stopMusic() {}
        }
    };
});

// Mock TerrainSystem to avoid expensive generation
vi.mock('../src/systems/TerrainSystem', () => {
    return {
        TerrainSystem: class {
            constructor() {}
            init() { return Promise.resolve(); }
            generate() { return Promise.resolve(); }
            settle() { return false; }
            getHeight() { return 0; }
            getColor() { return null; }
            addTerrain() {}
            destroyTerrain() {}
            isSolid() { return false; }
        }
    };
});

describe('GameEngine Loop Benchmark', () => {
    let game: GameEngine;

    beforeEach(() => {
        vi.useFakeTimers();

        // Mock requestAnimationFrame to simulate 60 FPS
        global.requestAnimationFrame = vi.fn((cb) => {
            return setTimeout(() => {
                cb(performance.now());
            }, 1000 / 60) as unknown as number;
        });

        const canvas = new MockCanvas();
        game = new GameEngine(canvas as any);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should measure the number of update calls per second', () => {
        // Spy on the update method
        // Access private method by casting to any
        const updateSpy = vi.spyOn(game as any, 'update');

        // Start the game loop
        game.start();

        // Run for 1 second
        vi.advanceTimersByTime(1000);

        const callCount = updateSpy.mock.calls.length;
        console.log(`\n\n>>> Benchmark Result: update() called ${callCount} times in 1 second <<<\n`);

        // We expect roughly 60 calls for a correct implementation.
        // If the double-init bug exists, we expect significantly more (likely ~120).
    });
});
