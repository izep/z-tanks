
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhysicsSystem } from '../src/systems/PhysicsSystem';
import { TerrainSystem } from '../src/systems/TerrainSystem';
import { GameState, GamePhase, type TankState } from '../src/core/GameState';

import { SoundManager } from '../src/core/SoundManager';
import { WrapBorderStrategy } from '../src/systems/physics/BorderStrategy';

// Mock Canvas and Context for Node environment
class MockContext {
    clearRect() { }
    beginPath() { }
    moveTo() { }
    lineTo() { }
    closePath() { }
    fill() { }
    arc() { }
    getImageData() {
        return { data: new Uint8ClampedArray(4) }; // Always transparent
    }
}

class MockCanvas {
    width = 800;
    height = 600;
    getContext() { return new MockContext(); }
}

class MockSoundManager extends SoundManager {
    constructor() {
        super();
        this.ctx = { createGain: () => ({ connect: () => {}, gain: { value: 0 } }) } as any;
    }
    playExplosion() { }
    playHit() { }
    playSizzle() { }
}

global.HTMLCanvasElement = MockCanvas as any;
// @ts-ignore
global.document = {
    createElement: () => new MockCanvas()
} as any;

// Mock window
global.window = {
    AudioContext: class {
        createGain() { return { connect: () => {}, gain: { value: 0 } }; }
        createOscillator() { return { connect: () => {}, start: () => {}, stop: () => {}, frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }; }
        destination: {}
        currentTime: 0
    },
} as any;

describe('PhysicsSystem', () => {
    let terrain: TerrainSystem;
    let physics: PhysicsSystem;
    let mockState: GameState;
    let soundManager: SoundManager;

    beforeEach(() => {
        terrain = new TerrainSystem(800, 600);
        soundManager = new MockSoundManager();
        // Spy on getGroundY to control terrain height for the test
        vi.spyOn(terrain, 'getGroundY').mockReturnValue(550);
        vi.spyOn(terrain, 'isSolid').mockImplementation((x, y) => {
            return y >= 550;
        });
        physics = new PhysicsSystem(terrain, soundManager);

        mockState = {
            phase: GamePhase.PROJECTILE_FLYING,
            tanks: [
                { id: 1, name: "P1", x: 100, y: 500, health: 100 } as TankState,
                { id: 2, name: "P2", x: 410, y: 550, health: 100 } as TankState,
            ],
            projectiles: [],
            explosions: [],
            currentPlayerIndex: 0,
            roundNumber: 1,
            maxRounds: 10,
            wind: 0,
            gravity: 98,
            terrainDirty: false,
            lastExplosionTime: 0
        };
    });


    it('should update projectile position based on gravity and wind', () => {
        mockState.wind = 10;
        const proj: any = {
            id: '1',
            x: 100,
            y: 100,
            vx: 100,
            vy: 0,
            weaponType: 'missile',
            ownerId: 1,
            elapsedTime: 0,
            trail: []
        };
        mockState.projectiles = [proj];

        physics.update(mockState, 0.1);

        expect(proj.vx).toBeCloseTo(100 + (10 * 0.1 * 6)); // wind factor of 6
        expect(proj.vy).toBeCloseTo(98 * 0.1 * 10); // gravity factor of 10
        expect(proj.x).toBeCloseTo(100 + proj.vx * 0.1);
    });

    it('should detect boundary collision', () => {
        const proj: any = {
            id: '2',
            x: -10, // Out of bounds
            y: 100,
            vx: 0,
            vy: 0,
            weaponType: 'missile',
            ownerId: 1,
            elapsedTime: 0,
            trail: []
        };
        mockState.projectiles = [proj];

        physics.update(mockState, 0.1);

        expect(mockState.projectiles.length).toBe(0);
    });

    it('should detect projectile-tank collision', () => {
        const proj: any = {
            id: '3',
            x: 685,
            y: 490,
            vx: 100,
            vy: 0,
            weaponType: 'missile',
            ownerId: 1,
            elapsedTime: 0,
            trail: []
        };
        mockState.tanks.push({ id: 3, name: "P3", x: 700, y: 500, health: 100 } as TankState)
        mockState.projectiles = [proj];
        mockState.explosions = [];

        physics.update(mockState, 0.1);

        expect(mockState.projectiles.length).toBe(0);
        expect(mockState.explosions.length).toBe(1);
        // Position after update: x=695, y=499.8
        expect(mockState.explosions[0].x).toBeCloseTo(695);
        expect(mockState.explosions[0].y).toBeCloseTo(499.8);
    });

    it('should detect projectile-terrain collision', () => {
        const proj: any = {
            id: '4',
            x: 400,
            y: 545,
            vx: 0,
            vy: 100,
            weaponType: 'missile',
            ownerId: 1,
            elapsedTime: 0,
            trail: []
        };
        mockState.projectiles = [proj];
        mockState.explosions = [];

        physics.update(mockState, 0.1);

        expect(mockState.projectiles.length).toBe(0);
        expect(mockState.explosions.length).toBe(1);
        expect(mockState.explosions[0].x).toBeCloseTo(400);
        expect(mockState.explosions[0].y).toBeCloseTo(564.8);
    });

    it('should damage tanks and deform terrain on explosion', () => {
        const explodeSpy = vi.spyOn(terrain, 'explode');
        const proj: any = {
            id: '5',
            x: 400,
            y: 545,
            vx: 0,
            vy: 100,
            weaponType: 'missile',
            ownerId: 1,
            elapsedTime: 0,
            trail: []
        };
        mockState.projectiles = [proj];

        physics.update(mockState, 0.1);

        expect(mockState.explosions.length).toBe(1);
        expect(explodeSpy).toHaveBeenCalled();
        expect(mockState.tanks[1].health).toBeLessThan(100);
    });

    it('should wrap projectile around screen with WrapBorderStrategy', () => {
        physics.setBorderStrategy(new WrapBorderStrategy());
        const proj: any = {
            id: 'wrap-test',
            x: 810, // Just beyond right edge
            y: 100,
            vx: 100,
            vy: 0,
            weaponType: 'missile',
            ownerId: 1,
            elapsedTime: 0,
            trail: []
        };
        mockState.projectiles = [proj];

        physics.update(mockState, 0.1);

        expect(mockState.projectiles.length).toBe(1);
        expect(proj.x).toBeLessThan(800);
        expect(proj.x).toBeGreaterThan(0);
        expect(proj.x).toBeCloseTo(10 + (proj.vx * 0.1)); // 810 - 800 + movement
    });
});
