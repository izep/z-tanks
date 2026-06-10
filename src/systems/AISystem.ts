import { type GameState } from '../core/GameState';
import { PhysicsSystem } from './PhysicsSystem';
import { SoundManager } from '../core/SoundManager';
import { TerrainSystem } from './TerrainSystem';
import { activateShield } from '../core/WeaponData';

export class AISystem {
    private physicsSystem: PhysicsSystem;
    private soundManager: SoundManager;
    private terrainSystem: TerrainSystem;
    private aiTurnTimer: number = 0;
    private readonly AI_TURN_DELAY = 1.0; // 1 second delay

    constructor(physicsSystem: PhysicsSystem, soundManager: SoundManager, terrainSystem: TerrainSystem) {
        this.physicsSystem = physicsSystem;
        this.soundManager = soundManager;
        this.terrainSystem = terrainSystem;
    }

    public handleAiTurn(state: GameState, dt: number) {
        const tank = state.tanks[state.currentPlayerIndex];
        if (!tank || !tank.aiController) return;

        this.aiTurnTimer += dt;

        if (this.aiTurnTimer >= this.AI_TURN_DELAY) {
            this.aiTurnTimer = 0;

            const decision = tank.aiController.decideShot(state, state.currentPlayerIndex, this.terrainSystem);
            tank.angle = decision.angle;
            tank.power = decision.power;
            tank.currentWeapon = decision.weapon;

            // Execute Pre-Shot Actions
            if (decision.actions) {
                decision.actions.forEach(action => {
                    if (action === 'shield') {
                         if (!tank.activeShield && activateShield(tank)) {
                             this.soundManager.playUI();
                         }
                    } else if (action === 'battery') {
                         if ((tank.accessories['battery'] || 0) > 0) {
                             tank.accessories['battery']--;
                             // Batteries restore tank strength, which also raises the max-power cap
                             tank.health = Math.min(100, tank.health + 10);
                             this.soundManager.playUI();
                         }
                    }
                });
            }

            // Fire
            this.soundManager.playFire();

            // Talking Tanks (AI)
            if (Math.random() < 0.5) {
                const phrases = ['Calculating...', 'Target Acquired', 'Exterminate!', 'Logic demands death'];
                tank.lastWords = phrases[Math.floor(Math.random() * phrases.length)];
                tank.sayTimer = 2;
            }

            this.physicsSystem.fireProjectile(state, tank.power, tank.angle, tank.currentWeapon);
        }
    }
}
