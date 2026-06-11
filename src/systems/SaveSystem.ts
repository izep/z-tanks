import { type GameState, type TankState, GamePhase } from '../core/GameState';
import { AIController, AIPersonality } from '../core/AIController';
import { TerrainSystem } from './TerrainSystem';
import { EconomySystem, type MarketState } from './EconomySystem';

const SAVE_KEY = 'tanksalot_save_v1';
const SAVE_VERSION = 1;

interface SavedGame {
    version: number;
    savedAt: number;
    state: Omit<GameState, 'projectiles' | 'explosions' | 'smokeTrails'>;
    terrain: string; // PNG data URL
    market: MarketState;
}

/**
 * Save/Load support (Requirements 8.4). The game autosaves at the start of
 * every turn and on entering the shop; a saved game can be resumed from the
 * setup screen. Storage: localStorage (fits comfortably; terrain is a PNG).
 */
export class SaveSystem {
    public hasSave(): boolean {
        try {
            return localStorage.getItem(SAVE_KEY) !== null;
        } catch {
            return false;
        }
    }

    public clear(): void {
        try {
            localStorage.removeItem(SAVE_KEY);
        } catch {
            // Storage unavailable; nothing to clear
        }
    }

    public save(state: GameState, terrain: TerrainSystem, economy: EconomySystem): boolean {
        // Only persist stable phases; mid-flight state is not resumable
        if (state.phase !== GamePhase.AIMING && state.phase !== GamePhase.SHOP) return false;

        try {
            const saved: SavedGame = {
                version: SAVE_VERSION,
                savedAt: Date.now(),
                state: {
                    phase: state.phase,
                    tanks: state.tanks.map(t => this.sanitizeTank(t)),
                    currentPlayerIndex: state.currentPlayerIndex,
                    roundNumber: state.roundNumber,
                    maxRounds: state.maxRounds,
                    wind: state.wind,
                    gravity: state.gravity,
                    terrainDirty: false,
                    lastExplosionTime: 0,
                    borderMode: state.borderMode,
                    windSetting: state.windSetting
                },
                terrain: terrain.serialize(),
                market: JSON.parse(JSON.stringify(economy.getMarketState()))
            };
            localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
            return true;
        } catch (e) {
            console.warn('Failed to save game:', e);
            return false;
        }
    }

    public async load(state: GameState, terrain: TerrainSystem, economy: EconomySystem): Promise<boolean> {
        let saved: SavedGame;
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return false;
            saved = JSON.parse(raw);
        } catch (e) {
            console.warn('Failed to read save:', e);
            return false;
        }

        if (saved.version !== SAVE_VERSION || !saved.state || !saved.terrain) return false;

        const terrainOk = await terrain.loadFromDataURL(saved.terrain);
        if (!terrainOk) return false;

        const s = saved.state;
        state.phase = s.phase;
        state.tanks = s.tanks.map(t => this.reviveTank(t));
        state.projectiles = [];
        state.explosions = [];
        state.smokeTrails = [];
        state.currentPlayerIndex = s.currentPlayerIndex;
        state.roundNumber = s.roundNumber;
        state.maxRounds = s.maxRounds;
        state.wind = s.wind;
        state.gravity = s.gravity;
        state.terrainDirty = false;
        state.lastExplosionTime = 0;
        state.borderMode = s.borderMode;
        state.windSetting = s.windSetting;

        economy.restoreMarketState(saved.market);
        return true;
    }

    private sanitizeTank(tank: TankState): TankState {
        // AIController holds behavior, not data — drop it and rebuild on load
        const { aiController, ...rest } = tank;
        return rest as TankState;
    }

    private reviveTank(tank: TankState): TankState {
        const revived: TankState = { ...tank };
        if (revived.isAi) {
            const personality = revived.aiPersonality || AIPersonality.UNKNOWN;
            revived.aiController = new AIController(personality);
        }
        return revived;
    }
}
