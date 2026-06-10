import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PhysicsSystem } from '../src/systems/PhysicsSystem';
import { TerrainSystem } from '../src/systems/TerrainSystem';
import { ShopSystem } from '../src/systems/ShopSystem';
import { EconomySystem } from '../src/systems/EconomySystem';
import { GamePhase, getMaxPower, rollWind, ECONOMY, type GameState, type TankState } from '../src/core/GameState';
import { WEAPONS, activateShield } from '../src/core/WeaponData';
import { SoundManager } from '../src/core/SoundManager';

// Mock document for TerrainSystem canvas
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
    playSizzle() { }
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
        angle: 90,
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

describe('Scorched Earth fidelity', () => {
    let physics: PhysicsSystem;
    let terrain: TerrainSystem;
    let sound: SoundManager;

    beforeEach(() => {
        terrain = new TerrainSystem(800, 600);
        sound = new MockSoundManager();
        physics = new PhysicsSystem(terrain, sound);
    });

    describe('Weapon stats match Requirements.md table', () => {
        it('uses documented blast radii', () => {
            expect(WEAPONS.baby_missile.radius).toBe(10);
            expect(WEAPONS.missile.radius).toBe(20);
            expect(WEAPONS.baby_nuke.radius).toBe(40);
            expect(WEAPONS.nuke.radius).toBe(75);
            expect(WEAPONS.mirv.radius).toBe(20);
            expect(WEAPONS.death_head.radius).toBe(35);
            expect(WEAPONS.funky_bomb.radius).toBe(80);
        });
    });

    describe("Death's Head", () => {
        it('splits into 9 warheads at apogee', () => {
            const state = makeState([]);
            state.projectiles.push({
                id: 'dh-1',
                x: 400,
                y: 200,
                vx: 50,
                vy: 10, // Descending, well above terrain
                weaponType: 'death_head',
                ownerId: 1,
                elapsedTime: 0,
                trail: [],
                splitDone: false
            });

            physics.update(state, 0.1);

            expect(state.projectiles.length).toBe(9);
            state.projectiles.forEach(p => expect(p.weaponType).toBe('baby_nuke'));
        });

        it('fizzles without exploding if it hits before apogee', () => {
            const state = makeState([]);
            // Ascending projectile colliding with a tank directly
            const victim = makeTank({ id: 2, x: 400, y: 210 });
            state.tanks.push(victim);
            state.projectiles.push({
                id: 'dh-2',
                x: 400,
                y: 200,
                vx: 0,
                vy: -50, // Still ascending: pre-apogee
                weaponType: 'death_head',
                ownerId: 1,
                elapsedTime: 0,
                trail: [],
                splitDone: false
            });

            physics.update(state, 0.01);

            expect(state.projectiles.length).toBe(0); // Removed
            expect(state.explosions.length).toBe(0); // No explosion (fizzle)
            expect(victim.health).toBe(100); // No damage
        });
    });

    describe('Baby Missile', () => {
        it('damages tanks on direct explosion (regression)', () => {
            const victim = makeTank({ id: 2, x: 405, y: 505 });
            const state = makeState([makeTank(), victim]);

            physics.triggerExplosion(state, 400, 500, { weaponType: 'baby_missile', ownerId: 1 });

            expect(victim.health).toBeLessThan(100);
        });
    });

    describe('Max power cap (Requirements 1.5)', () => {
        it('caps at 1000 for a full-strength tank', () => {
            expect(getMaxPower({ health: 100 })).toBe(1000);
            expect(getMaxPower({ health: 150 })).toBe(1000);
        });

        it('scales down with damage', () => {
            expect(getMaxPower({ health: 50 })).toBe(500);
            expect(getMaxPower({ health: 0 })).toBe(0);
        });

        it('clamps firing power to tank strength', () => {
            const tank = makeTank({ health: 50, currentWeapon: 'baby_missile' });
            const state = makeState([tank]);
            state.phase = GamePhase.AIMING;

            physics.fireProjectile(state, 1000, 0, 'baby_missile');

            expect(state.projectiles.length).toBe(1);
            // Speed = power * 0.5; clamped power = 500 -> vx = 250 at angle 0
            expect(state.projectiles[0].vx).toBeCloseTo(250, 0);
        });

        it('reduces stored power when tank takes damage', () => {
            const tank = makeTank({ health: 100, power: 1000 });
            const state = makeState([tank]);

            tank.health = 40;
            physics.update(state, 0.016);

            expect(tank.power).toBeLessThanOrEqual(400);
        });
    });

    describe('Laser (energy weapon)', () => {
        it('damages tanks in the beam path and consumes batteries', () => {
            const shooter = makeTank({ id: 1, x: 100, y: 300, accessories: { battery: 5 } });
            const target = makeTank({ id: 2, x: 500, y: 310 });
            const state = makeState([shooter, target]);
            state.currentPlayerIndex = 0;

            physics.fireProjectile(state, 500, 0, 'laser'); // Fire right

            expect(target.health).toBeLessThan(100);
            expect(shooter.accessories['battery']).toBe(5 - ECONOMY.MAX_ENERGY_BATTERIES);
            expect(state.phase).toBe(GamePhase.EXPLOSION);
        });

        it('is weak without batteries', () => {
            const shooter = makeTank({ id: 1, x: 100, y: 300 });
            const target = makeTank({ id: 2, x: 500, y: 310 });
            const state = makeState([shooter, target]);

            physics.fireProjectile(state, 500, 0, 'laser');

            expect(target.health).toBe(100 - 25); // Unpowered laser damage
        });

        it('cuts through terrain along the beam', () => {
            const shooter = makeTank({ id: 1, x: 100, y: 300 });
            const state = makeState([shooter]);
            vi.spyOn(terrain, 'isSolid').mockImplementation((x: number) => x > 300 && x < 350);
            const explodeSpy = vi.spyOn(terrain, 'explode');

            physics.fireProjectile(state, 500, 0, 'laser');

            expect(explodeSpy).toHaveBeenCalled();
        });
    });

    describe('Plasma Blast (energy weapon)', () => {
        it('blasts radially from the tank, sparing the owner', () => {
            const shooter = makeTank({ id: 1, x: 400, y: 500, accessories: { battery: 3 } });
            const nearEnemy = makeTank({ id: 2, x: 450, y: 500 });
            const farEnemy = makeTank({ id: 3, x: 700, y: 500 });
            const state = makeState([shooter, nearEnemy, farEnemy]);

            physics.fireProjectile(state, 500, 90, 'plasma_blast');

            expect(shooter.health).toBe(100); // Owner immune
            expect(nearEnemy.health).toBeLessThan(100);
            expect(farEnemy.health).toBe(100); // Out of range (radius 75 + buffer)
            expect(shooter.accessories['battery']).toBe(0);
        });

        it('has minimal radius without batteries', () => {
            const shooter = makeTank({ id: 1, x: 400, y: 500 });
            const enemy = makeTank({ id: 2, x: 450, y: 500 }); // 50px away > radius 10 + 10
            const state = makeState([shooter, enemy]);

            physics.fireProjectile(state, 500, 90, 'plasma_blast');

            expect(enemy.health).toBe(100);
        });
    });

    describe('Combat earnings', () => {
        it('awards credits for damage dealt to enemies', () => {
            const attacker = makeTank({ id: 1 });
            const victim = makeTank({ id: 2, x: 600 });
            const state = makeState([attacker, victim]);

            const dealt = physics.applyTankDamage(state, victim, 30, attacker.id);

            expect(dealt).toBe(30);
            expect(attacker.credits).toBe(30 * ECONOMY.CREDITS_PER_DAMAGE);
        });

        it('awards a kill bounty', () => {
            const attacker = makeTank({ id: 1 });
            const victim = makeTank({ id: 2, x: 600, health: 20 });
            const state = makeState([attacker, victim]);

            physics.applyTankDamage(state, victim, 50, attacker.id);

            expect(victim.isDead).toBe(true);
            expect(attacker.credits).toBe(50 * ECONOMY.CREDITS_PER_DAMAGE + ECONOMY.KILL_BOUNTY);
        });

        it('does not award credits for self-damage', () => {
            const attacker = makeTank({ id: 1 });
            const state = makeState([attacker]);

            physics.applyTankDamage(state, attacker, 30, attacker.id);

            expect(attacker.credits).toBe(0);
        });
    });

    describe('Shields', () => {
        it('activateShield prefers the strongest available shield', () => {
            const tank = makeTank({ accessories: { shield: 1, heavy_shield: 1 } });

            expect(activateShield(tank)).toBe(true);
            expect(tank.activeShield).toBe('heavy_shield');
            expect(tank.shieldHealth).toBe(400);
            expect(tank.accessories['heavy_shield']).toBe(0);
            expect(tank.accessories['shield']).toBe(1);
        });

        it('activateShield fails without inventory', () => {
            const tank = makeTank();
            expect(activateShield(tank)).toBe(false);
            expect(tank.activeShield).toBeUndefined();
        });

        it('active shield absorbs damage before health', () => {
            const tank = makeTank({ accessories: { shield: 1 } });
            activateShield(tank);
            const state = makeState([tank]);

            physics.applyTankDamage(state, tank, 150, 99);

            expect(tank.health).toBe(100);
            expect(tank.shieldHealth).toBe(50);
        });
    });

    describe('Wind settings (Requirements 3.1)', () => {
        it('rolls zero wind when disabled', () => {
            expect(rollWind('none')).toBe(0);
        });

        it('rolls within range for normal and strong', () => {
            for (let i = 0; i < 50; i++) {
                expect(Math.abs(rollWind('normal'))).toBeLessThanOrEqual(35);
                expect(Math.abs(rollWind('strong'))).toBeLessThanOrEqual(70);
            }
        });
    });
});

