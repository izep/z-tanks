import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsSystem } from '../src/systems/PhysicsSystem';
import { TerrainSystem } from '../src/systems/TerrainSystem';
import { GamePhase, type GameState, type TankState } from '../src/core/GameState';
import { WEAPONS, GUIDANCE_ORDER } from '../src/core/WeaponData';
import { SoundManager } from '../src/core/SoundManager';

global.document = {
    createElement: (tag: string) => {
        if (tag === 'canvas') {
            return {
                width: 0,
                height: 0,
                getContext: () => ({
                    fillStyle: '',
                    fillRect: () => {},
                    clearRect: () => {},
                    getImageData: () => ({ data: new Uint8ClampedArray(800 * 600 * 4) }),
                    putImageData: () => {},
                    beginPath: () => {},
                    arc: () => {},
                    fill: () => {},
                    moveTo: () => {},
                    lineTo: () => {},
                    closePath: () => {}
                })
            };
        }
        return {};
    }
} as any;

class MockSoundManager extends SoundManager {
    constructor() {
        super();
        this.ctx = { createGain: () => ({ connect: () => {}, gain: { value: 0 } }) } as any;
    }
    playExplosion() { }
    playHit() { }
    playUI() { }
    playFire() { }
}

global.window = {
    AudioContext: class {
        createGain() { return { connect: () => {}, gain: { value: 0 } }; }
        createOscillator() { return { connect: () => {}, start: () => {}, stop: () => {}, frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }; }
        destination: {}
        currentTime: 0
    },
} as any;

function makeTank(overrides: Partial<TankState> = {}): TankState {
    return {
        id: 1,
        name: 'P1',
        x: 100,
        y: 500,
        vy: 0,
        angle: 45,
        power: 600,
        health: 100,
        fuel: 0,
        color: 'red',
        variant: 0,
        isAi: false,
        isFalling: false,
        isDead: false,
        credits: 0,
        currentWeapon: 'baby_missile',
        inventory: {},
        accessories: {},
        hasLanded: true,
        ...overrides
    };
}

function makeState(tanks: TankState[]): GameState {
    return {
        phase: GamePhase.PROJECTILE_FLYING,
        tanks,
        projectiles: [],
        explosions: [],
        currentPlayerIndex: 0,
        roundNumber: 1,
        maxRounds: 10,
        wind: 0,
        gravity: 100,
        terrainDirty: false,
        lastExplosionTime: 0
    };
}

describe('Guidance systems (Requirements 2.2)', () => {
    let physics: PhysicsSystem;
    let terrain: TerrainSystem;

    beforeEach(() => {
        terrain = new TerrainSystem(800, 600);
        physics = new PhysicsSystem(terrain, new MockSoundManager());
    });

    it('guidance items are purchasable accessories', () => {
        expect(WEAPONS.heat_guidance.type).toBe('item');
        expect(WEAPONS.lazy_boy.type).toBe('item');
        expect(GUIDANCE_ORDER).toContain('heat_guidance');
        expect(GUIDANCE_ORDER).toContain('lazy_boy');
    });

    it('armed guidance is attached to the projectile and consumed on fire', () => {
        const tank = makeTank({ accessories: { heat_guidance: 2 }, activeGuidance: 'heat_guidance' });
        const state = makeState([tank]);
        state.phase = GamePhase.AIMING;

        physics.fireProjectile(state, 500, 45, 'baby_missile');

        expect(state.projectiles.length).toBe(1);
        expect(state.projectiles[0].guidance).toBe('heat_guidance');
        expect(tank.accessories['heat_guidance']).toBe(1);
        expect(tank.activeGuidance).toBe('heat_guidance'); // Still armed, supply remains
    });

    it('disarms automatically when supply is exhausted', () => {
        const tank = makeTank({ accessories: { lazy_boy: 1 }, activeGuidance: 'lazy_boy' });
        const state = makeState([tank]);

        physics.fireProjectile(state, 500, 45, 'baby_missile');

        expect(tank.accessories['lazy_boy']).toBe(0);
        expect(tank.activeGuidance).toBeUndefined();
    });

    it('does not attach guidance when none is armed', () => {
        const tank = makeTank({ accessories: { heat_guidance: 2 } });
        const state = makeState([tank]);

        physics.fireProjectile(state, 500, 45, 'baby_missile');

        expect(state.projectiles[0].guidance).toBeUndefined();
        expect(tank.accessories['heat_guidance']).toBe(2);
    });

    it('heat guidance steers a descending projectile toward the enemy', () => {
        const shooter = makeTank({ id: 1, x: 100 });
        const enemy = makeTank({ id: 2, x: 700, y: 500 });
        const state = makeState([shooter, enemy]);

        // Two identical descending projectiles high above ground; one guided
        const base = {
            x: 300, y: 100, vx: 50, vy: 20,
            ownerId: 1, elapsedTime: 0, trail: [], splitDone: true
        };
        state.projectiles.push(
            { ...base, id: 'unguided', weaponType: 'baby_missile', trail: [] },
            { ...base, id: 'guided', weaponType: 'baby_missile', trail: [], guidance: 'heat_guidance' }
        );

        for (let i = 0; i < 10; i++) physics.update(state, 0.05);

        const guided = state.projectiles.find(p => p.id === 'guided');
        const unguided = state.projectiles.find(p => p.id === 'unguided');
        expect(guided).toBeDefined();
        expect(unguided).toBeDefined();
        // Guided shot accelerates toward the enemy at x=700
        expect(guided!.vx).toBeGreaterThan(unguided!.vx);
    });

    it('heat guidance does not steer while ascending, lazy boy does', () => {
        const shooter = makeTank({ id: 1, x: 100 });
        const enemy = makeTank({ id: 2, x: 700, y: 500 });
        const state = makeState([shooter, enemy]);

        const base = {
            x: 300, y: 300, vx: 0, vy: -200, // Ascending
            ownerId: 1, elapsedTime: 0, trail: [], splitDone: true
        };
        state.projectiles.push(
            { ...base, id: 'heat', weaponType: 'baby_missile', trail: [], guidance: 'heat_guidance' },
            { ...base, id: 'lazy', weaponType: 'baby_missile', trail: [], guidance: 'lazy_boy' }
        );

        physics.update(state, 0.05);

        const heat = state.projectiles.find(p => p.id === 'heat')!;
        const lazy = state.projectiles.find(p => p.id === 'lazy')!;
        expect(heat.vx).toBe(0); // No correction while ascending
        expect(lazy.vx).toBeGreaterThan(0); // Homing all flight
    });

    it('guidance never steers toward the owner', () => {
        const shooter = makeTank({ id: 1, x: 100, y: 500 });
        const state = makeState([shooter]); // No enemies at all

        state.projectiles.push({
            id: 'g1', x: 300, y: 100, vx: 50, vy: 20,
            weaponType: 'baby_missile', ownerId: 1, elapsedTime: 0,
            trail: [], splitDone: true, guidance: 'lazy_boy'
        });

        physics.update(state, 0.05);

        const p = state.projectiles.find(pr => pr.id === 'g1')!;
        expect(p.vx).toBeCloseTo(50, 5); // Unchanged: no valid target
    });
});
