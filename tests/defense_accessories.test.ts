import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsSystem } from '../src/systems/PhysicsSystem';
import { TerrainSystem } from '../src/systems/TerrainSystem';
import { applyAutoDefense } from '../src/systems/GameSetupSystem';
import { GamePhase, type GameState, type TankState } from '../src/core/GameState';
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
        x: 400,
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

describe('Mag Deflector', () => {
    let physics: PhysicsSystem;

    beforeEach(() => {
        physics = new PhysicsSystem(new TerrainSystem(800, 600), new MockSoundManager());
    });

    it('kicks an enemy projectile away and drains charge', () => {
        const defender = makeTank({ id: 2, x: 400, y: 500, activeShield: 'mag_deflector', shieldHealth: 100 });
        const state = makeState([makeTank({ id: 1, x: 100 }), defender]);

        // Enemy projectile drifting into the deflection radius, high above terrain
        state.projectiles.push({
            id: 'p1', x: 410, y: 470, vx: -50, vy: 10,
            weaponType: 'baby_missile', ownerId: 1, elapsedTime: 0, trail: [], splitDone: true
        });

        physics.update(state, 0.016);

        const proj = state.projectiles[0];
        expect(proj.deflected).toBe(true);
        expect(proj.vx).toBeGreaterThan(-50); // Kicked away (positive-x direction)
        expect(defender.shieldHealth).toBe(75);
    });

    it('does not deflect the owner\'s own shots and breaks when drained', () => {
        const defender = makeTank({ id: 2, x: 400, y: 500, activeShield: 'mag_deflector', shieldHealth: 25 });
        const state = makeState([makeTank({ id: 1, x: 100 }), defender]);

        // The defender's own projectile nearby: untouched
        state.projectiles.push({
            id: 'own', x: 410, y: 470, vx: -50, vy: 10,
            weaponType: 'baby_missile', ownerId: 2, elapsedTime: 0, trail: [], splitDone: true
        });
        physics.update(state, 0.016);
        expect(state.projectiles[0]?.deflected).toBeUndefined();

        // An enemy projectile drains the last charge and breaks the deflector
        state.projectiles.length = 0;
        state.projectiles.push({
            id: 'enemy', x: 410, y: 470, vx: -50, vy: 10,
            weaponType: 'baby_missile', ownerId: 1, elapsedTime: 0, trail: [], splitDone: true
        });
        physics.update(state, 0.016);
        expect(defender.activeShield).toBeUndefined();
    });

    it('does not absorb damage like a shield', () => {
        const defender = makeTank({ id: 2, activeShield: 'mag_deflector', shieldHealth: 100 });
        const state = makeState([defender]);

        const dealt = physics.applyTankDamage(state, defender, 40, 1);

        expect(dealt).toBe(40);
        expect(defender.health).toBe(60);
        expect(defender.shieldHealth).toBe(100); // Charge untouched by damage
    });
});

describe('Contact Triggers', () => {
    let physics: PhysicsSystem;
    let terrain: TerrainSystem;

    beforeEach(() => {
        terrain = new TerrainSystem(800, 600);
        physics = new PhysicsSystem(terrain, new MockSoundManager());
    });

    it('is consumed per shot and attached to the projectile', () => {
        const tank = makeTank({ accessories: { contact_trigger: 2 }, activeTrigger: true });
        const state = makeState([tank]);

        physics.fireProjectile(state, 500, 45, 'baby_missile');

        expect(state.projectiles[0].contactTrigger).toBe(true);
        expect(tank.accessories['contact_trigger']).toBe(1);
        expect(tank.activeTrigger).toBe(true);
    });

    it('disarms when supply is exhausted', () => {
        const tank = makeTank({ accessories: { contact_trigger: 1 }, activeTrigger: true });
        const state = makeState([tank]);

        physics.fireProjectile(state, 500, 45, 'baby_missile');

        expect(tank.activeTrigger).toBe(false);
    });

    it('makes a pre-apogee MIRV explode instead of fizzling', () => {
        const victim = makeTank({ id: 2, x: 400, y: 210 });
        const state = makeState([makeTank({ id: 1, x: 100 }), victim]);

        state.projectiles.push({
            id: 'm1', x: 400, y: 200, vx: 0, vy: -50, // Ascending
            weaponType: 'mirv', ownerId: 1, elapsedTime: 0, trail: [],
            splitDone: false, contactTrigger: true
        });

        physics.update(state, 0.01);

        expect(state.explosions.length).toBeGreaterThan(0); // Exploded, no fizzle
        expect(victim.health).toBeLessThan(100);
    });

    it('makes a roller detonate on contact instead of rolling', () => {
        const state = makeState([makeTank({ id: 1, x: 100 })]);
        terrain.generate(state);
        const groundY = terrain.getGroundY(400);

        state.projectiles.push({
            id: 'r1', x: 400, y: groundY - 2, vx: 0, vy: 50,
            weaponType: 'roller', ownerId: 1, elapsedTime: 0, trail: [],
            contactTrigger: true
        });

        // Run until resolved
        for (let i = 0; i < 20 && state.projectiles.length > 0; i++) {
            physics.update(state, 0.05);
        }

        // It exploded rather than entering the rolling state
        expect(state.projectiles.length).toBe(0);
        expect(state.explosions.length).toBeGreaterThan(0);
    });
});

describe('Auto Defense', () => {
    it('raises the best shield at round start without consuming itself', () => {
        const tank = makeTank({ accessories: { auto_defense: 1, shield: 1, heavy_shield: 1 } });
        const state = makeState([tank]);

        applyAutoDefense(state);

        expect(tank.activeShield).toBe('heavy_shield');
        expect(tank.shieldHealth).toBe(400);
        expect(tank.accessories['auto_defense']).toBe(1); // Sticky
        expect(tank.accessories['heavy_shield']).toBe(0); // Shield itself consumed
    });

    it('does nothing without shields or for dead tanks', () => {
        const noShields = makeTank({ accessories: { auto_defense: 1 } });
        const dead = makeTank({ id: 2, health: 0, accessories: { auto_defense: 1, shield: 1 } });
        const state = makeState([noShields, dead]);

        applyAutoDefense(state);

        expect(noShields.activeShield).toBeUndefined();
        expect(dead.activeShield).toBeUndefined();
    });
});
