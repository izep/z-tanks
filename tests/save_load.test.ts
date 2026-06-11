import { describe, it, expect, beforeEach } from 'vitest';
import { SaveSystem } from '../src/systems/SaveSystem';
import { EconomySystem } from '../src/systems/EconomySystem';
import { GamePhase, type GameState, type TankState } from '../src/core/GameState';
import { AIPersonality } from '../src/core/AIController';

// Minimal localStorage stub for node
const store = new Map<string, string>();
(global as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); }
};

// Terrain stub: serialization is a PNG data URL in production; here a token
const terrainStub = {
    serialize: () => 'data:image/png;base64,TEST',
    loadFromDataURL: async (url: string) => url === 'data:image/png;base64,TEST'
} as any;

function makeTank(overrides: Partial<TankState> = {}): TankState {
    return {
        id: 1,
        name: 'P1',
        x: 200,
        y: 480,
        vy: 0,
        angle: 60,
        power: 750,
        health: 80,
        fuel: 120,
        color: 'red',
        variant: 0,
        isAi: false,
        isFalling: false,
        isDead: false,
        credits: 12345,
        currentWeapon: 'missile',
        inventory: { missile: 4, baby_missile: -1 },
        accessories: { shield: 1, battery: 2 },
        hasLanded: true,
        ...overrides
    };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
    return {
        phase: GamePhase.AIMING,
        tanks: [
            makeTank(),
            makeTank({ id: 2, name: 'Bot', isAi: true, aiPersonality: AIPersonality.CYBORG, x: 600 })
        ],
        projectiles: [],
        explosions: [],
        smokeTrails: [],
        currentPlayerIndex: 1,
        roundNumber: 3,
        maxRounds: 10,
        wind: -12.5,
        gravity: 98,
        terrainDirty: false,
        lastExplosionTime: 0,
        borderMode: 'bounce',
        windSetting: 'strong',
        ...overrides
    };
}

describe('Save/Load (Requirements 8.4)', () => {
    let saveSystem: SaveSystem;
    let economy: EconomySystem;

    beforeEach(() => {
        store.clear();
        saveSystem = new SaveSystem();
        economy = new EconomySystem('low');
    });

    it('saves during stable phases and reports hasSave', () => {
        expect(saveSystem.hasSave()).toBe(false);
        expect(saveSystem.save(makeState(), terrainStub, economy)).toBe(true);
        expect(saveSystem.hasSave()).toBe(true);
    });

    it('refuses to save mid-flight', () => {
        const state = makeState({ phase: GamePhase.PROJECTILE_FLYING });
        expect(saveSystem.save(state, terrainStub, economy)).toBe(false);
        expect(saveSystem.hasSave()).toBe(false);
    });

    it('round-trips full game state', async () => {
        const original = makeState();
        saveSystem.save(original, terrainStub, economy);

        const fresh = makeState({
            tanks: [], roundNumber: 1, wind: 0, currentPlayerIndex: 0,
            borderMode: 'normal', windSetting: 'normal'
        });
        const ok = await saveSystem.load(fresh, terrainStub, economy);

        expect(ok).toBe(true);
        expect(fresh.roundNumber).toBe(3);
        expect(fresh.wind).toBe(-12.5);
        expect(fresh.currentPlayerIndex).toBe(1);
        expect(fresh.borderMode).toBe('bounce');
        expect(fresh.windSetting).toBe('strong');
        expect(fresh.tanks.length).toBe(2);
        expect(fresh.tanks[0].credits).toBe(12345);
        expect(fresh.tanks[0].inventory['missile']).toBe(4);
        expect(fresh.tanks[0].inventory['baby_missile']).toBe(-1);
        expect(fresh.tanks[0].accessories['battery']).toBe(2);
        expect(fresh.tanks[0].health).toBe(80);
        expect(fresh.projectiles).toEqual([]);
        expect(fresh.explosions).toEqual([]);
    });

    it('rebuilds AI controllers on load', async () => {
        saveSystem.save(makeState(), terrainStub, economy);

        const fresh = makeState({ tanks: [] });
        await saveSystem.load(fresh, terrainStub, economy);

        const bot = fresh.tanks[1];
        expect(bot.isAi).toBe(true);
        expect(bot.aiController).toBeDefined();
        expect(bot.aiController!.personality).toBe(AIPersonality.CYBORG);
        expect(fresh.tanks[0].aiController).toBeUndefined();
    });

    it('restores market prices', async () => {
        for (let i = 0; i < 5; i++) economy.updatePrice('missile', true);
        const inflated = economy.getPrice('missile');
        saveSystem.save(makeState(), terrainStub, economy);

        const freshEconomy = new EconomySystem('low');
        await saveSystem.load(makeState({ tanks: [] }), terrainStub, freshEconomy);

        expect(freshEconomy.getPrice('missile')).toBe(inflated);
    });

    it('clear removes the save', () => {
        saveSystem.save(makeState(), terrainStub, economy);
        saveSystem.clear();
        expect(saveSystem.hasSave()).toBe(false);
    });

    it('rejects corrupted saves gracefully', async () => {
        store.set('tanksalot_save_v1', '{not json');
        const ok = await saveSystem.load(makeState(), terrainStub, economy);
        expect(ok).toBe(false);
    });
});