describe('Shop sell-back (Requirements 7.3)', () => {
    let shop: ShopSystem;
    let economy: EconomySystem;
    let state: GameState;
    let tank: TankState;

    beforeEach(() => {
        economy = new EconomySystem('none');
        shop = new ShopSystem(new MockSoundManager(), economy);
        tank = makeTank({ inventory: { missile: 5, baby_missile: -1 }, accessories: { shield: 1 } });
        state = makeState([tank]);
        state.phase = GamePhase.SHOP;
    });

    it('sells one weapon for a fraction of the unit price', () => {
        shop.handleSellWeapon(state, 'missile');

        const expectedRefund = Math.floor((WEAPONS.missile.cost / WEAPONS.missile.bundleSize) * ECONOMY.SELLBACK_RATIO);
        expect(tank.inventory['missile']).toBe(4);
        expect(tank.credits).toBe(expectedRefund);
    });

    it('sells accessories', () => {
        shop.handleSellWeapon(state, 'shield');

        expect(tank.accessories['shield']).toBe(0);
        expect(tank.credits).toBe(Math.floor(WEAPONS.shield.cost * ECONOMY.SELLBACK_RATIO));
    });

    it('cannot sell infinite or unowned weapons', () => {
        shop.handleSellWeapon(state, 'baby_missile');
        shop.handleSellWeapon(state, 'nuke');

        expect(tank.inventory['baby_missile']).toBe(-1);
        expect(tank.credits).toBe(0);
    });

    it('resets current weapon when the last one is sold', () => {
        tank.inventory['missile'] = 1;
        tank.currentWeapon = 'missile';

        shop.handleSellWeapon(state, 'missile');

        expect(tank.currentWeapon).toBe('baby_missile');
    });
});
