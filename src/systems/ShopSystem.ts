import { type GameState, ECONOMY } from '../core/GameState';
import { SoundManager } from '../core/SoundManager';
import { WEAPONS, activateShield, getArmsLevel } from '../core/WeaponData';
import { EconomySystem } from './EconomySystem';

export class ShopSystem {
    private soundManager: SoundManager;
    private economySystem: EconomySystem;

    constructor(soundManager: SoundManager, economySystem: EconomySystem) {
        this.soundManager = soundManager;
        this.economySystem = economySystem;
    }

    public initShopTurn(state: GameState): boolean {
        // Find first human player
        const firstHumanIndex = state.tanks.findIndex(t => !t.isAi);
        if (firstHumanIndex !== -1) {
            state.currentPlayerIndex = firstHumanIndex;
            return true;
        }
        return false; // No humans
    }

    public tryNextShopTurn(state: GameState): boolean {
        // Find next human player after current index
        const nextHumanIndex = state.tanks.findIndex((t, i) => i > state.currentPlayerIndex && !t.isAi);
        if (nextHumanIndex !== -1) {
            state.currentPlayerIndex = nextHumanIndex;
            return true;
        }
        return false;
    }

    public handleBuyWeapon(state: GameState, weaponId: string, tankId?: number) {
        const tank = tankId !== undefined
            ? state.tanks.find(t => t.id === tankId)
            : state.tanks[state.currentPlayerIndex];

        if (!tank) return;

        const weapon = WEAPONS[weaponId];
        if (!weapon) return;

        // Arms level restriction (Requirements 2.3) — applies to humans and AI
        if (getArmsLevel(weaponId) > (state.armsLevel ?? 4)) return;

        const price = this.economySystem.getPrice(weaponId);

        if (tank.credits >= price) {
            // Check for Items
            if (weapon.type === 'item') {
                tank.credits -= price;
                this.economySystem.updatePrice(weaponId, true);
                this.soundManager.playUI(); // Success sound

                if (weaponId === 'fuel_can') {
                    tank.fuel += weapon.effectValue || 250;
                } else {
                    tank.accessories[weaponId] = (tank.accessories[weaponId] || 0) + (weapon.effectValue || 1);
                }
                return;
            }

            // Infinite check for weapons
            if (tank.inventory[weaponId] === -1) {
                this.soundManager.playUI(); // Already have it
                return;
            }

            const currentCount = tank.inventory[weaponId] || 0;
            const bundleSize = weapon.bundleSize || 1;
            const newCount = Math.min(currentCount + bundleSize, 99);

            // Only purchase if we can add at least 1 item
            if (newCount > currentCount) {
                tank.credits -= price;
                tank.inventory[weaponId] = newCount;
                this.economySystem.updatePrice(weaponId, true);
                this.soundManager.playUI(); // Success sound
            } else {
                // Already at max (99)
                this.soundManager.playUI();
            }
        } else {
            // Fail sound
        }
    }

    /**
     * Sells one unit of an owned weapon or accessory back to the market
     * at a fraction of the current price (Requirements 7.3).
     */
    public handleSellWeapon(state: GameState, weaponId: string, tankId?: number) {
        const tank = tankId !== undefined
            ? state.tanks.find(t => t.id === tankId)
            : state.tanks[state.currentPlayerIndex];
        if (!tank) return;

        const weapon = WEAPONS[weaponId];
        if (!weapon) return;

        const unitPrice = this.economySystem.getPrice(weaponId) / (weapon.bundleSize || 1);
        const refund = Math.floor(unitPrice * ECONOMY.SELLBACK_RATIO);

        if (weapon.type === 'item') {
            if (weaponId === 'fuel_can') return; // Fuel is added to the tank on purchase; not resellable
            if ((tank.accessories[weaponId] || 0) <= 0) return;
            tank.accessories[weaponId]--;
        } else {
            const count = tank.inventory[weaponId] || 0;
            if (count <= 0) return; // Nothing to sell (infinite weapons are -1: not sellable)
            tank.inventory[weaponId] = count - 1;
            if (tank.inventory[weaponId] === 0 && tank.currentWeapon === weaponId) {
                tank.currentWeapon = 'baby_missile';
            }
        }

        tank.credits += refund;
        this.economySystem.updatePrice(weaponId, false);
        this.soundManager.playUI();
    }

    public handleSetWeapon(state: GameState, id: string) {
        const tank = state.tanks[state.currentPlayerIndex];
        if (!tank) return;
        // Verify
        if (tank.inventory[id] !== undefined && tank.inventory[id] !== 0) {
            tank.currentWeapon = id;
            this.soundManager.playUI();
        }
    }

    public handleSetShield(state: GameState, id: string) {
        const tank = state.tanks[state.currentPlayerIndex];
        if (!tank) return;
        if (tank.activeShield === id) return; // Already running this shield
        if (activateShield(tank, id)) {
            this.soundManager.playUI();
        }
    }

    public applyMarketForces(): void {
        this.economySystem.applyMarketForces();
    }

    public getEconomySystem(): EconomySystem {
        return this.economySystem;
    }
}