import { type GameState } from '../core/GameState';
import { type AiDecision } from '../core/AIController';
import { PhysicsSystem } from './PhysicsSystem';
import { SoundManager } from '../core/SoundManager';
import { TerrainSystem } from './TerrainSystem';
import { activateShield, GUIDANCE_ORDER } from '../core/WeaponData';
import { tankSay } from '../core/TankTalk';

const AI_TURN_DELAY = 1.0; // seconds before the AI fires

export class AISystem {
    private physicsSystem: PhysicsSystem;
    private soundManager: SoundManager;
    private terrainSystem: TerrainSystem;

    // Per-turn state
    private aiTurnTimer: number = 0;
    private lastPlayerIndex: number = -1;

    // Async decision state: prevent launching multiple solve requests per turn
    private deciding: boolean = false;
    private decisionReady: boolean = false;
    private pendingDecision: AiDecision | null = null;

    constructor(physicsSystem: PhysicsSystem, soundManager: SoundManager, terrainSystem: TerrainSystem) {
        this.physicsSystem = physicsSystem;
        this.soundManager = soundManager;
        this.terrainSystem = terrainSystem;
    }

    public handleAiTurn(state: GameState, dt: number) {
        const tank = state.tanks[state.currentPlayerIndex];
        if (!tank || !tank.aiController) return;

        // Reset state when a new AI player's turn begins
        if (state.currentPlayerIndex !== this.lastPlayerIndex) {
            this.aiTurnTimer = 0;
            this.lastPlayerIndex = state.currentPlayerIndex;
            this.deciding = false;
            this.decisionReady = false;
            this.pendingDecision = null;
        }

        this.aiTurnTimer += dt;

        // Kick off the async solve exactly once (immediately, while the delay counts down)
        if (!this.deciding) {
            this.deciding = true;
            tank.aiController.decideShot(state, state.currentPlayerIndex, this.terrainSystem)
                .then((decision: AiDecision) => {
                    this.pendingDecision = decision;
                    this.decisionReady = true;
                });
        }

        // Wait for both the delay AND the worker response before firing
        if (this.aiTurnTimer >= AI_TURN_DELAY && this.decisionReady && this.pendingDecision) {
            const decision = this.pendingDecision;

            // Reset for next turn
            this.deciding = false;
            this.decisionReady = false;
            this.pendingDecision = null;

            tank.angle = decision.angle;
            tank.power = decision.power;
            tank.currentWeapon = decision.weapon;

            // Execute Pre-Shot Actions
            if (decision.actions) {
                decision.actions.forEach((action: 'shield' | 'battery') => {
                    if (action === 'shield') {
                        if (!tank.activeShield && activateShield(tank)) {
                            this.soundManager.playUI();
                        }
                    } else if (action === 'battery') {
                        if ((tank.accessories['battery'] || 0) > 0) {
                            tank.accessories['battery']--;
                            tank.health = Math.min(100, tank.health + 10);
                            this.soundManager.playUI();
                        }
                    }
                });
            }

            // Arm guidance if owned (consumed by fireProjectile)
            if (!tank.activeGuidance) {
                tank.activeGuidance = GUIDANCE_ORDER.find(id => (tank.accessories[id] || 0) > 0);
            }

            this.soundManager.playFire();
            tankSay(state, tank, 'aiFire', 0.5);
            this.physicsSystem.fireProjectile(state, tank.power, tank.angle, tank.currentWeapon);
        }
    }
}
