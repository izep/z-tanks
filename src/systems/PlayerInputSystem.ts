import { type GameState, CONSTANTS, getMaxPower } from '../core/GameState';
import { InputManager, GameAction } from '../core/InputManager';
import { TerrainSystem } from './TerrainSystem';
import { PhysicsSystem } from './PhysicsSystem';
import { SoundManager } from '../core/SoundManager';
import { WEAPONS, WEAPON_ORDER, activateShield } from '../core/WeaponData';
import { tankSay } from '../core/TankTalk';

/**
 * Handles input for the current player during their turn.
 */
export class PlayerInputSystem {
    private inputManager: InputManager;
    private terrainSystem: TerrainSystem;
    private physicsSystem: PhysicsSystem;
    private soundManager: SoundManager;
    private inputHoldTime: number = 0;

    constructor(
        inputManager: InputManager,
        terrainSystem: TerrainSystem,
        physicsSystem: PhysicsSystem,
        soundManager: SoundManager
    ) {
        this.inputManager = inputManager;
        this.terrainSystem = terrainSystem;
        this.physicsSystem = physicsSystem;
        this.soundManager = soundManager;
    }

    public handleAimingInput(state: GameState, dt: number) {
        const tank = state.tanks[state.currentPlayerIndex];
        if (!tank) return;

        if (
            this.inputManager.isActionActive(GameAction.AIM_UP) ||
            this.inputManager.isActionActive(GameAction.AIM_DOWN) ||
            this.inputManager.isActionActive(GameAction.POWER_UP) ||
            this.inputManager.isActionActive(GameAction.POWER_DOWN)
        ) {
            this.inputHoldTime += dt;
        } else {
            this.inputHoldTime = 0;
        }

        const multiplier = this.inputHoldTime > 0.5 ? 4.0 : 1.0; // Speed up after 0.5s hold

        if (this.inputManager.isActionActive(GameAction.AIM_UP)) {
            tank.angle = Math.min(180, tank.angle + 20 * dt * multiplier);
        }
        if (this.inputManager.isActionActive(GameAction.AIM_DOWN)) {
            tank.angle = Math.max(0, tank.angle - 20 * dt * multiplier);
        }
        if (this.inputManager.isActionActive(GameAction.POWER_UP)) {
            tank.power = Math.min(getMaxPower(tank), tank.power + 100 * dt * multiplier);
        }
        if (this.inputManager.isActionActive(GameAction.POWER_DOWN)) {
            tank.power = Math.max(0, tank.power - 100 * dt * multiplier);
        }

        if (this.inputManager.isActionTriggered(GameAction.NEXT_WEAPON)) {
            const currentIdx = WEAPON_ORDER.indexOf(tank.currentWeapon);
            let nextIdx = (currentIdx + 1) % WEAPON_ORDER.length;
            // Scan for weapon we have and is NOT an item
            let count = 0;
            while (
                (
                    (!tank.inventory[WEAPON_ORDER[nextIdx]] || tank.inventory[WEAPON_ORDER[nextIdx]] === 0) ||
                    WEAPONS[WEAPON_ORDER[nextIdx]].type === 'item'
                ) &&
                count < WEAPON_ORDER.length
            ) {
                nextIdx = (nextIdx + 1) % WEAPON_ORDER.length;
                count++;
            }
            tank.currentWeapon = WEAPON_ORDER[nextIdx];
            console.log('Switched to', tank.currentWeapon);
        }

        if (this.inputManager.isActionTriggered(GameAction.TOGGLE_SHIELD)) {
            if (tank.activeShield) {
                tank.activeShield = undefined;
                tank.shieldHealth = 0;
            } else if (activateShield(tank)) {
                this.soundManager.playUI();
            }
        }

        // Contact trigger arming (consumed per shot while armed)
        if (this.inputManager.isActionTriggered(GameAction.TOGGLE_TRIGGER)) {
            if (tank.activeTrigger) {
                tank.activeTrigger = false;
            } else if ((tank.accessories['contact_trigger'] || 0) > 0) {
                tank.activeTrigger = true;
                this.soundManager.playUI();
            }
        }

        // Battery usage to restore health
        if (this.inputManager.isActionTriggered(GameAction.USE_BATTERY)) {
            if ((tank.accessories['battery'] || 0) > 0 && tank.health < 100) {
                const restoreAmount = WEAPONS['battery'].effectValue || 10;
                const oldHealth = tank.health;
                tank.health = Math.min(100, tank.health + restoreAmount);
                tank.accessories['battery']--;
                console.log(`Battery used! Health: ${oldHealth} -> ${tank.health}`);
                this.soundManager.playUI();
            } else if (tank.health >= 100) {
                console.log('Health already full!');
            } else {
                console.log('No batteries!');
            }
        }

        // Movement with fuel consumption
        const MOVE_SPEED = 50; // pixels per second
        const FUEL_COST_PER_PIXEL = 1;

        if (this.inputManager.isActionActive(GameAction.MOVE_LEFT) && tank.fuel > 0 && tank.hasLanded) {
            const moveAmount = MOVE_SPEED * dt;
            const fuelNeeded = Math.ceil(moveAmount * FUEL_COST_PER_PIXEL);

            if (tank.fuel >= fuelNeeded) {
                const newX = Math.max(0, tank.x - moveAmount);
                const groundY = this.terrainSystem.getGroundY(Math.floor(newX));

                // Check if slope is not too steep
                const currentGroundY = this.terrainSystem.getGroundY(Math.floor(tank.x));
                const slopeDiff = Math.abs(groundY - currentGroundY);

                if (slopeDiff < 15) {
                    // Max climbable slope
                    tank.x = newX;
                    tank.y = groundY;
                    tank.fuel -= fuelNeeded;
                }
            }
        }

        if (this.inputManager.isActionActive(GameAction.MOVE_RIGHT) && tank.fuel > 0 && tank.hasLanded) {
            const moveAmount = MOVE_SPEED * dt;
            const fuelNeeded = Math.ceil(moveAmount * FUEL_COST_PER_PIXEL);

            if (tank.fuel >= fuelNeeded) {
                const newX = Math.min(CONSTANTS.SCREEN_WIDTH - 1, tank.x + moveAmount);
                const groundY = this.terrainSystem.getGroundY(Math.floor(newX));

                // Check if slope is not too steep
                const currentGroundY = this.terrainSystem.getGroundY(Math.floor(tank.x));
                const slopeDiff = Math.abs(groundY - currentGroundY);

                if (slopeDiff < 15) {
                    // Max climbable slope
                    tank.x = newX;
                    tank.y = groundY;
                    tank.fuel -= fuelNeeded;
                }
            }
        }

        // Testing phase switch
        if (this.inputManager.isActionTriggered(GameAction.FIRE)) {
            // Cannot fire if projectile already in air (simple check)
            if (state.projectiles.length === 0) {
                console.log('Fire!');
                this.soundManager.playFire();

                // Talking Tanks
                tankSay(state, tank, 'fire', 0.3);

                this.physicsSystem.fireProjectile(state, tank.power, tank.angle, tank.currentWeapon);
            }
        }
    }
}
