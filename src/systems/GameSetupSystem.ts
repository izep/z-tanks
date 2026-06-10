import { type GameState, GamePhase, CONSTANTS, ECONOMY, rollWind } from '../core/GameState';
import { AIController, AIPersonality } from '../core/AIController';
import { TerrainSystem } from './TerrainSystem';
import { SoundManager } from '../core/SoundManager';
import { WEAPONS, WEAPON_ORDER } from '../core/WeaponData';

export class GameSetupSystem {
    private terrainSystem: TerrainSystem;
    private soundManager: SoundManager;

    constructor(terrainSystem: TerrainSystem, soundManager: SoundManager) {
        this.terrainSystem = terrainSystem;
        this.soundManager = soundManager;
    }

    public async handleStartGame(state: GameState, config: any) {
        // Init tanks based on config
        const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'cyan'];
        state.tanks = [];
        const sectionWidth = CONSTANTS.SCREEN_WIDTH / config.playerCount;

        config.players.forEach((pConfig: any, i: number) => {
            // Determine AI Logic
            let aiCtrl: AIController | undefined;
            let aiPers: AIPersonality | undefined;

            if (pConfig.isAi) {
                // Parse personality string to Enum
                const key = pConfig.aiPersonality as keyof typeof AIPersonality;
                aiPers = AIPersonality[key] || AIPersonality.UNKNOWN;
                aiCtrl = new AIController(aiPers!);
            }

            state.tanks.push({
                id: i + 1,
                name: pConfig.name || `Player ${i + 1}`,
                x: sectionWidth * i + sectionWidth / 2,
                y: 100, // Will fall
                vy: 0,
                angle: 90,
                power: 600,
                health: 100,
                fuel: 250,
                color: colors[i % colors.length],
                variant: pConfig.variant || 0,
                isAi: pConfig.isAi,
                aiPersonality: aiPers,
                aiController: aiCtrl,
                isFalling: true,
                hasLanded: false, // Initial fall
                parachuteThreshold: 15,
                isDead: false,
                credits: config.startingCash ?? ECONOMY.DEFAULT_STARTING_CASH,
                currentWeapon: 'baby_missile',
                inventory: pConfig.testMode || config.testMode ? this.getTestInventory() : { 'missile': -1, 'baby_missile': -1 },
                accessories: { 'parachute': config.testMode ? 10 : 0 } // Give parachutes too
            });
        });

        state.maxRounds = config.rounds || 10;
        state.phase = GamePhase.AIMING;
        state.borderMode = config.borders || 'normal';
        state.windSetting = config.wind || 'normal';

        // Gravity setting (Requirements 3.1)
        const gravityScale = config.gravity === 'low' ? 0.5 : (config.gravity === 'high' ? 1.5 : 1.0);
        state.gravity = CONSTANTS.GRAVITY * gravityScale;

        // Initial Wind
        state.wind = rollWind(state.windSetting);
        console.log(`Initial Wind: ${state.wind.toFixed(1)}`);

        await this.terrainSystem.generate(state);
        this.soundManager.playUI(); // Will also resume AudioContext
    }

    private getTestInventory(): Record<string, number> {
        const inv: Record<string, number> = {};
        WEAPON_ORDER.forEach(w => {
            const stats = WEAPONS[w];
            if (stats.cost === 0) {
                inv[w] = -1;
            } else {
                inv[w] = 100;
            }
        });
        return inv;
    }
}
